import { formatTime } from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import type { AffectedRequest, PatternDetector } from "../types";
import { THRESHOLDS } from "../constants";
import { getEntryEndTime } from "../utils";

/**
 * Flags requests that started shortly after every earlier request had
 * finished, i.e. requests that appear to wait for the previous one instead of
 * loading in parallel. Longer idle periods are reported as waterfall gaps.
 */
export const detectSequentialLoading: PatternDetector = (context) => {
	const { entries, startTimes, chronological } = context;
	if (chronological.length <= THRESHOLDS.SEQUENTIAL_MIN_REQUESTS) return null;

	const affected: AffectedRequest[] = [];
	let latestEnd = -Infinity;
	let previous: number | null = null;

	for (const index of chronological) {
		const entry = entries[index];
		const samePage = previous === null || entries[previous].pageref === entry.pageref;
		const idle = startTimes[index] - latestEnd;
		if (
			previous !== null &&
			samePage &&
			idle >= 0 &&
			idle <= THRESHOLDS.WATERFALL_GAP_MS &&
			getResourceType(entry) !== "ws"
		) {
			affected.push({
				index,
				details: `Started ${formatTime(idle)} after all earlier requests finished`,
			});
		}
		latestEnd = Math.max(latestEnd, getEntryEndTime(context, index));
		previous = index;
	}

	const candidates = chronological.length - 1;
	if (
		affected.length < THRESHOLDS.SEQUENTIAL_MIN_REQUESTS ||
		affected.length <= candidates * THRESHOLDS.SEQUENTIAL_LOADING_PERCENT
	) {
		return null;
	}

	return {
		type: "sequential",
		severity: "medium",
		title: "Sequential Loading Pattern",
		description: `${Math.round((affected.length / candidates) * 100)}% of requests started only after every earlier request had finished`,
		recommendation:
			"Start independent requests in parallel (e.g. Promise.all, preload and preconnect hints, HTTP/2) instead of chaining them",
		impact:
			"Requests wait for each other instead of loading in parallel, stretching the total load time",
		affected,
	};
};
