import type { NextConfig } from "next";

// STATIC_EXPORT=1 builds a static site for the Vercel preview (see ../vercel.json).
const nextConfig: NextConfig = process.env.STATIC_EXPORT ? { output: "export" } : {};

export default nextConfig;
