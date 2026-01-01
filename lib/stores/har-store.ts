import { create } from "zustand";
import type { TabId } from "@/components/har-viewer/entry-details/types";

export interface HAREntry {
	_connectionId?: string;
	_initiator?: unknown;
	_priority?: string;
	_resourceType?: string;
	cache?: Record<string, unknown>;
	connection?: string;
	request: {
		method: string;
		url: string;
		httpVersion: string;
		headers: Array<{ name: string; value: string }>;
		queryString: Array<{ name: string; value: string }>;
		cookies: Array<Record<string, unknown>>;
		headersSize: number;
		bodySize: number;
		postData?: {
			mimeType: string;
			text?: string;
			params?: Array<Record<string, unknown>>;
		};
	};
	response: {
		status: number;
		statusText: string;
		httpVersion: string;
		headers: Array<{ name: string; value: string }>;
		cookies: Array<Record<string, unknown>>;
		content: {
			size: number;
			mimeType: string;
			compression?: number;
			text?: string;
		};
		redirectURL: string;
		headersSize: number;
		bodySize: number;
		_transferSize?: number;
		_error?: unknown;
		_fetchedViaServiceWorker?: boolean;
	};
	serverIPAddress?: string;
	startedDateTime: string;
	time: number;
	timings: {
		blocked: number;
		dns: number;
		ssl: number;
		connect: number;
		send: number;
		wait: number;
		receive: number;
		[key: string]: number;
	};
}

export interface HARLog {
	version: string;
	creator: {
		name: string;
		version: string;
	};
	pages?: Array<Record<string, unknown>>;
	entries: HAREntry[];
}

export interface HARData {
	log: HARLog;
}

export type ResourceType =
	| "all"
	| "fetch"
	| "doc"
	| "css"
	| "js"
	| "font"
	| "img"
	| "media"
	| "manifest"
	| "ws"
	| "wasm"
	| "other";

export type ViewMode =
	| "list"
	| "analytics"
	| "patterns"
	| "statistics"
	| "export";

export type TimelineViewMode = "detailed" | "overview";

export type TimelineGroupMode = "none" | "domain" | "type";

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

interface HARStore {
	harData: HARData | null;
	entries: HAREntry[];
	selectedEntries: Set<number>;
	visibleEntryIndices: number[];
	expandedEntry: number | null;
	focusedEntry: number | null;
	lastSelectedIndex: number | null;
	activeTab: TabId;
	showDeleteConfirm: boolean;
	filterText: string;
	sortBy: "time" | "size" | "status" | "method" | "url";
	sortOrder: "asc" | "desc";
	searchText: string;
	resourceTypeFilter: ResourceType;
	showTimeline: boolean;
	scrollToIndex: number | null;
	viewMode: ViewMode;
	secondaryHarData: HARData | null;
	comparisonMode: "side-by-side" | "diff" | null;
	advancedFilters: AdvancedFilters;
	showAdvancedFilters: boolean;
	bookmarks: Map<number, Bookmark>;
	showBookmarksOnly: boolean;
	showBookmarksPanel: boolean;
	timelineZoom: number;
	timelineScrollOffset: number;
	timelineViewMode: TimelineViewMode;
	timelineGroupMode: TimelineGroupMode;
	timelineHoveredEntry: number | null;
	timelineSelectedForComparison: [number, number] | null;
	expandedDomainGroups: Set<string>;
	visibleColumns: Set<string>;
	showKeyboardShortcuts: boolean;
	setHarData: (data: HARData) => void;
	updateEntry: (index: number, entry: HAREntry) => void;
	deleteEntries: (indices: number[]) => void;
	setViewMode: (mode: ViewMode) => void;
	setSecondaryHarData: (data: HARData | null) => void;
	setComparisonMode: (mode: "side-by-side" | "diff" | null) => void;
	setAdvancedFilters: (filters: Partial<AdvancedFilters>) => void;
	toggleAdvancedFilters: () => void;
	addBookmark: (
		entryIndex: number,
		label: string,
		color: string,
		note?: string
	) => void;
	removeBookmark: (entryIndex: number) => void;
	updateBookmark: (entryIndex: number, updates: Partial<Bookmark>) => void;
	toggleBookmarksOnly: () => void;
	toggleBookmarksPanel: () => void;
	setTimelineZoom: (zoom: number) => void;
	setTimelineScrollOffset: (offset: number) => void;
	setTimelineViewMode: (mode: TimelineViewMode) => void;
	setTimelineGroupMode: (mode: TimelineGroupMode) => void;
	setTimelineHoveredEntry: (index: number | null) => void;
	setTimelineSelectedForComparison: (
		indices: [number, number] | null
	) => void;
	toggleComparisonEntry: (index: number) => void;
	toggleDomainGroup: (domain: string) => void;
	toggleColumn: (column: string) => void;
	toggleKeyboardShortcuts: () => void;
	resetAdvancedFilters: () => void;
	toggleSelection: (index: number) => void;
	selectEntry: (index: number) => void;
	deselectEntry: (index: number) => void;
	selectRange: (index: number) => void;
	selectAll: () => void;
	deselectAll: () => void;
	invertSelection: () => void;
	setExpandedEntry: (index: number | null) => void;
	setFocusedEntry: (index: number | null) => void;
	setActiveTab: (tab: TabId) => void;
	setShowDeleteConfirm: (show: boolean) => void;
	setFilterText: (text: string) => void;
	setSortBy: (sortBy: "time" | "size" | "status" | "method" | "url") => void;
	toggleSortOrder: () => void;
	setSearchText: (text: string) => void;
	setResourceTypeFilter: (filter: ResourceType) => void;
	toggleTimeline: () => void;
	setVisibleEntryIndices: (indices: number[]) => void;
	setLastSelectedIndex: (index: number | null) => void;
	setScrollToIndex: (index: number | null) => void;
	clearHarData: () => void;
}

