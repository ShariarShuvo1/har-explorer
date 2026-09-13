"use client";

import { useMemo } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useHarStore } from "@/lib/stores/har-store";
import {
	formatBytes,
	formatTime,
	getEntryContentSize,
	getEntryTransferSize,
	nonNegative,
} from "@/lib/har-parser";
import { TIMING_BG, TIMING_LABELS, TIMING_PHASES } from "@/lib/timing";
import { MARKER_LABELS, type WaterfallModel } from "@/lib/waterfall";
import { cn } from "@/lib/cn";

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
	return (
		<span className={cn("whitespace-nowrap", className)}>
			<span className="text-muted-foreground">{label} </span>
			<span className="font-medium text-foreground tabular-nums">{value}</span>
		</span>
	);
}

/** DevTools-style summary of the requests currently listed. */
export function RequestsStatusBar({
	indices,
	model,
}: {
	indices: number[];
	model: WaterfallModel;
}) {
	const entries = useHarStore((s) => s.entries);

	const stats = useMemo(() => {
		let transferred = 0;
		let resources = 0;
		let totalTime = 0;
		let first = Infinity;
		let last = -Infinity;
		for (const index of indices) {
			const entry = entries[index];
			if (!entry) continue;
			transferred += getEntryTransferSize(entry);
			resources += getEntryContentSize(entry);
			totalTime += nonNegative(entry.time);
			const bar = model.bars.get(index);
			if (bar?.hasValidStart) {
				first = Math.min(first, bar.start);
				last = Math.max(last, bar.start + bar.duration);
			}
		}
		return {
			transferred,
			resources,
			finish: Number.isFinite(first) ? last - first : 0,
			average: indices.length > 0 ? totalTime / indices.length : 0,
		};
	}, [indices, entries, model.bars]);

	const firstMarkers = new Map<string, number>();
	for (const marker of model.markers) {
		if (!firstMarkers.has(marker.kind)) firstMarkers.set(marker.kind, marker.value);
	}

	return (
		<div
			role="status"
			aria-live="polite"
			className="scrollbar-none flex h-8 shrink-0 items-center gap-x-4 overflow-x-auto border-t bg-muted/30 px-3 text-xs sm:px-4"
		>
			<Stat
				label={indices.length === entries.length ? "Requests" : "Showing"}
				value={
					indices.length === entries.length
						? entries.length.toLocaleString()
						: `${indices.length.toLocaleString()} of ${entries.length.toLocaleString()}`
				}
			/>
			<Stat label="Transferred" value={formatBytes(stats.transferred)} />
			<Stat label="Resources" value={formatBytes(stats.resources)} className="hidden sm:inline" />
			<Stat label="Finish" value={formatTime(stats.finish)} />
			<Stat label="Avg" value={formatTime(stats.average)} className="hidden md:inline" />
			{[...firstMarkers].map(([kind, value]) => (
				<span key={kind} className="hidden items-center gap-1.5 whitespace-nowrap lg:inline-flex">
					<span
						className={cn("h-3 w-0.5 rounded-full", kind === "dcl" ? "bg-info" : "bg-destructive")}
						aria-hidden="true"
					/>
					<span className="text-muted-foreground">
						{MARKER_LABELS[kind as keyof typeof MARKER_LABELS]}
					</span>
					<span className="font-medium text-foreground tabular-nums">{formatTime(value)}</span>
				</span>
			))}
			<HoverCard openDelay={150} closeDelay={100}>
				<HoverCardTrigger asChild>
					<Button variant="ghost" size="xs" className="ml-auto h-6 shrink-0 text-muted-foreground">
						<Palette />
						<span className="hidden sm:inline">Timing colors</span>
					</Button>
				</HoverCardTrigger>
				<HoverCardContent side="top" align="end" className="w-56">
					<p className="mb-2 text-xs font-medium">Waterfall phases</p>
					<ul className="space-y-1.5 text-xs">
						{TIMING_PHASES.map((phase) => (
							<li key={phase} className="flex items-center gap-2">
								<span className={cn("size-2.5 rounded-sm", TIMING_BG[phase])} aria-hidden="true" />
								{TIMING_LABELS[phase]}
							</li>
						))}
						<li className="flex items-center gap-2 border-t pt-1.5">
							<span className="h-3 w-0.5 rounded-full bg-info" aria-hidden="true" />
							{MARKER_LABELS.dcl}
						</li>
						<li className="flex items-center gap-2">
							<span className="h-3 w-0.5 rounded-full bg-destructive" aria-hidden="true" />
							{MARKER_LABELS.load}
						</li>
					</ul>
				</HoverCardContent>
			</HoverCard>
		</div>
	);
}
