import { HAREntry } from "@/lib/stores/har-store";
import { Pattern } from "../types";
import { THRESHOLDS } from "../constants";
import { formatDuration } from "../utils";

export function detectWaterfallGaps(entries: HAREntry[]): Pattern | null {
	if (entries.length < 2) return null;

	const sortedByTime = [...entries]
		.map((entry, index) => ({
			entry,
			index,
			start: new Date(entry.startedDateTime).getTime(),
			end:
				new Date(entry.startedDateTime).getTime() +
				(entry.time > 0 ? entry.time : 0),
		}))
		.sort((a, b) => a.start - b.start);

	const gaps: Array<{
		gap: number;
		index: number;
		url: string;
		details: string;
	}> = [];

	for (let i = 1; i < sortedByTime.length; i++) {
		const prevEnd = sortedByTime[i - 1].end;
		const currentStart = sortedByTime[i].start;
		const gap = currentStart - prevEnd;

		if (gap > THRESHOLDS.WATERFALL_GAP_MS) {
			gaps.push({
				gap,
				index: sortedByTime[i].index,
				url: sortedByTime[i].entry.request.url,
				details: `${formatDuration(gap)} idle time`,
			});
		}
	}

	if (gaps.length === 0) return null;

	const totalGapTime = gaps.reduce((sum, g) => sum + g.gap, 0);
	const sortedGaps = gaps.sort((a, b) => b.gap - a.gap);

	return {
		type: "waterfall-gaps",
		severity: "medium",
		title: "Waterfall Loading Gaps",
		description: `Found ${gaps.length} significant gaps (>${THRESHOLDS.WATERFALL_GAP_MS}ms) in request waterfall`,
		count: gaps.length,
		examples: sortedGaps.slice(0, 5).map((g) => ({
			url: g.url,
			index: g.index,
			details: g.details,
		})),
		recommendation:
			"Preload critical resources or use resource hints (dns-prefetch, preconnect) to minimize idle time",
		impact: `${formatDuration(
			totalGapTime
		)} total idle time could be optimized`,
		allAffectedIndices: sortedGaps.map((g) => g.index),
	};
}
