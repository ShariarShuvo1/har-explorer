import { formatTime } from "@/lib/har-parser";
import type { PatternDetector } from "../types";
import { THRESHOLDS } from "../constants";
import { getEntryEndTime, plural } from "../utils";

export const detectWaterfallGaps: PatternDetector = (context) => {
	const { entries, startTimes, chronological } = context;
	if (chronological.length < 2) return null;

	const gaps: Array<{ index: number; gap: number }> = [];
	// Compare against the latest end seen so far, not the previous request's
	// end: a long request still in flight means the network is not idle.
	let latestEnd = -Infinity;
	let previous: number | null = null;

	for (const index of chronological) {
		const gap = startTimes[index] - latestEnd;
		// A new page (navigation) is expected to start after a pause.
		const samePage = previous !== null && entries[previous].pageref === entries[index].pageref;
		if (samePage && gap > THRESHOLDS.WATERFALL_GAP_MS) {
			gaps.push({ index, gap });
		}
		latestEnd = Math.max(latestEnd, getEntryEndTime(context, index));
		previous = index;
	}
	if (gaps.length === 0) return null;

	const totalGapTime = gaps.reduce((sum, { gap }) => sum + gap, 0);
	gaps.sort((a, b) => b.gap - a.gap);

	return {
		type: "waterfall-gaps",
		severity: "medium",
		title: "Waterfall Loading Gaps",
		description: `${plural(gaps.length, "gap")} longer than ${formatTime(THRESHOLDS.WATERFALL_GAP_MS)} with no requests in flight`,
		recommendation:
			"Preload critical resources or use resource hints (dns-prefetch, preconnect) and start follow-up requests earlier to minimize idle time",
		impact: `${formatTime(totalGapTime)} of total idle time`,
		affected: gaps.map(({ index, gap }) => ({
			index,
			details: `${formatTime(gap)} idle before this request started`,
		})),
	};
};
