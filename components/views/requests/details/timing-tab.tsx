"use client";

import { useMemo } from "react";
import { Lightbulb, TriangleAlert } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import {
	formatBytes,
	formatTime,
	getEntryContentSize,
	getEntryStartTime,
	getHeaderValue,
} from "@/lib/har-parser";
import { getCaptureStart } from "@/lib/filter-entries";
import { useHarStore } from "@/lib/stores/har-store";
import {
	TIMING_BG,
	TIMING_LABELS,
	formatSignedTime,
	getBarSegments,
	getTimingPhases,
} from "@/lib/timing";
import { calculatePerformanceMetrics, isTextualMimeType, percentOf } from "@/lib/entry/entry-utils";
import type { PerformanceMetrics } from "@/lib/entry/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Tone } from "@/components/common/stat-card";
import { cn } from "@/lib/cn";
import { Section, StatChip, TabBody, formatStartedDateTime } from "./shared";

/** Text responses above this size should be compressed on the wire. */
const COMPRESSION_THRESHOLD = 10 * 1024;

function getScore(metrics: PerformanceMetrics): number | null {
	if (!metrics.hasTimingData) return null;
	const penalty =
		(metrics.ttfb / 1000) * 10 +
		(metrics.breakdownTotal / 3000) * 20 +
		(metrics.dnsLookup / 100) * 10 +
		((metrics.tcpConnection + metrics.tlsHandshake) / 100) * 10;
	return Math.max(0, 100 - Math.min(100, penalty));
}

function scoreLabel(score: number | null): { label: string; tone: Tone } {
	if (score === null) return { label: "No data", tone: "default" };
	if (score >= 90) return { label: "Excellent", tone: "success" };
	if (score >= 70) return { label: "Good", tone: "info" };
	if (score >= 50) return { label: "Average", tone: "warning" };
	return { label: "Poor", tone: "destructive" };
}

function getInsights(
	entry: HAREntry,
	metrics: PerformanceMetrics
): Array<{ text: string; type: "info" | "warning" }> {
	const insights: Array<{ text: string; type: "info" | "warning" }> = [];
	if (!metrics.hasTimingData) {
		return [
			{
				type: "info",
				text: "This entry has no timing data (it may have been served from cache or failed).",
			},
		];
	}

	if (metrics.blocked > 100) {
		insights.push({
			type: "warning",
			text: `The request was queued for ${formatTime(metrics.blocked)}. Too many parallel requests to one host (HTTP/1.1 allows 6) or low priority; HTTP/2 multiplexing helps.`,
		});
	}
	if (metrics.dnsLookup > 100) {
		insights.push({
			type: "warning",
			text: `DNS lookup is slow (${formatTime(metrics.dnsLookup)}). Consider dns-prefetch/preconnect hints or fewer third-party domains.`,
		});
	}
	if (metrics.tcpConnection > 100) {
		insights.push({
			type: "warning",
			text: `TCP connection is slow (${formatTime(metrics.tcpConnection)}). Reuse connections (keep-alive, HTTP/2) or use a CDN closer to users.`,
		});
	}
	if (metrics.tlsHandshake > 100) {
		insights.push({
			type: "warning",
			text: `TLS handshake is slow (${formatTime(metrics.tlsHandshake)}). Enable TLS 1.3, session resumption and OCSP stapling.`,
		});
	}
	if (metrics.serverProcessing > 200) {
		insights.push({
			type: "warning",
			text: `The server took ${formatTime(metrics.serverProcessing)} to respond (TTFB ${formatTime(metrics.ttfb)}). Optimize server-side processing or cache the response.`,
		});
	}
	if (metrics.contentDownload > 500) {
		insights.push({
			type: "warning",
			text: `Content download is slow (${formatTime(metrics.contentDownload)}). Reduce the payload size or compress it.`,
		});
	}

	const size = getEntryContentSize(entry);
	const encoding = getHeaderValue(entry.response.headers, "content-encoding");
	if (
		size > COMPRESSION_THRESHOLD &&
		!encoding &&
		isTextualMimeType(entry.response.content.mimeType)
	) {
		insights.push({
			type: "warning",
			text: `${formatBytes(size)} text response sent without Content-Encoding. Enable gzip, Brotli or zstd compression.`,
		});
	}

	if (insights.length === 0) {
		insights.push({
			type: "info",
			text: "Performance looks good! No major bottlenecks detected.",
		});
	}
	return insights;
}

function StackedBar({ entry }: { entry: HAREntry }) {
	const { segments } = getBarSegments(entry);
	if (segments.length === 0) return null;
	return (
		<div
			className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
			role="img"
			aria-label="Timing breakdown"
		>
			{segments.map((segment) => (
				<div
					key={segment.phase}
					className={cn("relative h-full", TIMING_BG[segment.phase])}
					style={{ width: `${segment.pct}%` }}
					title={TIMING_LABELS[segment.phase]}
				>
					{segment.sslPct !== undefined && (
						<div
							className={cn("absolute inset-y-0 right-0", TIMING_BG.ssl)}
							style={{ width: `${segment.sslPct}%` }}
						/>
					)}
				</div>
			))}
		</div>
	);
}

