"use client";

import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import {
	useHarStore,
	type Bookmark,
	type GroupBy,
	type ListColumn,
	type SortBy,
} from "@/lib/stores/har-store";
import type { HAREntry } from "@/lib/har-types";
import type { EntryGroup } from "@/lib/filter-entries";
import {
	extractDomain,
	formatBytes,
	formatTime,
	getEntryContentSize,
	getEntryTransferSize,
	safeParseUrl,
} from "@/lib/har-parser";
import { getResourceType, RESOURCE_TYPE_LABELS } from "@/lib/resource-type";
import { getEntryName } from "@/lib/timing";
import type { WaterfallModel } from "@/lib/waterfall";
import { useElementWidth } from "@/lib/hooks/use-element-width";
import { cn } from "@/lib/cn";
import { RequestMenuItems } from "./request-actions";
import { WaterfallCell, WaterfallHeader } from "./waterfall";
import { getBookmarkColorClass } from "./bookmarks/bookmark-utils";

type Layout = "cards" | "table";

interface ColumnSpec {
	id: ListColumn | "name";
	label: string;
	width: string;
	sort?: SortBy;
	align?: "right";
	/** Minimum list width (px) for the column to be shown. */
	minWidth: number;
}

const COLUMNS: ColumnSpec[] = [
	{ id: "name", label: "Name", width: "minmax(10rem,1fr)", sort: "url", minWidth: 0 },
	{ id: "method", label: "Method", width: "4.5rem", sort: "method", minWidth: 0 },
	{ id: "status", label: "Status", width: "4.75rem", sort: "status", minWidth: 0 },
	{ id: "type", label: "Type", width: "5.5rem", minWidth: 760 },
	{ id: "size", label: "Size", width: "5.5rem", sort: "size", align: "right", minWidth: 640 },
	{ id: "time", label: "Time", width: "5rem", sort: "time", align: "right", minWidth: 0 },
	{
		id: "waterfall",
		label: "Waterfall",
		width: "minmax(9rem,1.15fr)",
		sort: "started",
		minWidth: 900,
	},
];

const CARD_BREAKPOINT = 560;
const ROW_HEIGHT = { table: 44, cards: 64 } as const;
const GROUP_HEIGHT = 34;

type Item =
	| { kind: "group"; key: string; count: number; collapsed: boolean }
	| { kind: "row"; index: number };

function groupLabel(groupBy: GroupBy, key: string) {
	if (groupBy === "type")
		return RESOURCE_TYPE_LABELS[key as keyof typeof RESOURCE_TYPE_LABELS] ?? key;
	return key;
}

interface RowProps {
	entry: HAREntry;
	index: number;
	layout: Layout;
	columns: ColumnSpec[];
	template: string;
	isActive: boolean;
	isSelected: boolean;
	bookmark: Bookmark | undefined;
	model: WaterfallModel;
	onContextTarget: (index: number) => void;
}

