"use client";

import { X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useHarStore, type AdvancedFilters, type TimeRange } from "@/lib/stores/har-store";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatOffset, httpVersionLabel, statusRangeLabel } from "./filter-utils";

interface Chip {
	key: string;
	label: string;
	onRemove: () => void;
}

function rangeLabel(
	name: string,
	min: number | null,
	max: number | null,
	format: (value: number) => string
): string {
	if (min !== null && max !== null) return `${name}: ${format(min)}–${format(max)}`;
	if (min !== null) return `${name} ≥ ${format(min)}`;
	return `${name} ≤ ${format(max ?? 0)}`;
}

function buildChips(
	filters: AdvancedFilters,
	update: (filters: Partial<AdvancedFilters>) => void,
	showBookmarksOnly: boolean,
	setShowBookmarksOnly: (show: boolean) => void,
	timeRange: TimeRange | null,
	setTimeRange: (range: TimeRange | null) => void
): Chip[] {
	const chips: Chip[] = [];

	if (filters.statusRanges.length > 0) {
		chips.push({
			key: "status-ranges",
			label: `Status: ${filters.statusRanges.map(statusRangeLabel).join(", ")}`,
			onRemove: () => update({ statusRanges: [] }),
		});
	}
	if (filters.statusCodes.length > 0) {
		chips.push({
			key: "status-codes",
			label: `Code: ${filters.statusCodes.join(", ")}`,
			onRemove: () => update({ statusCodes: [] }),
		});
	}
	if (filters.methodFilters.length > 0) {
		chips.push({
			key: "methods",
			label: `Method: ${filters.methodFilters.map((m) => m.toUpperCase()).join(", ")}`,
			onRemove: () => update({ methodFilters: [] }),
		});
	}
	if (filters.httpVersions.length > 0) {
		chips.push({
			key: "versions",
			label: `HTTP: ${filters.httpVersions.map(httpVersionLabel).join(", ")}`,
			onRemove: () => update({ httpVersions: [] }),
		});
	}
	if (filters.sizeMin !== null || filters.sizeMax !== null) {
		chips.push({
			key: "size",
			label: rangeLabel("Size", filters.sizeMin, filters.sizeMax, formatBytes),
			onRemove: () => update({ sizeMin: null, sizeMax: null }),
		});
	}
	if (filters.durationMin !== null || filters.durationMax !== null) {
		chips.push({
			key: "duration",
			label: rangeLabel("Duration", filters.durationMin, filters.durationMax, formatTime),
			onRemove: () => update({ durationMin: null, durationMax: null }),
		});
	}
	if (filters.domainPattern.trim()) {
		chips.push({
			key: "domain",
			label: `Domain: ${filters.domainPattern.trim()}`,
			onRemove: () => update({ domainPattern: "" }),
		});
	}
	if (filters.pathPattern.trim()) {
		chips.push({
			key: "path",
			label: `Path: ${filters.pathPattern.trim()}`,
			onRemove: () => update({ pathPattern: "" }),
		});
	}
	filters.headerMatches.forEach((match, index) => {
		const name = match.name.trim();
		if (!name) return;
		const value = match.value.trim();
		chips.push({
			key: `header-${index}`,
			label: value ? `Header: ${name} ∋ ${value}` : `Header: ${name}`,
			onRemove: () =>
				update({
					headerMatches: useHarStore
						.getState()
						.advancedFilters.headerMatches.filter((_, i) => i !== index),
				}),
		});
	});
	if (showBookmarksOnly) {
		chips.push({
			key: "bookmarks",
			label: "Bookmarked",
			onRemove: () => setShowBookmarksOnly(false),
		});
	}
	if (timeRange) {
		chips.push({
			key: "time",
			label: `Time: ${formatOffset(timeRange.start)}–${formatOffset(timeRange.end)}`,
			onRemove: () => setTimeRange(null),
		});
	}
	return chips;
}

/**
 * Removable summary of active advanced filters, bookmarks-only and time range.
 * Search and resource type have their own toolbar controls and are not listed.
 */
export function FilterChips({ className }: { className?: string }) {
	const {
		advancedFilters,
		setAdvancedFilters,
		showBookmarksOnly,
		setShowBookmarksOnly,
		timeRange,
		setTimeRange,
	} = useHarStore(
		useShallow((s) => ({
			advancedFilters: s.advancedFilters,
			setAdvancedFilters: s.setAdvancedFilters,
			showBookmarksOnly: s.showBookmarksOnly,
			setShowBookmarksOnly: s.setShowBookmarksOnly,
			timeRange: s.timeRange,
			setTimeRange: s.setTimeRange,
		}))
	);

	const chips = buildChips(
		advancedFilters,
		setAdvancedFilters,
		showBookmarksOnly,
		setShowBookmarksOnly,
		timeRange,
		setTimeRange
	);
	if (chips.length === 0) return null;

	const clearAll = () => {
		const state = useHarStore.getState();
		state.resetAdvancedFilters();
		state.setShowBookmarksOnly(false);
		state.setTimeRange(null);
	};

	return (
		<div
			role="group"
			aria-label="Active filters"
			className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
		>
			{chips.map((chip) => (
				<Badge
					key={chip.key}
					variant="secondary"
					className="h-8 max-w-full gap-1 pr-1 pl-2.5 font-normal sm:h-7"
				>
					<span className="min-w-0 truncate" title={chip.label}>
						{chip.label}
					</span>
					<button
						type="button"
						onClick={chip.onRemove}
						aria-label={`Remove filter ${chip.label}`}
						className="flex size-6 shrink-0 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 sm:size-5"
					>
						<X className="size-3" />
					</button>
				</Badge>
			))}
			<Button
				variant="ghost"
				size="sm"
				className="h-8 px-2 text-muted-foreground sm:h-7"
				onClick={clearAll}
			>
				Clear all
			</Button>
		</div>
	);
}
