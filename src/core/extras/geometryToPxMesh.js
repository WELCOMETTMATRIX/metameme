import * as THREE from './three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const cache = new Map() // id -> { id, pmesh, refs }

class PMeshHandle {
  constructor(item) {
    this.value = item.pmesh
    this.item = item
    this.item.refs++
    this.released = false
  }

  release() {
    if (this.released) return
    this.item.refs--
    if (this.item.refs === 0) {
      this.item.pmesh.release()
      cache.delete(this.item.id)
      // console.log('DESTROY', this.item.id)
    }
    this.released = true
    this.value = null
  }
}

export function geometryToPxMesh(world, geometry, convex) {
  // determine a bake scale to prevent extremely large meshes from causing
  // triangle-size warnings in PhysX cooking. We scale the vertex positions
  // down for cooking and compensate by applying the inverse scale when
  // creating the runtime mesh geometry.
  const bbox = geometry.boundingBox || (() => { geometry.computeBoundingBox(); return geometry.boundingBox })()
  const size = new THREE.Vector3()
  bbox.getSize(size)
  const maxExtent = Math.max(size.x, size.y, size.z)
  const TARGET_EXTENT = 1.0
  const bakeScale = maxExtent > TARGET_EXTENT * 5 ? TARGET_EXTENT / maxExtent : 1.0
  if (bakeScale !== 1.0) {
    console.warn(`[geometryToPxMesh] auto-scaling large mesh ${geometry.uuid} by factor ${bakeScale.toFixed(4)} for PhysX cooking`) // eslint-disable-line no-console
  }

  const id = `${geometry.uuid}_${convex ? 'convex' : 'triangles'}_bs${bakeScale}`

  // check and return cached if already cooked
  let item = cache.get(id)
  if (item) {
    return new PMeshHandle(item)
  }

  const cookingParams = world.physics.cookingParams

  // geometry = BufferGeometryUtils.mergeVertices(geometry)
  // geometry = geometry.toNonIndexed()
  // geometry.computeVertexNormals()

  // console.log('geometry', geometry)
  // console.log('convex', convex)

  let position = geometry.attributes.position
  const index = geometry.index

  if (position.isInterleavedBufferAttribute) {
    // deinterleave!
    position = BufferGeometryUtils.deinterleaveAttribute(position)
    position = new THREE.BufferAttribute(new Float32Array(position.array), position.itemSize, false)
  }

  // console.log('position', position)
  // console.log('index', index)

  // Apply bakeScale to positions sent to PhysX
  const positions = position.array
  const scaledPositions = bakeScale === 1.0 ? positions : new Float32Array(positions.length)
  if (bakeScale !== 1.0) {
    for (let i = 0; i < positions.length; i++) scaledPositions[i] = positions[i] * bakeScale
  }
  const floatBytes = scaledPositions.length * scaledPositions.BYTES_PER_ELEMENT
  const pointsPtr = PHYSX._webidl_malloc(floatBytes)
  PHYSX.HEAPF32.set(scaledPositions, pointsPtr >> 2)

  let desc
  let pmesh

  if (convex) {
    desc = new PHYSX.PxConvexMeshDesc()
    desc.points.count = positions.length / 3
    desc.points.stride = 12 // size of PhysX.PxVec3 in bytes
    desc.points.data = pointsPtr
    desc.flags.raise(PHYSX.PxConvexFlagEnum.eCOMPUTE_CONVEX) // eCHECK_ZERO_AREA_TRIANGLES
    pmesh = PHYSX.CreateConvexMesh(cookingParams, desc)
  } else {
    desc = new PHYSX.PxTriangleMeshDesc()

    desc.points.count = positions.length / 3
    desc.points.stride = 12
    desc.points.data = pointsPtr

    // console.log('points.count', desc.points.count)
    // console.log('points.stride', desc.points.stride)

    let indices = index.array // Uint16Array or Uint32Array

    // for some reason i'm seeing Uint8Arrays in some glbs, specifically the vipe rooms.
    // so we just coerce these up to u16
    if (indices instanceof Uint8Array) {
      indices = new Uint16Array(index.array.length)
      for (let i = 0; i < index.array.length; i++) {
        indices[i] = index.array[i]
      }
    }

    const indexBytes = indices.length * indices.BYTES_PER_ELEMENT
    const indexPtr = PHYSX._webidl_malloc(indexBytes)
    if (indices instanceof Uint16Array) {
      PHYSX.HEAPU16.set(indices, indexPtr >> 1)
      desc.triangles.stride = 6 // 3 × 2 bytes per triangle
      desc.flags.raise(PHYSX.PxTriangleMeshFlagEnum.e16_BIT_INDICES)
    } else {
      // note: this is here for brevity but no longer used as we force everything to 16 bit
      PHYSX.HEAPU32.set(indices, indexPtr >> 2)
      desc.triangles.stride = 12 // 3 × 4 bytes per triangle
    }
    desc.triangles.count = indices.length / 3
    desc.triangles.data = indexPtr

    // console.log('triangles.count', desc.triangles.count)
    // console.log('triangles.stride', desc.triangles.stride)

    // if (!desc.isValid()) {
    //   throw new Error('Invalid mesh description')
    // }

    try {
      pmesh = PHYSX.CreateTriangleMesh(cookingParams, desc)
    } catch (err) {
      console.error('geometryToPxMesh failed...')
      console.error(err)
    } finally {
      PHYSX._webidl_free(indexPtr)
    }
  }

  PHYSX._webidl_free(pointsPtr)
  PHYSX.destroy(desc)

  if (!pmesh) return null

  item = { id, pmesh, refs: 0, bakeScale }
  cache.set(id, item)
  return new PMeshHandle(item)
}