export function getResourceType(entry: HAREntry): ResourceType {
	const mimeType = entry.response.content.mimeType.toLowerCase();
	const url = entry.request.url.toLowerCase();

	if (entry.request.method === "OPTIONS") return "other";

	if (
		mimeType.includes("application/json") ||
		mimeType.includes("application/xml") ||
		url.includes("/api/") ||
		url.includes("/xhr/")
	) {
		return "fetch";
	}

	if (mimeType.includes("text/html")) return "doc";
	if (mimeType.includes("text/css") || url.endsWith(".css")) return "css";
	if (
		mimeType.includes("javascript") ||
		mimeType.includes("ecmascript") ||
		url.endsWith(".js") ||
		url.endsWith(".mjs")
	)
		return "js";
	if (mimeType.includes("font") || url.match(/\.(woff|woff2|ttf|otf|eot)$/))
		return "font";
	if (
		mimeType.includes("image") ||
		url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)
	)
		return "img";
	if (
		mimeType.includes("video") ||
		mimeType.includes("audio") ||
		url.match(/\.(mp4|webm|ogg|mp3|wav)$/)
	)
		return "media";
	if (mimeType.includes("manifest") || url.endsWith("manifest.json"))
		return "manifest";
	if (
		url.includes("websocket") ||
		url.startsWith("ws://") ||
		url.startsWith("wss://")
	)
		return "ws";
	if (mimeType.includes("wasm") || url.endsWith(".wasm")) return "wasm";

	return "other";
}

