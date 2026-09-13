import type { HAREntry, HARPage } from "@/lib/har-types";
import type { Pattern, PatternSeverity } from "./types";
import { SEVERITIES } from "./constants";
import { detectPatterns } from "./detect";

export { detectPatterns };
export { SEVERITIES, SEVERITY_ORDER, THRESHOLDS } from "./constants";
export type { AffectedRequest, Pattern, PatternSeverity, PatternType } from "./types";

export interface PatternSummary {
	total: number;
	bySeverity: Record<PatternSeverity, number>;
}

/** Counts detected patterns (issues), not affected requests. */
export function summarizePatterns(patterns: readonly Pattern[]): PatternSummary {
	const bySeverity = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])) as Record<
		PatternSeverity,
		number
	>;
	for (const pattern of patterns) bySeverity[pattern.severity] += 1;
	return { total: patterns.length, bySeverity };
}

const cache = new WeakMap<HAREntry[], { pages: HARPage[] | undefined; patterns: Pattern[] }>();

/**
 * detectPatterns memoized per entries array, so the sidebar badge and the
 * Patterns view share one pass over large files. Edits replace the array,
 * which naturally invalidates the cache.
 */
export function getCachedPatterns(entries: HAREntry[], pages: HARPage[] | undefined): Pattern[] {
	const hit = cache.get(entries);
	if (hit && hit.pages === pages) return hit.patterns;
	let patterns: Pattern[];
	try {
		patterns = detectPatterns(entries, pages ?? []);
	} catch (error) {
		console.error("Pattern detection failed:", error);
		patterns = [];
	}
	cache.set(entries, { pages, patterns });
	return patterns;
}
