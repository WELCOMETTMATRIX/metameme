"use client"

import dynamic from "next/dynamic"

const MetaverseViewer = dynamic(() => import("@/components/metaverse-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen w-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-foreground/70 text-lg">Loading Metaverse...</p>
      </div>
    </div>
  ),
})

export default function Home() {
  return <MetaverseViewer />
}
