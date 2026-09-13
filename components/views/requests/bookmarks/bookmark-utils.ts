import type { HAREntry } from "@/lib/har-types";
import { extractPathname } from "@/lib/har-parser";

/**
 * Bookmark colors are stored as the hex values earlier versions used, so
 * existing bookmarks keep their color; the UI renders them with theme-aware
 * Tailwind classes instead of the raw hex.
 */
export const BOOKMARK_COLORS = [
	{ value: "#06b6d4", name: "Cyan", className: "bg-cyan-500 dark:bg-cyan-400" },
	{ value: "#22c55e", name: "Green", className: "bg-green-500 dark:bg-green-400" },
	{ value: "#eab308", name: "Yellow", className: "bg-yellow-500 dark:bg-yellow-400" },
	{ value: "#f97316", name: "Orange", className: "bg-orange-500 dark:bg-orange-400" },
	{ value: "#ef4444", name: "Red", className: "bg-red-500 dark:bg-red-400" },
	{ value: "#ec4899", name: "Pink", className: "bg-pink-500 dark:bg-pink-400" },
	{ value: "#a855f7", name: "Purple", className: "bg-purple-500 dark:bg-purple-400" },
	{ value: "#3b82f6", name: "Blue", className: "bg-blue-500 dark:bg-blue-400" },
] as const;

export type BookmarkColor = (typeof BOOKMARK_COLORS)[number];

export const DEFAULT_BOOKMARK_COLOR: string = BOOKMARK_COLORS[0].value;

/** Palette entry for a stored color; unknown values fall back to the default. */
export function getBookmarkColor(value: string | undefined): BookmarkColor {
	const lower = value?.toLowerCase();
	return BOOKMARK_COLORS.find((color) => color.value === lower) ?? BOOKMARK_COLORS[0];
}

/** Background class for a bookmark color dot. */
export function getBookmarkColorClass(value: string | undefined): string {
	return getBookmarkColor(value).className;
}

export function getDefaultBookmarkLabel(entry: HAREntry): string {
	const path = extractPathname(entry.request.url) || entry.request.url;
	return `${entry.request.method} ${path}`.trim();
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 365 * 24 * 3600_000],
	["month", 30 * 24 * 3600_000],
	["week", 7 * 24 * 3600_000],
	["day", 24 * 3600_000],
	["hour", 3600_000],
	["minute", 60_000],
];

/** "5 minutes ago"-style text for an ISO timestamp relative to `now`. */
export function formatRelativeTime(iso: string, now: number): string {
	const time = Date.parse(iso);
	if (!Number.isFinite(time)) return "";
	const diff = time - now;
	const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
	for (const [unit, ms] of RELATIVE_UNITS) {
		if (Math.abs(diff) >= ms) return format.format(Math.round(diff / ms), unit);
	}
	return "just now";
}
