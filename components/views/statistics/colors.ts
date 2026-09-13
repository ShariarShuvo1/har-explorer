import type { SequenceResourceType } from "@/lib/statistics/sequence";

export interface SeriesColor {
	/** Solid fill for dots and bars. */
	fill: string;
	/** Indicator color override for `components/ui/progress`. */
	progress: string;
}

// Literal class strings so Tailwind can see them.
const CHART: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, SeriesColor> = {
	1: { fill: "bg-chart-1", progress: "*:data-[slot=progress-indicator]:bg-chart-1" },
	2: { fill: "bg-chart-2", progress: "*:data-[slot=progress-indicator]:bg-chart-2" },
	3: { fill: "bg-chart-3", progress: "*:data-[slot=progress-indicator]:bg-chart-3" },
	4: { fill: "bg-chart-4", progress: "*:data-[slot=progress-indicator]:bg-chart-4" },
	5: { fill: "bg-chart-5", progress: "*:data-[slot=progress-indicator]:bg-chart-5" },
	6: { fill: "bg-chart-6", progress: "*:data-[slot=progress-indicator]:bg-chart-6" },
	7: { fill: "bg-chart-7", progress: "*:data-[slot=progress-indicator]:bg-chart-7" },
	8: { fill: "bg-chart-8", progress: "*:data-[slot=progress-indicator]:bg-chart-8" },
};

export const NEUTRAL_COLOR: SeriesColor = CHART[8];

// Extra series for the rarer resource types. Mixing toward the foreground
// darkens in light mode and lightens in dark mode, so both themes stay legible.
const EXTRA = {
	olive: {
		fill: "bg-phase-send",
		progress: "*:data-[slot=progress-indicator]:bg-phase-send",
	},
	deepTeal: {
		fill: "bg-[color-mix(in_oklch,var(--color-chart-6),var(--color-foreground)_40%)]",
		progress:
			"*:data-[slot=progress-indicator]:bg-[color-mix(in_oklch,var(--color-chart-6),var(--color-foreground)_40%)]",
	},
	deepViolet: {
		fill: "bg-[color-mix(in_oklch,var(--color-chart-2),var(--color-foreground)_40%)]",
		progress:
			"*:data-[slot=progress-indicator]:bg-[color-mix(in_oklch,var(--color-chart-2),var(--color-foreground)_40%)]",
	},
} satisfies Record<string, SeriesColor>;

const RESOURCE_TYPE_COLORS: Record<SequenceResourceType, SeriesColor> = {
	doc: CHART[1],
	css: CHART[2],
	js: CHART[4],
	font: CHART[7],
	img: CHART[3],
	media: CHART[5],
	fetch: CHART[6],
	manifest: EXTRA.olive,
	ws: EXTRA.deepTeal,
	wasm: EXTRA.deepViolet,
	other: CHART[8],
};

export function resourceTypeColor(type: SequenceResourceType): SeriesColor {
	return RESOURCE_TYPE_COLORS[type];
}

const PRIORITY_COLORS: Record<string, SeriesColor> = {
	VeryHigh: CHART[5],
	High: CHART[4],
	Medium: CHART[3],
	Low: CHART[1],
	VeryLow: CHART[8],
};

export function priorityColor(priority: string): SeriesColor {
	return PRIORITY_COLORS[priority] ?? NEUTRAL_COLOR;
}

const INITIATOR_COLORS: Record<string, SeriesColor> = {
	parser: CHART[2],
	script: CHART[4],
	preload: CHART[3],
	prefetch: CHART[3],
	preflight: CHART[6],
	redirect: CHART[5],
	signedexchange: CHART[7],
	xhr: CHART[1],
	fetch: CHART[1],
};

export function initiatorColor(type: string): SeriesColor {
	return INITIATOR_COLORS[type] ?? NEUTRAL_COLOR;
}

export const CDN_COLOR = CHART[3];
export const ORIGIN_COLOR = CHART[1];
export const BODY_COLOR = CHART[3];
export const HEADER_COLOR = CHART[5];
