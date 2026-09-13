import type { ResourceType } from "@/lib/har-types";
import { safeParseUrl } from "@/lib/har-parser";
import { RESOURCE_TYPE_LABELS, getResourceType } from "@/lib/resource-type";
import type { PatternContext, PatternDetector } from "../types";
import { plural } from "../utils";

/** "Optionally-blockable" passive content; everything else is blocked. */
const PASSIVE_TYPES = new Set<ResourceType>(["img", "media"]);

function isLoopback(url: URL): boolean {
	const host = url.hostname;
	return (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host === "[::1]" ||
		/^127(\.\d{1,3}){3}$/.test(host)
	);
}

interface PageDocument {
	secure: boolean;
	/** Index of the main document entry, when it is part of the log. */
	index: number | null;
}

/**
 * Finds the main document of every page: the first successful document
 * response (so an http→https redirect in front of it is ignored), falling
 * back to the page title, which Chrome sets to the page URL.
 */
function findPageDocuments({
	entries,
	pages,
	chronological,
}: PatternContext): Map<string, PageDocument> {
	const documents = new Map<string, PageDocument>();
	for (const index of chronological) {
		const entry = entries[index];
		const key = entry.pageref ?? "";
		if (documents.has(key)) continue;
		const { status } = entry.response;
		if (getResourceType(entry) !== "doc" || status < 200 || status >= 300) {
			continue;
		}
		const url = safeParseUrl(entry.request.url);
		if (url) documents.set(key, { secure: url.protocol === "https:", index });
	}
	for (const page of pages) {
		const key = typeof page.id === "string" ? page.id : "";
		if (documents.has(key) || typeof page.title !== "string") continue;
		const url = safeParseUrl(page.title);
		if (url && (url.protocol === "https:" || url.protocol === "http:")) {
			documents.set(key, { secure: url.protocol === "https:", index: null });
		}
	}
	return documents;
}

export const detectMixedContent: PatternDetector = (context) => {
	const { entries, startTimes } = context;
	const documents = findPageDocuments(context);
	if (documents.size === 0) return null;
	const fallback = documents.get("") ?? documents.values().next().value;

	const findings: Array<{ index: number; active: boolean; details: string }> = [];

	entries.forEach((entry, index) => {
		const url = safeParseUrl(entry.request.url);
		if (!url || (url.protocol !== "http:" && url.protocol !== "ws:")) return;
		if (isLoopback(url)) return;

		const page = (entry.pageref !== undefined && documents.get(entry.pageref)) || fallback;
		if (!page?.secure || page.index === index) return;
		// Requests before the main document (e.g. the redirect to it) are not
		// loaded by the secure page.
		if (page.index !== null && startTimes[index] < startTimes[page.index]) {
			return;
		}

		const type = getResourceType(entry);
		const active = !PASSIVE_TYPES.has(type);
		findings.push({
			index,
			active,
			details: `${RESOURCE_TYPE_LABELS[type]} over ${url.protocol.slice(0, -1)}: ${
				active ? "blocked by browsers" : "auto-upgraded or blocked"
			}`,
		});
	});
	if (findings.length === 0) return null;

	const hasActive = findings.some((finding) => finding.active);
	findings.sort((a, b) => Number(b.active) - Number(a.active) || a.index - b.index);

	return {
		type: "mixed-content",
		severity: hasActive ? "high" : "medium",
		title: "Mixed Content",
		description: `${plural(findings.length, "insecure request")} (http:// or ws://) made from an HTTPS page`,
		recommendation:
			"Load every resource over HTTPS (and WebSockets over wss://), or add Content-Security-Policy: upgrade-insecure-requests",
		impact: hasActive
			? "Browsers block active mixed content such as scripts, styles, fetches, frames and WebSockets, which breaks the page"
			: "Browsers upgrade or block insecure images and media and mark the page as not fully secure",
		affected: findings.map(({ index, details }) => ({ index, details })),
	};
};
