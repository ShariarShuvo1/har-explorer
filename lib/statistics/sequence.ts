import { getEntryContentSize, nonNegative } from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import type { HAREntry, ResourceType } from "@/lib/har-types";
import { getValidStartTime, percentOf } from "./utils";

export type SequenceResourceType = Exclude<ResourceType, "all">;

const CRITICAL_RESOURCE_TYPES = new Set<SequenceResourceType>(["doc", "css", "js"]);

export interface ResourceSequenceStats {
	resourceType: SequenceResourceType;
	/** 1-based position when ordered by average start time. */
	order: number;
	count: number;
	/** Ms relative to the first request. */
	firstStart: number;
	lastEnd: number;
	avgStartTime: number;
	avgDuration: number;
	totalSize: number;
	/** Average number of in-flight requests of this type while any was in flight. */
	parallelism: number | null;
	/** Requests that spent time queued or stalled (`timings.blocked > 0`). */
	queuedCount: number;
}

export interface SequenceAnalysis {
	loadSequence: ResourceSequenceStats[];
	timedCount: number;
	totalDuration: number;
	avgParallelism: number | null;
	peakConcurrency: number;
	queuedPercentage: number;
	avgBlocked: number;
	criticalResources: ResourceSequenceStats[];
}

interface Interval {
	start: number;
	end: number;
}

/** Length of time covered by at least one interval. Sorts `intervals` in place. */
function unionLength(intervals: Interval[]): number {
	intervals.sort((a, b) => a.start - b.start);
	let total = 0;
	let spanStart = -Infinity;
	let spanEnd = -Infinity;
	for (const { start, end } of intervals) {
		if (start > spanEnd) {
			if (spanEnd > spanStart) total += spanEnd - spanStart;
			spanStart = start;
			spanEnd = end;
		} else if (end > spanEnd) {
			spanEnd = end;
		}
	}
	if (spanEnd > spanStart) total += spanEnd - spanStart;
	return total;
}

/** Highest number of simultaneously in-flight requests (sweep line). */
function peakConcurrency(intervals: Interval[]): number {
	const events: Array<readonly [number, number]> = [];
	for (const { start, end } of intervals) {
		if (end > start) events.push([start, 1], [end, -1]);
	}
	// At equal timestamps ends are processed before starts.
	events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	let current = 0;
	let peak = 0;
	for (const [, delta] of events) {
		current += delta;
		if (current > peak) peak = current;
	}
	return Math.max(peak, intervals.length > 0 ? 1 : 0);
}

/** Average in-flight requests while at least one was in flight. */
function averageParallelism(intervals: Interval[], totalDuration: number): number | null {
	const busy = unionLength(intervals);
	return busy > 0 ? totalDuration / busy : null;
}

export function analyzeSequence(entries: HAREntry[]): SequenceAnalysis {
	const timed: Array<{ start: number; end: number; index: number }> = [];
	let firstStart = Infinity;
	entries.forEach((entry, index) => {
		const start = getValidStartTime(entry);
		if (start === null) return;
		timed.push({ start, end: start + nonNegative(entry.time), index });
		if (start < firstStart) firstStart = start;
	});

	const groups = new Map<
		SequenceResourceType,
		{
			count: number;
			firstStart: number;
			lastEnd: number;
			totalSize: number;
			queuedCount: number;
			intervals: Interval[];
			totalDuration: number;
			totalStart: number;
		}
	>();
	const allIntervals: Interval[] = [];
	let lastEnd = -Infinity;
	let totalDuration = 0;
	let totalBlocked = 0;
	let queuedCount = 0;

	for (const { start, end, index } of timed) {
		const entry = entries[index];
		const type = getResourceType(entry) as SequenceResourceType;
		const relativeStart = start - firstStart;
		const relativeEnd = end - firstStart;
		const duration = end - start;
		const queued = entry.timings.blocked > 0;

		let group = groups.get(type);
		if (!group) {
			group = {
				count: 0,
				firstStart: relativeStart,
				lastEnd: relativeEnd,
				totalSize: 0,
				queuedCount: 0,
				intervals: [],
				totalDuration: 0,
				totalStart: 0,
			};
			groups.set(type, group);
		}
		group.count++;
		group.firstStart = Math.min(group.firstStart, relativeStart);
		group.lastEnd = Math.max(group.lastEnd, relativeEnd);
		group.totalSize += getEntryContentSize(entry);
		if (queued) group.queuedCount++;
		group.totalDuration += duration;
		group.totalStart += relativeStart;
		group.intervals.push({ start, end });

		allIntervals.push({ start, end });
		totalDuration += duration;
		totalBlocked += nonNegative(entry.timings.blocked);
		if (queued) queuedCount++;
		if (end > lastEnd) lastEnd = end;
	}

	const loadSequence: ResourceSequenceStats[] = Array.from(groups.entries())
		.map(([resourceType, group]) => ({
			resourceType,
			order: 0,
			count: group.count,
			firstStart: group.firstStart,
			lastEnd: group.lastEnd,
			avgStartTime: group.totalStart / group.count,
			avgDuration: group.totalDuration / group.count,
			totalSize: group.totalSize,
			parallelism: averageParallelism(group.intervals, group.totalDuration),
			queuedCount: group.queuedCount,
		}))
		.sort((a, b) => a.avgStartTime - b.avgStartTime)
		.map((stat, index) => ({ ...stat, order: index + 1 }));

	return {
		loadSequence,
		timedCount: timed.length,
		totalDuration: timed.length > 0 ? lastEnd - firstStart : 0,
		avgParallelism: averageParallelism(allIntervals, totalDuration),
		peakConcurrency: peakConcurrency(allIntervals),
		queuedPercentage: percentOf(queuedCount, timed.length),
		avgBlocked: timed.length > 0 ? totalBlocked / timed.length : 0,
		criticalResources: loadSequence.filter((s) => CRITICAL_RESOURCE_TYPES.has(s.resourceType)),
	};
}
