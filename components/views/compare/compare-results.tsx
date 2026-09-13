"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Shuffle } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import type { CompareRow, RowFlags } from "@/lib/har-compare";
import {
	extractDomain,
	extractPath,
	formatBytes,
	formatTime,
	getEntryTransferSize,
} from "@/lib/har-parser";
import { formatSignedTime } from "@/lib/timing";
import { cn } from "@/lib/cn";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCompareUiStore, type CompareSortKey } from "./compare-ui-store";
import { ChangeBadge, SizeCell, StatusChange, TimeCell, rowAccent } from "./row-parts";
import { TONE_CLASSES, formatSignedBytes, sizeDeltaOf, toneForDelta } from "./utils";

export type ResultsLayout = "cards" | "diff" | "side";

const ESTIMATES: Record<ResultsLayout, number> = { cards: 112, diff: 56, side: 64 };

const DIFF_COLUMNS = "grid-cols-[5.5rem_minmax(0,1fr)_7rem_8.5rem_8.5rem_2rem] gap-3";
const DIFF_COLUMNS_WIDE = "grid-cols-[5.5rem_4.5rem_minmax(0,1fr)_8rem_10rem_10rem_2rem] gap-3";
const SIDE_COLUMNS = "grid-cols-[minmax(0,1fr)_9.5rem_minmax(0,1fr)] gap-2";

interface CompareResultsProps {
	rows: CompareRow[];
	flags: Map<string, RowFlags>;
	layout: ResultsLayout;
	/** Container is wide enough for a separate method column. */
	wide: boolean;
	baselineName: string;
	comparisonName: string;
	onDetails: (row: CompareRow) => void;
	onJump: (row: CompareRow) => void;
	empty: ReactNode;
}

