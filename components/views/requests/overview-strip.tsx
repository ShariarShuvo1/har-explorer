"use client";

import { useMemo, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHarStore } from "@/lib/stores/har-store";
import { formatTime } from "@/lib/har-parser";
import { computeTicks } from "@/lib/timing";
import type { WaterfallModel } from "@/lib/waterfall";
import { useElementWidth } from "@/lib/hooks/use-element-width";
import { cn } from "@/lib/cn";
import { MarkerLegend } from "./waterfall";

const BUCKETS = 160;
const HEIGHT = 48;

/**
 * DevTools-style overview: request density over the whole capture. Drag to
 * zoom the waterfall (and filter the list) to a time window.
 */
export function OverviewStrip({
	model,
	indices,
}: {
	model: WaterfallModel;
	/** Indices that pass every filter except the time range. */
	indices: number[];
}) {
	const timeRange = useHarStore((s) => s.timeRange);
	const setTimeRange = useHarStore((s) => s.setTimeRange);
	const [ref, width] = useElementWidth<HTMLDivElement>();
	const trackRef = useRef<HTMLDivElement | null>(null);
	const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
	const total = model.captureEnd;

	const buckets = useMemo(() => {
		const counts = new Array<number>(BUCKETS).fill(0);
		for (const index of indices) {
			const bar = model.bars.get(index);
			if (!bar || !bar.hasValidStart) continue;
			const first = Math.min(BUCKETS - 1, Math.floor((bar.start / total) * BUCKETS));
			const last = Math.min(
				BUCKETS - 1,
				Math.floor(((bar.start + bar.duration) / total) * BUCKETS)
			);
			for (let b = first; b <= last; b++) counts[b]++;
		}
		const max = Math.max(1, ...counts);
		return counts.map((c) => c / max);
	}, [indices, model.bars, total]);

	const ticks = computeTicks(0, total, width, 90);

	const offsetAt = (clientX: number) => {
		const rect = trackRef.current?.getBoundingClientRect();
		if (!rect || rect.width === 0) return 0;
		return Math.min(total, Math.max(0, ((clientX - rect.left) / rect.width) * total));
	};

	const selection = drag
		? { start: Math.min(drag.from, drag.to), end: Math.max(drag.from, drag.to) }
		: timeRange;

	return (
		<div className="border-b bg-muted/20 px-3 py-2 sm:px-4">
			<div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<ZoomIn className="size-3.5" />
					{timeRange ? (
						<span>
							Showing{" "}
							<span className="font-medium text-foreground tabular-nums">
								{formatTime(timeRange.start)} – {formatTime(timeRange.end)}
							</span>
						</span>
					) : (
						<span>Drag across the timeline to zoom in · arrow keys pan when zoomed</span>
					)}
				</div>
				<div className="flex items-center gap-3">
					<MarkerLegend model={model} />
					{timeRange && (
						<Button variant="ghost" size="xs" onClick={() => setTimeRange(null)}>
							<X />
							Reset zoom
						</Button>
					)}
				</div>
			</div>
			<div
				ref={(node) => {
					trackRef.current = node;
					return ref(node);
				}}
				role="slider"
				tabIndex={0}
				aria-label="Time range"
				aria-valuemin={0}
				aria-valuemax={Math.round(total)}
				aria-valuenow={Math.round(timeRange?.start ?? 0)}
				aria-valuetext={
					timeRange
						? `${formatTime(timeRange.start)} to ${formatTime(timeRange.end)}`
						: "Whole capture"
				}
				onKeyDown={(e) => {
					if (e.key === "Escape" && timeRange) {
						e.stopPropagation();
						setTimeRange(null);
						return;
					}
					if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
					e.preventDefault();
					// Arrows pan the zoomed window by a tenth of its width (Shift: half).
					const range = timeRange ?? { start: 0, end: total };
					const width = range.end - range.start;
					if (width >= total) return;
					const step = width * (e.shiftKey ? 0.5 : 0.1) * (e.key === "ArrowLeft" ? -1 : 1);
					const start = Math.min(Math.max(0, range.start + step), total - width);
					setTimeRange({ start, end: start + width });
				}}
				onPointerCancel={() => setDrag(null)}
				onPointerDown={(e) => {
					if (e.button !== 0) return;
					e.currentTarget.setPointerCapture(e.pointerId);
					const at = offsetAt(e.clientX);
					setDrag({ from: at, to: at });
				}}
				onPointerMove={(e) => {
					if (!drag) return;
					setDrag({ from: drag.from, to: offsetAt(e.clientX) });
				}}
				onPointerUp={() => {
					if (!drag) return;
					const start = Math.min(drag.from, drag.to);
					const end = Math.max(drag.from, drag.to);
					setDrag(null);
					// A click (tiny drag) clears the zoom instead of selecting nothing.
					if (end - start < total / 400) setTimeRange(null);
					else setTimeRange({ start, end });
				}}
				className="relative cursor-crosshair touch-none rounded-md border bg-background select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
				style={{ height: HEIGHT }}
			>
				<div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-px px-px pt-3">
					{buckets.map((value, i) => (
						<div
							key={i}
							className="flex-1 rounded-t-[1px] bg-primary/55"
							style={{ height: `${Math.max(value > 0 ? 6 : 0, value * 100)}%` }}
						/>
					))}
				</div>
				{ticks.map((tick) => (
					<span
						key={tick.offset}
						className="pointer-events-none absolute top-0.5 pl-1 text-[10px] leading-none text-muted-foreground tabular-nums"
						style={{ left: `${(tick.offset / total) * 100}%` }}
					>
						<span
							className="absolute top-0 left-0 h-[calc(var(--h)*1px)] w-px bg-border"
							style={{ "--h": HEIGHT } as React.CSSProperties}
						/>
						{tick.label}
					</span>
				))}
				{model.markers.map((marker) => (
					<div
						key={marker.key}
						className={cn(
							"pointer-events-none absolute inset-y-0 w-0.5",
							marker.kind === "dcl" ? "bg-info" : "bg-destructive"
						)}
						style={{ left: `${(marker.offset / total) * 100}%` }}
					/>
				))}
				{selection && (
					<>
						<div
							className="pointer-events-none absolute inset-y-0 left-0 bg-background/70"
							style={{ width: `${(selection.start / total) * 100}%` }}
						/>
						<div
							className="pointer-events-none absolute inset-y-0 right-0 bg-background/70"
							style={{ width: `${100 - (selection.end / total) * 100}%` }}
						/>
						<div
							className="pointer-events-none absolute inset-y-0 border-x-2 border-primary"
							style={{
								left: `${(selection.start / total) * 100}%`,
								width: `${((selection.end - selection.start) / total) * 100}%`,
							}}
						/>
					</>
				)}
			</div>
		</div>
	);
}
