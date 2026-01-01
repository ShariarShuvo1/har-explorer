export const THRESHOLDS = {
	WATERFALL_GAP_MS: 500,
	LARGE_COOKIE_KB: 4,
	API_BATCHING_WINDOW_MS: 2000,
	DNS_SLOW_MS: 200,
	SSL_SLOW_MS: 500,
	WAIT_SLOW_MS: 3000,
	SEQUENTIAL_LOADING_PERCENT: 0.3,
} as const;

export const PATTERN_CATEGORIES = {
	PERFORMANCE: ["waterfall-gaps", "sequential", "timing-anomalies"],
	CACHING: ["uncached", "duplicate"],
	SECURITY: ["mixed-content", "cors"],
	OPTIMIZATION: ["api-batching", "large-cookies", "priority-mismatch"],
	ERRORS: ["failed", "redirect"],
} as const;

export const SEVERITY_LABELS = {
	high: "High Priority",
	medium: "Medium Priority",
	low: "Low Priority",
} as const;
