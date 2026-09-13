import { normalizeHttpVersion } from "@/lib/filter-entries";

export const STATUS_CLASSES = [
	{ label: "1xx", min: 100, max: 199, title: "Informational (100–199)" },
	{ label: "2xx", min: 200, max: 299, title: "Success (200–299)" },
	{ label: "3xx", min: 300, max: 399, title: "Redirect (300–399)" },
	{ label: "4xx", min: 400, max: 499, title: "Client error (400–499)" },
	{ label: "5xx", min: 500, max: 599, title: "Server error (500–599)" },
	{ label: "Failed", min: 0, max: 0, title: "No response received (status 0)" },
] as const;

export function statusRangeLabel(range: { min: number; max: number }): string {
	return (
		STATUS_CLASSES.find((c) => c.min === range.min && c.max === range.max)?.label ??
		`${range.min}–${range.max}`
	);
}

export function isValidStatusCode(code: number): boolean {
	return Number.isInteger(code) && code >= 0 && code <= 999;
}

/**
 * Mirrors the regex detection in `matchesPattern` so the user is told when a
 * pattern that looks like a regex does not compile (it then falls back to a
 * plain substring match).
 */
export function getRegexError(pattern: string): string | null {
	const trimmed = pattern.trim();
	if (!trimmed) return null;
	const slashMatch = /^\/(.+)\/([a-z]*)$/i.exec(trimmed);
	const looksLikeRegex = /^\^|\$$|\.\*|\\[dwsb]/.test(trimmed);
	if (!slashMatch && !looksLikeRegex) return null;
	try {
		if (slashMatch) new RegExp(slashMatch[1], slashMatch[2]);
		else new RegExp(trimmed);
		return null;
	} catch {
		return "Invalid regular expression, matching as plain text";
	}
}

export const UNKNOWN_HTTP_VERSION = normalizeHttpVersion("");

/**
 * The filter normalizes stored values again, and "unknown" does not survive a
 * second normalization, so entries without a version are stored as "".
 */
export function toHttpVersionFilterValue(version: string): string {
	return version === UNKNOWN_HTTP_VERSION ? "" : version;
}

export function httpVersionLabel(version: string): string {
	return normalizeHttpVersion(version) === UNKNOWN_HTTP_VERSION ? "Unknown" : version;
}

/** Common methods first, in the order people expect, then the rest alphabetically. */
export const COMMON_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

export function compareMethods(a: string, b: string): number {
	const ai = COMMON_METHODS.indexOf(a);
	const bi = COMMON_METHODS.indexOf(b);
	if (ai !== -1 || bi !== -1) {
		return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
	}
	return a.localeCompare(b);
}

/** Compact offset for chips, e.g. "850ms" or "1.2s". */
export function formatOffset(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${Number((ms / 1000).toFixed(ms < 10_000 ? 1 : 0))}s`;
}

export const BYTES_PER_KB = 1024;

export function bytesToKb(bytes: number | null): number | null {
	return bytes === null ? null : Math.round((bytes / BYTES_PER_KB) * 100) / 100;
}

export function kbToBytes(kb: number | null): number | null {
	return kb === null ? null : Math.round(kb * BYTES_PER_KB);
}
