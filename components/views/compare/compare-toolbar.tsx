"use client";

import { useId } from "react";
import { useShallow } from "zustand/react/shallow";
import {
	ArrowDownUp,
	Columns2,
	RotateCcw,
	Rows3,
	Search,
	SlidersHorizontal,
	X,
} from "lucide-react";
import { useHarStore, type ComparisonMode } from "@/lib/stores/har-store";
import {
	DEFAULT_MATCH_OPTIONS,
	DEFAULT_THRESHOLDS,
	DEFAULT_VOLATILE_PARAMS,
} from "@/lib/har-compare";
import { cn } from "@/lib/cn";
import { NumberField } from "@/components/common/number-field";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	DEFAULT_SORT_DIRECTION,
	useCompareUiStore,
	type CompareFilter,
	type CompareSortKey,
} from "./compare-ui-store";
import type { FilterCounts } from "./use-compare-model";

const FILTERS: Array<{ id: CompareFilter; label: string; countClass?: string }> = [
	{ id: "all", label: "All" },
	{ id: "changed", label: "Changed" },
	{ id: "added", label: "Added", countClass: "text-success" },
	{ id: "removed", label: "Removed", countClass: "text-destructive" },
	{ id: "status", label: "Status changed" },
	{ id: "slower", label: "Slower", countClass: "text-destructive" },
	{ id: "faster", label: "Faster", countClass: "text-success" },
];

const SORT_OPTIONS: Array<{ id: CompareSortKey; label: string }> = [
	{ id: "order", label: "Timeline" },
	{ id: "url", label: "URL" },
	{ id: "status", label: "Status" },
	{ id: "timeDelta", label: "Time change" },
	{ id: "timePct", label: "Time change %" },
	{ id: "sizeDelta", label: "Size change" },
];

interface CompareToolbarProps {
	counts: FilterCounts;
	/** Column headers are hidden, so sorting moves into a menu. */
	showSortMenu: boolean;
	showModeToggle: boolean;
}

