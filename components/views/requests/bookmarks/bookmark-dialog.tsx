"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { useHarStore, type Bookmark, type HAREntry } from "@/lib/stores/har-store";
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
	ResponsiveDialogTitle,
} from "@/components/common/responsive-dialog";
import { MethodBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { extractPath } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import {
	BOOKMARK_COLORS,
	DEFAULT_BOOKMARK_COLOR,
	getBookmarkColor,
	getDefaultBookmarkLabel,
} from "./bookmark-utils";

interface BookmarkDialogProps {
	entryIndex: number | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** Create or edit the bookmark of one request. */
export function BookmarkDialog({ entryIndex, open, onOpenChange }: BookmarkDialogProps) {
	const entry = useHarStore((s) => (entryIndex === null ? undefined : s.entries[entryIndex]));
	const bookmark = useHarStore((s) =>
		entryIndex === null ? undefined : s.bookmarks.get(entryIndex)
	);
	const isOpen = open && entry !== undefined && entryIndex !== null;

	return (
		<ResponsiveDialog open={isOpen} onOpenChange={onOpenChange}>
			<ResponsiveDialogContent size="sm">
				{entry && entryIndex !== null && (
					<BookmarkForm
						// Remount so the draft resets whenever a different bookmark is edited.
						key={`${entryIndex}:${bookmark?.createdAt ?? "new"}`}
						entryIndex={entryIndex}
						entry={entry}
						bookmark={bookmark}
						onClose={() => onOpenChange(false)}
					/>
				)}
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function BookmarkForm({
	entryIndex,
	entry,
	bookmark,
	onClose,
}: {
	entryIndex: number;
	entry: HAREntry;
	bookmark: Bookmark | undefined;
	onClose: () => void;
}) {
	const addBookmark = useHarStore((s) => s.addBookmark);
	const updateBookmark = useHarStore((s) => s.updateBookmark);
	const removeBookmark = useHarStore((s) => s.removeBookmark);
	const defaultLabel = getDefaultBookmarkLabel(entry);
	const [label, setLabel] = useState(bookmark?.label ?? defaultLabel);
	const [color, setColor] = useState(
		bookmark ? getBookmarkColor(bookmark.color).value : DEFAULT_BOOKMARK_COLOR
	);
	const [note, setNote] = useState(bookmark?.note ?? "");
	const labelId = useId();
	const noteId = useId();
	const formId = useId();

	const save = () => {
		const finalLabel = label.trim() || defaultLabel;
		const finalNote = note.trim() || undefined;
		if (bookmark) {
			updateBookmark(entryIndex, { label: finalLabel, color, note: finalNote });
			toast.success("Bookmark updated");
		} else {
			addBookmark(entryIndex, finalLabel, color, finalNote);
			toast.success("Bookmarked");
		}
		onClose();
	};

	const remove = () => {
		if (!bookmark) return;
		const removed = bookmark;
		removeBookmark(entryIndex);
		onClose();
		toast("Bookmark removed", {
			action: {
				label: "Undo",
				onClick: () => {
					const state = useHarStore.getState();
					if (state.entries[entryIndex] !== entry || state.bookmarks.has(entryIndex)) return;
					state.addBookmark(entryIndex, removed.label, removed.color, removed.note);
					state.updateBookmark(entryIndex, { createdAt: removed.createdAt });
				},
			},
		});
	};

	return (
		<>
			<ResponsiveDialogHeader>
				<ResponsiveDialogTitle>{bookmark ? "Edit bookmark" : "Add bookmark"}</ResponsiveDialogTitle>
				<ResponsiveDialogDescription className="flex min-w-0 items-center gap-2">
					<MethodBadge method={entry.request.method} />
					<span className="truncate font-mono text-xs" title={entry.request.url}>
						{extractPath(entry.request.url)}
					</span>
				</ResponsiveDialogDescription>
			</ResponsiveDialogHeader>
			<ResponsiveDialogBody>
				<form
					id={formId}
					onSubmit={(e) => {
						e.preventDefault();
						save();
					}}
				>
					<FieldGroup className="gap-5">
						<Field>
							<FieldLabel htmlFor={labelId}>Label</FieldLabel>
							<Input
								id={labelId}
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder={defaultLabel}
								maxLength={120}
								autoFocus
							/>
						</Field>
						<FieldSet className="gap-3">
							<FieldLegend variant="label" className="mb-0">
								Color
							</FieldLegend>
							<RadioGroup
								value={color}
								onValueChange={setColor}
								className="flex flex-wrap gap-2"
								aria-label="Bookmark color"
							>
								{BOOKMARK_COLORS.map((option) => (
									<RadioGroupItem
										key={option.value}
										value={option.value}
										aria-label={option.name}
										title={option.name}
										className={cn(
											"size-8 border-0 shadow-none sm:size-7 [&_svg]:size-2.5 [&_svg]:fill-background",
											"data-[state=checked]:ring-2 data-[state=checked]:ring-foreground data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-background",
											option.className
										)}
									/>
								))}
							</RadioGroup>
						</FieldSet>
						<Field>
							<FieldLabel htmlFor={noteId}>Note</FieldLabel>
							<Textarea
								id={noteId}
								value={note}
								onChange={(e) => setNote(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
										e.preventDefault();
										save();
									}
								}}
								rows={4}
								placeholder="Why is this request interesting?"
							/>
						</Field>
					</FieldGroup>
				</form>
			</ResponsiveDialogBody>
			<ResponsiveDialogFooter className="sm:justify-between">
				{bookmark ? (
					<Button
						type="button"
						variant="ghost"
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						onClick={remove}
					>
						Remove bookmark
					</Button>
				) : (
					<span className="hidden sm:block" />
				)}
				<div className="flex flex-col-reverse gap-2 sm:flex-row">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form={formId}>
						Save
					</Button>
				</div>
			</ResponsiveDialogFooter>
		</>
	);
}
