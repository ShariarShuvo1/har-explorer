import type { HAREntry, HARNameValue, ResourceType } from "./har-types";
import {
	getBaseMimeType,
	getEntryContentSize,
	getEntryStartTime,
	getEntryTransferSize,
	nonNegative,
	safeParseUrl,
} from "./har-parser";
import { getResourceType } from "./resource-type";

export const DEFAULT_VOLATILE_PARAMS: readonly string[] = [
	"_",
	"v",
	"t",
	"ts",
	"_t",
	"timestamp",
	"cb",
	"cachebuster",
	"cache_buster",
	"rand",
	"random",
	"nonce",
];

/** Response headers that differ on practically every request and would only add noise. */
export const IGNORED_DIFF_HEADERS: ReadonlySet<string> = new Set([
	"date",
	"age",
	"expires",
	"content-length",
	"set-cookie",
	"x-request-id",
	"x-correlation-id",
	"x-trace-id",
	"traceparent",
	"tracestate",
	"x-amzn-requestid",
	"x-amzn-trace-id",
	"x-amz-request-id",
	"x-amz-id-2",
	"x-amz-cf-id",
	"x-amz-cf-pop",
	"cf-ray",
	"x-served-by",
	"x-timer",
	"x-runtime",
	"x-response-time",
	"x-envoy-upstream-service-time",
	"server-timing",
	"report-to",
	"nel",
	"x-cloud-trace-context",
]);

export interface MatchOptions {
	/** Drop cache-busting query parameters (see `volatileParams`) from the match key. */
	ignoreVolatileParams: boolean;
	volatileParams: readonly string[];
	/** Ignore the query string entirely. */
	ignoreQueryString: boolean;
	/**
	 * After exact matching, pair leftover requests whose URLs only differ in
	 * numeric ids, UUIDs, long hex ids or fingerprinted asset names.
	 */
	normalizeDynamicSegments: boolean;
	compareHeaders: boolean;
}

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
	ignoreVolatileParams: true,
	volatileParams: DEFAULT_VOLATILE_PARAMS,
	ignoreQueryString: false,
	normalizeDynamicSegments: true,
	compareHeaders: true,
};

export interface ChangeThresholds {
	/** A matched request is slower/faster when |Δtime| exceeds both of these. */
	timePct: number;
	timeMs: number;
	/** Sizes are considered changed when |Δsize| exceeds both of these. */
	sizePct: number;
	sizeBytes: number;
}

export const DEFAULT_THRESHOLDS: ChangeThresholds = {
	timePct: 20,
	timeMs: 50,
	sizePct: 10,
	sizeBytes: 100,
};

export interface HeaderDiff {
	name: string;
	baseline: string | null;
	comparison: string | null;
}

export interface PairDelta {
	statusChanged: boolean;
	mimeChanged: boolean;
	timeDelta: number;
	/** Relative change in percent; null when the baseline value is zero. */
	timeDeltaPct: number | null;
	transferDelta: number;
	transferDeltaPct: number | null;
	contentDelta: number;
	contentDeltaPct: number | null;
	headerDiffs: HeaderDiff[];
}

export interface MatchedRow {
	kind: "matched";
	id: string;
	baselineIndex: number;
	comparisonIndex: number;
	baseline: HAREntry;
	comparison: HAREntry;
	/** "pattern" when the pair was only found after normalizing dynamic segments. */
	matchedBy: "exact" | "pattern";
	delta: PairDelta;
}

export interface RemovedRow {
	kind: "removed";
	id: string;
	baselineIndex: number;
	baseline: HAREntry;
}

export interface AddedRow {
	kind: "added";
	id: string;
	comparisonIndex: number;
	comparison: HAREntry;
}

export type CompareRow = MatchedRow | RemovedRow | AddedRow;

export interface CompareResult {
	/** Rows in baseline timeline order, with added requests placed next to their neighbours. */
	rows: CompareRow[];
	matched: number;
	matchedByPattern: number;
	added: number;
	removed: number;
}

const NUMERIC_SEGMENT = /^\d+$/;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_ID_SEGMENT = /^[0-9a-f]{16,}$/i;
const TOKEN_SEGMENT = /^[A-Za-z0-9_-]{24,}$/;
const HASHED_ASSET = /^(.+)([.\-_])([A-Za-z0-9]{4,})(\.[A-Za-z0-9]+)$/;

