import type { Metadata, Viewport } from "next";
import {
	SITE_NAME,
	SITE_TITLE,
	SITE_DESCRIPTION,
	SITE_URL,
	CREATOR_NAME,
	CREATOR_GITHUB_URL,
} from "./constants";

const GOOGLE_SITE_VERIFICATION = "fsvwCxiT-jgIJrC7_to1MJ3P48M_ihUAwd7WDBeCVMw";

/**
 * Root metadata; relative URLs resolve against `metadataBase` (SITE_URL).
 * Icons, the web manifest and the Open Graph / Twitter images come from the
 * file conventions in app/ (icon.svg, manifest.ts, opengraph-image.tsx, ...).
 */
export function buildMetadata(): Metadata {
	return {
		metadataBase: new URL(SITE_URL),
		title: {
			default: SITE_TITLE,
			template: `%s | ${SITE_NAME}`,
		},
		description: SITE_DESCRIPTION,
		applicationName: SITE_NAME,
		authors: [{ name: CREATOR_NAME, url: CREATOR_GITHUB_URL }],
		creator: CREATOR_NAME,
		category: "technology",
		alternates: {
			canonical: "/",
		},
		robots: {
			index: true,
			follow: true,
			googleBot: {
				"max-image-preview": "large",
			},
		},
		openGraph: {
			type: "website",
			url: "/",
			siteName: SITE_NAME,
			title: SITE_TITLE,
			description: SITE_DESCRIPTION,
			locale: "en_US",
		},
		twitter: {
			card: "summary_large_image",
			title: SITE_TITLE,
			description: SITE_DESCRIPTION,
		},
		// Request data is full of numbers and addresses; don't let iOS turn them into links.
		formatDetection: {
			telephone: false,
			email: false,
			address: false,
		},
		verification: {
			google: GOOGLE_SITE_VERIFICATION,
		},
	};
}

/** Matches the light and dark `--background` tokens in globals.css. */
export const THEME_COLORS = {
	light: "#fbfcfd",
	dark: "#090c11",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
		{ media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
	],
	colorScheme: "light dark",
};
