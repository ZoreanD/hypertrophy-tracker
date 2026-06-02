import type { NextConfig } from "next";
// Change the import to this:
// @ts-ignore
import withPWA from "next-pwa";

// Now use it directly as the function
const withPWAConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withPWAConfig(nextConfig);