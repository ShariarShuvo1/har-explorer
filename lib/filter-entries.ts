import type { HAREntry, ResourceType } from "./har-types";
import type { AdvancedFilters, Bookmark, GroupBy, SortBy, TimeRange } from "./stores/har-store";
import {
	getBaseMimeType,
	getEntryContentSize,
	getEntryStartTime,
	getEntryTransferSize,
	safeParseUrl,
} from "./har-parser";
import { getResourceType } from "./resource-type";

export interface EntryFilterState {
	entries: HAREntry[];
	searchText: string;
	resourceTypeFilter: ResourceType;
	advancedFilters: AdvancedFilters;
	bookmarks: Map<number, Bookmark>;
	showBookmarksOnly: boolean;
	/** Only keep requests overlapping this window (ms from the first request). */
	timeRange?: TimeRange | null;
}

/** Earliest valid start time across entries (ms epoch), or 0 when none is valid. */
export function getCaptureStart(entries: HAREntry[]): number {
	let base = Infinity;
	for (const entry of entries) {
		const start = getEntryStartTime(entry);
		if (start > 0 && start < base) base = start;
	}
	return Number.isFinite(base) ? base : 0;
}

export function countActiveAdvancedFilters(filters: AdvancedFilters): number {
	return (
		(filters.statusCodes.length > 0 ? 1 : 0) +
		(filters.statusRanges.length > 0 ? 1 : 0) +
		(filters.methodFilters.length > 0 ? 1 : 0) +
		(filters.httpVersions.length > 0 ? 1 : 0) +
		(filters.sizeMin !== null || filters.sizeMax !== null ? 1 : 0) +
		(filters.durationMin !== null || filters.durationMax !== null ? 1 : 0) +
		(filters.domainPattern.trim() ? 1 : 0) +
		(filters.pathPattern.trim() ? 1 : 0) +
		(filters.headerMatches.some((h) => h.name.trim()) ? 1 : 0)
	);
}

/**
 * Matches `value` against a user pattern. Patterns wrapped in slashes
 * (`/^\/api\//`) or containing regex anchors are treated as regular
 * expressions; everything else is a case-insensitive substring match. An
 * invalid regex falls back to a substring match rather than hiding everything.
 */
export function matchesPattern(value: string, pattern: string): boolean {
	const trimmed = pattern.trim();
	if (!trimmed) return true;

	const slashMatch = /^\/(.+)\/([a-z]*)$/i.exec(trimmed);
	const looksLikeRegex = /^\^|\$$|\.\*|\\[dwsb]/.test(trimmed);
	if (slashMatch || looksLikeRegex) {
		try {
			const regex = slashMatch
				? new RegExp(
						slashMatch[1],
						slashMatch[2].includes("i") ? slashMatch[2] : slashMatch[2] + "i"
					)
				: new RegExp(trimmed, "i");
			return regex.test(value);
		} catch {
			// fall through to substring matching
		}
	}
	return value.toLowerCase().includes(trimmed.toLowerCase());
}

function matchesHeader(entry: HAREntry, match: { name: string; value: string }): boolean {
	const name = match.name.trim().toLowerCase();
	if (!name) return true;
	const needle = match.value.trim().toLowerCase();
	const headers = [...entry.request.headers, ...entry.response.headers];
	return headers.some(
		(header) =>
			header.name.toLowerCase() === name && (!needle || header.value.toLowerCase().includes(needle))
	);
}

/** Normalizes "HTTP/2.0", "h2" and "http/2" to the same key. */
export function normalizeHttpVersion(version: string): string {
	const lower = version.trim().toLowerCase();
	if (!lower || lower === "unknown") return "unknown";
	if (lower === "h2" || lower === "http/2" || lower === "http/2.0") {
		return "HTTP/2";
	}
	if (lower === "h3" || lower.startsWith("http/3")) return "HTTP/3";
	if (lower === "http/1.1") return "HTTP/1.1";
	if (lower === "http/1.0") return "HTTP/1.0";
	return version.trim().toUpperCase();
}

export function getEntryHttpVersion(entry: HAREntry): string {
	return normalizeHttpVersion(entry.response.httpVersion || entry.request.httpVersion);
}

function matchesSearch(entry: HAREntry, search: string): boolean {
	return (
		entry.request.url.toLowerCase().includes(search) ||
		entry.request.method.toLowerCase().includes(search) ||
		String(entry.response.status).includes(search) ||
		entry.response.statusText.toLowerCase().includes(search) ||
		getBaseMimeType(entry.response.content.mimeType).includes(search)
	);
}

