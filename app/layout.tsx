import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "MetaMeme - Virtual World Explorer",
  description: "Explore the MetaMeme metaverse - an immersive 3D virtual world experience",
  keywords: ["metaverse", "virtual world", "3D", "webgl", "three.js", "metameme"],
  authors: [{ name: "MetaMeme" }],
  openGraph: {
    title: "MetaMeme - Virtual World Explorer",
    description: "Explore the MetaMeme metaverse - an immersive 3D virtual world experience",
    type: "website",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a1a2e",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
