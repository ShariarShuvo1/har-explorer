"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import {
	ArrowLeftRight,
	CheckCircle2,
	FileJson,
	Info,
	MoreHorizontal,
	SearchX,
	Trash2,
	Upload,
} from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";
import type { HARData, HAREntry } from "@/lib/har-types";
import type { CompareRow } from "@/lib/har-compare";
import { cn } from "@/lib/cn";
import { Page, PageHeader } from "@/components/common/page";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCompareUiStore } from "./compare-ui-store";
import { CompareResults, type ResultsLayout } from "./compare-results";
import { SummaryStats, TypeBreakdown } from "./compare-summary";
import { CompareToolbar } from "./compare-toolbar";
import { FileDropTarget, useComparisonFileLoader, type ComparisonFileLoader } from "./file-loading";
import { RowDetailsSheet } from "./row-details-sheet";
import { useCompareModel } from "./use-compare-model";

export function CompareView() {
	const { entries, fileName, secondaryHarData, secondaryFileName } = useHarStore(
		useShallow((s) => ({
			entries: s.entries,
			fileName: s.fileName,
			secondaryHarData: s.secondaryHarData,
			secondaryFileName: s.secondaryFileName,
		}))
	);
	const loader = useComparisonFileLoader();
	const baselineName = fileName || "Current file";

	if (!secondaryHarData) {
		return (
			<FileDropTarget
				loader={loader}
				label="Drop to compare"
				className="flex min-h-0 flex-1 flex-col"
			>
				<NoComparison loader={loader} baselineName={baselineName} requestCount={entries.length} />
				{loader.input}
			</FileDropTarget>
		);
	}

	return (
		<FileDropTarget
			loader={loader}
			label="Drop to replace the comparison file"
			className="flex min-h-0 flex-1 flex-col"
		>
			<CompareWorkspace
				entries={entries}
				secondaryHarData={secondaryHarData}
				baselineName={baselineName}
				comparisonName={secondaryFileName || "Comparison file"}
				loader={loader}
			/>
			{loader.input}
		</FileDropTarget>
	);
}

/* ------------------------------------------------------------ empty state */

function NoComparison({
	loader,
	baselineName,
	requestCount,
}: {
	loader: ComparisonFileLoader;
	baselineName: string;
	requestCount: number;
}) {
	return (
		<Page width="default" className="max-w-3xl">
			<PageHeader
				title="Compare"
				description="Load a second capture to see which requests were added or removed, which got slower or faster, and which changed status or size. Typical uses: before vs after a deploy, or a working vs a broken session."
			/>

			<FileCard label="Baseline (currently loaded)" name={baselineName} count={requestCount} />

			<Empty className="border border-dashed bg-card py-10 md:py-14">
				<EmptyHeader>
					<EmptyMedia variant="icon">{loader.isLoading ? <Spinner /> : <Upload />}</EmptyMedia>
					<EmptyTitle>
						{loader.isLoading ? "Reading HAR file…" : "Drop a second HAR file"}
					</EmptyTitle>
					<EmptyDescription>
						It will be compared against{" "}
						<span className="font-mono break-all text-foreground">{baselineName}</span>. Drag it
						anywhere on this page or choose it from your computer.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button onClick={loader.openPicker} disabled={loader.isLoading}>
						<FileJson />
						Choose HAR file
					</Button>
					<p className="text-xs text-muted-foreground">.har or .json export</p>
				</EmptyContent>
			</Empty>

			<LoadError loader={loader} />

			<p className="flex items-start gap-2 text-xs text-muted-foreground">
				<Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
				Requests are matched by method and URL. Cache-busting query parameters are ignored and URLs
				that only differ in ids or file hashes can still be paired; both can be tuned under Options.
				The comparison file is parsed locally and never uploaded.
			</p>
		</Page>
	);
}

function LoadError({ loader }: { loader: ComparisonFileLoader }) {
	if (!loader.error) return null;
	return (
		<Alert variant="destructive">
			<Info />
			<AlertTitle>Couldn&apos;t load the comparison file</AlertTitle>
			<AlertDescription className="break-words">{loader.error}</AlertDescription>
		</Alert>
	);
}

