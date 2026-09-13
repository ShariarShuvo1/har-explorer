import { create } from "zustand";
import {
	DEFAULT_MATCH_OPTIONS,
	DEFAULT_THRESHOLDS,
	type ChangeThresholds,
	type MatchOptions,
} from "@/lib/har-compare";

export type CompareFilter =
	"all" | "changed" | "added" | "removed" | "status" | "slower" | "faster";

export type CompareSortKey = "order" | "url" | "status" | "timeDelta" | "timePct" | "sizeDelta";

export type SortDirection = "asc" | "desc";

/**
 * View preferences for the compare view. Kept outside the component so they
 * survive switching to another view and back.
 */
interface CompareUiState {
	filter: CompareFilter;
	search: string;
	sortKey: CompareSortKey;
	sortDirection: SortDirection;
	thresholds: ChangeThresholds;
	matchOptions: MatchOptions;
	showTypeBreakdown: boolean;
	/** Last scroll position of the results list and the layout it belongs to. */
	scrollOffset: number;
	scrollKey: string;
	setFilter: (filter: CompareFilter) => void;
	setSearch: (search: string) => void;
	toggleSort: (key: CompareSortKey) => void;
	setSort: (key: CompareSortKey, direction: SortDirection) => void;
	setThresholds: (thresholds: Partial<ChangeThresholds>) => void;
	setMatchOptions: (options: Partial<MatchOptions>) => void;
	resetOptions: () => void;
	setShowTypeBreakdown: (show: boolean) => void;
	setScroll: (offset: number, key: string) => void;
	resetScroll: () => void;
}

export const DEFAULT_SORT_DIRECTION: Record<CompareSortKey, SortDirection> = {
	order: "asc",
	url: "asc",
	status: "asc",
	timeDelta: "desc",
	timePct: "desc",
	sizeDelta: "desc",
};

export const useCompareUiStore = create<CompareUiState>((set) => ({
	filter: "all",
	search: "",
	sortKey: "order",
	sortDirection: "asc",
	thresholds: DEFAULT_THRESHOLDS,
	matchOptions: DEFAULT_MATCH_OPTIONS,
	showTypeBreakdown: false,
	scrollOffset: 0,
	scrollKey: "",
	setFilter: (filter) => set({ filter, scrollOffset: 0 }),
	setSearch: (search) => set({ search, scrollOffset: 0 }),
	toggleSort: (key) =>
		set((state) =>
			state.sortKey === key
				? {
						sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
						scrollOffset: 0,
					}
				: {
						sortKey: key,
						sortDirection: DEFAULT_SORT_DIRECTION[key],
						scrollOffset: 0,
					}
		),
	setSort: (sortKey, sortDirection) => set({ sortKey, sortDirection, scrollOffset: 0 }),
	setThresholds: (thresholds) =>
		set((state) => ({
			thresholds: { ...state.thresholds, ...thresholds },
		})),
	setMatchOptions: (options) =>
		set((state) => ({
			matchOptions: { ...state.matchOptions, ...options },
		})),
	resetOptions: () =>
		set({
			thresholds: DEFAULT_THRESHOLDS,
			matchOptions: DEFAULT_MATCH_OPTIONS,
		}),
	setShowTypeBreakdown: (showTypeBreakdown) => set({ showTypeBreakdown }),
	setScroll: (scrollOffset, scrollKey) => set({ scrollOffset, scrollKey }),
	resetScroll: () => set({ scrollOffset: 0 }),
}));
