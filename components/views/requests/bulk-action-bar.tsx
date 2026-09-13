"use client";

import {
	BookmarkPlus,
	FileOutput,
	GitCompareArrows,
	MoreHorizontal,
	Trash2,
	X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useHarStore } from "@/lib/stores/har-store";
import { DEFAULT_BOOKMARK_COLOR, getDefaultBookmarkLabel } from "./bookmarks/bookmark-utils";

/** Floating actions for the current multi-selection (Gmail/Linear style). */
export function BulkActionBar() {
	const selected = useHarStore((s) => s.selectedEntries);
	const count = selected.size;
	if (count === 0) return null;

	const store = useHarStore.getState;
	const indices = [...selected].sort((a, b) => a - b);

	const bookmarkAll = () => {
		const state = store();
		let added = 0;
		for (const index of indices) {
			if (state.bookmarks.has(index)) continue;
			state.addBookmark(
				index,
				getDefaultBookmarkLabel(state.entries[index]),
				DEFAULT_BOOKMARK_COLOR
			);
			added++;
		}
		toast.success(
			added === 0
				? "Already bookmarked"
				: `Bookmarked ${added} ${added === 1 ? "request" : "requests"}`
		);
	};

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
			<div
				role="toolbar"
				aria-label="Selection actions"
				className="pointer-events-auto flex max-w-full animate-in items-center gap-1 rounded-xl border bg-popover p-1.5 pl-3 text-popover-foreground shadow-lg fade-in-0 slide-in-from-bottom-2"
			>
				<span className="text-sm font-medium whitespace-nowrap tabular-nums">{count} selected</span>
				<Separator orientation="vertical" className="mx-1.5 data-[orientation=vertical]:h-5" />
				<Button variant="ghost" size="sm" onClick={bookmarkAll}>
					<BookmarkPlus />
					<span className="hidden sm:inline">Bookmark</span>
				</Button>
				<Button variant="ghost" size="sm" onClick={() => store().openExportView("selected")}>
					<FileOutput />
					<span className="hidden sm:inline">Export</span>
				</Button>
				{count === 2 && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => store().setTimingComparison([indices[0], indices[1]])}
					>
						<GitCompareArrows />
						<span className="hidden md:inline">Compare timing</span>
					</Button>
				)}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" aria-label="More selection actions">
							<MoreHorizontal />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" side="top">
						<DropdownMenuItem onSelect={() => store().selectAll()}>
							Select all visible
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => store().invertSelection()}>
							Invert selection
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<Button
					variant="ghost"
					size="sm"
					className="text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={() => store().requestDelete(indices)}
				>
					<Trash2 />
					<span className="hidden sm:inline">Delete</span>
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => store().deselectAll()}
					aria-label="Clear selection"
				>
					<X />
				</Button>
			</div>
		</div>
	);
}