const hasDigitAndLetter = (value: string) => /\d/.test(value) && /[a-z]/i.test(value);

function isFingerprint(value: string): boolean {
	if (!hasDigitAndLetter(value)) return false;
	return /^[0-9a-f]+$/i.test(value) || value.length >= 8;
}

export function normalizeSegment(segment: string): string {
	if (!segment) return segment;
	if (
		NUMERIC_SEGMENT.test(segment) ||
		UUID_SEGMENT.test(segment) ||
		HEX_ID_SEGMENT.test(segment) ||
		(TOKEN_SEGMENT.test(segment) && hasDigitAndLetter(segment))
	) {
		return ":id";
	}
	const asset = HASHED_ASSET.exec(segment);
	if (asset && isFingerprint(asset[3])) {
		return `${asset[1]}${asset[2]}*${asset[4]}`;
	}
	return segment;
}

const volatileSets = new WeakMap<readonly string[], Set<string>>();

function volatileSet(params: readonly string[]): Set<string> {
	let set = volatileSets.get(params);
	if (!set) {
		set = new Set(params.map((p) => p.toLowerCase()));
		volatileSets.set(params, set);
	}
	return set;
}

/** Builds the URL part of a match key. `dynamic` also normalizes ids and fingerprints. */
export function normalizeUrlForMatch(url: string, options: MatchOptions, dynamic = false): string {
	const parsed = safeParseUrl(url);
	let origin = "";
	let path: string;
	let params: Array<[string, string]> = [];

	if (parsed) {
		origin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
		path = parsed.pathname;
		params = Array.from(parsed.searchParams.entries());
	} else {
		const [beforeHash] = url.split("#");
		const queryStart = beforeHash.indexOf("?");
		path = queryStart === -1 ? beforeHash : beforeHash.slice(0, queryStart);
		if (queryStart !== -1) {
			params = Array.from(new URLSearchParams(beforeHash.slice(queryStart + 1)).entries());
		}
	}

	if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
	if (dynamic) path = path.split("/").map(normalizeSegment).join("/");

	if (options.ignoreQueryString || params.length === 0) return origin + path;

	const volatile = options.ignoreVolatileParams ? volatileSet(options.volatileParams) : null;
	const kept = params
		.filter(([name]) => !volatile?.has(name.toLowerCase()))
		.map(([name, value]): [string, string] => [name, dynamic ? normalizeSegment(value) : value])
		.sort(([nameA, valueA], [nameB, valueB]) => {
			const a = `${nameA}=${valueA}`;
			const b = `${nameB}=${valueB}`;
			return a < b ? -1 : a > b ? 1 : 0;
		});
	if (kept.length === 0) return origin + path;

	const query = kept
		.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
		.join("&");
	return `${origin}${path}?${query}`;
}

export function getMatchKey(entry: HAREntry, options: MatchOptions, dynamic = false): string {
	return `${entry.request.method.toUpperCase()} ${normalizeUrlForMatch(entry.request.url, options, dynamic)}`;
}

function percentChange(from: number, to: number): number | null {
	if (from === 0) return to === 0 ? 0 : null;
	return ((to - from) / from) * 100;
}

function headerMap(headers: HARNameValue[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const header of headers) {
		const name = header.name.toLowerCase();
		if (name.startsWith(":") || IGNORED_DIFF_HEADERS.has(name)) continue;
		const existing = map.get(name);
		map.set(name, existing === undefined ? header.value : `${existing}, ${header.value}`);
	}
	return map;
}

export function diffHeaders(baseline: HARNameValue[], comparison: HARNameValue[]): HeaderDiff[] {
	const a = headerMap(baseline);
	const b = headerMap(comparison);
	const diffs: HeaderDiff[] = [];
	for (const [name, value] of a) {
		const other = b.get(name);
		if (other !== value) {
			diffs.push({ name, baseline: value, comparison: other ?? null });
		}
	}
	for (const [name, value] of b) {
		if (!a.has(name)) diffs.push({ name, baseline: null, comparison: value });
	}
	return diffs.sort((x, y) => x.name.localeCompare(y.name));
}

