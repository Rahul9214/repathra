import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_CLERK_KEYLESS_DISABLED: "true",
  },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
