import { HAREntry } from "@/lib/stores/har-store";

export interface TimelineEntry {
	entry: HAREntry;
	originalIndex: number;
	offset: number;
	duration: number;
	segments: { type: string; value: number }[];
	total: number;
	startTime: number;
	endTime: number;
}

export interface TooltipData {
	entry: HAREntry;
	x: number;
	y: number;
	segments: { type: string; value: number }[];
}
