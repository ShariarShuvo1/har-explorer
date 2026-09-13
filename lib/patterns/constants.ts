import type { PatternSeverity } from "./types";

export const THRESHOLDS = {
	WATERFALL_GAP_MS: 500,
	LARGE_COOKIE_KB: 4,
	API_BATCHING_WINDOW_MS: 2000,
	DNS_SLOW_MS: 200,
	SSL_SLOW_MS: 500,
	WAIT_SLOW_MS: 3000,
	SEQUENTIAL_LOADING_PERCENT: 0.3,
	SEQUENTIAL_MIN_REQUESTS: 5,
	LARGE_IMAGE_BYTES: 100 * 1024,
} as const;

export const SEVERITIES: readonly PatternSeverity[] = ["high", "medium", "low"];

export const SEVERITY_ORDER: Record<PatternSeverity, number> = {
	high: 0,
	medium: 1,
	low: 2,
};
