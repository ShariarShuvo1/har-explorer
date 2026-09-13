import { create } from "zustand";
import type { HARData, HAREntry, ResourceType } from "@/lib/har-types";
import { filterEntryIndices, groupKeyFor } from "@/lib/filter-entries";

export type {
	HARCookie,
	HARData,
	HAREntry,
	HARLog,
	HARNameValue,
	HARPage,
	ResourceType,
} from "@/lib/har-types";
export { getResourceType } from "@/lib/resource-type";

export type ViewMode = "requests" | "analytics" | "patterns" | "statistics" | "compare" | "export";

export type SortBy = "started" | "time" | "size" | "status" | "method" | "url";

export type GroupBy = "none" | "domain" | "type";

export type ComparisonMode = "side-by-side" | "diff";

export type ExportScope = "all" | "selected" | "filtered" | "bookmarked";

/** Sections of the request details pane, in display order. */
export type DetailTab =
	"overview" | "headers" | "payload" | "response" | "timing" | "cache" | "security" | "code";

export interface AdvancedFilters {
	statusCodes: number[];
	statusRanges: { min: number; max: number }[];
	sizeMin: number | null;
	sizeMax: number | null;
	durationMin: number | null;
	durationMax: number | null;
	domainPattern: string;
	pathPattern: string;
	headerMatches: { name: string; value: string }[];
	httpVersions: string[];
	methodFilters: string[];
}

export interface Bookmark {
	entryIndex: number;
	label: string;
	color: string;
	note?: string;
	createdAt: string;
}

export const LIST_COLUMNS = ["method", "status", "type", "size", "time", "waterfall"] as const;
export type ListColumn = (typeof LIST_COLUMNS)[number];

/** A time window (ms offsets from the first request) the waterfall is zoomed to. */
export interface TimeRange {
	start: number;
	end: number;
}

export const createDefaultAdvancedFilters = (): AdvancedFilters => ({
	statusCodes: [],
	statusRanges: [],
	sizeMin: null,
	sizeMax: null,
	durationMin: null,
	durationMax: null,
	domainPattern: "",
	pathPattern: "",
	headerMatches: [],
	httpVersions: [],
	methodFilters: [],
});

interface HistorySnapshot {
	label: string;
	harData: HARData | null;
	entries: HAREntry[];
	bookmarks: Map<number, Bookmark>;
	isDirty: boolean;
	/** Sorted indices removed by this step, for re-mapping later bookmarks on undo. */
	deleted?: number[];
}

const MAX_HISTORY = 30;

interface HARStore {
	harData: HARData | null;
	fileName: string | null;
	/** True once entries were edited or deleted since the file was loaded. */
	isDirty: boolean;
	entries: HAREntry[];

	viewMode: ViewMode;

	selectedEntries: Set<number>;
	lastSelectedIndex: number | null;
	/** Entry indices in the order the request list currently displays them. */
	visibleEntryIndices: number[];

	/** Entry shown in the details pane. */
	activeEntry: number | null;
	detailTab: DetailTab;
	detailsMaximized: boolean;
	/** One-shot request for the request list to scroll an entry into view. */
	scrollToIndex: number | null;

	sortBy: SortBy;
	sortOrder: "asc" | "desc";
	searchText: string;
	resourceTypeFilter: ResourceType;
	advancedFilters: AdvancedFilters;
	showBookmarksOnly: boolean;

	visibleColumns: Set<ListColumn>;
	groupBy: GroupBy;
	collapsedGroups: Set<string>;
	showOverview: boolean;
	timeRange: TimeRange | null;

	bookmarks: Map<number, Bookmark>;

	secondaryHarData: HARData | null;
	secondaryFileName: string | null;
	comparisonMode: ComparisonMode;

	/** Scope the Export view should preselect the next time it opens. */
	pendingExportScope: ExportScope | null;

	/** Two entries whose timings are compared in a dialog. */
	timingComparison: [number, number] | null;
	showKeyboardShortcuts: boolean;
	showCommandPalette: boolean;
	showBookmarksSheet: boolean;
	showFiltersPanel: boolean;
	/** Entries awaiting delete confirmation. */
	pendingDelete: number[] | null;

	history: HistorySnapshot[];

	setHarData: (data: HARData, fileName?: string | null) => void;
	clearHarData: () => void;
	updateEntry: (index: number, entry: HAREntry, label?: string) => void;
	deleteEntries: (indices: number[]) => void;
	undo: () => string | null;

