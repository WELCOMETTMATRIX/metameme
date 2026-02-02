"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { RGBELoader } from "three/addons/loaders/RGBELoader.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

export default function MetaverseViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState("Initializing...")
  const [error, setError] = useState<string | null>(null)

  const initScene = useCallback(async () => {
    if (!containerRef.current) return

    try {
      // Scene setup
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1a1a2e)
      sceneRef.current = scene

      // Camera setup
      const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
      )
      camera.position.set(0, 5, 15)
      cameraRef.current = camera

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      containerRef.current.appendChild(renderer.domElement)
      rendererRef.current = renderer

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 3
      controls.maxDistance = 100
      controls.maxPolarAngle = Math.PI / 2.1
      controls.target.set(0, 2, 0)
      controlsRef.current = controls

      // Lighting
      setLoadingStatus("Setting up lighting...")
      
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
      scene.add(ambientLight)

      const sunLight = new THREE.DirectionalLight(0xffffff, 2)
      sunLight.position.set(50, 100, 50)
      sunLight.castShadow = true
      sunLight.shadow.mapSize.width = 2048
      sunLight.shadow.mapSize.height = 2048
      sunLight.shadow.camera.near = 0.5
      sunLight.shadow.camera.far = 500
      sunLight.shadow.camera.left = -50
      sunLight.shadow.camera.right = 50
      sunLight.shadow.camera.top = 50
      sunLight.shadow.camera.bottom = -50
      scene.add(sunLight)

      // Create ground plane
      setLoadingStatus("Creating environment...")
      
      const groundGeometry = new THREE.CircleGeometry(100, 64)
      const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d2d44,
        roughness: 0.9,
        metalness: 0.1,
      })
      const ground = new THREE.Mesh(groundGeometry, groundMaterial)
      ground.rotation.x = -Math.PI / 2
      ground.receiveShadow = true
      scene.add(ground)

      // Add grid
      const gridHelper = new THREE.GridHelper(100, 50, 0x4a4a6a, 0x3a3a5a)
      gridHelper.position.y = 0.01
      scene.add(gridHelper)

      // Create sample environment
      createSampleEnvironment(scene)

      // Try to load HDR environment
      setLoadingStatus("Loading environment map...")
      try {
        const rgbeLoader = new RGBELoader()
        const hdrTexture = await new Promise<THREE.Texture>((resolve, reject) => {
          rgbeLoader.load(
            "/Clear_08_4pm_LDR.hdr",
            (texture) => resolve(texture),
            undefined,
            () => reject(new Error("HDR not found"))
          )
        })
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping
        scene.environment = hdrTexture
      } catch {
        // Use basic environment if HDR not available
        const pmremGenerator = new THREE.PMREMGenerator(renderer)
        const envScene = new THREE.Scene()
        envScene.background = new THREE.Color(0x87ceeb)
        scene.environment = pmremGenerator.fromScene(envScene).texture
        pmremGenerator.dispose()
      }

      // Try to load base environment model
      setLoadingStatus("Loading 3D environment...")
      try {
        const gltfLoader = new GLTFLoader()
        const gltf = await new Promise<any>((resolve, reject) => {
          gltfLoader.load(
            "/base-environment.glb",
            (gltf) => resolve(gltf),
            undefined,
            () => reject(new Error("Model not found"))
          )
        })
        gltf.scene.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        scene.add(gltf.scene)
      } catch {
        // Model not available, use sample environment
        console.log("Base environment not found, using sample environment")
      }

      setIsLoading(false)

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      // Handle resize
      const handleResize = () => {
        if (!containerRef.current) return
        const width = window.innerWidth
        const height = window.innerHeight
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
      }
      window.addEventListener("resize", handleResize)

      return () => {
        window.removeEventListener("resize", handleResize)
        renderer.dispose()
        containerRef.current?.removeChild(renderer.domElement)
      }
    } catch (err) {
      console.error("Failed to initialize scene:", err)
      setError(err instanceof Error ? err.message : "Failed to initialize 3D scene")
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    initScene()
    return () => {
      rendererRef.current?.dispose()
    }
  }, [initScene])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-foreground text-xl font-medium">MetaMeme Metaverse</p>
            <p className="text-foreground/60 text-sm">{loadingStatus}</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-50">
          <div className="flex flex-col items-center gap-4 p-8 bg-destructive/10 rounded-lg border border-destructive">
            <p className="text-destructive text-xl font-medium">Error</p>
            <p className="text-foreground/80 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* UI Overlay */}
      {!isLoading && !error && (
        <>
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-10">
            <div className="flex items-center justify-between">
              <div className="pointer-events-auto">
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">MetaMeme</h1>
                <p className="text-white/70 text-sm drop-shadow-md">Virtual World Explorer</p>
              </div>
            </div>
          </div>

          {/* Controls hint */}
          <div className="absolute bottom-4 left-4 pointer-events-none z-10">
            <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white/80 text-xs space-y-1">
              <p>Drag to rotate view</p>
              <p>Scroll to zoom</p>
              <p>Right-click drag to pan</p>
            </div>
          </div>

          {/* Info panel */}
          <div className="absolute bottom-4 right-4 pointer-events-none z-10">
            <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white/80 text-xs">
              <p>Metaverse Viewer Mode</p>
              <p className="text-white/50 mt-1">Connect WebSocket for multiplayer</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function createSampleEnvironment(scene: THREE.Scene) {
  // Create some sample buildings/structures
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    roughness: 0.7,
    metalness: 0.3,
  })

  // Central structure
  const centralGeometry = new THREE.CylinderGeometry(3, 4, 8, 8)
  const centralMesh = new THREE.Mesh(centralGeometry, buildingMaterial)
  centralMesh.position.set(0, 4, 0)
  centralMesh.castShadow = true
  centralMesh.receiveShadow = true
  scene.add(centralMesh)

  // Add a glowing top
  const glowGeometry = new THREE.SphereGeometry(1.5, 32, 32)
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    emissive: 0x6366f1,
    emissiveIntensity: 0.5,
  })
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial)
  glowMesh.position.set(0, 9, 0)
  scene.add(glowMesh)

  // Surrounding pillars
  const pillarGeometry = new THREE.BoxGeometry(1, 6, 1)
  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a6270,
    roughness: 0.8,
    metalness: 0.2,
  })

  const pillarCount = 8
  const radius = 12
  for (let i = 0; i < pillarCount; i++) {
    const angle = (i / pillarCount) * Math.PI * 2
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial)
    pillar.position.set(
      Math.cos(angle) * radius,
      3,
      Math.sin(angle) * radius
    )
    pillar.castShadow = true
    pillar.receiveShadow = true
    scene.add(pillar)

    // Add light on top of each pillar
    const lightGeometry = new THREE.SphereGeometry(0.3, 16, 16)
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.8,
    })
    const lightMesh = new THREE.Mesh(lightGeometry, lightMaterial)
    lightMesh.position.set(
      Math.cos(angle) * radius,
      6.5,
      Math.sin(angle) * radius
    )
    scene.add(lightMesh)
  }

  // Add floating platforms
  const platformGeometry = new THREE.BoxGeometry(4, 0.5, 4)
  const platformMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    roughness: 0.5,
    metalness: 0.5,
  })

  const platforms = [
    { x: -15, y: 3, z: -15 },
    { x: 15, y: 5, z: -15 },
    { x: -15, y: 4, z: 15 },
    { x: 15, y: 6, z: 15 },
  ]

  platforms.forEach((pos) => {
    const platform = new THREE.Mesh(platformGeometry, platformMaterial)
    platform.position.set(pos.x, pos.y, pos.z)
    platform.castShadow = true
    platform.receiveShadow = true
    scene.add(platform)
  })

  // Add some trees/vegetation markers
  const treeGeometry = new THREE.ConeGeometry(1.5, 4, 6)
  const treeMaterial = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.9,
  })
  const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2, 6)
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.9,
  })

  const treePositions = [
    { x: -25, z: -20 },
    { x: -30, z: 10 },
    { x: 25, z: -25 },
    { x: 28, z: 20 },
    { x: -20, z: 30 },
    { x: 20, z: 30 },
  ]

  treePositions.forEach((pos) => {
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
    trunk.position.set(pos.x, 1, pos.z)
    trunk.castShadow = true
    trunk.receiveShadow = true
    scene.add(trunk)

    const tree = new THREE.Mesh(treeGeometry, treeMaterial)
    tree.position.set(pos.x, 4, pos.z)
    tree.castShadow = true
    tree.receiveShadow = true
    scene.add(tree)
  })
}
