import type { HAREntry, HARPage } from "@/lib/har-types";

export type PatternType =
	| "duplicate"
	| "failed"
	| "redirect"
	| "cors"
	| "uncached"
	| "sequential"
	| "waterfall-gaps"
	| "mixed-content"
	| "large-cookies"
	| "api-batching"
	| "priority-mismatch"
	| "timing-anomalies";

export type PatternSeverity = "high" | "medium" | "low";

export interface AffectedRequest {
	index: number;
	details?: string;
}

export interface Pattern {
	type: PatternType;
	severity: PatternSeverity;
	title: string;
	description: string;
	recommendation: string;
	impact?: string;
	/** Unique entry indices, most relevant first. */
	affected: AffectedRequest[];
}

export interface PatternContext {
	entries: HAREntry[];
	pages: HARPage[];
	/** Start time of each entry in ms since epoch, NaN when unparseable. */
	startTimes: number[];
	/** Indices of entries with a valid start time, ordered by start time. */
	chronological: number[];
}

export type PatternDetector = (context: PatternContext) => Pattern | null;
