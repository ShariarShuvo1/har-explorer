import type { HAREntry, HARPage } from "./har-types";
import { getEntryStartTime } from "./har-parser";
import { getCaptureStart } from "./filter-entries";
import { getBarSegments, type BarSegment } from "./timing";

export type PageMarkerKind = "dcl" | "load";

export const MARKER_LABELS: Record<PageMarkerKind, string> = {
	dcl: "DOMContentLoaded",
	load: "Load",
};

export interface WaterfallBar {
	/** Milliseconds from the start of the capture. */
	start: number;
	/** Bar length in milliseconds (never shorter than the phase sum). */
	duration: number;
	segments: BarSegment[];
	hasValidStart: boolean;
}

export interface PageMarker {
	key: string;
	kind: PageMarkerKind;
	/** Milliseconds from the start of the capture. */
	offset: number;
	/** Milliseconds since the page started. */
	value: number;
	pageTitle: string;
}

export interface WaterfallModel {
	/** Capture start as an epoch in ms (0 when no entry has a valid start). */
	captureStart: number;
	/** End of the last request, in ms from capture start (> 0). */
	captureEnd: number;
	/** Visible window, in ms from capture start. */
	viewStart: number;
	viewEnd: number;
	bars: Map<number, WaterfallBar>;
	markers: PageMarker[];
}

/**
 * Positions every entry on a shared time axis. Offsets are measured from the
 * earliest request in the whole file so they stay stable while filtering.
 */
export function buildWaterfallModel(
	entries: HAREntry[],
	pages: HARPage[] | undefined,
	view: { start: number; end: number } | null
): WaterfallModel {
	const captureStart = getCaptureStart(entries);
	const bars = new Map<number, WaterfallBar>();
	let captureEnd = 0;
	const firstStartByPage = new Map<string, number>();

	entries.forEach((entry, index) => {
		const raw = getEntryStartTime(entry);
		const valid = raw > 0 && captureStart > 0;
		const start = valid ? raw - captureStart : 0;
		const { segments, duration } = getBarSegments(entry);
		bars.set(index, { start, duration, segments, hasValidStart: valid });
		captureEnd = Math.max(captureEnd, start + duration);
		if (valid && typeof entry.pageref === "string" && entry.pageref) {
			const known = firstStartByPage.get(entry.pageref);
			if (known === undefined || start < known) firstStartByPage.set(entry.pageref, start);
		}
	});

	const markers: PageMarker[] = [];
	const pageList = Array.isArray(pages) ? pages : [];
	pageList.forEach((page, pageIndex) => {
		const pageId = typeof page.id === "string" ? page.id : undefined;
		let pageStart = Date.parse(
			typeof page.startedDateTime === "string" ? page.startedDateTime : ""
		);
		pageStart =
			Number.isFinite(pageStart) && captureStart > 0
				? pageStart - captureStart
				: ((pageId ? firstStartByPage.get(pageId) : undefined) ??
					(pageList.length === 1 ? 0 : NaN));
		if (!Number.isFinite(pageStart)) return;

		const timings = page.pageTimings;
		const values: [PageMarkerKind, unknown][] = [
			["dcl", timings?.onContentLoad],
			["load", timings?.onLoad],
		];
		for (const [kind, value] of values) {
			if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
			const offset = pageStart + value;
			if (offset < 0) continue;
			markers.push({
				key: `${pageIndex}-${kind}`,
				kind,
				offset,
				value,
				pageTitle:
					typeof page.title === "string" && page.title
						? page.title
						: pageId || `Page ${pageIndex + 1}`,
			});
			captureEnd = Math.max(captureEnd, offset);
		}
	});

	captureEnd = Math.max(captureEnd, 1);
	const viewStart = view ? Math.max(0, view.start) : 0;
	const viewEnd = view ? Math.max(viewStart + 1, view.end) : captureEnd;

	return { captureStart, captureEnd, viewStart, viewEnd, bars, markers };
}

/** Converts a capture offset to a percentage of the visible window. */
export function toViewPct(model: WaterfallModel, offset: number): number {
	return ((offset - model.viewStart) / (model.viewEnd - model.viewStart)) * 100;
}
