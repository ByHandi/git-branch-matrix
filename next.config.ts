import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the Docker image needs the self-contained server; `next start` warns on it.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
};

export default nextConfig;
