"use client";

import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useHarStore } from "@/lib/stores/har-store";
import {
	countActiveAdvancedFilters,
	filterEntryIndices,
	groupEntryIndices,
	sortEntryIndices,
	type EntryGroup,
} from "@/lib/filter-entries";

/**
 * Indices of entries that pass the current search, resource-type, bookmark,
 * time-range and advanced filters, in original (chronological) HAR order.
 * This is the single source of truth for every view that respects filters.
 */
export function useFilteredEntryIndices(): number[] {
	const state = useHarStore(
		useShallow((s) => ({
			entries: s.entries,
			searchText: s.searchText,
			resourceTypeFilter: s.resourceTypeFilter,
			advancedFilters: s.advancedFilters,
			bookmarks: s.bookmarks,
			showBookmarksOnly: s.showBookmarksOnly,
			timeRange: s.timeRange,
		}))
	);

	return useMemo(() => filterEntryIndices(state), [state]);
}

/** True when any filter hides at least one request. */
export function useFiltersActive(): boolean {
	return useHarStore(
		(s) =>
			s.searchText.trim() !== "" ||
			s.resourceTypeFilter !== "all" ||
			s.showBookmarksOnly ||
			s.timeRange !== null ||
			countActiveAdvancedFilters(s.advancedFilters) > 0
	);
}

/** Filtered indices in list order, split into groups (a single group when ungrouped). */
export function useEntryGroups(): EntryGroup[] {
	const filtered = useFilteredEntryIndices();
	const { entries, sortBy, sortOrder, groupBy } = useHarStore(
		useShallow((s) => ({
			entries: s.entries,
			sortBy: s.sortBy,
			sortOrder: s.sortOrder,
			groupBy: s.groupBy,
		}))
	);

	return useMemo(
		() =>
			groupEntryIndices(entries, sortEntryIndices(entries, filtered, sortBy, sortOrder), groupBy),
		[entries, filtered, sortBy, sortOrder, groupBy]
	);
}

/**
 * Keeps `visibleEntryIndices` in the store in sync with the list order, so
 * selection helpers (select all, shift-click ranges, invert, previous/next)
 * work in every view. Rows inside collapsed groups still count as visible:
 * they pass the filters, and stepping onto one expands its group.
 */
export function useSyncVisibleEntryIndices(): EntryGroup[] {
	const groups = useEntryGroups();
	const setVisibleEntryIndices = useHarStore((s) => s.setVisibleEntryIndices);

	const visible = useMemo(() => groups.flatMap((group) => group.indices), [groups]);

	useEffect(() => {
		setVisibleEntryIndices(visible);
	}, [visible, setVisibleEntryIndices]);

	return groups;
}