function FileCard({
	label,
	name,
	count,
	className,
	actions,
}: {
	label: string;
	name: string;
	count: number;
	className?: string;
	actions?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex min-w-0 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-card-foreground shadow-xs",
				className
			)}
		>
			<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
				<FileJson className="size-4" aria-hidden="true" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="truncate text-sm font-medium" title={name}>
					{name}
					<span className="font-normal text-muted-foreground">
						{" "}
						· {count.toLocaleString()} {count === 1 ? "request" : "requests"}
					</span>
				</p>
			</div>
			{actions}
		</div>
	);
}

/* -------------------------------------------------------------- workspace */

/** Tracks an element's width so layouts can follow the space the view actually gets. */
function useElementWidth<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [width, setWidth] = useState(0);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	return [ref, width] as const;
}

interface CompareWorkspaceProps {
	entries: HAREntry[];
	secondaryHarData: HARData;
	baselineName: string;
	comparisonName: string;
	loader: ComparisonFileLoader;
}

function CompareWorkspace({
	entries,
	secondaryHarData,
	baselineName,
	comparisonName,
	loader,
}: CompareWorkspaceProps) {
	const comparisonMode = useHarStore((s) => s.comparisonMode);
	const openEntry = useHarStore((s) => s.openEntry);
	const setSecondaryHarData = useHarStore((s) => s.setSecondaryHarData);
	const setFilter = useCompareUiStore((s) => s.setFilter);
	const setSearch = useCompareUiStore((s) => s.setSearch);
	const resetScroll = useCompareUiStore((s) => s.resetScroll);
	const comparisonEntries = secondaryHarData.log.entries;
	const { result, summaries, flags, counts, visibleRows, identical, isFiltered } = useCompareModel(
		entries,
		comparisonEntries
	);

	const [containerRef, width] = useElementWidth<HTMLDivElement>();
	const wide = width >= 1024;
	const layout: ResultsLayout =
		width < 768 ? "cards" : comparisonMode === "side-by-side" && wide ? "side" : "diff";

	const [detailsRow, setDetailsRow] = useState<CompareRow | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [confirmSwap, setConfirmSwap] = useState(false);

	const showDetails = useCallback((row: CompareRow) => {
		setDetailsRow(row);
		setDetailsOpen(true);
	}, []);

	const jumpToRow = useCallback(
		(row: CompareRow) => {
			if (row.kind === "added") return;
			setDetailsOpen(false);
			openEntry(row.baselineIndex);
		},
		[openEntry]
	);

	const swap = () => {
		const state = useHarStore.getState();
		const current = state.harData;
		if (!current) return;
		const currentName = state.fileName;
		state.setHarData(secondaryHarData, state.secondaryFileName);
		state.setSecondaryHarData(current, currentName);
		state.setViewMode("compare");
		resetScroll();
		toast.success("Swapped baseline and comparison");
	};

	const requestSwap = () => {
		const state = useHarStore.getState();
		if (state.bookmarks.size > 0 || state.isDirty) setConfirmSwap(true);
		else swap();
	};

	const remove = () => {
		loader.clearError();
		setSecondaryHarData(null);
		resetScroll();
	};

	const bothEmpty = entries.length === 0 && comparisonEntries.length === 0;

	const empty = bothEmpty ? (
		<EmptyMessage
			icon={FileJson}
			title="Nothing to compare"
			description="Neither file contains any requests."
		/>
	) : isFiltered ? (
		<EmptyMessage
			icon={SearchX}
			title="No matching requests"
			description="No requests match the current filter or search."
			action={
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						setFilter("all");
						setSearch("");
					}}
				>
					Clear filter and search
				</Button>
			}
		/>
	) : (
		<EmptyMessage icon={FileJson} title="Nothing to compare" />
	);

	const fileActions = (
		<>
			<div className="hidden shrink-0 items-center gap-1 sm:flex">
				<Button variant="ghost" size="sm" onClick={loader.openPicker} disabled={loader.isLoading}>
					{loader.isLoading ? <Spinner /> : <Upload />}
					Replace
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={remove}
					className="text-muted-foreground hover:text-destructive"
				>
					<Trash2 />
					Remove
				</Button>
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="shrink-0 sm:hidden"
						aria-label="Comparison file actions"
					>
						{loader.isLoading ? <Spinner /> : <MoreHorizontal />}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={requestSwap}>
						<ArrowLeftRight />
						Swap baseline and comparison
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={loader.openPicker} disabled={loader.isLoading}>
						<Upload />
						Replace comparison file
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" onSelect={remove}>
						<Trash2 />
						Remove comparison
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);

	return (
		<div ref={containerRef} className="@container flex min-h-0 flex-1 flex-col overflow-y-auto">
			<div className="flex shrink-0 flex-col gap-3 px-4 pt-4 sm:px-6 lg:px-8">
				<div className="grid min-w-0 gap-2 @3xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @3xl:items-center">
					<FileCard label="Baseline" name={baselineName} count={entries.length} />
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								onClick={requestSwap}
								aria-label="Swap baseline and comparison"
								className="hidden justify-self-center rounded-full sm:inline-flex"
							>
								<ArrowLeftRight className="rotate-90 @3xl:rotate-0" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Swap baseline and comparison</TooltipContent>
					</Tooltip>
					<FileCard
						label="Comparison"
						name={comparisonName}
						count={comparisonEntries.length}
						actions={fileActions}
					/>
				</div>

				<LoadError loader={loader} />

				<SummaryStats baseline={summaries.baseline} comparison={summaries.comparison} />

				<p className="text-xs text-muted-foreground">
					<span className="font-medium text-foreground tabular-nums">
						{result.matched.toLocaleString()}
					</span>{" "}
					matched
					{result.matchedByPattern > 0 && (
						<> ({result.matchedByPattern.toLocaleString()} by URL pattern)</>
					)}
					{" · "}
					<span className="font-medium text-success tabular-nums">
						{result.added.toLocaleString()}
					</span>{" "}
					only in comparison{" · "}
					<span className="font-medium text-destructive tabular-nums">
						{result.removed.toLocaleString()}
					</span>{" "}
					only in baseline
				</p>

				{!bothEmpty && identical && (
					<Alert role="status">
						<CheckCircle2 className="text-success" />
						<AlertTitle>No differences</AlertTitle>
						<AlertDescription>
							Every request matched with the same status and type, and no size or timing change
							exceeds the thresholds.
						</AlertDescription>
					</Alert>
				)}

				<TypeBreakdown baseline={summaries.baseline} comparison={summaries.comparison} />
			</div>

			<div className="flex h-[85dvh] shrink-0 flex-col gap-3 px-4 pt-4 pb-4 sm:px-6 lg:h-auto lg:min-h-[28rem] lg:flex-1 lg:shrink lg:px-8 lg:pb-6">
				<CompareToolbar counts={counts} showSortMenu={layout === "cards"} showModeToggle={wide} />
				{width > 0 && (
					<CompareResults
						key={layout}
						rows={visibleRows}
						flags={flags}
						layout={layout}
						wide={wide}
						baselineName={baselineName}
						comparisonName={comparisonName}
						onDetails={showDetails}
						onJump={jumpToRow}
						empty={empty}
					/>
				)}
			</div>

			<RowDetailsSheet
				row={detailsRow}
				open={detailsOpen}
				onOpenChange={setDetailsOpen}
				baselineName={baselineName}
				comparisonName={comparisonName}
				onJump={jumpToRow}
			/>

			<ConfirmDialog
				open={confirmSwap}
				onOpenChange={setConfirmSwap}
				title="Swap baseline and comparison?"
				description={
					<p>
						The comparison file becomes the main file. Bookmarks, list filters and undo history on
						the current file will be cleared.
					</p>
				}
				confirmLabel="Swap files"
				onConfirm={swap}
			/>
		</div>
	);
}

function EmptyMessage({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	return (
		<Empty className="p-0 md:p-0">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Icon />
				</EmptyMedia>
				<EmptyTitle className="text-base">{title}</EmptyTitle>
				{description && <EmptyDescription>{description}</EmptyDescription>}
			</EmptyHeader>
			{action && <EmptyContent>{action}</EmptyContent>}
		</Empty>
	);
}