function PhaseRows({ entry }: { entry: HAREntry }) {
	const phases = getTimingPhases(entry);
	const { duration } = getBarSegments(entry);

	return (
		<ul className="divide-y rounded-lg border">
			{phases.map(({ phase, value, nested }) => {
				const pct = value !== null ? percentOf(value, duration) : 0;
				return (
					<li
						key={phase}
						className={cn(
							"grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 @sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_5rem]",
							nested && "pl-7"
						)}
					>
						<span className="flex min-w-0 items-center gap-2 text-[13px]">
							<span className={cn("size-2.5 shrink-0 rounded-sm", TIMING_BG[phase])} />
							<span className="truncate">
								{TIMING_LABELS[phase]}
								{nested && <span className="text-muted-foreground"> (part of connection)</span>}
							</span>
						</span>
						<span className="text-right font-mono text-xs tabular-nums @sm:order-last">
							{value === null ? (
								<span className="text-muted-foreground">n/a</span>
							) : (
								formatTime(value)
							)}
						</span>
						<div className="col-span-2 flex items-center gap-2 @sm:col-span-1">
							<div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
								<div
									className={cn("h-full rounded-full", TIMING_BG[phase])}
									style={{ width: `${pct}%` }}
								/>
							</div>
							<span className="w-11 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
								{value === null ? "" : `${pct.toFixed(1)}%`}
							</span>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

export function TimingTab({ entry }: { entry: HAREntry }) {
	const entries = useHarStore((s) => s.entries);
	const captureStart = useMemo(() => getCaptureStart(entries), [entries]);
	const metrics = useMemo(() => calculatePerformanceMetrics(entry), [entry]);
	const insights = useMemo(() => getInsights(entry, metrics), [entry, metrics]);
	const score = getScore(metrics);
	const { label: scoreText, tone: scoreTone } = scoreLabel(score);
	const start = getEntryStartTime(entry);
	const offset = start > 0 && captureStart > 0 ? start - captureStart : null;

	// Exporter-specific extras such as Chrome's `_blocked_queueing`.
	const customTimings = Object.entries(entry.timings).filter(
		([key, value]) => key.startsWith("_") && typeof value === "number"
	);

	return (
		<TabBody>
			<div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
				<StatChip label="Total" value={formatTime(metrics.totalTime)} tone="primary" />
				<StatChip
					label="Time to first byte"
					value={formatTime(metrics.ttfb)}
					tone={metrics.ttfb > 200 ? "warning" : "default"}
					hint="Everything before the first response byte: queueing, DNS, connection, sending and waiting"
				/>
				<StatChip
					label="Started at"
					value={offset === null ? "—" : formatSignedTime(offset)}
					hint="Offset from the first request in the capture"
				/>
				<StatChip
					label="Score"
					value={score === null ? "—" : `${score.toFixed(0)} · ${scoreText}`}
					tone={scoreTone}
					hint="Rough estimate from the timings"
				/>
			</div>
			<p className="text-xs text-muted-foreground">
				Started {formatStartedDateTime(entry.startedDateTime)}
			</p>

			<Section title="Timing breakdown">
				{metrics.hasTimingData ? (
					<div className="space-y-3">
						<StackedBar entry={entry} />
						<PhaseRows entry={entry} />
					</div>
				) : (
					<p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
						No timing data was recorded for this request.
					</p>
				)}
				{customTimings.length > 0 && (
					<div className="flex flex-wrap gap-1.5 pt-1">
						{customTimings.map(([key, value]) => (
							<span
								key={key}
								className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
							>
								{key}: {formatTime(value)}
							</span>
						))}
					</div>
				)}
			</Section>

			<Section title="Performance insights">
				<div className="space-y-2">
					{insights.map((insight, i) => (
						<Alert
							key={i}
							className={cn(
								insight.type === "warning"
									? "border-warning/30 bg-warning/5 text-warning"
									: "border-info/30 bg-info/5 text-info"
							)}
						>
							{insight.type === "warning" ? <TriangleAlert /> : <Lightbulb />}
							<AlertDescription className="text-foreground">{insight.text}</AlertDescription>
						</Alert>
					))}
				</div>
			</Section>

			<Section title="Network efficiency">
				<div className="space-y-2 rounded-lg border p-3">
					<div className="flex items-center justify-between gap-2 text-sm">
						<span className="text-muted-foreground">Download vs total time</span>
						<span className="font-mono text-xs font-semibold tabular-nums">
							{metrics.efficiency.toFixed(1)}%
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary"
							style={{ width: `${metrics.efficiency}%` }}
						/>
					</div>
					<p className="text-xs text-muted-foreground">
						{!metrics.hasTimingData
							? "No timing data available"
							: metrics.efficiency < 20
								? "Low efficiency: most of the time is spent before the first byte (latency, connection setup, server)"
								: metrics.efficiency > 60
									? "High efficiency: most of the time is spent transferring data"
									: "Moderate efficiency: balanced latency and transfer"}
					</p>
				</div>
			</Section>
		</TabBody>
	);
}