/** Indices (into `entries`) that pass every active filter, in HAR order. */
export function filterEntryIndices(state: EntryFilterState): number[] {
	const {
		entries,
		searchText,
		resourceTypeFilter,
		advancedFilters: filters,
		bookmarks,
		showBookmarksOnly,
		timeRange,
	} = state;
	const captureStart = timeRange ? getCaptureStart(entries) : 0;
	const search = searchText.trim().toLowerCase();
	const statusCodes = new Set(filters.statusCodes);
	const methods = new Set(filters.methodFilters.map((m) => m.toUpperCase()));
	const httpVersions = new Set(filters.httpVersions.map(normalizeHttpVersion));
	const headerMatches = filters.headerMatches.filter((h) => h.name.trim());

	const result: number[] = [];
	entries.forEach((entry, index) => {
		if (showBookmarksOnly && !bookmarks.has(index)) return;
		if (resourceTypeFilter !== "all" && getResourceType(entry) !== resourceTypeFilter) {
			return;
		}
		if (search && !matchesSearch(entry, search)) return;

		if (timeRange) {
			const start = getEntryStartTime(entry);
			if (start <= 0) return;
			const offset = start - captureStart;
			const end = offset + Math.max(0, entry.time);
			if (end < timeRange.start || offset > timeRange.end) return;
		}

		const status = entry.response.status;
		// Status codes and status ranges are alternatives (e.g. "404 or any 5xx").
		if (statusCodes.size > 0 || filters.statusRanges.length > 0) {
			const matchesCode = statusCodes.has(status);
			const matchesRange = filters.statusRanges.some(
				(range) => status >= range.min && status <= range.max
			);
			if (!matchesCode && !matchesRange) return;
		}

		if (methods.size > 0 && !methods.has(entry.request.method.toUpperCase())) {
			return;
		}
		if (httpVersions.size > 0 && !httpVersions.has(getEntryHttpVersion(entry))) {
			return;
		}

		const size = getEntryContentSize(entry);
		if (filters.sizeMin !== null && size < filters.sizeMin) return;
		if (filters.sizeMax !== null && size > filters.sizeMax) return;
		if (filters.durationMin !== null && entry.time < filters.durationMin) {
			return;
		}
		if (filters.durationMax !== null && entry.time > filters.durationMax) {
			return;
		}

		if (filters.domainPattern.trim() || filters.pathPattern.trim()) {
			const url = safeParseUrl(entry.request.url);
			const hostname = url?.hostname ?? "";
			const pathname = url ? url.pathname : entry.request.url;
			if (!matchesPattern(hostname, filters.domainPattern)) return;
			if (!matchesPattern(pathname, filters.pathPattern)) return;
		}

		if (!headerMatches.every((match) => matchesHeader(entry, match))) {
			return;
		}

		result.push(index);
	});
	return result;
}

export function sortEntryIndices(
	entries: HAREntry[],
	indices: number[],
	sortBy: SortBy,
	sortOrder: "asc" | "desc"
): number[] {
	const direction = sortOrder === "asc" ? 1 : -1;
	const valueOf = (entry: HAREntry): string | number => {
		switch (sortBy) {
			case "started":
				return getEntryStartTime(entry);
			case "time":
				return entry.time;
			// The list shows transferred bytes, so sorting uses the same number.
			case "size":
				return getEntryTransferSize(entry);
			case "status":
				return entry.response.status;
			case "method":
				return entry.request.method;
			case "url":
				return entry.request.url;
		}
	};

	return [...indices].sort((a, b) => {
		const aVal = valueOf(entries[a]);
		const bVal = valueOf(entries[b]);
		const diff =
			typeof aVal === "number" && typeof bVal === "number"
				? aVal - bVal
				: String(aVal).localeCompare(String(bVal));
		// Stable tie-break on original order keeps the list from jumping.
		return diff !== 0 ? diff * direction : a - b;
	});
}

export interface EntryGroup {
	key: string;
	/** Indices in display order. */
	indices: number[];
}

/**
 * Groups already-sorted indices, keeping groups in order of first appearance
 * so the list stays in the chosen sort order within and across groups.
 */
/** Group key used by the request list for an entry. */
export function groupKeyFor(entry: HAREntry, groupBy: GroupBy): string {
	if (groupBy === "domain") return safeParseUrl(entry.request.url)?.hostname || "(no host)";
	if (groupBy === "type") return getResourceType(entry);
	return "";
}

export function groupEntryIndices(
	entries: HAREntry[],
	sorted: number[],
	groupBy: GroupBy
): EntryGroup[] {
	if (groupBy === "none") return [{ key: "", indices: sorted }];
	const groups = new Map<string, number[]>();
	for (const index of sorted) {
		const key = groupKeyFor(entries[index], groupBy);
		let group = groups.get(key);
		if (!group) {
			group = [];
			groups.set(key, group);
		}
		group.push(index);
	}
	return [...groups].map(([key, indices]) => ({ key, indices }));
}
