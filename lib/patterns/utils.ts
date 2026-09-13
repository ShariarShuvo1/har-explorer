import type { HAREntry, HARPage } from "@/lib/har-types";
import { nonNegative } from "@/lib/har-parser";
import type { AffectedRequest, PatternContext } from "./types";

export function createPatternContext(entries: HAREntry[], pages: HARPage[]): PatternContext {
	const startTimes = entries.map((entry) => Date.parse(entry.startedDateTime));
	const chronological: number[] = [];
	startTimes.forEach((time, index) => {
		if (Number.isFinite(time)) chronological.push(index);
	});
	chronological.sort((a, b) => startTimes[a] - startTimes[b] || a - b);
	return { entries, pages, startTimes, chronological };
}

export function getEntryEndTime(context: PatternContext, index: number): number {
	return context.startTimes[index] + nonNegative(context.entries[index].time);
}

/** Merges repeated indices (keeping first-seen order) and joins their details. */
export function uniqueAffected(items: AffectedRequest[]): AffectedRequest[] {
	const byIndex = new Map<number, AffectedRequest>();
	for (const item of items) {
		const existing = byIndex.get(item.index);
		if (!existing) {
			byIndex.set(item.index, { ...item });
		} else if (item.details && item.details !== existing.details) {
			existing.details = existing.details ? `${existing.details}; ${item.details}` : item.details;
		}
	}
	return [...byIndex.values()];
}

export function plural(count: number, singular: string, pluralForm?: string) {
	return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

/** Chrome marks responses served from the memory or disk cache with `_fromCache`. */
export function isServedFromCache(entry: HAREntry): boolean {
	const fromCache = (entry as { _fromCache?: unknown })._fromCache;
	return typeof fromCache === "string" && fromCache.length > 0;
}

/** Resolves a possibly relative URL (e.g. a Location header) against a base. */
export function resolveUrl(target: string, base: string): string {
	try {
		return new URL(target, base).href;
	} catch {
		return target;
	}
}

/** Approximate number of bytes of cookie data sent with the request. */
export function getRequestCookieBytes(entry: HAREntry): number {
	let headerBytes = 0;
	for (const header of entry.request.headers) {
		if (header.name.toLowerCase() === "cookie") {
			headerBytes += header.value.length;
		}
	}
	if (headerBytes > 0) return headerBytes;

	const { cookies } = entry.request;
	if (cookies.length === 0) return 0;
	// "name=value" pairs joined with "; ".
	return (
		cookies.reduce((sum, cookie) => sum + cookie.name.length + 1 + cookie.value.length, 0) +
		2 * (cookies.length - 1)
	);
}

export function isApiPath(pathname: string): boolean {
	return /\/(api|graphql|rest|v\d+)(\/|$)/i.test(pathname) || /\.json$/i.test(pathname);
}