export function CompareToolbar({ counts, showSortMenu, showModeToggle }: CompareToolbarProps) {
	const { filter, search, setFilter, setSearch } = useCompareUiStore(
		useShallow((s) => ({
			filter: s.filter,
			search: s.search,
			setFilter: s.setFilter,
			setSearch: s.setSearch,
		}))
	);
	const comparisonMode = useHarStore((s) => s.comparisonMode);
	const setComparisonMode = useHarStore((s) => s.setComparisonMode);

	return (
		<div className="flex flex-col gap-2 @6xl:flex-row @6xl:items-center">
			<div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1 @6xl:pb-0">
				<ToggleGroup
					type="single"
					value={filter}
					onValueChange={(value) => value && setFilter(value as CompareFilter)}
					aria-label="Filter compared requests"
					spacing={1}
					className="h-10 rounded-lg bg-muted p-[3px] sm:h-9"
				>
					{FILTERS.map((item) => (
						<ToggleGroupItem
							key={item.id}
							value={item.id}
							className="h-full gap-1.5 rounded-md px-2.5 text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:bg-input/40"
						>
							{item.label}
							<span
								className={cn(
									"text-xs tabular-nums",
									counts[item.id] > 0 && item.countClass ? item.countClass : "text-muted-foreground"
								)}
							>
								{counts[item.id].toLocaleString()}
							</span>
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</div>

			<div className="flex min-w-0 items-center gap-2 @6xl:ml-auto">
				<InputGroup className="h-10 min-w-0 flex-1 sm:h-9 @6xl:w-64 @6xl:flex-none">
					<InputGroupAddon>
						<Search aria-hidden="true" />
					</InputGroupAddon>
					<InputGroupInput
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Filter by URL, method, status"
						aria-label="Search compared requests"
					/>
					{search && (
						<InputGroupAddon align="inline-end">
							<InputGroupButton
								size="icon-xs"
								onClick={() => setSearch("")}
								aria-label="Clear search"
							>
								<X />
							</InputGroupButton>
						</InputGroupAddon>
					)}
				</InputGroup>

				{showSortMenu && <SortMenu />}
				<OptionsPopover />

				{showModeToggle && (
					<ToggleGroup
						type="single"
						variant="outline"
						value={comparisonMode}
						onValueChange={(value) => value && setComparisonMode(value as ComparisonMode)}
						aria-label="Comparison layout"
						className="shrink-0"
					>
						<ToggleGroupItem value="diff" aria-label="Unified">
							<Rows3 aria-hidden="true" />
							Unified
						</ToggleGroupItem>
						<ToggleGroupItem value="side-by-side" aria-label="Side by side">
							<Columns2 aria-hidden="true" />
							Side by side
						</ToggleGroupItem>
					</ToggleGroup>
				)}
			</div>
		</div>
	);
}

function SortMenu() {
	const sortKey = useCompareUiStore((s) => s.sortKey);
	const sortDirection = useCompareUiStore((s) => s.sortDirection);
	const setSort = useCompareUiStore((s) => s.setSort);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="size-10 shrink-0 sm:size-9"
					aria-label="Sort"
				>
					<ArrowDownUp />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuLabel>Sort by</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={sortKey}
					onValueChange={(value) => {
						const key = value as CompareSortKey;
						setSort(key, DEFAULT_SORT_DIRECTION[key]);
					}}
				>
					{SORT_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.id} value={option.id}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuLabel>Direction</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={sortDirection}
					onValueChange={(value) => setSort(sortKey, value as "asc" | "desc")}
				>
					<DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function SwitchRow({
	label,
	description,
	checked,
	disabled,
	onChange,
}: {
	label: string;
	description?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (checked: boolean) => void;
}) {
	const id = useId();
	return (
		<div className={cn("flex items-start justify-between gap-3", disabled && "opacity-60")}>
			<Label
				htmlFor={id}
				className="flex min-w-0 flex-col items-start gap-0.5 leading-snug font-normal"
			>
				<span>{label}</span>
				{description && (
					<span className="text-xs break-words text-muted-foreground">{description}</span>
				)}
			</Label>
			<Switch
				id={id}
				checked={checked}
				disabled={disabled}
				onCheckedChange={onChange}
				className="mt-0.5"
			/>
		</div>
	);
}

function ThresholdField({
	label,
	unit,
	value,
	onChange,
}: {
	label: string;
	unit: string;
	value: number;
	onChange: (value: number) => void;
}) {
	return (
		<NumberField
			value={value}
			onChange={(next) => {
				if (next !== null && next !== value) onChange(next);
			}}
			min={0}
			step={unit === "B" ? 50 : unit === "ms" ? 10 : 5}
			unit={unit}
			aria-label={label}
		/>
	);
}

function shallowEqual<T extends object>(a: T, b: T) {
	return (Object.keys(a) as Array<keyof T>).every((key) => a[key] === b[key]);
}

function OptionsPopover() {
	const { thresholds, matchOptions, setThresholds, setMatchOptions, resetOptions } =
		useCompareUiStore(
			useShallow((s) => ({
				thresholds: s.thresholds,
				matchOptions: s.matchOptions,
				setThresholds: s.setThresholds,
				setMatchOptions: s.setMatchOptions,
				resetOptions: s.resetOptions,
			}))
		);
	const customized =
		!shallowEqual(matchOptions, DEFAULT_MATCH_OPTIONS) ||
		!shallowEqual(thresholds, DEFAULT_THRESHOLDS);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className="relative h-10 shrink-0 sm:h-9"
					aria-label="Match options"
				>
					<SlidersHorizontal />
					<span className="hidden sm:inline">Options</span>
					{customized && (
						<span
							className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary"
							aria-hidden="true"
						/>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="max-h-(--radix-popover-content-available-height) w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-0"
			>
				<div className="space-y-3 p-4">
					<h3 className="text-sm font-semibold">Request matching</h3>
					<SwitchRow
						label="Ignore cache-busting query parameters"
						description={DEFAULT_VOLATILE_PARAMS.join(", ")}
						checked={matchOptions.ignoreVolatileParams}
						disabled={matchOptions.ignoreQueryString}
						onChange={(ignoreVolatileParams) => setMatchOptions({ ignoreVolatileParams })}
					/>
					<SwitchRow
						label="Ignore the whole query string"
						checked={matchOptions.ignoreQueryString}
						onChange={(ignoreQueryString) => setMatchOptions({ ignoreQueryString })}
					/>
					<SwitchRow
						label="Match URLs that differ only in ids or file hashes"
						description="e.g. /users/123 ↔ /users/124, app.4f2a.js ↔ app.9bc1.js"
						checked={matchOptions.normalizeDynamicSegments}
						onChange={(normalizeDynamicSegments) => setMatchOptions({ normalizeDynamicSegments })}
					/>
					<SwitchRow
						label="Compare response headers"
						description="Volatile headers such as date, age and request ids are ignored"
						checked={matchOptions.compareHeaders}
						onChange={(compareHeaders) => setMatchOptions({ compareHeaders })}
					/>
				</div>
				<Separator />
				<div className="space-y-3 p-4">
					<div>
						<h3 className="text-sm font-semibold">Change thresholds</h3>
						<p className="text-xs text-muted-foreground">
							A change counts only when it exceeds both limits.
						</p>
					</div>
					<fieldset className="space-y-1.5">
						<legend className="mb-1.5 text-xs font-medium">Slower / faster</legend>
						<div className="grid grid-cols-2 gap-2">
							<ThresholdField
								label="Minimum time change in percent"
								unit="%"
								value={thresholds.timePct}
								onChange={(timePct) => setThresholds({ timePct })}
							/>
							<ThresholdField
								label="Minimum time change in milliseconds"
								unit="ms"
								value={thresholds.timeMs}
								onChange={(timeMs) => setThresholds({ timeMs })}
							/>
						</div>
					</fieldset>
					<fieldset className="space-y-1.5">
						<legend className="mb-1.5 text-xs font-medium">Size changed</legend>
						<div className="grid grid-cols-2 gap-2">
							<ThresholdField
								label="Minimum size change in percent"
								unit="%"
								value={thresholds.sizePct}
								onChange={(sizePct) => setThresholds({ sizePct })}
							/>
							<ThresholdField
								label="Minimum size change in bytes"
								unit="B"
								value={thresholds.sizeBytes}
								onChange={(sizeBytes) => setThresholds({ sizeBytes })}
							/>
						</div>
					</fieldset>
				</div>
				<Separator />
				<div className="flex justify-end p-2">
					<Button variant="ghost" size="sm" onClick={resetOptions} disabled={!customized}>
						<RotateCcw />
						Reset to defaults
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
