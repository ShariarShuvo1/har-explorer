import { HAREntry } from "@/lib/stores/har-store";
import { Pattern } from "../types";

export function detectMixedContent(entries: HAREntry[]): Pattern | null {
	const pageUrl = entries[0]?.request.url;
	if (!pageUrl) return null;

	let isHttpsPage = false;
	try {
		isHttpsPage = new URL(pageUrl).protocol === "https:";
	} catch {
		return null;
	}

	if (!isHttpsPage) return null;

	const mixedContent = entries
		.map((entry, index) => {
			try {
				const url = new URL(entry.request.url);
				if (url.protocol === "http:") {
					return {
						index,
						url: entry.request.url,
						type: entry.response.content.mimeType || "unknown",
					};
				}
			} catch {}
			return null;
		})
		.filter(Boolean) as Array<{
		index: number;
		url: string;
		type: string;
	}>;

	if (mixedContent.length === 0) return null;

	const hasScriptOrStyle = mixedContent.some((mc) =>
		/(script|css|javascript|stylesheet)/i.test(mc.type)
	);

	return {
		type: "mixed-content",
		severity: hasScriptOrStyle ? "high" : "medium",
		title: "Mixed Content Detected",
		description: `${mixedContent.length} HTTP resources loaded on HTTPS page`,
		count: mixedContent.length,
		examples: mixedContent.slice(0, 5).map((mc) => ({
			url: mc.url,
			index: mc.index,
			details: mc.type,
		})),
		recommendation:
			"Update all resource URLs to use HTTPS to prevent security warnings and potential blocking",
		impact: hasScriptOrStyle
			? "Critical resources may be blocked by browsers"
			: "Browser warnings and degraded security",
		allAffectedIndices: mixedContent.map((mc) => mc.index),
	};
}
