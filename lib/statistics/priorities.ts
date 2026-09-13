import { getResourceType } from "@/lib/resource-type";
import type { HAREntry } from "@/lib/har-types";
import { getValidStartTime } from "./utils";

export const UNKNOWN_PRIORITY = "Unknown";
/** Render-critical resources marked high priority that start this late are flagged. */
export const LATE_START_THRESHOLD_MS = 3000;
const RENDER_CRITICAL_TYPES = new Set(["doc", "css", "js", "font"]);

/** Chrome's resource priorities, highest first. */
export const PRIORITY_ORDER = ["VeryHigh", "High", "Medium", "Low", "VeryLow"] as const;

const PRIORITY_LOOKUP = new Map<string, string>(
	PRIORITY_ORDER.map((priority) => [priority.toLowerCase(), priority])
);

const PRIORITY_LABELS: Record<string, string> = {
	VeryHigh: "Very High",
	High: "High",
	Medium: "Medium",
	Low: "Low",
	VeryLow: "Very Low",
};

/** Canonical priority name ("VeryHigh", ...) or null when not recorded. */
export function getPriority(entry: HAREntry): string | null {
	if (typeof entry._priority !== "string") return null;
	const raw = entry._priority.trim();
	if (!raw) return null;
	return PRIORITY_LOOKUP.get(raw.toLowerCase().replace(/[\s_-]/g, "")) ?? raw;
}

export function getPriorityRank(priority: string): number {
	const index = (PRIORITY_ORDER as readonly string[]).indexOf(priority);
	return index === -1 ? PRIORITY_ORDER.length : index;
}

export function getPriorityLabel(priority: string): string {
	return PRIORITY_LABELS[priority] ?? priority;
}

export interface PriorityRow {
	priority: string;
	count: number;
	avgDuration: number;
	/** Average ms after the first request started; null when no start times. */
	avgStartTime: number | null;
}

export interface LatePriorityEntry {
	entryIndex: number;
	url: string;
	/** Ms after the first request of the same page. */
	pageOffset: number;
}

export interface PriorityAnalysis {
	priorityStats: PriorityRow[];
	/** Set when high priority resources start later than low ones on average. */
	averageMismatch: { highAvg: number; lowAvg: number } | null;
	/** Late render-critical high priority requests, latest first. */
	late: LatePriorityEntry[];
	hasPriorityData: boolean;
}

export function analyzePriorities(entries: HAREntry[], indices: number[]): PriorityAnalysis {
	const starts = entries.map(getValidStartTime);
	let firstStart = Infinity;
	const pageFirstStart = new Map<string, number>();
	entries.forEach((entry, position) => {
		const start = starts[position];
		if (start === null) return;
		if (start < firstStart) firstStart = start;
		const page = entry.pageref ?? "";
		const pageStart = pageFirstStart.get(page);
		if (pageStart === undefined || start < pageStart) {
			pageFirstStart.set(page, start);
		}
	});

	const priorityMap = new Map<
		string,
		{
			count: number;
			totalDuration: number;
			totalStartOffset: number;
			timedCount: number;
		}
	>();
	const high = { totalOffset: 0, count: 0 };
	const low = { totalOffset: 0, count: 0 };
	const late: Array<{ position: number; pageOffset: number }> = [];
	let hasPriorityData = false;

	entries.forEach((entry, position) => {
		const priority = getPriority(entry) ?? UNKNOWN_PRIORITY;
		if (priority !== UNKNOWN_PRIORITY) hasPriorityData = true;

		let stat = priorityMap.get(priority);
		if (!stat) {
			stat = {
				count: 0,
				totalDuration: 0,
				totalStartOffset: 0,
				timedCount: 0,
			};
			priorityMap.set(priority, stat);
		}
		stat.count++;
		stat.totalDuration += entry.time;

		const start = starts[position];
		if (start === null) return;
		const offset = start - firstStart;
		stat.totalStartOffset += offset;
		stat.timedCount++;

		if (priority === "VeryHigh" || priority === "High") {
			high.totalOffset += offset;
			high.count++;
			const pageOffset = start - (pageFirstStart.get(entry.pageref ?? "") ?? start);
			if (
				pageOffset > LATE_START_THRESHOLD_MS &&
				RENDER_CRITICAL_TYPES.has(getResourceType(entry))
			) {
				late.push({ position, pageOffset });
			}
		} else if (priority === "Low" || priority === "VeryLow") {
			low.totalOffset += offset;
			low.count++;
		}
	});

	const priorityStats = Array.from(priorityMap.entries())
		.map(([priority, stat]) => ({
			priority,
			count: stat.count,
			avgDuration: stat.totalDuration / stat.count,
			avgStartTime: stat.timedCount > 0 ? stat.totalStartOffset / stat.timedCount : null,
		}))
		.sort(
			(a, b) =>
				getPriorityRank(a.priority) - getPriorityRank(b.priority) ||
				a.priority.localeCompare(b.priority)
		);

	let averageMismatch: PriorityAnalysis["averageMismatch"] = null;
	if (high.count > 0 && low.count > 0) {
		const highAvg = high.totalOffset / high.count;
		const lowAvg = low.totalOffset / low.count;
		if (highAvg > lowAvg) averageMismatch = { highAvg, lowAvg };
	}

	late.sort((a, b) => b.pageOffset - a.pageOffset);

	return {
		priorityStats,
		averageMismatch,
		late: late.map((item) => ({
			entryIndex: indices[item.position],
			url: entries[item.position].request.url,
			pageOffset: item.pageOffset,
		})),
		hasPriorityData,
	};
}