export const useHarStore = create<HARStore>((set) => ({
	harData: null,
	entries: [],
	selectedEntries: new Set(),
	visibleEntryIndices: [],
	expandedEntry: null,
	focusedEntry: null,
	lastSelectedIndex: null,
	activeTab: "general",
	showDeleteConfirm: false,
	filterText: "",
	sortBy: "time",
	sortOrder: "desc",
	searchText: "",
	resourceTypeFilter: "all",
	showTimeline: false,
	scrollToIndex: null,
	viewMode: "list",
	secondaryHarData: null,
	comparisonMode: null,
	advancedFilters: {
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
	},
	showAdvancedFilters: false,
	bookmarks: new Map(),
	showBookmarksOnly: false,
	showBookmarksPanel: false,
	timelineZoom: 1,
	timelineScrollOffset: 0,
	timelineViewMode: "detailed",
	timelineGroupMode: "none",
	timelineHoveredEntry: null,
	timelineSelectedForComparison: null,
	expandedDomainGroups: new Set(),
	visibleColumns: new Set(["method", "status", "url", "time", "size"]),
	showKeyboardShortcuts: false,

	setHarData: (data: HARData) =>
		set({
			harData: data,
			entries: data.log.entries,
			selectedEntries: new Set(),
			expandedEntry: null,
			visibleEntryIndices: data.log.entries.map((_, i) => i),
			lastSelectedIndex: null,
		}),

	updateEntry: (index: number, entry: HAREntry) =>
		set((state) => {
			const newEntries = [...state.entries];
			newEntries[index] = entry;
			return {
				entries: newEntries,
				harData: state.harData
					? {
							...state.harData,
							log: {
								...state.harData.log,
								entries: newEntries,
							},
					  }
					: null,
			};
		}),

	deleteEntries: (indices: number[]) =>
		set((state) => {
			const newEntries = state.entries.filter(
				(_, i) => !indices.includes(i)
			);

			const newBookmarks = new Map(state.bookmarks);
			indices.forEach((index) => {
				newBookmarks.delete(index);
			});

			return {
				entries: newEntries,
				harData: state.harData
					? {
							...state.harData,
							log: {
								...state.harData.log,
								entries: newEntries,
							},
					  }
					: null,
				selectedEntries: new Set(),
				expandedEntry: null,
				visibleEntryIndices: newEntries.map((_, i) => i),
				lastSelectedIndex: null,
				bookmarks: newBookmarks,
			};
		}),

	toggleSelection: (index: number) =>
		set((state) => {
			const newSelected = new Set(state.selectedEntries);
			let lastSelected = state.lastSelectedIndex;
			if (newSelected.has(index)) {
				newSelected.delete(index);
			} else {
				newSelected.add(index);
				lastSelected = index;
			}
			return {
				selectedEntries: newSelected,
				lastSelectedIndex: lastSelected,
			};
		}),

	selectEntry: (index: number) =>
		set((state) => {
			const newSelected = new Set(state.selectedEntries);
			newSelected.add(index);
			return {
				selectedEntries: newSelected,
				lastSelectedIndex: index,
			};
		}),

	deselectEntry: (index: number) =>
		set((state) => {
			const newSelected = new Set(state.selectedEntries);
			newSelected.delete(index);
			return { selectedEntries: newSelected };
		}),

	selectRange: (index: number) =>
		set((state) => {
			if (!state.visibleEntryIndices.length) {
				return {};
			}

			const targetPosition = state.visibleEntryIndices.indexOf(index);
			if (targetPosition === -1) {
				const newSelected = new Set(state.selectedEntries);
				newSelected.add(index);
				return {
					selectedEntries: newSelected,
					lastSelectedIndex: index,
				};
			}

			const anchorIndex =
				state.lastSelectedIndex !== null &&
				state.visibleEntryIndices.includes(state.lastSelectedIndex)
					? state.lastSelectedIndex
					: state.visibleEntryIndices[targetPosition];

			const anchorPosition =
				state.visibleEntryIndices.indexOf(anchorIndex);
			const start = Math.min(anchorPosition, targetPosition);
			const end = Math.max(anchorPosition, targetPosition);
			const range = state.visibleEntryIndices.slice(start, end + 1);
			const newSelected = new Set(state.selectedEntries);
			range.forEach((i) => newSelected.add(i));

			return {
				selectedEntries: newSelected,
				lastSelectedIndex: index,
			};
		}),

	selectAll: () =>
		set((state) => {
			const indices = state.visibleEntryIndices;
			const newSelected = new Set(state.selectedEntries);
			indices.forEach((i) => newSelected.add(i));
			const last = indices.length ? indices[indices.length - 1] : null;
			return {
				selectedEntries: newSelected,
				lastSelectedIndex: last ?? state.lastSelectedIndex,
			};
		}),

	deselectAll: () =>
		set({ selectedEntries: new Set(), lastSelectedIndex: null }),

	invertSelection: () =>
		set((state) => {
			const newSelected = new Set<number>();
			state.visibleEntryIndices.forEach((index) => {
				if (!state.selectedEntries.has(index)) {
					newSelected.add(index);
				}
			});
			const last = newSelected.size
				? Array.from(newSelected).pop() ?? null
				: null;
			return {
				selectedEntries: newSelected,
				lastSelectedIndex: last,
			};
		}),

	setExpandedEntry: (index: number | null) => set({ expandedEntry: index }),

	setFocusedEntry: (index: number | null) => set({ focusedEntry: index }),

	setActiveTab: (tab: TabId) => set({ activeTab: tab }),

	setShowDeleteConfirm: (show: boolean) => set({ showDeleteConfirm: show }),

	setFilterText: (text: string) =>
		set({
			filterText: text,
			selectedEntries: new Set(),
			lastSelectedIndex: null,
		}),

	setSortBy: (sortBy) => set({ sortBy }),

	toggleSortOrder: () =>
		set((state) => ({
			sortOrder: state.sortOrder === "asc" ? "desc" : "asc",
		})),

	setSearchText: (text: string) =>
		set({
			searchText: text,
			selectedEntries: new Set(),
			lastSelectedIndex: null,
		}),

	setResourceTypeFilter: (filter: ResourceType) =>
		set({
			resourceTypeFilter: filter,
			selectedEntries: new Set(),
			lastSelectedIndex: null,
		}),

	toggleTimeline: () =>
		set((state) => ({
			showTimeline: !state.showTimeline,
			showAdvancedFilters: state.showTimeline ? false : false,
		})),

	setVisibleEntryIndices: (indices: number[]) =>
		set({ visibleEntryIndices: indices }),

	setScrollToIndex: (index: number | null) => set({ scrollToIndex: index }),

	setLastSelectedIndex: (index: number | null) =>
		set({ lastSelectedIndex: index }),

	clearHarData: () =>
		set({
			harData: null,
			entries: [],
			selectedEntries: new Set(),
			visibleEntryIndices: [],
			expandedEntry: null,
			lastSelectedIndex: null,
			filterText: "",
			searchText: "",
			resourceTypeFilter: "all",
		}),

	setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

	setSecondaryHarData: (data: HARData | null) =>
		set({ secondaryHarData: data }),

	setComparisonMode: (mode: "side-by-side" | "diff" | null) =>
		set({ comparisonMode: mode }),

	setAdvancedFilters: (filters: Partial<AdvancedFilters>) =>
		set((state) => ({
			advancedFilters: { ...state.advancedFilters, ...filters },
		})),

	toggleAdvancedFilters: () =>
		set((state) => ({
			showAdvancedFilters: !state.showAdvancedFilters,
			showTimeline: state.showAdvancedFilters ? false : false,
		})),

	resetAdvancedFilters: () =>
		set({
			advancedFilters: {
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
			},
		}),

	addBookmark: (
		entryIndex: number,
		label: string,
		color: string,
		note?: string
	) =>
		set((state) => {
			const newBookmarks = new Map(state.bookmarks);
			newBookmarks.set(entryIndex, {
				entryIndex,
				label,
				color,
				note,
				createdAt: new Date().toISOString(),
			});
			return { bookmarks: newBookmarks };
		}),

	removeBookmark: (entryIndex: number) =>
		set((state) => {
			const newBookmarks = new Map(state.bookmarks);
			newBookmarks.delete(entryIndex);
			return { bookmarks: newBookmarks };
		}),

	updateBookmark: (entryIndex: number, updates: Partial<Bookmark>) =>
		set((state) => {
			const newBookmarks = new Map(state.bookmarks);
			const existing = newBookmarks.get(entryIndex);
			if (existing) {
				newBookmarks.set(entryIndex, { ...existing, ...updates });
			}
			return { bookmarks: newBookmarks };
		}),

	toggleBookmarksOnly: () =>
		set((state) => ({
			showBookmarksOnly: !state.showBookmarksOnly,
		})),
	toggleBookmarksPanel: () =>
		set((state) => ({ showBookmarksPanel: !state.showBookmarksPanel })),

	setTimelineZoom: (zoom: number) =>
		set({ timelineZoom: Math.max(0.1, Math.min(zoom, 10)) }),

	setTimelineScrollOffset: (offset: number) =>
		set({ timelineScrollOffset: Math.max(0, offset) }),

	setTimelineViewMode: (mode: TimelineViewMode) =>
		set({ timelineViewMode: mode }),

	setTimelineGroupMode: (mode: TimelineGroupMode) =>
		set({ timelineGroupMode: mode, expandedDomainGroups: new Set() }),

	setTimelineHoveredEntry: (index: number | null) =>
		set({ timelineHoveredEntry: index }),

	setTimelineSelectedForComparison: (indices: [number, number] | null) =>
		set({ timelineSelectedForComparison: indices }),

	toggleComparisonEntry: (index: number) =>
		set((state) => {
			const current = state.timelineSelectedForComparison;
			if (!current) {
				return {
					timelineSelectedForComparison: [index, -1] as [
						number,
						number
					],
				};
			}
			if (current[0] === index) {
				return { timelineSelectedForComparison: null };
			}
			if (current[1] === -1) {
				return {
					timelineSelectedForComparison: [current[0], index] as [
						number,
						number
					],
				};
			}
			return {
				timelineSelectedForComparison: [index, -1] as [number, number],
			};
		}),

	toggleDomainGroup: (domain: string) =>
		set((state) => {
			const newGroups = new Set(state.expandedDomainGroups);
			if (newGroups.has(domain)) {
				newGroups.delete(domain);
			} else {
				newGroups.add(domain);
			}
			return { expandedDomainGroups: newGroups };
		}),

	toggleColumn: (column: string) =>
		set((state) => {
			const newColumns = new Set(state.visibleColumns);
			if (newColumns.has(column)) {
				newColumns.delete(column);
			} else {
				newColumns.add(column);
			}
			return { visibleColumns: newColumns };
		}),

	toggleKeyboardShortcuts: () =>
		set((state) => ({
			showKeyboardShortcuts: !state.showKeyboardShortcuts,
		})),
}));
