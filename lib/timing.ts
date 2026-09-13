import type { HAREntry, HARTimings } from "./har-types";
import { formatTime, nonNegative, safeParseUrl } from "./har-parser";

export const TIMING_PHASES = [
	"blocked",
	"dns",
	"connect",
	"ssl",
	"send",
	"wait",
	"receive",
] as const;

export type TimingPhase = (typeof TIMING_PHASES)[number];

export const TIMING_LABELS: Record<TimingPhase, string> = {
	blocked: "Queued / blocked",
	dns: "DNS lookup",
	connect: "Initial connection",
	ssl: "SSL/TLS",
	send: "Request sent",
	wait: "Waiting (TTFB)",
	receive: "Content download",
};

export const TIMING_SHORT_LABELS: Record<TimingPhase, string> = {
	blocked: "Blocked",
	dns: "DNS",
	connect: "Connect",
	ssl: "SSL",
	send: "Send",
	wait: "Wait",
	receive: "Receive",
};

/** Tailwind background classes backed by the --phase-* theme tokens. */
export const TIMING_BG: Record<TimingPhase, string> = {
	blocked: "bg-phase-blocked",
	dns: "bg-phase-dns",
	connect: "bg-phase-connect",
	ssl: "bg-phase-ssl",
	send: "bg-phase-send",
	wait: "bg-phase-wait",
	receive: "bg-phase-receive",
};

export const TIMING_CSS_VAR: Record<TimingPhase, string> = {
	blocked: "var(--phase-blocked)",
	dns: "var(--phase-dns)",
	connect: "var(--phase-connect)",
	ssl: "var(--phase-ssl)",
	send: "var(--phase-send)",
	wait: "var(--phase-wait)",
	receive: "var(--phase-receive)",
};

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/** Short DevTools-style name: the last path segment, or the host for "/". */
export function getEntryName(url: string, parsed: URL | null = safeParseUrl(url)): string {
	if (!parsed) {
		const path = url.split(/[?#]/)[0];
		return path.split("/").filter(Boolean).pop() || url || "/";
	}
	if (parsed.protocol === "data:") return `data:${parsed.pathname.split(/[;,]/)[0]}`;
	const last = parsed.pathname.split("/").filter(Boolean).pop();
	if (last) return safeDecode(last);
	return parsed.host ? `${parsed.host}/` : parsed.href;
}

export function formatSignedTime(ms: number): string {
	const sign = ms > 0 ? "+" : ms < 0 ? "−" : "±";
	return `${sign}${formatTime(Math.abs(ms))}`;
}

function timingValue(timings: HARTimings, phase: TimingPhase): number | null {
	const value = timings[phase];
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export interface PhaseValue {
	phase: TimingPhase;
	/** null when the phase does not apply (HAR uses -1 for that). */
	value: number | null;
	/** True for SSL when it is already counted inside connect. */
	nested: boolean;
}

export function getTimingPhases(entry: HAREntry): PhaseValue[] {
	const connect = timingValue(entry.timings, "connect");
	const ssl = timingValue(entry.timings, "ssl");
	const sslNested = ssl !== null && connect !== null && ssl <= connect;
	return TIMING_PHASES.map((phase) => ({
		phase,
		value: timingValue(entry.timings, phase),
		nested: phase === "ssl" && sslNested,
	}));
}

export interface BarSegment {
	phase: TimingPhase;
	/** Width as a percentage of the whole bar. */
	pct: number;
	/** SSL share of the connect segment, when SSL is part of connect. */
	sslPct?: number;
}

/**
 * Bar segments for a waterfall bar. Per the HAR spec `connect` includes `ssl`,
 * so SSL is drawn inside the connect segment; exporters that report a larger
 * SSL than connect clearly did not include it, so it becomes its own segment.
 */
export function getBarSegments(entry: HAREntry): { segments: BarSegment[]; duration: number } {
	const { timings } = entry;
	const connect = nonNegative(timings.connect);
	const ssl = nonNegative(timings.ssl);
	const sslNested = ssl <= connect;

	const parts: { phase: TimingPhase; value: number }[] = [];
	for (const phase of TIMING_PHASES) {
		if (phase === "ssl" && sslNested) continue;
		const value = nonNegative(timings[phase]);
		if (value > 0) parts.push({ phase, value });
	}

	const phaseSum = parts.reduce((sum, part) => sum + part.value, 0);
	const duration = Math.max(nonNegative(entry.time), phaseSum);
	if (duration <= 0) return { segments: [], duration: 0 };

	const segments = parts.map((part): BarSegment => {
		const segment: BarSegment = { phase: part.phase, pct: (part.value / duration) * 100 };
		if (part.phase === "connect" && sslNested && ssl > 0) {
			segment.sslPct = (ssl / connect) * 100;
		}
		return segment;
	});
	return { segments, duration };
}

export interface AxisTick {
	offset: number;
	label: string;
}

function stepDecimals(step: number, scale: number): number {
	return clamp(scale - Math.floor(Math.log10(step) + 1e-9), 0, 3);
}

export function formatTickLabel(ms: number, step: number): string {
	if (ms === 0) return "0";
	if (step >= 60_000) {
		const minutes = Math.floor(ms / 60_000);
		const seconds = Math.round((ms % 60_000) / 1000);
		return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
	}
	if (ms >= 1000) return `${Number((ms / 1000).toFixed(stepDecimals(step, 3)))}s`;
	return `${Number(ms.toFixed(stepDecimals(step, 0)))}ms`;
}

/** Evenly spaced 1/2/5 ticks between `start` and `end`, at least `minSpacing` px apart. */
export function computeTicks(
	start: number,
	end: number,
	widthPx: number,
	minSpacing = 80
): AxisTick[] {
	const span = end - start;
	if (!(span > 0) || !(widthPx > 0)) return [];
	const raw = (span * minSpacing) / widthPx;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
	const first = Math.ceil(start / step - 1e-9) * step;
	const ticks: AxisTick[] = [];
	for (let offset = first, i = 0; offset <= end + 1e-9 && i < 5000; offset += step, i++) {
		ticks.push({ offset, label: formatTickLabel(offset, step) });
	}
	return ticks;
}