const RequestRow = memo(function RequestRow({
	entry,
	index,
	layout,
	columns,
	template,
	isActive,
	isSelected,
	bookmark,
	model,
	onContextTarget,
}: RowProps) {
	const { request, response } = entry;
	const parsed = safeParseUrl(request.url);
	const name = getEntryName(request.url, parsed);
	const domain = parsed?.host || extractDomain(request.url);
	const failed = response.status <= 0 || response.status >= 400;

	const onClick = (e: MouseEvent) => {
		const state = useHarStore.getState();
		if (e.shiftKey) {
			e.preventDefault();
			state.selectRange(index);
		} else if (e.metaKey || e.ctrlKey) {
			state.toggleSelection(index);
		} else {
			state.setActiveEntry(index);
		}
	};

	const checkbox = (
		<div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
			<Checkbox
				checked={isSelected}
				onClick={(e) => {
					if (e.shiftKey) {
						e.preventDefault();
						useHarStore.getState().selectRange(index);
					}
				}}
				onCheckedChange={() => useHarStore.getState().toggleSelection(index)}
				aria-label={`Select ${request.method} ${name}`}
			/>
		</div>
	);

	const rowClass = cn(
		"group relative h-full cursor-default border-b border-border/60 text-sm transition-colors",
		"hover:bg-accent/50",
		isSelected && "bg-primary/[0.06] hover:bg-primary/10",
		isActive && "bg-accent hover:bg-accent",
		failed && "text-destructive"
	);

	const activeBar = isActive && (
		<span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true" />
	);

	const bookmarkMark = bookmark && (
		<span
			role="img"
			className={cn("size-2 shrink-0 rounded-full", getBookmarkColorClass(bookmark.color))}
			aria-label={`Bookmarked: ${bookmark.label}`}
			title={bookmark.label}
		/>
	);

	if (layout === "cards") {
		return (
			<div
				role="row"
				aria-selected={isActive}
				data-index={index}
				onClick={onClick}
				onDoubleClick={() => useHarStore.getState().openEntry(index)}
				onContextMenu={() => onContextTarget(index)}
				className={cn(rowClass, "grid grid-cols-[2rem_1fr] items-center gap-x-1 pr-3 pl-1")}
			>
				{activeBar}
				{checkbox}
				<div className="min-w-0 space-y-1 py-2">
					<div className="flex min-w-0 items-center gap-2">
						<MethodBadge method={request.method} />
						<span
							className={cn("min-w-0 flex-1 truncate font-medium", !failed && "text-foreground")}
						>
							{name}
						</span>
						{bookmarkMark}
						<StatusBadge status={response.status} />
					</div>
					<div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
						<span className="min-w-0 truncate">{domain}</span>
						<span aria-hidden="true">·</span>
						<span className="shrink-0 tabular-nums">{formatTime(entry.time)}</span>
						<span aria-hidden="true">·</span>
						<span className="shrink-0 tabular-nums">
							{formatBytes(getEntryTransferSize(entry))}
						</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			role="row"
			aria-selected={isActive}
			data-index={index}
			onClick={onClick}
			onDoubleClick={() => {
				const state = useHarStore.getState();
				state.openEntry(index);
				state.setDetailsMaximized(true);
			}}
			onContextMenu={() => onContextTarget(index)}
			className={cn(rowClass, "grid items-center gap-x-3 pr-3 pl-1")}
			style={{ gridTemplateColumns: template }}
		>
			{activeBar}
			{checkbox}
			{columns.map((column) => {
				switch (column.id) {
					case "name":
						return (
							<div key="name" role="cell" className="min-w-0" title={request.url}>
								<div className="flex min-w-0 items-center gap-1.5">
									<span className={cn("truncate font-medium", !failed && "text-foreground")}>
										{name}
									</span>
									{bookmarkMark}
								</div>
								<div className="truncate text-xs text-muted-foreground">{domain}</div>
							</div>
						);
					case "method":
						return (
							<div key="method" role="cell">
								<MethodBadge method={request.method} />
							</div>
						);
					case "status":
						return (
							<div key="status" role="cell">
								<StatusBadge status={response.status} statusText={response.statusText} />
							</div>
						);
					case "type":
						return (
							<div key="type" role="cell" className="truncate text-xs text-muted-foreground">
								{RESOURCE_TYPE_LABELS[getResourceType(entry)]}
							</div>
						);
					case "size":
						return (
							<div
								key="size"
								role="cell"
								className="text-right text-xs text-muted-foreground tabular-nums"
								title={`Transferred ${formatBytes(getEntryTransferSize(entry))} · Resource ${formatBytes(getEntryContentSize(entry))}`}
							>
								{formatBytes(getEntryTransferSize(entry))}
							</div>
						);
					case "time":
						return (
							<div
								key="time"
								role="cell"
								className={cn(
									"text-right text-xs tabular-nums",
									entry.time >= 3000
										? "text-destructive"
										: entry.time >= 1000
											? "text-warning"
											: "text-muted-foreground"
								)}
							>
								{formatTime(entry.time)}
							</div>
						);
					case "waterfall":
						return (
							<div key="waterfall" role="cell" className="h-full min-w-0">
								<WaterfallCell entry={entry} bar={model.bars.get(index)} model={model} />
							</div>
						);
				}
			})}
		</div>
	);
});

export function RequestTable({ groups, model }: { groups: EntryGroup[]; model: WaterfallModel }) {
	const entries = useHarStore((s) => s.entries);
	const activeEntry = useHarStore((s) => s.activeEntry);
	const selectedEntries = useHarStore((s) => s.selectedEntries);
	const bookmarks = useHarStore((s) => s.bookmarks);
	const visibleColumns = useHarStore((s) => s.visibleColumns);
	const groupBy = useHarStore((s) => s.groupBy);
	const collapsedGroups = useHarStore((s) => s.collapsedGroups);
	const sortBy = useHarStore((s) => s.sortBy);
	const sortOrder = useHarStore((s) => s.sortOrder);
	const scrollToIndex = useHarStore((s) => s.scrollToIndex);
	const visibleEntryIndices = useHarStore((s) => s.visibleEntryIndices);

	const [widthRef, width] = useElementWidth<HTMLDivElement>();
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [contextIndex, setContextIndex] = useState<number | null>(null);

	const layout: Layout = width > 0 && width < CARD_BREAKPOINT ? "cards" : "table";
	const columns = COLUMNS.filter(
		(c) => (c.id === "name" || visibleColumns.has(c.id)) && width >= c.minWidth
	);
	const template = `1.75rem ${columns.map((c) => c.width).join(" ")}`;
	const waterfallWidth = useMemo(() => {
		if (!columns.some((c) => c.id === "waterfall")) return 0;
		return Math.max(140, width * 0.33);
	}, [columns, width]);

	const items = useMemo<Item[]>(() => {
		if (groupBy === "none")
			return (groups[0]?.indices ?? []).map((index) => ({ kind: "row", index }));
		const list: Item[] = [];
		for (const group of groups) {
			const collapsed = collapsedGroups.has(group.key);
			list.push({ kind: "group", key: group.key, count: group.indices.length, collapsed });
			if (!collapsed) for (const index of group.indices) list.push({ kind: "row", index });
		}
		return list;
	}, [groups, groupBy, collapsedGroups]);

	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: (i) => (items[i]?.kind === "group" ? GROUP_HEIGHT : ROW_HEIGHT[layout]),
		getItemKey: (i) => {
			const item = items[i];
			return item.kind === "group" ? `g:${item.key}` : item.index;
		},
		overscan: 12,
	});

	useEffect(() => {
		virtualizer.measure();
	}, [layout, virtualizer]);

	useEffect(() => {
		if (scrollToIndex === null) return;
		const position = items.findIndex((item) => item.kind === "row" && item.index === scrollToIndex);
		if (position >= 0) virtualizer.scrollToIndex(position, { align: "auto" });
		useHarStore.getState().setScrollToIndex(null);
	}, [scrollToIndex, items, virtualizer]);

	const selectedVisible = visibleEntryIndices.reduce(
		(count, i) => count + (selectedEntries.has(i) ? 1 : 0),
		0
	);
	const allSelected =
		visibleEntryIndices.length > 0 && selectedVisible === visibleEntryIndices.length;

	const onSort = (sort: SortBy) => {
		const state = useHarStore.getState();
		if (state.sortBy === sort) state.toggleSortOrder();
		else {
			state.setSortBy(sort);
			state.setSortOrder(sort === "time" || sort === "size" ? "desc" : "asc");
		}
	};

	return (
		<div
			ref={widthRef}
			role="table"
			aria-label="Requests"
			aria-rowcount={visibleEntryIndices.length}
			className="flex h-full min-h-0 w-full flex-col"
		>
			{layout === "cards" && (
				<div
					role="row"
					className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/40 pr-3 pl-2 text-xs text-muted-foreground"
				>
					<Checkbox
						checked={allSelected ? true : selectedVisible > 0 ? "indeterminate" : false}
						onCheckedChange={() => {
							const state = useHarStore.getState();
							if (allSelected) state.deselectAll();
							else state.selectAll();
						}}
						aria-label={allSelected ? "Deselect all requests" : "Select all visible requests"}
					/>
					<span>
						{selectedVisible > 0 ? `${selectedVisible.toLocaleString()} selected` : "Select all"}
					</span>
				</div>
			)}
			{layout === "table" && (
				<div
					role="row"
					className="grid h-9 shrink-0 items-center gap-x-3 border-b bg-muted/40 pr-3 pl-1 text-xs font-medium text-muted-foreground"
					style={{ gridTemplateColumns: template }}
				>
					<div className="flex items-center justify-center">
						<Checkbox
							checked={allSelected ? true : selectedVisible > 0 ? "indeterminate" : false}
							onCheckedChange={() => {
								const state = useHarStore.getState();
								if (allSelected) state.deselectAll();
								else state.selectAll();
							}}
							aria-label={allSelected ? "Deselect all requests" : "Select all visible requests"}
						/>
					</div>
					{columns.map((column) => {
						const active = column.sort !== undefined && sortBy === column.sort;
						const content =
							column.id === "waterfall" && waterfallWidth > 0 ? (
								<WaterfallHeader model={model} width={waterfallWidth} />
							) : (
								<>
									{column.label}
									{active &&
										(sortOrder === "asc" ? (
											<ArrowUp className="size-3" />
										) : (
											<ArrowDown className="size-3" />
										))}
								</>
							);
						return (
							<div
								key={column.id}
								role="columnheader"
								aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}
								className={cn(
									"flex h-full min-w-0 items-center",
									column.align === "right" && "justify-end"
								)}
							>
								{column.sort ? (
									<button
										type="button"
										onClick={() => onSort(column.sort!)}
										title={
											column.id === "waterfall"
												? "Sort by start time"
												: column.id === "name"
													? "Sort by URL"
													: `Sort by ${column.label.toLowerCase()}`
										}
										className={cn(
											"flex h-full min-w-0 items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
											column.id === "waterfall" && "w-full",
											active && column.id !== "waterfall" && "text-foreground"
										)}
									>
										{content}
									</button>
								) : (
									content
								)}
							</div>
						);
					})}
				</div>
			)}

			<ContextMenu onOpenChange={(open) => !open && setContextIndex(null)}>
				<ContextMenuTrigger asChild>
					<div
						ref={scrollRef}
						className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
						onContextMenu={(e) => {
							// Only rows get a menu; empty space keeps the browser menu.
							if (!(e.target as HTMLElement).closest("[data-index]")) e.stopPropagation();
						}}
					>
						<div
							role="rowgroup"
							style={{ height: virtualizer.getTotalSize() }}
							className="relative w-full"
						>
							{virtualizer.getVirtualItems().map((virtualItem) => {
								const item = items[virtualItem.index];
								return (
									<div
										key={virtualItem.key}
										className="absolute top-0 left-0 w-full"
										style={{
											height: virtualItem.size,
											transform: `translateY(${virtualItem.start}px)`,
										}}
									>
										{item.kind === "group" ? (
											<button
												type="button"
												onClick={() => useHarStore.getState().toggleGroup(item.key)}
												aria-expanded={!item.collapsed}
												className="flex h-full w-full items-center gap-2 border-b bg-muted/60 px-3 text-left text-xs font-medium hover:bg-muted"
											>
												<ChevronRight
													className={cn(
														"size-3.5 transition-transform",
														!item.collapsed && "rotate-90"
													)}
												/>
												<span className="min-w-0 truncate">{groupLabel(groupBy, item.key)}</span>
												<span className="ml-auto text-muted-foreground tabular-nums">
													{item.count}
												</span>
											</button>
										) : (
											<RequestRow
												entry={entries[item.index]}
												index={item.index}
												layout={layout}
												columns={columns}
												template={template}
												isActive={activeEntry === item.index}
												isSelected={selectedEntries.has(item.index)}
												bookmark={bookmarks.get(item.index)}
												model={model}
												onContextTarget={setContextIndex}
											/>
										)}
									</div>
								);
							})}
						</div>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent className="w-60">
					{contextIndex !== null && entries[contextIndex] && (
						<RequestMenuItems index={contextIndex} kind="context" showOpen />
					)}
				</ContextMenuContent>
			</ContextMenu>
		</div>
	);
}
