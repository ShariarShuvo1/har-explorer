import { extractDomain, getEntryTransferSize } from "@/lib/har-parser";
import type { HAREntry } from "@/lib/har-types";
import { asRecord } from "./utils";

export interface InitiatorStats {
	type: string;
	count: number;
	totalSize: number;
	totalTime: number;
	domainCount: number;
}

export interface InitiatorAnalysis {
	initiatorStats: InitiatorStats[];
	/** All initiating URLs, most requests first. */
	topInitiators: Array<{ url: string; count: number }>;
	maxStackDepth: number;
	/** Root first; `entryIndex` is the store index of a request with that URL. */
	longestChain: Array<{ url: string; entryIndex: number | null }>;
	hasInitiatorData: boolean;
}

const INITIATOR_LABELS: Record<string, string> = {
	parser: "Parser",
	script: "Script",
	preload: "Preload",
	preflight: "Preflight",
	signedexchange: "Signed Exchange",
	redirect: "Redirect",
	other: "Other",
	unknown: "Unknown",
};

export function getInitiatorType(entry: HAREntry): string {
	const initiator = entry._initiator;
	if (typeof initiator === "string") {
		return initiator.trim().toLowerCase() || "unknown";
	}
	const type = asRecord(initiator)?.type;
	if (typeof type === "string" && type.trim()) {
		return type.trim().toLowerCase();
	}
	return "unknown";
}

export function getInitiatorLabel(type: string): string {
	return INITIATOR_LABELS[type] ?? type;
}

const MAX_STACK_SEGMENTS = 1000;

/** The initiator's stack followed through its async `parent` segments. */
function getStackSegments(entry: HAREntry): Record<string, unknown>[] {
	const segments: Record<string, unknown>[] = [];
	const seen = new Set<Record<string, unknown>>();
	let stack = asRecord(asRecord(entry._initiator)?.stack);
	while (stack && !seen.has(stack) && segments.length < MAX_STACK_SEGMENTS) {
		seen.add(stack);
		segments.push(stack);
		stack = asRecord(stack.parent);
	}
	return segments;
}

function getCallFrames(segment: Record<string, unknown>): unknown[] {
	return Array.isArray(segment.callFrames) ? segment.callFrames : [];
}

/** The document or script that triggered the request, when recorded. */
export function getInitiatorUrl(entry: HAREntry): string | null {
	const url = asRecord(entry._initiator)?.url;
	if (typeof url === "string" && url) return url;
	for (const segment of getStackSegments(entry)) {
		for (const frame of getCallFrames(segment)) {
			const frameUrl = asRecord(frame)?.url;
			if (typeof frameUrl === "string" && frameUrl) return frameUrl;
		}
	}
	return null;
}

/** Total call frames across the initiator stack and its async parents. */
export function getInitiatorStackDepth(entry: HAREntry): number {
	return getStackSegments(entry).reduce(
		(depth, segment) => depth + getCallFrames(segment).length,
		0
	);
}

/**
 * The longest "A loaded B loaded C" chain, where each request's initiator URL
 * is matched against the URLs of the other requests.
 */
function findLongestChain(parentOf: Map<string, string>): string[] {
	const depthOf = new Map<string, number>();

	const resolveDepth = (url: string): number => {
		const path: string[] = [];
		const onPath = new Set<string>();
		let current: string | undefined = url;
		let depth = 0;
		while (current !== undefined) {
			const known = depthOf.get(current);
			if (known !== undefined) {
				depth = known;
				break;
			}
			if (onPath.has(current)) break;
			onPath.add(current);
			path.push(current);
			current = parentOf.get(current);
		}
		for (let i = path.length - 1; i >= 0; i--) {
			depth++;
			depthOf.set(path[i], depth);
		}
		return depthOf.get(url) ?? depth;
	};

	let deepestUrl: string | null = null;
	let maxDepth = 0;
	for (const url of parentOf.keys()) {
		const depth = resolveDepth(url);
		if (depth > maxDepth) {
			maxDepth = depth;
			deepestUrl = url;
		}
	}
	if (!deepestUrl) return [];

	const chain: string[] = [];
	const seen = new Set<string>();
	let current: string | undefined = deepestUrl;
	while (current !== undefined && !seen.has(current)) {
		seen.add(current);
		chain.push(current);
		current = parentOf.get(current);
	}
	return chain.reverse();
}

export function analyzeInitiators(entries: HAREntry[], indices: number[]): InitiatorAnalysis {
	const initiatorMap = new Map<
		string,
		{ count: number; totalSize: number; totalTime: number; domains: Set<string> }
	>();
	const initiatorUrlCounts = new Map<string, number>();
	const parentOf = new Map<string, string>();
	const firstIndexOfUrl = new Map<string, number>();
	let maxStackDepth = 0;
	let hasInitiatorData = false;

	entries.forEach((entry, position) => {
		if (entry._initiator != null) hasInitiatorData = true;
		const url = entry.request.url;
		if (!firstIndexOfUrl.has(url)) firstIndexOfUrl.set(url, indices[position]);

		const type = getInitiatorType(entry);
		let stat = initiatorMap.get(type);
		if (!stat) {
			stat = { count: 0, totalSize: 0, totalTime: 0, domains: new Set() };
			initiatorMap.set(type, stat);
		}
		stat.count++;
		stat.totalSize += getEntryTransferSize(entry);
		stat.totalTime += entry.time;
		stat.domains.add(extractDomain(url));

		const initiatorUrl = getInitiatorUrl(entry);
		if (initiatorUrl) {
			initiatorUrlCounts.set(initiatorUrl, (initiatorUrlCounts.get(initiatorUrl) ?? 0) + 1);
			if (initiatorUrl !== url && !parentOf.has(url)) {
				parentOf.set(url, initiatorUrl);
			}
		}

		maxStackDepth = Math.max(maxStackDepth, getInitiatorStackDepth(entry));
	});

	return {
		initiatorStats: Array.from(initiatorMap.entries())
			.map(([type, stat]) => ({
				type,
				count: stat.count,
				totalSize: stat.totalSize,
				totalTime: stat.totalTime,
				domainCount: stat.domains.size,
			}))
			.sort((a, b) => b.count - a.count),
		topInitiators: Array.from(initiatorUrlCounts.entries())
			.map(([url, count]) => ({ url, count }))
			.sort((a, b) => b.count - a.count),
		maxStackDepth,
		longestChain: findLongestChain(parentOf).map((url) => ({
			url,
			entryIndex: firstIndexOfUrl.get(url) ?? null,
		})),
		hasInitiatorData,
	};
}