export function computePairDelta(
	baseline: HAREntry,
	comparison: HAREntry,
	compareHeaders = true
): PairDelta {
	const baseTime = nonNegative(baseline.time);
	const cmpTime = nonNegative(comparison.time);
	const baseTransfer = getEntryTransferSize(baseline);
	const cmpTransfer = getEntryTransferSize(comparison);
	const baseContent = getEntryContentSize(baseline);
	const cmpContent = getEntryContentSize(comparison);

	return {
		statusChanged: baseline.response.status !== comparison.response.status,
		mimeChanged:
			getBaseMimeType(baseline.response.content.mimeType) !==
			getBaseMimeType(comparison.response.content.mimeType),
		timeDelta: cmpTime - baseTime,
		timeDeltaPct: percentChange(baseTime, cmpTime),
		transferDelta: cmpTransfer - baseTransfer,
		transferDeltaPct: percentChange(baseTransfer, cmpTransfer),
		contentDelta: cmpContent - baseContent,
		contentDeltaPct: percentChange(baseContent, cmpContent),
		headerDiffs: compareHeaders
			? diffHeaders(baseline.response.headers, comparison.response.headers)
			: [],
	};
}

function chronologicalIndices(entries: HAREntry[]): number[] {
	const starts = entries.map(getEntryStartTime);
	return entries.map((_, i) => i).sort((a, b) => starts[a] - starts[b] || a - b);
}

/** Pairs occurrences sharing a key in order; returns the pairs and what is left over. */
function pairByKey(
	baseIndices: number[],
	cmpIndices: number[],
	baseKey: (i: number) => string,
	cmpKey: (i: number) => string
) {
	const queues = new Map<string, { items: number[]; next: number }>();
	for (const i of cmpIndices) {
		const key = cmpKey(i);
		const queue = queues.get(key);
		if (queue) queue.items.push(i);
		else queues.set(key, { items: [i], next: 0 });
	}

	const pairs = new Map<number, number>();
	const leftoverBase: number[] = [];
	for (const i of baseIndices) {
		const queue = queues.get(baseKey(i));
		if (queue && queue.next < queue.items.length) {
			pairs.set(i, queue.items[queue.next++]);
		} else {
			leftoverBase.push(i);
		}
	}

	const used = new Set(pairs.values());
	const leftoverCmp = cmpIndices.filter((i) => !used.has(i));
	return { pairs, leftoverBase, leftoverCmp };
}

export function compareHar(
	baseline: HAREntry[],
	comparison: HAREntry[],
	options: MatchOptions = DEFAULT_MATCH_OPTIONS
): CompareResult {
	const baseOrder = chronologicalIndices(baseline);
	const cmpOrder = chronologicalIndices(comparison);

	const exact = pairByKey(
		baseOrder,
		cmpOrder,
		(i) => getMatchKey(baseline[i], options),
		(i) => getMatchKey(comparison[i], options)
	);

	const pairs = new Map(exact.pairs);
	const patternPairs = new Set<number>();
	let removedIndices = exact.leftoverBase;
	let addedIndices = exact.leftoverCmp;

	if (options.normalizeDynamicSegments && removedIndices.length > 0 && addedIndices.length > 0) {
		const fuzzy = pairByKey(
			removedIndices,
			addedIndices,
			(i) => getMatchKey(baseline[i], options, true),
			(i) => getMatchKey(comparison[i], options, true)
		);
		for (const [b, c] of fuzzy.pairs) {
			pairs.set(b, c);
			patternPairs.add(b);
		}
		removedIndices = fuzzy.leftoverBase;
		addedIndices = fuzzy.leftoverCmp;
	}

	const removedSet = new Set(removedIndices);
	const addedSet = new Set(addedIndices);

	// Anchor each added request after the nearest earlier comparison request
	// that has a baseline counterpart, so side-by-side rows stay aligned.
	const cmpToBase = new Map<number, number>();
	for (const [b, c] of pairs) cmpToBase.set(c, b);
	const addedAfter = new Map<number, AddedRow[]>();
	const leadingAdded: AddedRow[] = [];
	let anchor: number | null = null;
	for (const c of cmpOrder) {
		if (addedSet.has(c)) {
			const row: AddedRow = {
				kind: "added",
				id: `a-${c}`,
				comparisonIndex: c,
				comparison: comparison[c],
			};
			if (anchor === null) leadingAdded.push(row);
			else {
				const list = addedAfter.get(anchor);
				if (list) list.push(row);
				else addedAfter.set(anchor, [row]);
			}
		} else {
			anchor = cmpToBase.get(c) ?? anchor;
		}
	}

	const rows: CompareRow[] = [...leadingAdded];
	for (const b of baseOrder) {
		if (removedSet.has(b)) {
			rows.push({
				kind: "removed",
				id: `r-${b}`,
				baselineIndex: b,
				baseline: baseline[b],
			});
			continue;
		}
		const c = pairs.get(b);
		if (c === undefined) continue;
		rows.push({
			kind: "matched",
			id: `m-${b}-${c}`,
			baselineIndex: b,
			comparisonIndex: c,
			baseline: baseline[b],
			comparison: comparison[c],
			matchedBy: patternPairs.has(b) ? "pattern" : "exact",
			delta: computePairDelta(baseline[b], comparison[c], options.compareHeaders),
		});
		const trailing = addedAfter.get(b);
		if (trailing) rows.push(...trailing);
	}

	return {
		rows,
		matched: pairs.size,
		matchedByPattern: patternPairs.size,
		added: addedIndices.length,
		removed: removedIndices.length,
	};
}

