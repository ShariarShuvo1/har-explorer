"use client";

import { useMemo, useState } from "react";
import { FilterX, SearchX } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useHarStore } from "@/lib/stores/har-store";
import { filterEntryIndices } from "@/lib/filter-entries";
import { buildWaterfallModel } from "@/lib/waterfall";
import { useSyncVisibleEntryIndices } from "@/lib/hooks/use-filtered-entries";
import { useMediaQuery } from "@/lib/hooks/use-mobile";
import { RequestsToolbar } from "./requests-toolbar";
import { FilterChips } from "./filters/filters-panel";
import { RequestTable } from "./request-table";
import { DetailsPane } from "./details-pane";
import { OverviewStrip } from "./overview-strip";
import { BulkActionBar } from "./bulk-action-bar";
import { RequestsStatusBar } from "./status-bar";
import { RequestsUiContext } from "./request-actions";
import { BookmarkDialog } from "./bookmarks/bookmark-dialog";

export function RequestsView() {
	const groups = useSyncVisibleEntryIndices();
	const entries = useHarStore((s) => s.entries);
	const pages = useHarStore((s) => s.harData?.log.pages);
	const timeRange = useHarStore((s) => s.timeRange);
	const showOverview = useHarStore((s) => s.showOverview);
	const activeEntry = useHarStore((s) => s.activeEntry);
	const maximized = useHarStore((s) => s.detailsMaximized);
	const setActiveEntry = useHarStore((s) => s.setActiveEntry);
	const resetAllFilters = useHarStore((s) => s.resetAllFilters);
	const isWide = useMediaQuery("(min-width: 1024px)");
	const [bookmarkEditIndex, setBookmarkEditIndex] = useState<number | null>(null);

	const filterState = useHarStore(
		useShallow((s) => ({
			entries: s.entries,
			searchText: s.searchText,
			resourceTypeFilter: s.resourceTypeFilter,
			advancedFilters: s.advancedFilters,
			bookmarks: s.bookmarks,
			showBookmarksOnly: s.showBookmarksOnly,
		}))
	);
	const overviewIndices = useMemo(
		() => (showOverview ? filterEntryIndices(filterState) : []),
		[showOverview, filterState]
	);

	const model = useMemo(
		() => buildWaterfallModel(entries, pages, timeRange),
		[entries, pages, timeRange]
	);

	const listed = useMemo(() => groups.flatMap((group) => group.indices), [groups]);
	const shown = listed.length;
	const hasActive = activeEntry !== null && activeEntry < entries.length;
	const uiContext = useMemo(() => ({ editBookmark: setBookmarkEditIndex }), []);

	const list =
		shown === 0 ? (
			<Empty className="h-full border-0">
				<EmptyHeader>
					<EmptyMedia variant="icon">{entries.length === 0 ? <SearchX /> : <FilterX />}</EmptyMedia>
					<EmptyTitle>
						{entries.length === 0 ? "This HAR file has no requests" : "No matching requests"}
					</EmptyTitle>
					<EmptyDescription>
						{entries.length === 0
							? "Open another file from the menu in the sidebar."
							: "Try a different search, resource type or filter."}
					</EmptyDescription>
				</EmptyHeader>
				{entries.length > 0 && (
					<EmptyContent>
						<Button variant="outline" size="sm" onClick={resetAllFilters}>
							Clear all filters
						</Button>
					</EmptyContent>
				)}
			</Empty>
		) : (
			<RequestTable groups={groups} model={model} />
		);

	return (
		<RequestsUiContext.Provider value={uiContext}>
			<div className="relative flex min-h-0 flex-1 flex-col">
				<RequestsToolbar shown={shown} />
				<FilterChips className="border-b px-3 py-2 sm:px-4" />
				{showOverview && <OverviewStrip model={model} indices={overviewIndices} />}

				<div className="relative min-h-0 flex-1">
					{isWide && hasActive ? (
						<ResizablePanelGroup orientation="horizontal" className="h-full">
							{!maximized && (
								<>
									<ResizablePanel id="request-list" defaultSize="55" minSize={360}>
										{list}
									</ResizablePanel>
									<ResizableHandle withHandle />
								</>
							)}
							<ResizablePanel
								id="request-details"
								defaultSize={maximized ? "100" : "45"}
								minSize={380}
							>
								<DetailsPane index={activeEntry} canMaximize onClose={() => setActiveEntry(null)} />
							</ResizablePanel>
						</ResizablePanelGroup>
					) : (
						list
					)}
					<BulkActionBar />
				</div>
				{entries.length > 0 && <RequestsStatusBar indices={listed} model={model} />}
			</div>

			{!isWide && (
				<Sheet open={hasActive} onOpenChange={(open) => !open && setActiveEntry(null)}>
					<SheetContent
						data-details-sheet
						side="right"
						className="w-full gap-0 p-0 sm:max-w-2xl [&>button:last-child]:hidden"
						onOpenAutoFocus={(e) => e.preventDefault()}
						onEscapeKeyDown={(e) => {
							// Keep the sheet open while an inline editor has unsaved input.
							if (document.querySelector('[data-editing="true"]')) e.preventDefault();
						}}
					>
						<SheetTitle className="sr-only">Request details</SheetTitle>
						<SheetDescription className="sr-only">
							Headers, payload, response and timing
						</SheetDescription>
						{hasActive && (
							<DetailsPane
								index={activeEntry}
								canMaximize={false}
								onClose={() => setActiveEntry(null)}
							/>
						)}
					</SheetContent>
				</Sheet>
			)}

			<BookmarkDialog
				entryIndex={bookmarkEditIndex}
				open={bookmarkEditIndex !== null}
				onOpenChange={(open) => !open && setBookmarkEditIndex(null)}
			/>
		</RequestsUiContext.Provider>
	);
}
