"use client";

import { memo } from "react";
import type { HAREntry } from "@/lib/har-types";
import {
	formatBytes,
	formatTime,
	getBaseMimeType,
	getEntryContentSize,
	getEntryTransferSize,
} from "@/lib/har-parser";
import { TIMING_BG, TIMING_LABELS, computeTicks, getTimingPhases } from "@/lib/timing";
import { MARKER_LABELS, toViewPct, type WaterfallBar, type WaterfallModel } from "@/lib/waterfall";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/cn";

const MARKER_COLOR = { dcl: "bg-info", load: "bg-destructive" } as const;

export function TimingBreakdownList({
	entry,
	startOffset,
}: {
	entry: HAREntry;
	startOffset?: number;
}) {
	const phases = getTimingPhases(entry);
	return (
		<div className="space-y-2 text-xs">
			{startOffset !== undefined && (
				<div className="flex justify-between text-muted-foreground">
					<span>Started at</span>
					<span className="tabular-nums">{formatTime(startOffset)}</span>
				</div>
			)}
			<ul className="space-y-1">
				{phases.map(({ phase, value, nested }) => (
					<li key={phase} className={cn("flex items-center gap-2", value === null && "opacity-50")}>
						<span className={cn("size-2 shrink-0 rounded-sm", TIMING_BG[phase])} />
						<span className={cn("flex-1", nested && "pl-3 text-muted-foreground")}>
							{TIMING_LABELS[phase]}
						</span>
						<span className="font-mono tabular-nums">
							{value === null ? "—" : formatTime(value)}
						</span>
					</li>
				))}
			</ul>
			<div className="flex justify-between border-t pt-2 font-medium">
				<span>Total</span>
				<span className="font-mono tabular-nums">{formatTime(entry.time)}</span>
			</div>
			<div className="flex justify-between text-muted-foreground">
				<span>Transferred</span>
				<span className="tabular-nums">{formatBytes(getEntryTransferSize(entry))}</span>
			</div>
			<div className="flex justify-between text-muted-foreground">
				<span>Resource size</span>
				<span className="tabular-nums">{formatBytes(getEntryContentSize(entry))}</span>
			</div>
			<div className="flex justify-between gap-3 text-muted-foreground">
				<span>Type</span>
				<span className="truncate font-mono">
					{getBaseMimeType(entry.response.content.mimeType) || "unknown"}
				</span>
			</div>
		</div>
	);
}

function Bar({ bar, model }: { bar: WaterfallBar; model: WaterfallModel }) {
	const left = toViewPct(model, bar.start);
	const width = Math.max((bar.duration / (model.viewEnd - model.viewStart)) * 100, 0.3);
	if (left > 100 || left + width < 0) return null;

	return (
		<div
			className={cn(
				"absolute top-1/2 flex h-2.5 -translate-y-1/2 overflow-hidden rounded-[3px]",
				!bar.hasValidStart && "opacity-40"
			)}
			style={{ left: `${left}%`, width: `${width}%`, minWidth: 2 }}
		>
			{bar.segments.length === 0 ? (
				<div className="h-full w-full bg-muted-foreground/40" />
			) : (
				bar.segments.map((segment) => (
					<div
						key={segment.phase}
						className={cn("relative h-full", TIMING_BG[segment.phase])}
						style={{ width: `${segment.pct}%` }}
					>
						{segment.sslPct !== undefined && (
							<div
								className="absolute inset-y-0 right-0 bg-phase-ssl"
								style={{ width: `${segment.sslPct}%` }}
							/>
						)}
					</div>
				))
			)}
		</div>
	);
}

export const WaterfallCell = memo(function WaterfallCell({
	entry,
	bar,
	model,
}: {
	entry: HAREntry;
	bar: WaterfallBar | undefined;
	model: WaterfallModel;
}) {
	if (!bar) return null;
	return (
		<HoverCard openDelay={350} closeDelay={80}>
			<HoverCardTrigger asChild>
				<div className="relative h-full w-full overflow-hidden">
					{model.markers.map((marker) => {
						const pct = toViewPct(model, marker.offset);
						if (pct < 0 || pct > 100) return null;
						return (
							<div
								key={marker.key}
								className={cn("absolute inset-y-0 w-px opacity-40", MARKER_COLOR[marker.kind])}
								style={{ left: `${pct}%` }}
							/>
						);
					})}
					<Bar bar={bar} model={model} />
				</div>
			</HoverCardTrigger>
			<HoverCardContent side="left" align="center" className="w-64">
				<TimingBreakdownList
					entry={entry}
					startOffset={bar.hasValidStart ? bar.start : undefined}
				/>
			</HoverCardContent>
		</HoverCard>
	);
});

export function WaterfallHeader({ model, width }: { model: WaterfallModel; width: number }) {
	const ticks = computeTicks(model.viewStart, model.viewEnd, width, 70);
	return (
		<div className="relative h-full w-full overflow-hidden" aria-hidden="true">
			{ticks.map((tick) => {
				const pct = toViewPct(model, tick.offset);
				return (
					<span
						key={tick.offset}
						className="absolute top-1/2 -translate-y-1/2 pl-1 text-[10px] font-normal whitespace-nowrap text-muted-foreground normal-case tabular-nums"
						style={{ left: `${pct}%` }}
					>
						<span className="absolute inset-y-[-8px] left-0 w-px bg-border" />
						{tick.label}
					</span>
				);
			})}
		</div>
	);
}

export function MarkerLegend({ model }: { model: WaterfallModel }) {
	if (model.markers.length === 0) return null;
	const seen = new Set<string>();
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
			{model.markers.map((marker) => {
				if (seen.has(marker.kind)) return null;
				seen.add(marker.kind);
				return (
					<span key={marker.key} className="inline-flex items-center gap-1.5">
						<span className={cn("h-3 w-0.5 rounded-full", MARKER_COLOR[marker.kind])} />
						{MARKER_LABELS[marker.kind]}
						<span className="text-foreground tabular-nums">{formatTime(marker.value)}</span>
					</span>
				);
			})}
		</div>
	);
}
