import type { HAREntry } from "@/lib/har-types";
import { getEntryStartTime, getEntryTransferSize, nonNegative } from "@/lib/har-parser";

const BUCKET_STEPS_MS = [
	10, 20, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000,
	300_000, 600_000, 1_800_000, 3_600_000,
];
const MAX_BUCKETS = 150;

function chooseBucketSize(durationMs: number): number {
	const step = BUCKET_STEPS_MS.find((size) => durationMs / size <= MAX_BUCKETS);
	return step ?? Math.ceil(durationMs / MAX_BUCKETS);
}

export interface BandwidthAnalytics {
	/** `t` is seconds from the first request start; `rate` bytes per second. */
	rateTimeline: { t: number; rate: number }[];
	cumulativeTimeline: { t: number; total: number }[];
	bucketSize: number;
	peakRate: number;
	peakTime: number;
	avgRate: number;
	totalBytes: number;
	durationMs: number;
	endSeconds: number;
}

export function computeBandwidth(
	entries: HAREntry[],
	indices: number[]
): BandwidthAnalytics | null {
	const timed: { start: number; end: number; receive: number; bytes: number }[] = [];
	for (const index of indices) {
		const entry = entries[index];
		const start = getEntryStartTime(entry);
		// Entries without a parseable start time cannot be placed in time.
		if (start <= 0) continue;
		const time = nonNegative(entry.time);
		timed.push({
			start,
			end: start + time,
			receive: Math.min(nonNegative(entry.timings.receive), time),
			bytes: getEntryTransferSize(entry),
		});
	}

	if (!timed.length) return null;

	let origin = Infinity;
	let lastEnd = -Infinity;
	for (const item of timed) {
		if (item.start < origin) origin = item.start;
		if (item.end > lastEnd) lastEnd = item.end;
	}
	const durationMs = Math.max(lastEnd - origin, 1);
	const bucketSize = chooseBucketSize(durationMs);
	const bucketCount = Math.max(1, Math.ceil(durationMs / bucketSize));
	const bucketBytes = new Float64Array(bucketCount);
	const lastBucket = bucketCount - 1;
	const bucketOf = (offsetMs: number) =>
		Math.min(Math.max(Math.floor(offsetMs / bucketSize), 0), lastBucket);

	let totalBytes = 0;
	for (const item of timed) {
		if (item.bytes <= 0) continue;
		totalBytes += item.bytes;

		// Bytes arrive during the receive phase; spread them evenly over it.
		const receiveEnd = item.end - origin;
		const receiveStart = receiveEnd - item.receive;
		if (item.receive <= 0) {
			bucketBytes[bucketOf(receiveEnd)] += item.bytes;
			continue;
		}
		const first = bucketOf(receiveStart);
		const last = bucketOf(receiveEnd);
		if (first === last) {
			bucketBytes[first] += item.bytes;
			continue;
		}
		for (let i = first; i <= last; i++) {
			const overlapStart = Math.max(receiveStart, i * bucketSize);
			const overlapEnd = i === lastBucket ? receiveEnd : Math.min(receiveEnd, (i + 1) * bucketSize);
			if (overlapEnd > overlapStart) {
				bucketBytes[i] += (item.bytes * (overlapEnd - overlapStart)) / item.receive;
			}
		}
	}

	const bucketSeconds = bucketSize / 1000;
	let cumulative = 0;
	let peakRate = 0;
	let peakTime = 0;
	const rateTimeline: { t: number; rate: number }[] = [];
	const cumulativeTimeline: { t: number; total: number }[] = [];

	for (let i = 0; i < bucketCount; i++) {
		const t = (i * bucketSize) / 1000;
		const rate = bucketBytes[i] / bucketSeconds;
		cumulative += bucketBytes[i];
		if (rate > peakRate) {
			peakRate = rate;
			peakTime = t;
		}
		rateTimeline.push({ t, rate });
		cumulativeTimeline.push({ t, total: cumulative });
	}
	const endSeconds = durationMs / 1000;
	// Close both series at the end of the capture.
	rateTimeline.push({ t: endSeconds, rate: 0 });
	cumulativeTimeline.push({ t: endSeconds, total: totalBytes });

	return {
		rateTimeline,
		cumulativeTimeline,
		bucketSize,
		peakRate,
		peakTime,
		avgRate: totalBytes / (durationMs / 1000),
		totalBytes,
		durationMs,
		endSeconds,
	};
}
