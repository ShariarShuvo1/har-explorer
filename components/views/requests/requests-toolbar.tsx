"use client";

import { useMemo } from "react";
import {
	ArrowDownWideNarrow,
	ChartNoAxesGantt,
	Columns3,
	ListFilter,
	Rows3,
	Search,
	SlidersHorizontal,
	X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	LIST_COLUMNS,
	useHarStore,
	type GroupBy,
	type ListColumn,
	type SortBy,
} from "@/lib/stores/har-store";
import type { ResourceType } from "@/lib/har-types";
import { getResourceType, RESOURCE_TYPE_LABELS } from "@/lib/resource-type";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { FiltersPanel, useAdvancedFilterCount } from "./filters/filters-panel";
import { REQUEST_SEARCH_INPUT_ID } from "@/components/app-shell/keyboard-shortcuts";

const TYPE_ORDER: ResourceType[] = [
	"all",
	"fetch",
	"doc",
	"css",
	"js",
	"font",
	"img",
	"media",
	"manifest",
	"ws",
	"wasm",
	"other",
];

const SORT_LABELS: Record<SortBy, string> = {
	started: "Start time",
	time: "Duration",
	size: "Size",
	status: "Status",
	method: "Method",
	url: "Name / URL",
};

const COLUMN_LABELS: Record<ListColumn, string> = {
	method: "Method",
	status: "Status",
	type: "Type",
	size: "Size",
	time: "Time",
	waterfall: "Waterfall",
};

