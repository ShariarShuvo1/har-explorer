import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const baseUrl =
		process.env.PUBLIC_DEPLOYED_URL || "https://har-explorer.vercel.app";
	const canonicalUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/api/", "/_next/", "/static/"],
			},
			{
				userAgent: "Googlebot",
				allow: "/",
			},
			{
				userAgent: "Bingbot",
				allow: "/",
			},
			{
				userAgent: "Slurp",
				allow: "/",
			},
			{
				userAgent: "DuckDuckBot",
				allow: "/",
			},
			{
				userAgent: "Baiduspider",
				allow: "/",
			},
			{
				userAgent: "YandexBot",
				allow: "/",
			},
			{
				userAgent: "Sogou",
				allow: "/",
			},
			{
				userAgent: "Exabot",
				allow: "/",
			},
			{
				userAgent: "MJ12bot",
				allow: "/",
			},
			{
				userAgent: "AhrefsBot",
				allow: "/",
			},
			{
				userAgent: "SemrushBot",
				allow: "/",
			},
		],
		sitemap: `${canonicalUrl}/sitemap.xml`,
		host: canonicalUrl,
	};
}
