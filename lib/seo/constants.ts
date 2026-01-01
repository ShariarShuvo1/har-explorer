export const CREATOR_NAME = "Shariar Islam Shuvo";

export const REPOSITORY_URL = "https://github.com/ShariarShuvo1/har-explorer";
export const SITE_NAME = "HAR Explorer";

export const SITE_TITLE = "HAR Explorer - HTTP Archive File Analyzer & Editor";

export const SITE_DESCRIPTION =
	"Free online HAR file viewer, analyzer and editor. Analyze HTTP requests, debug network performance, detect patterns, view detailed timings, and export filtered data. No data leaves your browser.";

export const KEYWORDS = [
	"HAR file viewer",
	"HAR analyzer",
	"HAR editor",
	"HTTP Archive viewer",
	"HTTP Archive analyzer",
	"network traffic analyzer",
	"HTTP request analyzer",
	"web performance analyzer",
	"network debugging tool",
	"HAR file reader",
	"HAR file parser",
	"API request viewer",
	"network waterfall chart",
	"request timing analysis",
	"HTTP response viewer",
	"web developer tools",
	"network performance debugging",
	"browser network analysis",
	"HAR export tool",
	"network traffic inspection",
	"HTTP headers viewer",
	"request response viewer",
	"API debugging tool",
	"network latency analyzer",
	"waterfall diagram",
	"HTTP timing analysis",
	"network request inspector",
	"web traffic analyzer",
	"HAR file converter",
	"network performance tool",
	"request timeline viewer",
	"HTTP status code analyzer",
	"network bandwidth analyzer",
	"third party request analyzer",
	"cookie analyzer",
	"SSL certificate viewer",
	"cache analysis tool",
	"duplicate request detector",
	"mixed content detector",
	"performance pattern analyzer",
	"free HAR viewer",
	"online HAR analyzer",
	"browser HAR tool",
	"client-side HAR viewer",
	"privacy-focused HAR tool",
];

export const FEATURES = [
	{
		name: "HAR File Viewing",
		description:
			"View and browse HTTP Archive files with detailed request and response information",
	},
	{
		name: "Network Timeline",
		description:
			"Interactive waterfall chart showing request timings and dependencies",
	},
	{
		name: "Analytics Dashboard",
		description:
			"Comprehensive analytics including bandwidth timeline, protocol analysis, and third-party impact",
	},
	{
		name: "Pattern Detection",
		description:
			"Automatic detection of performance issues like duplicate requests, large cookies, and mixed content",
	},
	{
		name: "Statistics View",
		description:
			"Detailed statistics including domain analysis, connection reuse, and transfer efficiency",
	},
	{
		name: "Entry Details",
		description:
			"Deep inspection of individual requests with headers, timings, security, and cache information",
	},
	{
		name: "Export Functionality",
		description:
			"Export filtered data to Markdown, plain text, or HAR format",
	},
	{
		name: "Bookmarking",
		description: "Bookmark important requests for quick access and export",
	},
	{
		name: "Advanced Filtering",
		description:
			"Filter by resource type, status code, size, duration, domain, headers, and HTTP version",
	},
	{
		name: "Keyboard Shortcuts",
		description:
			"Efficient navigation with comprehensive keyboard shortcuts",
	},
	{
		name: "Dark Mode",
		description:
			"Full dark and light theme support with system preference detection",
	},
	{
		name: "Privacy First",
		description:
			"All processing happens client-side. No data is uploaded to any server",
	},
];

export const STRUCTURED_DATA = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: SITE_NAME,
	description: SITE_DESCRIPTION,
	creator: {
		"@type": "Person",
		name: CREATOR_NAME,
	},
	publisher: {
		"@type": "Person",
		name: CREATOR_NAME,
	},
	url: REPOSITORY_URL,
	codeRepository: REPOSITORY_URL,
	applicationCategory: "DeveloperApplication",
	operatingSystem: "Any",
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD",
	},
	featureList: [
		"HAR file viewing and analysis",
		"Network waterfall timeline",
		"Performance analytics dashboard",
		"Pattern detection for performance issues",
		"Request statistics and insights",
		"Advanced filtering and search",
		"Export to Markdown, text, or HAR",
		"Bookmarking system",
		"Keyboard shortcuts",
		"Dark and light themes",
		"Privacy-focused client-side processing",
	],
	browserRequirements: "Requires a modern browser with JavaScript enabled",
	softwareVersion: "1.0.0",
	releaseNotes: "Initial release with full HAR analysis capabilities",
};

export const FAQ_STRUCTURED_DATA = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: [
		{
			"@type": "Question",
			name: "What is a HAR file?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "A HAR (HTTP Archive) file is a JSON-formatted file that records all network requests made by a web browser. It contains detailed information about each HTTP request and response, including URLs, headers, timing data, and response content.",
			},
		},
		{
			"@type": "Question",
			name: "How do I create a HAR file?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "In Chrome: Open DevTools (F12), go to Network tab, perform the actions you want to record, right-click on the requests list, and select 'Save all as HAR with content'. In Firefox: Open DevTools, go to Network tab, right-click and select 'Save All As HAR'.",
			},
		},
		{
			"@type": "Question",
			name: "Is my data secure with HAR Explorer?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes, HAR Explorer processes all data entirely in your browser. No data is ever uploaded to any server. Your HAR files remain completely private and secure on your device.",
			},
		},
		{
			"@type": "Question",
			name: "What can I analyze with HAR Explorer?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "HAR Explorer lets you analyze request timings, identify performance bottlenecks, detect duplicate requests, view headers and cookies, analyze third-party impact, check for mixed content issues, and export filtered data for documentation or sharing.",
			},
		},
	],
};