	setViewMode: (mode: ViewMode) => void;
	/**
	 * Shows an entry in the request details pane from any view. Filters that
	 * would hide the entry are cleared so it is visible in the list.
	 */
	openEntry: (index: number, tab?: DetailTab) => void;
	setActiveEntry: (index: number | null) => void;
	setDetailTab: (tab: DetailTab) => void;
	setDetailsMaximized: (maximized: boolean) => void;
	stepActiveEntry: (delta: 1 | -1) => void;
	setScrollToIndex: (index: number | null) => void;

	toggleSelection: (index: number) => void;
	selectRange: (index: number) => void;
	selectAll: () => void;
	deselectAll: () => void;
	invertSelection: () => void;
	setSelection: (indices: number[]) => void;
	setVisibleEntryIndices: (indices: number[]) => void;

	setSortBy: (sortBy: SortBy) => void;
	setSortOrder: (sortOrder: "asc" | "desc") => void;
	toggleSortOrder: () => void;
	setSearchText: (text: string) => void;
	setResourceTypeFilter: (filter: ResourceType) => void;
	setAdvancedFilters: (filters: Partial<AdvancedFilters>) => void;
	resetAdvancedFilters: () => void;
	/** Clears search, resource type, advanced filters and bookmarks-only. */
	resetAllFilters: () => void;
	setShowBookmarksOnly: (show: boolean) => void;
	toggleBookmarksOnly: () => void;

	toggleColumn: (column: ListColumn) => void;
	setGroupBy: (groupBy: GroupBy) => void;
	toggleGroup: (key: string) => void;
	setShowOverview: (show: boolean) => void;
	setTimeRange: (range: TimeRange | null) => void;

	addBookmark: (entryIndex: number, label: string, color: string, note?: string) => void;
	removeBookmark: (entryIndex: number) => void;
	updateBookmark: (entryIndex: number, updates: Partial<Bookmark>) => void;

	setSecondaryHarData: (data: HARData | null, fileName?: string | null) => void;
	setComparisonMode: (mode: ComparisonMode) => void;

	openExportView: (scope?: ExportScope) => void;
	consumePendingExportScope: () => ExportScope | null;

	setTimingComparison: (pair: [number, number] | null) => void;
	setShowKeyboardShortcuts: (show: boolean) => void;
	setShowCommandPalette: (show: boolean) => void;
	setShowBookmarksSheet: (show: boolean) => void;
	setShowFiltersPanel: (show: boolean) => void;
	requestDelete: (indices: number[]) => void;
	cancelDelete: () => void;
}

/** State that belongs to a specific loaded file and must not leak into the next one. */
const createFileScopedState = () => ({
	isDirty: false,
	selectedEntries: new Set<number>(),
	lastSelectedIndex: null,
	activeEntry: null,
	detailsMaximized: false,
	scrollToIndex: null,
	searchText: "",
	resourceTypeFilter: "all" as ResourceType,
	advancedFilters: createDefaultAdvancedFilters(),
	showBookmarksOnly: false,
	collapsedGroups: new Set<string>(),
	timeRange: null,
	bookmarks: new Map<number, Bookmark>(),
	secondaryHarData: null,
	secondaryFileName: null,
	pendingExportScope: null,
	timingComparison: null,
	showBookmarksSheet: false,
	showFiltersPanel: false,
	pendingDelete: null,
	history: [] as HistorySnapshot[],
});

/** Maps an old index to its position after `sortedDeleted` indices are removed. */
function shiftIndex(index: number, sortedDeleted: number[]): number {
	let low = 0;
	let high = sortedDeleted.length;
	while (low < high) {
		const mid = (low + high) >> 1;
		if (sortedDeleted[mid] < index) low = mid + 1;
		else high = mid;
	}
	return index - low;
}

/** Old index for an index taken after `sortedDeleted` were removed. */
function unshiftIndex(index: number, sortedDeleted: number[]): number {
	let result = index;
	for (const deleted of sortedDeleted) {
		if (deleted <= result) result++;
		else break;
	}
	return result;
}

/**
 * Bookmarks after undoing `step`. Bookmark changes made since then are kept:
 * undoing an edit leaves bookmarks alone, and undoing a delete restores the
 * deleted rows' bookmarks while moving current ones back to their old rows.
 */
