"use client";

import { Bookmark as BookmarkIcon, Trash2, Star } from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";

export function BookmarksPanel() {
	const {
		bookmarks,
		removeBookmark,
		entries,
		setScrollToIndex,
		setExpandedEntry,
		setSearchText,
		setResourceTypeFilter,
		showBookmarksOnly,
		toggleBookmarksOnly,
	} = useHarStore();

	const bookmarkArray = Array.from(bookmarks.entries()).map(
		([index, bookmark]) => ({
			index,
			...bookmark,
		})
	);

	const handleClickBookmark = (entryIndex: number) => {
		setSearchText("");
		setResourceTypeFilter("all");
		if (showBookmarksOnly) {
			toggleBookmarksOnly();
		}
		setExpandedEntry(entryIndex);
		setScrollToIndex(entryIndex);
	};

	return (
		<div className="p-4 bg-card/40 border border-border h-full space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<BookmarkIcon className="w-5 h-5 text-primary" />
					<h3 className="text-lg font-semibold text-foreground">
						Bookmarks
					</h3>
					<span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs font-bold">
						{bookmarkArray.length}
					</span>
				</div>
			</div>

			<div className="space-y-2 overflow-y-auto h-[calc(100%-30px)]">
				{bookmarkArray.length === 0 ? (
					<div className="text-center py-8 text-muted">
						<Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
						<p className="text-sm">No bookmarks yet</p>
						<p className="text-xs mt-1">
							Click the bookmark icon on any entry
						</p>
					</div>
				) : (
					bookmarkArray.map((bookmark) => (
						<div
							key={bookmark.index}
							className="p-3 bg-card rounded border border-border hover:bg-card-hover transition-colors"
						>
							<div className="flex items-start gap-3">
								<div
									className="w-1 h-full rounded"
									style={{
										backgroundColor: bookmark.color,
									}}
								/>
								<div className="flex-1 min-w-0">
									<button
										onClick={() =>
											handleClickBookmark(bookmark.index)
										}
										className="w-full text-left"
									>
										<div className="flex items-center gap-2 mb-1">
											<span className="text-sm font-medium text-foreground">
												{bookmark.label}
											</span>
										</div>
										{bookmark.note && (
											<p className="text-xs text-muted mt-1">
												{bookmark.note}
											</p>
										)}
										{entries[bookmark.index] && (
											<p className="text-xs text-muted/70 mt-1 truncate font-mono">
												{
													entries[bookmark.index]
														.request.url
												}
											</p>
										)}
									</button>
								</div>
								<button
									aria-label="Delete Bookmark"
									onClick={() =>
										removeBookmark(bookmark.index)
									}
									className="p-1 hover:bg-red-500/10 rounded transition-colors"
								>
									<Trash2 className="w-3 h-3 text-red-500" />
								</button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
