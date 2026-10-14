import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  distDir: process.env.EVFLOW_QA === "true" ? ".next-qa" : process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  reactStrictMode: true,
  transpilePackages: ["@evflow/ui-react", "@evflow/design-tokens", "@evflow/contracts"],
  poweredByHeader: false,
  webpack(config) {
    config.resolve.alias["@evflow/contracts"] = resolve(
      __dirname,
      "../../packages/contracts/src/index.ts",
    );
    return config;
  },
};

export default nextConfig;
