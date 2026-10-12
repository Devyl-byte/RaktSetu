import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext normally emits a Cloudflare Worker plus client assets. Vercel
  // cannot execute that worker or provide its D1 binding, so its deployment
  // is a static export. API requests are forwarded to the hosted Cloudflare
  // demonstration backend by vercel.json.
  ...(process.env.VERCEL === "1" ? { output: "export" as const } : {}),
};

export default nextConfig;