function restoreBookmarks(
	current: Map<number, Bookmark>,
	step: HistorySnapshot
): Map<number, Bookmark> {
	if (!step.deleted) return current;
	const deletedSet = new Set(step.deleted);
	const restored = new Map<number, Bookmark>();
	step.bookmarks.forEach((bookmark, index) => {
		if (deletedSet.has(index)) restored.set(index, bookmark);
	});
	current.forEach((bookmark, index) => {
		const old = unshiftIndex(index, step.deleted!);
		restored.set(old, { ...bookmark, entryIndex: old });
	});
	return restored;
}

function withEntries(harData: HARData | null, entries: HAREntry[]) {
	return harData ? { ...harData, log: { ...harData.log, entries } } : null;
}

const clearSelection = {
	selectedEntries: new Set<number>(),
	lastSelectedIndex: null,
};

export const useHarStore = create<HARStore>((set, get) => {
	const snapshot = (label: string, deleted?: number[]): HistorySnapshot[] => {
		const { harData, entries, bookmarks, isDirty, history } = get();
		return [
			...history.slice(-(MAX_HISTORY - 1)),
			{ label, harData, entries, bookmarks, isDirty, deleted },
		];
	};

	return {
		harData: null,
		fileName: null,
		entries: [],
		viewMode: "requests",
		visibleEntryIndices: [],
		detailTab: "overview",
		sortBy: "started",
		sortOrder: "asc",
		visibleColumns: new Set<ListColumn>(LIST_COLUMNS),
		groupBy: "none",
		showOverview: false,
		comparisonMode: "diff",
		showKeyboardShortcuts: false,
		showCommandPalette: false,
		...createFileScopedState(),

		setHarData: (data, fileName = null) =>
			set({
				...createFileScopedState(),
				harData: data,
				fileName,
				entries: data.log.entries,
				visibleEntryIndices: data.log.entries.map((_, i) => i),
				viewMode: "requests",
				showCommandPalette: false,
			}),

		clearHarData: () =>
			set({
				...createFileScopedState(),
				harData: null,
				fileName: null,
				entries: [],
				visibleEntryIndices: [],
				viewMode: "requests",
				showKeyboardShortcuts: false,
				showCommandPalette: false,
			}),

		updateEntry: (index, entry, label = "Edit request") =>
			set((state) => {
				if (index < 0 || index >= state.entries.length) return {};
				const history = snapshot(label);
				const entries = [...state.entries];
				entries[index] = entry;
				return {
					entries,
					harData: withEntries(state.harData, entries),
					isDirty: true,
					history,
				};
			}),

		deleteEntries: (indices) =>
			set((state) => {
				const deleted = new Set(indices.filter((i) => i >= 0 && i < state.entries.length));
				if (deleted.size === 0) return { pendingDelete: null };
				const sortedDeleted = [...deleted].sort((a, b) => a - b);
				const history = snapshot(
					deleted.size === 1 ? "Delete request" : `Delete ${deleted.size} requests`,
					sortedDeleted
				);
				const remap = (index: number) => shiftIndex(index, sortedDeleted);
				const remapOrNull = (index: number | null) =>
					index === null || deleted.has(index) ? null : remap(index);

				const entries = state.entries.filter((_, i) => !deleted.has(i));

				// Bookmarks are keyed by entry index, so every surviving bookmark
				// moves down by the number of deleted entries before it.
				const bookmarks = new Map<number, Bookmark>();
				state.bookmarks.forEach((bookmark, index) => {
					if (deleted.has(index)) return;
					const next = remap(index);
					bookmarks.set(next, { ...bookmark, entryIndex: next });
				});

				const comparison = state.timingComparison;
				const timingComparison =
					comparison && !deleted.has(comparison[0]) && !deleted.has(comparison[1])
						? ([remap(comparison[0]), remap(comparison[1])] as [number, number])
						: null;

				return {
					entries,
					harData: withEntries(state.harData, entries),
					isDirty: true,
					history,
					...clearSelection,
					activeEntry: remapOrNull(state.activeEntry),
					scrollToIndex: null,
					timingComparison,
					visibleEntryIndices: state.visibleEntryIndices.filter((i) => !deleted.has(i)).map(remap),
					bookmarks,
					showBookmarksOnly: bookmarks.size === 0 ? false : state.showBookmarksOnly,
					pendingDelete: null,
				};
			}),

		undo: () => {
			const { history } = get();
			const last = history[history.length - 1];
			if (!last) return null;
			set((state) => ({
				harData: last.harData,
				entries: last.entries,
				bookmarks: restoreBookmarks(state.bookmarks, last),
				isDirty: last.isDirty,
				history: history.slice(0, -1),
				...clearSelection,
				activeEntry:
					state.activeEntry !== null && state.activeEntry < last.entries.length
						? state.activeEntry
						: null,
				timingComparison: null,
			}));
			return last.label;
		},

		setViewMode: (mode) => set({ viewMode: mode, showCommandPalette: false }),

		openEntry: (index, tab) =>
			set((state) => {
				if (index < 0 || index >= state.entries.length) return {};
				const visible = filterEntryIndices(state).includes(index);
				const collapsedGroups = new Set(state.collapsedGroups);
				collapsedGroups.delete(groupKeyFor(state.entries[index], state.groupBy));
				return {
					collapsedGroups,
					viewMode: "requests",
					activeEntry: index,
					scrollToIndex: index,
					showCommandPalette: false,
					showBookmarksSheet: false,
					...(tab ? { detailTab: tab } : {}),
					...(visible
						? {}
						: {
								advancedFilters: createDefaultAdvancedFilters(),
								searchText: "",
								resourceTypeFilter: "all" as ResourceType,
								showBookmarksOnly: false,
								timeRange: null,
								collapsedGroups: new Set<string>(),
							}),
				};
			}),

		setActiveEntry: (index) =>
			set((state) => ({
				activeEntry: index,
				detailsMaximized: index === null ? false : state.detailsMaximized,
			})),

		setDetailTab: (tab) => set({ detailTab: tab }),

		setDetailsMaximized: (maximized) => set({ detailsMaximized: maximized }),

		stepActiveEntry: (delta) =>
			set((state) => {
				const visible = state.visibleEntryIndices;
				if (visible.length === 0) return {};
				const position = state.activeEntry === null ? -1 : visible.indexOf(state.activeEntry);
				const next =
					position === -1
						? delta === 1
							? 0
							: visible.length - 1
						: Math.min(visible.length - 1, Math.max(0, position + delta));
				const target = visible[next];
				const collapsedGroups = new Set(state.collapsedGroups);
				collapsedGroups.delete(groupKeyFor(state.entries[target], state.groupBy));
				return { activeEntry: target, scrollToIndex: target, collapsedGroups };
			}),

		setScrollToIndex: (index) => set({ scrollToIndex: index }),

		toggleSelection: (index) =>
			set((state) => {
				const selected = new Set(state.selectedEntries);
				if (selected.has(index)) {
					selected.delete(index);
					return { selectedEntries: selected };
				}
				selected.add(index);
				return { selectedEntries: selected, lastSelectedIndex: index };
			}),

		selectRange: (index) =>
			set((state) => {
				const visible = state.visibleEntryIndices;
				const target = visible.indexOf(index);
				const selected = new Set(state.selectedEntries);
				if (target === -1) {
					selected.add(index);
					return { selectedEntries: selected, lastSelectedIndex: index };
				}
				const anchor =
					state.lastSelectedIndex !== null ? visible.indexOf(state.lastSelectedIndex) : -1;
				const start = Math.min(anchor === -1 ? target : anchor, target);
				const end = Math.max(anchor, target);
				for (const i of visible.slice(start, end + 1)) selected.add(i);
				return { selectedEntries: selected, lastSelectedIndex: index };
			}),

		selectAll: () =>
			set((state) => {
				const selected = new Set(state.selectedEntries);
				for (const i of state.visibleEntryIndices) selected.add(i);
				return { selectedEntries: selected };
			}),

		deselectAll: () => set(clearSelection),

		invertSelection: () =>
			set((state) => {
				const visible = new Set(state.visibleEntryIndices);
				const selected = new Set<number>();
				// Hidden selections are kept; only the visible ones are inverted.
				state.selectedEntries.forEach((i) => {
					if (!visible.has(i)) selected.add(i);
				});
				for (const i of state.visibleEntryIndices) {
					if (!state.selectedEntries.has(i)) selected.add(i);
				}
				return { selectedEntries: selected, lastSelectedIndex: null };
			}),

		setSelection: (indices) => set({ selectedEntries: new Set(indices), lastSelectedIndex: null }),

		setVisibleEntryIndices: (indices) => set({ visibleEntryIndices: indices }),

		setSortBy: (sortBy) => set({ sortBy }),
		setSortOrder: (sortOrder) => set({ sortOrder }),
		toggleSortOrder: () =>
			set((state) => ({ sortOrder: state.sortOrder === "asc" ? "desc" : "asc" })),

		// Changing what is visible clears the selection so hidden rows cannot be
		// deleted or exported by accident.
		setSearchText: (text) => set({ searchText: text, ...clearSelection }),
		setResourceTypeFilter: (filter) => set({ resourceTypeFilter: filter, ...clearSelection }),
		setAdvancedFilters: (filters) =>
			set((state) => ({
				advancedFilters: { ...state.advancedFilters, ...filters },
				...clearSelection,
			})),
		resetAdvancedFilters: () =>
			set({ advancedFilters: createDefaultAdvancedFilters(), ...clearSelection }),
		resetAllFilters: () =>
			set({
				advancedFilters: createDefaultAdvancedFilters(),
				searchText: "",
				resourceTypeFilter: "all",
				showBookmarksOnly: false,
				timeRange: null,
				...clearSelection,
			}),
		setShowBookmarksOnly: (show) => set({ showBookmarksOnly: show, ...clearSelection }),
		toggleBookmarksOnly: () =>
			set((state) => ({
				showBookmarksOnly: !state.showBookmarksOnly,
				...clearSelection,
			})),

		toggleColumn: (column) =>
			set((state) => {
				const columns = new Set(state.visibleColumns);
				if (columns.has(column)) columns.delete(column);
				else columns.add(column);
				return { visibleColumns: columns };
			}),

		setGroupBy: (groupBy) => set({ groupBy, collapsedGroups: new Set<string>() }),

		toggleGroup: (key) =>
			set((state) => {
				const groups = new Set(state.collapsedGroups);
				if (groups.has(key)) groups.delete(key);
				else groups.add(key);
				return { collapsedGroups: groups };
			}),

		setShowOverview: (show) => set({ showOverview: show }),

		setTimeRange: (range) =>
			set({
				timeRange: range && Number.isFinite(range.start) && range.end > range.start ? range : null,
				...clearSelection,
			}),

		addBookmark: (entryIndex, label, color, note) =>
			set((state) => {
				const bookmarks = new Map(state.bookmarks);
				bookmarks.set(entryIndex, {
					entryIndex,
					label,
					color,
					note,
					createdAt: new Date().toISOString(),
				});
				return { bookmarks };
			}),

		removeBookmark: (entryIndex) =>
			set((state) => {
				const bookmarks = new Map(state.bookmarks);
				bookmarks.delete(entryIndex);
				return {
					bookmarks,
					showBookmarksOnly: bookmarks.size === 0 ? false : state.showBookmarksOnly,
				};
			}),

		updateBookmark: (entryIndex, updates) =>
			set((state) => {
				const existing = state.bookmarks.get(entryIndex);
				if (!existing) return {};
				const bookmarks = new Map(state.bookmarks);
				bookmarks.set(entryIndex, { ...existing, ...updates, entryIndex });
				return { bookmarks };
			}),

		setSecondaryHarData: (data, fileName = null) =>
			set({ secondaryHarData: data, secondaryFileName: data ? fileName : null }),

		setComparisonMode: (mode) => set({ comparisonMode: mode }),

		openExportView: (scope) =>
			set({
				viewMode: "export",
				pendingExportScope: scope ?? null,
				showCommandPalette: false,
				showBookmarksSheet: false,
			}),

		consumePendingExportScope: () => {
			const scope = get().pendingExportScope;
			if (scope !== null) set({ pendingExportScope: null });
			return scope;
		},

		setTimingComparison: (pair) => set({ timingComparison: pair }),
		setShowKeyboardShortcuts: (show) =>
			set({ showKeyboardShortcuts: show, showCommandPalette: false }),
		setShowCommandPalette: (show) => set({ showCommandPalette: show }),
		setShowBookmarksSheet: (show) => set({ showBookmarksSheet: show }),
		setShowFiltersPanel: (show) => set({ showFiltersPanel: show }),
		requestDelete: (indices) => set({ pendingDelete: indices.length > 0 ? [...indices] : null }),
		cancelDelete: () => set({ pendingDelete: null }),
	};
});
