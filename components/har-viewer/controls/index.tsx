"use client";

import { useState, useEffect } from "react";
import {
	Search,
	CheckSquare,
	Square,
	Trash2,
	ArrowUp,
	ArrowDown,
	Filter,
	BarChart3,
	SlidersHorizontal,
	Bookmark,
	RotateCwSquare,
} from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";
import { IconButton } from "@/components/ui/icon-button";
import { ResourceTypeFilters } from "./resource-type-filters";
import { cn } from "@/lib/cn";

export function HarControls() {
	const [altPressed, setAltPressed] = useState(false);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Alt") {
				setAltPressed(true);
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === "Alt") {
				setAltPressed(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, []);

	const {
		entries,
		selectedEntries,
		selectAll,
		deselectAll,
		invertSelection,
		visibleEntryIndices,
		searchText,
		setSearchText,
		sortBy,
		setSortBy,
		toggleSortOrder,
		sortOrder,
		setShowDeleteConfirm,
		showTimeline,
		toggleTimeline,
		toggleAdvancedFilters,
		showAdvancedFilters,
		toggleBookmarksPanel,
		showBookmarksPanel,
	} = useHarStore();

	const selectedVisibleCount = visibleEntryIndices.filter((i) =>
		selectedEntries.has(i)
	).length;
	const totalVisible = visibleEntryIndices.length;
	const allSelected = totalVisible
		? selectedVisibleCount === totalVisible
		: selectedEntries.size === entries.length;
	const hasSelection = selectedEntries.size > 0;

	const handleDeleteSelected = () => {
		if (hasSelection) {
			setShowDeleteConfirm(true);
		}
	};

	return (
		<div className="flex flex-col gap-2 px-6 py-2 border-b border-border bg-card/30 backdrop-blur-sm">
			<div className="flex items-center gap-3 flex-wrap">
				<div className="flex items-center gap-2">
					<IconButton
						onClick={() => {
							if (altPressed) {
								invertSelection();
							} else if (allSelected) {
								deselectAll();
							} else {
								selectAll();
							}
						}}
						className={cn(
							(altPressed || allSelected) &&
								"text-primary bg-primary/10"
						)}
						title={
							altPressed
								? "Invert Selection"
								: allSelected
								? "Deselect All"
								: "Select All"
						}
					>
						{altPressed ? (
							<RotateCwSquare className="w-5 h-5" />
						) : allSelected ? (
							<CheckSquare className="w-5 h-5" />
						) : (
							<Square className="w-5 h-5" />
						)}
					</IconButton>
					{hasSelection && (
						<span className="text-xs font-semibold text-muted px-2 py-1 rounded-lg bg-primary/10">
							({selectedEntries.size})
						</span>
					)}
				</div>

				<div className="relative flex-1 min-w-64">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
					<input
						type="text"
						placeholder="Search..."
						value={searchText}
						onChange={(e) => setSearchText(e.target.value)}
						className="w-full pl-10! pr-4 py-2 rounded-lg border border-border bg-control-bg text-foreground placeholder:text-muted text-sm focus:outline-none"
					/>
				</div>

				<ResourceTypeFilters />

				<IconButton
					onClick={toggleAdvancedFilters}
					className={cn(
						showAdvancedFilters
							? "text-primary bg-primary/10"
							: "border border-border/60"
					)}
					title="Advanced Filters (Shift+F)"
				>
					<SlidersHorizontal className="w-5 h-5" />
				</IconButton>

				<IconButton
					onClick={handleDeleteSelected}
					disabled={!hasSelection}
					className={cn(
						hasSelection
							? "text-destructive hover:bg-destructive/10"
							: "opacity-50 cursor-not-allowed border border-border/60"
					)}
					title="Delete Selected"
				>
					<Trash2 className="w-5 h-5" />
				</IconButton>

				<div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-control-bg">
					<Filter className="w-4 h-4 text-muted" />
					<select
						value={sortBy}
						onChange={(e) =>
							setSortBy(
								e.target.value as
									| "time"
									| "size"
									| "status"
									| "method"
									| "url"
							)
						}
						aria-label="Sort by"
						className="bg-transparent text-foreground text-sm focus:outline-none cursor-pointer border-none"
					>
						<option value="time">Time</option>
						<option value="size">Size</option>
						<option value="status">Status</option>
						<option value="method">Method</option>
						<option value="url">URL</option>
					</select>
				</div>

				<IconButton
					onClick={toggleSortOrder}
					className="border border-border/60"
					title={`Sort ${
						sortOrder === "asc" ? "Descending" : "Ascending"
					}`}
				>
					{sortOrder === "asc" ? (
						<ArrowUp className="w-5 h-5" />
					) : (
						<ArrowDown className="w-5 h-5" />
					)}
				</IconButton>

				<IconButton
					onClick={toggleTimeline}
					className={cn(
						showTimeline
							? "text-primary bg-primary/10"
							: "border border-border/60"
					)}
					title={showTimeline ? "Hide Timeline" : "Show Timeline"}
				>
					<BarChart3 className="w-5 h-5" />
				</IconButton>

				<IconButton
					onClick={toggleBookmarksPanel}
					className={cn(
						showBookmarksPanel
							? "text-accent bg-accent/10"
							: "border border-border/60"
					)}
					title="Toggle Bookmarks Panel (B)"
				>
					<Bookmark className="w-5 h-5" />
				</IconButton>
			</div>
		</div>
	);
}