export function CompareResults({
	rows,
	flags,
	layout,
	wide,
	baselineName,
	comparisonName,
	onDetails,
	onJump,
	empty,
}: CompareResultsProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const setScroll = useCompareUiStore((s) => s.setScroll);
	// Restores the position after returning from another view.
	const [initialOffset] = useState(() => {
		const { scrollKey, scrollOffset } = useCompareUiStore.getState();
		return scrollKey === layout ? scrollOffset : 0;
	});

	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => ESTIMATES[layout],
		overscan: 8,
		getItemKey: (index) => rows[index].id,
		initialOffset,
	});

	const lastRows = useRef(rows);
	useEffect(() => {
		if (lastRows.current === rows) return;
		lastRows.current = rows;
		parentRef.current?.scrollTo({ top: 0 });
	}, [rows]);

	return (
		<div
			ref={parentRef}
			onScroll={(e) => setScroll(e.currentTarget.scrollTop, layout)}
			className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-xl border bg-card shadow-xs"
		>
			{layout === "diff" && <DiffHeader wide={wide} />}
			{layout === "side" && (
				<SideHeader baselineName={baselineName} comparisonName={comparisonName} />
			)}
			{rows.length === 0 ? (
				<div className="flex min-h-64 items-center justify-center p-6">{empty}</div>
			) : (
				<div
					role="list"
					aria-label="Compared requests"
					className="relative w-full"
					style={{ height: `${virtualizer.getTotalSize()}px` }}
				>
					{virtualizer.getVirtualItems().map((item) => {
						const row = rows[item.index];
						const rowFlags = flags.get(row.id);
						return (
							<div
								key={item.key}
								role="listitem"
								data-index={item.index}
								ref={virtualizer.measureElement}
								className="absolute top-0 left-0 w-full"
								style={{ transform: `translateY(${item.start}px)` }}
							>
								{layout === "cards" ? (
									<CardRow row={row} flags={rowFlags} onDetails={onDetails} onJump={onJump} />
								) : layout === "diff" ? (
									<DiffRow
										row={row}
										flags={rowFlags}
										wide={wide}
										onDetails={onDetails}
										onJump={onJump}
									/>
								) : (
									<SideRow row={row} flags={rowFlags} onDetails={onDetails} onJump={onJump} />
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ headers */

function SortButton({ sortKey, label }: { sortKey: CompareSortKey; label: string }) {
	const activeKey = useCompareUiStore((s) => s.sortKey);
	const direction = useCompareUiStore((s) => s.sortDirection);
	const toggleSort = useCompareUiStore((s) => s.toggleSort);
	const active = activeKey === sortKey;
	const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
	return (
		<Button
			type="button"
			variant="ghost"
			size="xs"
			onClick={() => toggleSort(sortKey)}
			aria-label={`Sort by ${label}${active ? (direction === "asc" ? ", ascending" : ", descending") : ""}`}
			className={cn("-mx-1 font-medium", active ? "text-foreground" : "text-muted-foreground")}
		>
			{label}
			<Icon className={cn(!active && "opacity-50")} aria-hidden="true" />
		</Button>
	);
}

const HEADER_CLASS =
	"sticky top-0 z-10 grid h-9 items-center border-b border-l-2 border-l-transparent bg-muted/80 px-3 text-xs font-medium text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/60";

function DiffHeader({ wide }: { wide: boolean }) {
	return (
		<div className={cn(HEADER_CLASS, wide ? DIFF_COLUMNS_WIDE : DIFF_COLUMNS)}>
			<span>Change</span>
			{wide && <span>Method</span>}
			<span className="flex min-w-0 items-center gap-2">
				<span className="mr-1">Request</span>
				<SortButton sortKey="order" label="Timeline" />
				<SortButton sortKey="url" label="URL" />
			</span>
			<span>
				<SortButton sortKey="status" label="Status" />
			</span>
			<span className="flex justify-end gap-1">
				<SortButton sortKey="timeDelta" label="Time Δ" />
				<SortButton sortKey="timePct" label="%" />
			</span>
			<span className="flex justify-end">
				<SortButton sortKey="sizeDelta" label="Size Δ" />
			</span>
			<span className="sr-only">Actions</span>
		</div>
	);
}

function SideHeader({
	baselineName,
	comparisonName,
}: {
	baselineName: string;
	comparisonName: string;
}) {
	return (
		<div className={cn(HEADER_CLASS, SIDE_COLUMNS)}>
			<span className="flex min-w-0 items-center gap-2">
				<span className="text-foreground">Baseline</span>
				<span className="min-w-0 flex-1 truncate font-mono font-normal" title={baselineName}>
					{baselineName}
				</span>
				<SortButton sortKey="order" label="Order" />
			</span>
			<span className="flex justify-center gap-1">
				<SortButton sortKey="timeDelta" label="Time" />
				<SortButton sortKey="sizeDelta" label="Size" />
			</span>
			<span className="flex min-w-0 items-center gap-2">
				<span className="text-foreground">Comparison</span>
				<span className="min-w-0 truncate font-mono font-normal" title={comparisonName}>
					{comparisonName}
				</span>
			</span>
		</div>
	);
}

/* --------------------------------------------------------------------- rows */

interface RowProps {
	row: CompareRow;
	flags?: RowFlags;
	onDetails: (row: CompareRow) => void;
	onJump: (row: CompareRow) => void;
}

function rowLabel(row: CompareRow) {
	const entry = row.kind === "added" ? row.comparison : row.baseline;
	const kind =
		row.kind === "added"
			? "only in comparison"
			: row.kind === "removed"
				? "only in baseline"
				: "matched";
	return `Show comparison details: ${entry.request.method} ${entry.request.url}, ${kind}`;
}

/** Full-row button underneath the content, so inner actions stay separate controls. */
// Row content is pointer-events-none so the whole row stays clickable; the
// hover title therefore lives on the button itself.
function rowTitle(row: CompareRow): string {
	if (row.kind === "added") return row.comparison.request.url;
	if (row.kind === "removed") return row.baseline.request.url;
	const baseline = row.baseline.request.url;
	const comparison = row.comparison.request.url;
	if (row.matchedBy === "pattern") {
		return `Baseline: ${baseline}\nComparison: ${comparison}\nMatched by URL pattern`;
	}
	return baseline === comparison ? baseline : `Baseline: ${baseline}\nComparison: ${comparison}`;
}

function RowButton({ row, onDetails }: { row: CompareRow; onDetails: (row: CompareRow) => void }) {
	return (
		<button
			type="button"
			onClick={() => onDetails(row)}
			aria-label={rowLabel(row)}
			title={rowTitle(row)}
			className="absolute inset-0 rounded-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
		/>
	);
}

function JumpButton({
	row,
	onJump,
	className,
}: {
	row: CompareRow;
	onJump: (row: CompareRow) => void;
	className?: string;
}) {
	if (row.kind === "added") return <span className={className} aria-hidden="true" />;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={() => onJump(row)}
					aria-label="Open baseline request in request list"
					className={cn(
						"pointer-events-auto relative text-muted-foreground hover:text-foreground",
						className
					)}
				>
					<ExternalLink />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Open in request list</TooltipContent>
		</Tooltip>
	);
}

function PatternHint({ row }: { row: CompareRow }) {
	if (row.kind !== "matched" || row.matchedBy !== "pattern") return null;
	return (
		<span className="inline-flex min-w-0 items-center gap-1 text-primary">
			<Shuffle className="size-3 shrink-0" aria-hidden="true" />
			<span className="truncate">{extractPath(row.comparison.request.url)}</span>
		</span>
	);
}

const ROW_BASE = "group relative border-b border-l-2 transition-colors hover:bg-accent/50";

function CardRow({ row, flags, onDetails, onJump }: RowProps) {
	const entry = row.kind === "added" ? row.comparison : row.baseline;
	const url = entry.request.url;
	return (
		<div className={cn(ROW_BASE, "px-4 py-3", rowAccent(row, flags))}>
			<RowButton row={row} onDetails={onDetails} />
			<div className="pointer-events-none relative flex min-w-0 flex-col gap-1.5">
				<div className="flex min-w-0 items-center gap-2">
					<ChangeBadge row={row} flags={flags} />
					<MethodBadge method={entry.request.method} />
					<StatusChange row={row} />
					<JumpButton row={row} onJump={onJump} className="-my-1.5 ml-auto size-9" />
				</div>
				<div className="min-w-0">
					<p className="truncate font-mono text-xs text-foreground">{extractPath(url)}</p>
					<p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
						<span className="truncate">{extractDomain(url)}</span>
						<PatternHint row={row} />
					</p>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<TimeCell row={row} flags={flags} align="left" />
					<SizeCell row={row} flags={flags} align="left" />
				</div>
			</div>
		</div>
	);
}

function DiffRow({ row, flags, wide, onDetails, onJump }: RowProps & { wide: boolean }) {
	const entry = row.kind === "added" ? row.comparison : row.baseline;
	const url = entry.request.url;
	return (
		<div className={cn(ROW_BASE, rowAccent(row, flags))}>
			<RowButton row={row} onDetails={onDetails} />
			<div
				className={cn(
					"pointer-events-none relative grid min-h-14 items-center px-3 py-1.5",
					wide ? DIFF_COLUMNS_WIDE : DIFF_COLUMNS
				)}
			>
				<div>
					<ChangeBadge row={row} flags={flags} />
				</div>
				{wide && (
					<div>
						<MethodBadge method={entry.request.method} />
					</div>
				)}
				<div className="min-w-0">
					<p className="flex min-w-0 items-center gap-2">
						{!wide && <MethodBadge method={entry.request.method} />}
						<span className="truncate font-mono text-xs text-foreground">{extractPath(url)}</span>
					</p>
					<p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
						<span className="truncate">{extractDomain(url)}</span>
						<PatternHint row={row} />
					</p>
				</div>
				<div className="min-w-0">
					<StatusChange row={row} />
				</div>
				<TimeCell row={row} flags={flags} />
				<SizeCell row={row} flags={flags} />
				<div className="flex justify-end">
					<JumpButton row={row} onJump={onJump} className="size-8" />
				</div>
			</div>
		</div>
	);
}

function EntryCell({
	entry,
	highlightStatus,
	action,
}: {
	entry: HAREntry;
	highlightStatus?: boolean;
	action?: ReactNode;
}) {
	const url = entry.request.url;
	return (
		<div className="flex min-w-0 items-center gap-1">
			<div className="min-w-0 flex-1">
				<p className="flex min-w-0 items-center gap-2">
					<MethodBadge method={entry.request.method} />
					<span
						className={cn("shrink-0 rounded px-0.5", highlightStatus && "ring-1 ring-primary/70")}
					>
						<StatusBadge status={entry.response.status} />
					</span>
					<span className="truncate font-mono text-xs text-foreground">{extractPath(url)}</span>
				</p>
				<p className="flex min-w-0 items-center gap-3 font-mono text-[11px] text-muted-foreground tabular-nums">
					<span className="truncate">{extractDomain(url)}</span>
					<span className="ml-auto shrink-0">{formatTime(entry.time)}</span>
					<span className="shrink-0">{formatBytes(getEntryTransferSize(entry))}</span>
				</p>
			</div>
			{action}
		</div>
	);
}

function BlankCell({ text, tone }: { text: string; tone: "added" | "removed" }) {
	return (
		<div
			className={cn(
				"flex h-10 items-center justify-center rounded-md border border-dashed text-xs",
				tone === "added"
					? "border-success/40 text-success"
					: "border-destructive/40 text-destructive"
			)}
		>
			{text}
		</div>
	);
}

function SideRow({ row, flags, onDetails, onJump }: RowProps) {
	const timeTone =
		row.kind === "matched"
			? toneForDelta(row.delta.timeDelta, !!(flags?.slower || flags?.faster))
			: "neutral";
	const size = row.kind === "matched" ? sizeDeltaOf(row.delta).delta : 0;
	const statusChanged = row.kind === "matched" && row.delta.statusChanged;
	return (
		<div className={cn(ROW_BASE, rowAccent(row, flags))}>
			<RowButton row={row} onDetails={onDetails} />
			<div
				className={cn(
					"pointer-events-none relative grid min-h-16 items-center px-3 py-2",
					SIDE_COLUMNS
				)}
			>
				{row.kind === "added" ? (
					<BlankCell text="Not in baseline" tone="added" />
				) : (
					<EntryCell
						entry={row.baseline}
						highlightStatus={statusChanged}
						action={<JumpButton row={row} onJump={onJump} className="size-8" />}
					/>
				)}
				<div className="flex flex-col items-center gap-1 text-center font-mono text-[11px] tabular-nums">
					<ChangeBadge row={row} flags={flags} />
					{row.kind === "matched" && (
						<span className="flex gap-2">
							<span className={TONE_CLASSES[timeTone]}>
								{Math.round(row.delta.timeDelta) === 0
									? "±0 ms"
									: formatSignedTime(row.delta.timeDelta)}
							</span>
							<span className={TONE_CLASSES[toneForDelta(size, !!flags?.sizeChanged)]}>
								{formatSignedBytes(size)}
							</span>
						</span>
					)}
				</div>
				{row.kind === "removed" ? (
					<BlankCell text="Not in comparison" tone="removed" />
				) : (
					<EntryCell entry={row.comparison} highlightStatus={statusChanged} />
				)}
			</div>
		</div>
	);
}
