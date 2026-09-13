export const CREATOR_NAME = "Shariar Islam Shuvo";
export const CREATOR_GITHUB_URL = "https://github.com/ShariarShuvo1";

export const REPOSITORY_URL = "https://github.com/ShariarShuvo1/har-explorer";
export const SITE_NAME = "HAR Explorer";

export const GA_MEASUREMENT_ID = "G-RY149KJ0QL";

const DEFAULT_SITE_URL = "https://har-explorer.vercel.app";

/**
 * Canonical origin without a trailing slash. `PUBLIC_DEPLOYED_URL` may be set
 * with or without a protocol; anything unparsable falls back to the default.
 */
function resolveSiteUrl(value: string | undefined): string {
	const trimmed = value?.trim();
	if (!trimmed) return DEFAULT_SITE_URL;
	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	try {
		const url = new URL(withProtocol);
		return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
	} catch {
		return DEFAULT_SITE_URL;
	}
}

export const SITE_URL = resolveSiteUrl(process.env.PUBLIC_DEPLOYED_URL);

export const SITE_TITLE = "HAR Explorer – Free Online HAR File Viewer & Analyzer";

/** Kept under ~160 characters so search results show it in full. */
export const SITE_DESCRIPTION =
	"View and analyze HAR files privately in your browser. Waterfall timeline, performance insights, issue detection, HAR comparison and OpenAPI export.";

export const SITE_TAGLINE =
	"Inspect, analyze, compare and export HAR files, entirely in your browser.";

const FEATURE_LIST = [
	"Request list with waterfall timeline",
	"Request details: headers, payload, response, timing, cache and security",
	"Request editing with undo",
	"Performance analytics",
	"Automatic issue and pattern detection",
	"Connection, priority and server statistics",
	"Compare two HAR files",
	"Export to Markdown, plain text, OpenAPI 3.0 or HAR",
	"Copy requests as cURL, fetch or PowerShell",
	"Bookmarks, filters and command palette",
	"Runs locally: files are never uploaded",
];

/** schema.org graph for the home page: the site, the app and its author. */
export const STRUCTURED_DATA = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "WebSite",
			"@id": `${SITE_URL}/#website`,
			url: `${SITE_URL}/`,
			name: SITE_NAME,
			description: SITE_DESCRIPTION,
			inLanguage: "en",
			publisher: { "@id": `${SITE_URL}/#author` },
		},
		{
			"@type": "WebApplication",
			"@id": `${SITE_URL}/#app`,
			name: SITE_NAME,
			url: `${SITE_URL}/`,
			description: SITE_DESCRIPTION,
			image: `${SITE_URL}/opengraph-image`,
			applicationCategory: "DeveloperApplication",
			applicationSubCategory: "Network analysis",
			operatingSystem: "Any",
			browserRequirements: "Requires JavaScript and a modern web browser",
			isAccessibleForFree: true,
			offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
			featureList: FEATURE_LIST,
			author: { "@id": `${SITE_URL}/#author` },
			sameAs: [REPOSITORY_URL],
		},
		{
			"@type": "Person",
			"@id": `${SITE_URL}/#author`,
			name: CREATOR_NAME,
			url: CREATOR_GITHUB_URL,
		},
	],
};
