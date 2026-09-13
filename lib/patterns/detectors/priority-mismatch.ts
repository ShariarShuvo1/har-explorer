import { formatBytes, getEntryContentSize } from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import type { PatternDetector } from "../types";
import { THRESHOLDS } from "../constants";
import { plural } from "../utils";

/** Chrome's VeryLow…VeryHigh scale (some tools use Lowest…Highest). */
const PRIORITY_RANK: Record<string, number> = {
	verylow: 0,
	lowest: 0,
	low: 1,
	medium: 2,
	high: 3,
	veryhigh: 4,
	highest: 4,
};
const LOW = 1;
const HIGH = 3;

export const detectPriorityMismatches: PatternDetector = ({ entries }) => {
	const mismatches: Array<{ index: number; critical: boolean; details: string }> = [];

	entries.forEach((entry, index) => {
		const priority = entry._priority;
		if (typeof priority !== "string") return;
		const rank = PRIORITY_RANK[priority.toLowerCase().replace(/[^a-z]/g, "")];
		if (rank === undefined) return;

		const type = getResourceType(entry);
		if ((type === "css" || type === "font") && rank <= LOW) {
			mismatches.push({
				index,
				critical: true,
				details: `${type === "css" ? "Stylesheet" : "Font"} loaded at ${priority} priority (expected only for non-critical ${type === "css" ? "media queries" : "fonts"})`,
			});
		} else if (type === "js" && rank <= LOW) {
			mismatches.push({
				index,
				critical: false,
				details: `Script loaded at ${priority} priority (fine if async or deferred)`,
			});
		} else if (type === "img" && rank >= HIGH) {
			const size = getEntryContentSize(entry);
			if (size > THRESHOLDS.LARGE_IMAGE_BYTES) {
				mismatches.push({
					index,
					critical: false,
					details: `Large image (${formatBytes(size)}) at ${priority} priority competes with critical resources`,
				});
			}
		}
	});
	if (mismatches.length === 0) return null;

	const hasCritical = mismatches.some((mismatch) => mismatch.critical);
	mismatches.sort((a, b) => Number(b.critical) - Number(a.critical) || a.index - b.index);

	return {
		type: "priority-mismatch",
		severity: hasCritical ? "medium" : "low",
		title: "Resource Priority Mismatches",
		description: `${plural(mismatches.length, "resource")} with a loading priority that may not match its importance`,
		recommendation:
			'Use <link rel="preload"> or fetchpriority="high" for render-critical resources, and fetchpriority="low" or lazy loading for large images outside the initial viewport',
		impact: hasCritical
			? "Render-critical styles or fonts are fetched late, delaying first render"
			: "Suboptimal loading order may hurt perceived performance",
		affected: mismatches.map(({ index, details }) => ({ index, details })),
	};
};
