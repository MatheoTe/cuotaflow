import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(process.cwd()) },
  // El modo demo siembra la foto del DNI ficticio leyéndola del disco: que viaje con cada función.
  outputFileTracingIncludes: { '/*': ['./public/demo/dni-ficticio.png'] },
}

export default nextConfig