export interface RowFlags {
	/** Matched with a meaningful difference (status, MIME, size or timing). */
	changed: boolean;
	statusChanged: boolean;
	mimeChanged: boolean;
	sizeChanged: boolean;
	slower: boolean;
	faster: boolean;
	headersChanged: boolean;
}

const NO_FLAGS: RowFlags = {
	changed: false,
	statusChanged: false,
	mimeChanged: false,
	sizeChanged: false,
	slower: false,
	faster: false,
	headersChanged: false,
};

function exceeds(delta: number, pct: number | null, minAbs: number, minPct: number): boolean {
	return Math.abs(delta) > minAbs && (pct === null || Math.abs(pct) > minPct);
}

export function classifyRow(
	row: CompareRow,
	thresholds: ChangeThresholds = DEFAULT_THRESHOLDS
): RowFlags {
	if (row.kind !== "matched") return NO_FLAGS;
	const { delta } = row;
	const timeExceeds = exceeds(
		delta.timeDelta,
		delta.timeDeltaPct,
		thresholds.timeMs,
		thresholds.timePct
	);
	const slower = timeExceeds && delta.timeDelta > 0;
	const faster = timeExceeds && delta.timeDelta < 0;
	const sizeChanged =
		exceeds(
			delta.transferDelta,
			delta.transferDeltaPct,
			thresholds.sizeBytes,
			thresholds.sizePct
		) ||
		exceeds(delta.contentDelta, delta.contentDeltaPct, thresholds.sizeBytes, thresholds.sizePct);
	return {
		changed: delta.statusChanged || delta.mimeChanged || sizeChanged || slower || faster,
		statusChanged: delta.statusChanged,
		mimeChanged: delta.mimeChanged,
		sizeChanged,
		slower,
		faster,
		headersChanged: delta.headerDiffs.length > 0,
	};
}

export function isErrorStatus(status: number): boolean {
	return status === 0 || status >= 400;
}

export type ConcreteResourceType = Exclude<ResourceType, "all">;

export interface TypeSummary {
	count: number;
	transferSize: number;
}

export interface HarSummary {
	requests: number;
	transferSize: number;
	contentSize: number;
	/** Last response end minus first request start, or -1 when unknown. */
	loadTime: number;
	errors: number;
	byType: Partial<Record<ConcreteResourceType, TypeSummary>>;
}

export function summarizeEntries(entries: HAREntry[]): HarSummary {
	let transferSize = 0;
	let contentSize = 0;
	let errors = 0;
	let firstStart = Infinity;
	let lastEnd = -Infinity;
	const byType: Partial<Record<ConcreteResourceType, TypeSummary>> = {};

	for (const entry of entries) {
		const transfer = getEntryTransferSize(entry);
		transferSize += transfer;
		contentSize += getEntryContentSize(entry);
		if (isErrorStatus(entry.response.status)) errors++;

		const start = getEntryStartTime(entry);
		if (start > 0) {
			firstStart = Math.min(firstStart, start);
			lastEnd = Math.max(lastEnd, start + nonNegative(entry.time));
		}

		const type = getResourceType(entry) as ConcreteResourceType;
		const bucket = byType[type] ?? (byType[type] = { count: 0, transferSize: 0 });
		bucket.count++;
		bucket.transferSize += transfer;
	}

	return {
		requests: entries.length,
		transferSize,
		contentSize,
		loadTime: Number.isFinite(firstStart) ? lastEnd - firstStart : -1,
		errors,
		byType,
	};
}
