export interface Pattern {
	type:
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
	severity: "high" | "medium" | "low";
	title: string;
	description: string;
	count: number;
	examples: Array<{
		url: string;
		index: number;
		details?: string;
	}>;
	recommendation: string;
	impact?: string;
	allAffectedIndices?: number[];
}

export interface PatternFilters {
	severity: Set<"high" | "medium" | "low">;
	types: Set<Pattern["type"]>;
}
