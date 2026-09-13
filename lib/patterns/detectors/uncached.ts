import type { HAREntry, HARNameValue, ResourceType } from "@/lib/har-types";
import {
	formatBytes,
	getEntryContentSize,
	getEntryTransferSize,
	getHeaderValue,
	safeParseUrl,
} from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import type { PatternDetector } from "../types";
import { isServedFromCache, plural } from "../utils";

const STATIC_TYPES = new Set<ResourceType>(["css", "js", "font", "img", "media", "wasm"]);
const STATIC_EXTENSION = /\.(css|m?js|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|wasm)$/i;

function parseCacheControl(headers: HARNameValue[]): Map<string, string> {
	const directives = new Map<string, string>();
	for (const header of headers) {
		if (header.name.toLowerCase() !== "cache-control") continue;
		for (const part of header.value.split(",")) {
			const [rawName, ...rest] = part.split("=");
			const name = rawName.trim().toLowerCase();
			if (name) {
				directives.set(name, rest.join("=").trim().replace(/^"|"$/g, ""));
			}
		}
	}
	return directives;
}

/**
 * Describes why a static response will be downloaded again on the next visit,
 * or returns null when it has a freshness lifetime or is deliberately
 * revalidated with a validator.
 */
function getCacheProblem(entry: HAREntry, startTime: number): string | null {
	const { headers } = entry.response;
	const directives = parseCacheControl(headers);
	const hasValidator =
		!!getHeaderValue(headers, "etag") || !!getHeaderValue(headers, "last-modified");

	if (directives.has("no-store")) return "Cache-Control: no-store";

	const noCache =
		directives.has("no-cache") ||
		(directives.size === 0 && /no-cache/i.test(getHeaderValue(headers, "pragma") ?? ""));
	const maxAgeValue = directives.get("max-age");
	const maxAge = maxAgeValue ? Number(maxAgeValue) : NaN;

	let staleReason: string | null = null;
	if (noCache) {
		staleReason = "Cache-Control: no-cache";
	} else if (directives.has("immutable") || maxAge > 0) {
		return null;
	} else if (Number.isFinite(maxAge)) {
		staleReason = `Cache-Control: max-age=${maxAgeValue}`;
	} else {
		const expires = getHeaderValue(headers, "expires");
		if (expires === undefined) {
			return getHeaderValue(headers, "last-modified")
				? "No Cache-Control or Expires (heuristic caching only)"
				: "No cache headers";
		}
		const expiresAt = Date.parse(expires);
		const responseDate = Date.parse(getHeaderValue(headers, "date") ?? "");
		const now = Number.isFinite(responseDate) ? responseDate : startTime;
		if (Number.isFinite(expiresAt) && (!Number.isFinite(now) || expiresAt > now)) {
			return null;
		}
		// An invalid or past Expires date means "already expired".
		staleReason = `Expires: ${expires}`;
	}

	// Stale responses with a validator are revalidated cheaply (304), which is
	// a deliberate policy rather than a missing cache header.
	return hasValidator ? null : `${staleReason} without ETag or Last-Modified`;
}

export const detectUncachedResources: PatternDetector = ({ entries, startTimes }) => {
	const uncached: Array<{ index: number; size: number; problem: string }> = [];

	entries.forEach((entry, index) => {
		const { status } = entry.response;
		if (entry.request.method !== "GET" || (status !== 200 && status !== 203)) {
			return;
		}
		if (isServedFromCache(entry)) return;
		const url = safeParseUrl(entry.request.url);
		if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
			return;
		}
		if (!STATIC_TYPES.has(getResourceType(entry)) && !STATIC_EXTENSION.test(url.pathname)) {
			return;
		}

		const problem = getCacheProblem(entry, startTimes[index]);
		if (!problem) return;
		const size = getEntryTransferSize(entry) || getEntryContentSize(entry);
		uncached.push({ index, size, problem });
	});
	if (uncached.length === 0) return null;

	uncached.sort((a, b) => b.size - a.size || a.index - b.index);
	const totalSize = uncached.reduce((sum, item) => sum + item.size, 0);

	return {
		type: "uncached",
		severity: "medium",
		title: "Missing Cache Headers",
		description: `${plural(uncached.length, "static resource")} without an effective cache lifetime`,
		recommendation:
			"Serve static assets with Cache-Control: max-age (add immutable for fingerprinted file names) so repeat visits load them from cache",
		impact:
			totalSize > 0
				? `${formatBytes(totalSize)} downloaded again on repeat visits`
				: "These resources are downloaded again on repeat visits",
		affected: uncached.map(({ index, size, problem }) => ({
			index,
			details: size > 0 ? `${problem} · ${formatBytes(size)}` : problem,
		})),
	};
};
