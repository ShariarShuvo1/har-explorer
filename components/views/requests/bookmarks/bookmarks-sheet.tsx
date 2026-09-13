"use client";

import { useId, useMemo, useState } from "react";
import { FileDown, MoreHorizontal, Pencil, Search, Star, Trash2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useHarStore, type Bookmark, type HAREntry } from "@/lib/stores/har-store";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Kbd } from "@/components/ui/kbd";
import { extractPath } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { BookmarkDialog } from "./bookmark-dialog";
import { formatRelativeTime, getBookmarkColorClass } from "./bookmark-utils";
import { useToggleBookmark } from "./use-toggle-bookmark";

const SEARCH_THRESHOLD = 5;

export function BookmarksSheet() {
	const open = useHarStore((s) => s.showBookmarksSheet);
	const setOpen = useHarStore((s) => s.setShowBookmarksSheet);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetContent side="right" className="w-full gap-0 sm:max-w-md">
				<BookmarksSheetBody />
			</SheetContent>
		</Sheet>
	);
}

function BookmarksSheetBody() {
	const { bookmarks, entries, showBookmarksOnly, setShowBookmarksOnly, openExportView } =
		useHarStore(
			useShallow((s) => ({
				bookmarks: s.bookmarks,
				entries: s.entries,
				showBookmarksOnly: s.showBookmarksOnly,
				setShowBookmarksOnly: s.setShowBookmarksOnly,
				openExportView: s.openExportView,
			}))
		);
	const [query, setQuery] = useState("");
	const [editing, setEditing] = useState<number | null>(null);
	// Captured when the sheet opens; the sheet body unmounts on close.
	const [now] = useState(() => Date.now());
	const switchId = useId();

	const sorted = useMemo(
		() => [...bookmarks.values()].sort((a, b) => a.entryIndex - b.entryIndex),
		[bookmarks]
	);

	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return sorted;
		return sorted.filter((bookmark) => {
			const url = entries[bookmark.entryIndex]?.request.url ?? "";
			return (
				bookmark.label.toLowerCase().includes(needle) ||
				(bookmark.note ?? "").toLowerCase().includes(needle) ||
				url.toLowerCase().includes(needle)
			);
		});
	}, [sorted, query, entries]);

	const hasBookmarks = sorted.length > 0;

	return (
		<>
			<SheetHeader className="gap-1 border-b pr-12">
				<SheetTitle className="flex items-center gap-2">
					Bookmarks
					{hasBookmarks && (
						<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
							{sorted.length}
						</span>
					)}
				</SheetTitle>
				<SheetDescription>Requests you starred for later.</SheetDescription>
			</SheetHeader>

			{hasBookmarks && (
				<div className="flex flex-col gap-3 border-b p-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Switch
								id={switchId}
								checked={showBookmarksOnly}
								onCheckedChange={setShowBookmarksOnly}
							/>
							<Label htmlFor={switchId} className="font-normal">
								Show only bookmarked
							</Label>
						</div>
						<Button variant="outline" size="sm" onClick={() => openExportView("bookmarked")}>
							<FileDown />
							Export
						</Button>
					</div>
					{sorted.length > SEARCH_THRESHOLD && (
						<InputGroup>
							<InputGroupAddon>
								<Search />
							</InputGroupAddon>
							<InputGroupInput
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search bookmarks"
								aria-label="Search bookmarks"
							/>
						</InputGroup>
					)}
				</div>
			)}

			<div className="min-h-0 flex-1 overflow-y-auto">
				{!hasBookmarks ? (
					<Empty className="h-full">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Star />
							</EmptyMedia>
							<EmptyTitle>No bookmarks yet</EmptyTitle>
							<EmptyDescription>
								Open a request and click the star or press <Kbd>B</Kbd>, or right-click a request
								and choose Bookmark.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : visible.length === 0 ? (
					<p className="p-6 text-center text-sm text-muted-foreground">
						No bookmarks match &ldquo;{query.trim()}&rdquo;.
					</p>
				) : (
					<ul className="flex flex-col gap-1 p-2">
						{visible.map((bookmark) => (
							<BookmarkRow
								key={`${bookmark.entryIndex}:${bookmark.createdAt}`}
								bookmark={bookmark}
								entry={entries[bookmark.entryIndex]}
								now={now}
								onEdit={() => setEditing(bookmark.entryIndex)}
							/>
						))}
					</ul>
				)}
			</div>

			<BookmarkDialog
				entryIndex={editing}
				open={editing !== null}
				onOpenChange={(next) => {
					if (!next) setEditing(null);
				}}
			/>
		</>
	);
}

function BookmarkRow({
	bookmark,
	entry,
	now,
	onEdit,
}: {
	bookmark: Bookmark;
	entry: HAREntry | undefined;
	now: number;
	onEdit: () => void;
}) {
	const openEntry = useHarStore((s) => s.openEntry);
	const toggleBookmark = useToggleBookmark();
	const index = bookmark.entryIndex;
	const created = formatRelativeTime(bookmark.createdAt, now);

	return (
		<li className="group relative flex items-start gap-1 rounded-lg hover:bg-accent/60">
			<button
				type="button"
				onClick={() => openEntry(index)}
				disabled={!entry}
				className="flex min-w-0 flex-1 items-start gap-3 rounded-lg p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
			>
				<span
					aria-hidden="true"
					className={cn(
						"mt-1.5 size-2.5 shrink-0 rounded-full",
						getBookmarkColorClass(bookmark.color)
					)}
				/>
				<span className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="text-sm font-medium break-words">{bookmark.label}</span>
					{entry ? (
						<span className="flex min-w-0 items-center gap-2">
							<MethodBadge method={entry.request.method} />
							<StatusBadge status={entry.response.status} />
							<span
								className="min-w-0 truncate font-mono text-xs text-muted-foreground"
								title={entry.request.url}
							>
								{extractPath(entry.request.url)}
							</span>
						</span>
					) : (
						<span className="text-xs text-destructive">Request no longer exists</span>
					)}
					{bookmark.note && (
						<span className="line-clamp-2 text-xs break-words whitespace-pre-wrap text-muted-foreground">
							{bookmark.note}
						</span>
					)}
					{created && (
						<span className="text-xs text-muted-foreground" title={bookmark.createdAt}>
							Added {created}
						</span>
					)}
				</span>
			</button>
			{/* Non-modal so the edit dialog can take focus right after the menu closes. */}
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className="mt-2 mr-2 shrink-0"
						aria-label={`Actions for bookmark ${bookmark.label}`}
					>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={onEdit} disabled={!entry}>
						<Pencil />
						Edit
					</DropdownMenuItem>
					<DropdownMenuItem variant="destructive" onSelect={() => toggleBookmark(index)}>
						<Trash2 />
						Remove
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</li>
	);
}
