import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl =
		process.env.PUBLIC_DEPLOYED_URL || "https://har-explorer.vercel.app";
	const canonicalUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

	return [
		{
			url: canonicalUrl,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
	];
}
