"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useHarStore } from "@/lib/stores/har-store";
import { DEFAULT_BOOKMARK_COLOR, getDefaultBookmarkLabel } from "./bookmark-utils";

/**
 * Returns `(index, onEdit?)` that bookmarks a request with the default label
 * and color, or removes its bookmark (with Undo). `onEdit` adds an "Edit"
 * action to the "Bookmarked" toast.
 */
export function useToggleBookmark() {
	return useCallback((index: number, onEdit?: () => void) => {
		const state = useHarStore.getState();
		const entry = state.entries[index];
		const existing = state.bookmarks.get(index);
		if (!entry) {
			if (existing) state.removeBookmark(index);
			return;
		}

		if (!existing) {
			state.addBookmark(index, getDefaultBookmarkLabel(entry), DEFAULT_BOOKMARK_COLOR);
			toast.success("Bookmarked", {
				action: onEdit ? { label: "Edit", onClick: onEdit } : undefined,
			});
			return;
		}

		state.removeBookmark(index);
		toast("Bookmark removed", {
			action: {
				label: "Undo",
				onClick: () => {
					const current = useHarStore.getState();
					// Entries may have been deleted since; only restore onto the same request.
					if (current.entries[index] !== entry || current.bookmarks.has(index)) return;
					current.addBookmark(index, existing.label, existing.color, existing.note);
					current.updateBookmark(index, { createdAt: existing.createdAt });
				},
			},
		});
	}, []);
}
