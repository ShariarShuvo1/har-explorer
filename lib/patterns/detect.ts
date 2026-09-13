import type { HAREntry, HARPage } from "@/lib/har-types";
import type { Pattern, PatternDetector } from "./types";
import { SEVERITY_ORDER } from "./constants";
import { createPatternContext, uniqueAffected } from "./utils";
import { detectApiBatchingOpportunities } from "./detectors/api-batching";
import { detectCorsIssues } from "./detectors/cors";
import { detectDuplicateRequests } from "./detectors/duplicate";
import { detectFailedRequests } from "./detectors/failed";
import { detectLargeCookies } from "./detectors/large-cookies";
import { detectMixedContent } from "./detectors/mixed-content";
import { detectPriorityMismatches } from "./detectors/priority-mismatch";
import { detectRedirects } from "./detectors/redirect";
import { detectSequentialLoading } from "./detectors/sequential";
import { detectTimingAnomalies } from "./detectors/timing-anomalies";
import { detectUncachedResources } from "./detectors/uncached";
import { detectWaterfallGaps } from "./detectors/waterfall-gaps";

const DETECTORS: PatternDetector[] = [
	detectFailedRequests,
	detectCorsIssues,
	detectMixedContent,
	detectDuplicateRequests,
	detectRedirects,
	detectUncachedResources,
	detectTimingAnomalies,
	detectWaterfallGaps,
	detectSequentialLoading,
	detectApiBatchingOpportunities,
	detectLargeCookies,
	detectPriorityMismatches,
];

/** Runs every detector and returns the findings, most severe first. */
export function detectPatterns(entries: HAREntry[], pages: HARPage[]): Pattern[] {
	if (entries.length === 0) return [];

	const context = createPatternContext(entries, pages);
	const patterns: Pattern[] = [];
	for (const detector of DETECTORS) {
		let pattern: Pattern | null;
		try {
			pattern = detector(context);
		} catch (error) {
			// One detector tripping over unusual data must not hide the others.
			console.error(`Pattern detector "${detector.name}" failed`, error);
			continue;
		}
		if (pattern && pattern.affected.length > 0) {
			patterns.push({ ...pattern, affected: uniqueAffected(pattern.affected) });
		}
	}

	return patterns.sort(
		(a, b) =>
			SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
			b.affected.length - a.affected.length
	);
}
