import type { Metadata, Viewport } from "next";
import {
	SITE_NAME,
	SITE_TITLE,
	SITE_DESCRIPTION,
	KEYWORDS,
	CREATOR_NAME,
	REPOSITORY_URL,
} from "./constants";

export function generateMetadata(baseUrl: string): Metadata {
	const canonicalUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

	return {
		metadataBase: new URL(canonicalUrl),
		title: {
			default: SITE_TITLE,
			template: `%s | ${SITE_NAME}`,
		},
		description: SITE_DESCRIPTION,
		keywords: KEYWORDS,
		authors: [{ name: CREATOR_NAME }],
		creator: CREATOR_NAME,
		publisher: CREATOR_NAME,
		applicationName: SITE_NAME,
		generator: "Next.js",
		referrer: "origin-when-cross-origin",
		robots: {
			index: true,
			follow: true,
			nocache: false,
			googleBot: {
				index: true,
				follow: true,
				noimageindex: false,
				"max-video-preview": -1,
				"max-image-preview": "large",
				"max-snippet": -1,
			},
		},
		alternates: {
			canonical: canonicalUrl,
		},
		category: "Developer Tools",
		classification: "Web Development Tool",
		other: {
			"revisit-after": "7 days",
			rating: "General",
			"dc.title": SITE_TITLE,
			"dc.description": SITE_DESCRIPTION,
			"dc.creator": CREATOR_NAME,
			"dc.subject":
				"HAR file analysis, HAR to API documentation, HAR to Markdown, HTTP Archive converter, Network debugging, API documentation generator, Response schema analyzer",
			"dc.format": "text/html",
			"dc.language": "en",
			"og:url": canonicalUrl,
			"og:type": "website",
			"og:site_name": SITE_NAME,
			"og:title": SITE_TITLE,
			"og:description": SITE_DESCRIPTION,
			"github:url": REPOSITORY_URL,
		},
	};
}

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	minimumScale: 1,
	maximumScale: 5,
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
	],
	colorScheme: "light dark",
};
