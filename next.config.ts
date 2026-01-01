import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	env: {
		PUBLIC_DEPLOYED_URL: process.env.PUBLIC_DEPLOYED_URL,
	},
};

export default nextConfig;
