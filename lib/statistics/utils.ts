import type { HAREntry, HARNameValue } from "@/lib/har-types";

/** Percentage of `part` in `total`, clamped to 0–100 and 0 when undefined. */
export function percentOf(part: number, total: number): number {
	if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
		return 0;
	}
	return Math.min(100, Math.max(0, (part / total) * 100));
}

/** Start time in epoch ms, or null when `startedDateTime` is missing/invalid. */
export function getValidStartTime(entry: HAREntry): number | null {
	const time = Date.parse(entry.startedDateTime);
	return Number.isFinite(time) ? time : null;
}

/** 4xx/5xx responses and requests that never got a response (status 0). */
export function isFailedEntry(entry: HAREntry): boolean {
	const status = entry.response.status;
	return status >= 400 || status <= 0;
}

export function lowerCaseHeaderMap(headers: HARNameValue[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const header of headers) {
		const name = header.name.toLowerCase();
		if (!map.has(name)) map.set(name, header.value);
	}
	return map;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}
