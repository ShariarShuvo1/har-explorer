import { formatTime, getHeaderValue, nonNegative } from "@/lib/har-parser";
import type { AffectedRequest, PatternDetector } from "../types";
import { plural, resolveUrl } from "../utils";

function isRedirect(status: number): boolean {
	// 304 Not Modified is a cache revalidation, not a redirect.
	return status >= 300 && status < 400 && status !== 304;
}

/** Position of the first value greater than `value` in an ascending array. */
function upperBound(sorted: number[], value: number): number {
	let low = 0;
	let high = sorted.length;
	while (low < high) {
		const mid = (low + high) >> 1;
		if (sorted[mid] <= value) low = mid + 1;
		else high = mid;
	}
	return low;
}

export const detectRedirects: PatternDetector = ({ entries }) => {
	const redirects: number[] = [];
	const targets = new Map<number, string>();
	const redirectsByUrl = new Map<string, number[]>();

	entries.forEach((entry, index) => {
		if (!isRedirect(entry.response.status)) return;
		redirects.push(index);
		const location =
			entry.response.redirectURL || getHeaderValue(entry.response.headers, "location") || "";
		if (location) {
			targets.set(index, resolveUrl(location, entry.request.url));
		}
		const url = resolveUrl(entry.request.url, entry.request.url);
		const list = redirectsByUrl.get(url);
		if (list) list.push(index);
		else redirectsByUrl.set(url, [index]);
	});
	if (redirects.length === 0) return null;

	// The next hop of a redirect is the first later redirect response for its
	// target (HAR entries are ordered by start time).
	const next = new Map<number, number>();
	const hasPrevious = new Set<number>();
	for (const index of redirects) {
		const target = targets.get(index);
		const candidates = target ? redirectsByUrl.get(target) : undefined;
		if (!candidates) continue;
		const hop = candidates[upperBound(candidates, index)];
		if (hop !== undefined && !hasPrevious.has(hop)) {
			next.set(index, hop);
			hasPrevious.add(hop);
		}
	}

	// Hops always point forward, so every chain starts at a redirect nothing
	// else led to.
	const chains: number[][] = [];
	for (const index of redirects) {
		if (hasPrevious.has(index)) continue;
		const chain: number[] = [];
		for (let current: number | undefined = index; current !== undefined;) {
			chain.push(current);
			current = next.get(current);
		}
		chains.push(chain);
	}

	chains.sort((a, b) => b.length - a.length || a[0] - b[0]);
	const longChains = chains.filter((chain) => chain.length > 1).length;

	const affected: AffectedRequest[] = [];
	let totalTime = 0;
	for (const chain of chains) {
		chain.forEach((index, position) => {
			const entry = entries[index];
			totalTime += nonNegative(entry.time);
			const hop = chain.length > 1 ? ` (hop ${position + 1} of ${chain.length})` : "";
			affected.push({
				index,
				details: `${entry.response.status} → ${targets.get(index) ?? "unknown location"}${hop}`,
			});
		});
	}

	return {
		type: "redirect",
		severity: longChains > 0 ? "medium" : "low",
		title: "Redirects",
		description:
			`${plural(redirects.length, "request")} redirected` +
			(longChains > 0 ? `, including ${plural(longChains, "chain")} of multiple redirects` : ""),
		recommendation:
			"Link directly to the final URL, and use HSTS for http→https upgrades, to avoid extra round-trips",
		impact: `${formatTime(totalTime)} spent on redirect responses`,
		affected,
	};
};