function FiltersControl() {
	const open = useHarStore((s) => s.showFiltersPanel);
	const setOpen = useHarStore((s) => s.setShowFiltersPanel);
	const resetAdvancedFilters = useHarStore((s) => s.resetAdvancedFilters);
	const count = useAdvancedFilterCount();
	const isMobile = useIsMobile();

	// On phones the button opens a drawer; on larger screens it is the popover trigger.
	const trigger = (
		<Button
			variant="outline"
			size="sm"
			onClick={isMobile ? () => setOpen(true) : undefined}
			aria-expanded={open}
			className="h-9 gap-1.5"
		>
			<SlidersHorizontal />
			<span className="hidden sm:inline">Filters</span>
			{count > 0 && <Badge className="h-5 min-w-5 rounded-full px-1.5 tabular-nums">{count}</Badge>}
		</Button>
	);

	if (isMobile) {
		return (
			<>
				{trigger}
				<Drawer open={open} onOpenChange={setOpen}>
					<DrawerContent className="max-h-[90dvh]">
						<DrawerHeader className="text-left">
							<DrawerTitle>Filters</DrawerTitle>
							<DrawerDescription>Narrow down the request list.</DrawerDescription>
						</DrawerHeader>
						<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
							<FiltersPanel />
						</div>
						<DrawerFooter className="flex-row border-t pt-3">
							<Button
								variant="outline"
								className="flex-1"
								onClick={resetAdvancedFilters}
								disabled={count === 0}
							>
								Reset
							</Button>
							<Button className="flex-1" onClick={() => setOpen(false)}>
								Done
							</Button>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
			</>
		);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={6}
				className="flex max-h-[min(80dvh,44rem)] w-[min(92vw,34rem)] flex-col gap-0 p-0"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="flex items-center justify-between border-b px-4 py-3">
					<div>
						<h2 className="text-sm font-semibold">Filters</h2>
						<p className="text-xs text-muted-foreground">Changes apply immediately.</p>
					</div>
					<Button variant="ghost" size="sm" onClick={resetAdvancedFilters} disabled={count === 0}>
						Reset
					</Button>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
					<FiltersPanel />
				</div>
				<div className="flex justify-end border-t px-4 py-2.5">
					<Button size="sm" onClick={() => setOpen(false)}>
						Done
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function ViewOptionsMenu() {
	const sortBy = useHarStore((s) => s.sortBy);
	const sortOrder = useHarStore((s) => s.sortOrder);
	const groupBy = useHarStore((s) => s.groupBy);
	const visibleColumns = useHarStore((s) => s.visibleColumns);
	const store = useHarStore.getState;

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="icon" aria-label="View options" className="size-9">
							<Rows3 />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Sort, group and columns</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<ArrowDownWideNarrow />
						Sort by
						<span className="ml-auto text-xs text-muted-foreground">{SORT_LABELS[sortBy]}</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-48">
						<DropdownMenuRadioGroup
							value={sortBy}
							onValueChange={(v) => store().setSortBy(v as SortBy)}
						>
							{(Object.keys(SORT_LABELS) as SortBy[]).map((key) => (
								<DropdownMenuRadioItem key={key} value={key} onSelect={(e) => e.preventDefault()}>
									{SORT_LABELS[key]}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
						<DropdownMenuSeparator />
						<DropdownMenuRadioGroup
							value={sortOrder}
							onValueChange={(v) => store().setSortOrder(v as "asc" | "desc")}
						>
							<DropdownMenuRadioItem value="asc" onSelect={(e) => e.preventDefault()}>
								Ascending
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="desc" onSelect={(e) => e.preventDefault()}>
								Descending
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<ListFilter />
						Group by
						<span className="ml-auto text-xs text-muted-foreground">
							{groupBy === "none" ? "None" : groupBy === "domain" ? "Domain" : "Type"}
						</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-44">
						<DropdownMenuRadioGroup
							value={groupBy}
							onValueChange={(v) => store().setGroupBy(v as GroupBy)}
						>
							<DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="domain">Domain</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="type">Resource type</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<Columns3 className="size-3.5" />
					Columns
				</DropdownMenuLabel>
				{LIST_COLUMNS.map((column) => (
					<DropdownMenuCheckboxItem
						key={column}
						checked={visibleColumns.has(column)}
						onCheckedChange={() => store().toggleColumn(column)}
						onSelect={(e) => e.preventDefault()}
					>
						{COLUMN_LABELS[column]}
					</DropdownMenuCheckboxItem>
				))}
				<DropdownMenuSeparator />
				<p className="px-2 py-1.5 text-xs text-muted-foreground">
					Narrow windows hide some columns automatically.
				</p>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function RequestsToolbar({ shown }: { shown: number }) {
	const entries = useHarStore((s) => s.entries);
	const searchText = useHarStore((s) => s.searchText);
	const setSearchText = useHarStore((s) => s.setSearchText);
	const resourceTypeFilter = useHarStore((s) => s.resourceTypeFilter);
	const setResourceTypeFilter = useHarStore((s) => s.setResourceTypeFilter);
	const showOverview = useHarStore((s) => s.showOverview);
	const setShowOverview = useHarStore((s) => s.setShowOverview);

	const typeCounts = useMemo(() => {
		const counts = Object.fromEntries(TYPE_ORDER.map((t) => [t, 0])) as Record<
			ResourceType,
			number
		>;
		counts.all = entries.length;
		for (const entry of entries) counts[getResourceType(entry)]++;
		return counts;
	}, [entries]);

	return (
		<div className="flex shrink-0 flex-col gap-2 border-b px-3 pt-3 pb-2 sm:px-4">
			<div className="flex items-center gap-2">
				<InputGroup className="h-9 max-w-md min-w-0 flex-1">
					<InputGroupAddon>
						<Search />
					</InputGroupAddon>
					<InputGroupInput
						id={REQUEST_SEARCH_INPUT_ID}
						value={searchText}
						onChange={(e) => setSearchText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.stopPropagation();
								if (searchText) setSearchText("");
								else e.currentTarget.blur();
							}
						}}
						placeholder="Filter requests"
						aria-label="Search requests"
						autoComplete="off"
						spellCheck={false}
					/>
					<InputGroupAddon align="inline-end">
						{searchText ? (
							<InputGroupButton
								size="icon-xs"
								onClick={() => setSearchText("")}
								aria-label="Clear search"
							>
								<X />
							</InputGroupButton>
						) : (
							<Kbd className="hidden sm:inline-flex">/</Kbd>
						)}
					</InputGroupAddon>
				</InputGroup>

				<span className="sr-only">
					{shown === entries.length
						? `${entries.length.toLocaleString()} requests`
						: `${shown.toLocaleString()} of ${entries.length.toLocaleString()}`}
				</span>

				<div className="ml-auto flex items-center gap-1.5">
					<FiltersControl />
					<Tooltip>
						<TooltipTrigger asChild>
							<Toggle
								variant="outline"
								pressed={showOverview}
								onPressedChange={setShowOverview}
								aria-label="Waterfall overview"
								className="size-9 min-w-9 p-0"
							>
								<ChartNoAxesGantt />
							</Toggle>
						</TooltipTrigger>
						<TooltipContent>Waterfall overview (T)</TooltipContent>
					</Tooltip>
					<ViewOptionsMenu />
				</div>
			</div>

			<ToggleGroup
				type="single"
				value={resourceTypeFilter}
				onValueChange={(value) => value && setResourceTypeFilter(value as ResourceType)}
				aria-label="Resource type"
				className="-mx-1 scrollbar-none w-[calc(100%+0.5rem)] justify-start gap-1 overflow-x-auto px-1 py-0.5"
			>
				{TYPE_ORDER.map((type) => {
					const count = typeCounts[type];
					if (count === 0 && type !== "all" && resourceTypeFilter !== type) return null;
					return (
						<ToggleGroupItem
							key={type}
							value={type}
							size="sm"
							className="h-7 shrink-0 gap-1.5 rounded-md! border border-transparent px-2.5 text-xs font-normal text-muted-foreground data-[state=on]:border-border data-[state=on]:bg-background data-[state=on]:font-medium data-[state=on]:text-foreground data-[state=on]:shadow-xs"
						>
							{RESOURCE_TYPE_LABELS[type]}
							<span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>
						</ToggleGroupItem>
					);
				})}
			</ToggleGroup>
		</div>
	);
}
