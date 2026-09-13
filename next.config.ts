import type { NextConfig } from "next";

// No script-src/style-src policy: the sandboxed srcdoc HTML previews inherit the
// page's CSP, and they must be able to render arbitrary captured markup.
const securityHeaders = [
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
	},
];

const nextConfig: NextConfig = {
	poweredByHeader: false,
	env: {
		PUBLIC_DEPLOYED_URL: process.env.PUBLIC_DEPLOYED_URL,
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
