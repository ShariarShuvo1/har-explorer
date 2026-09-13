"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useHarStore } from "@/lib/stores/har-store";
import { undoActionFor } from "./app-topbar";

export function DeleteRequestsDialog() {
	const pending = useHarStore((s) => s.pendingDelete);
	const cancelDelete = useHarStore((s) => s.cancelDelete);
	const deleteEntries = useHarStore((s) => s.deleteEntries);
	const bookmarks = useHarStore((s) => s.bookmarks);
	const visible = useHarStore((s) => s.visibleEntryIndices);

	// Keep showing the last request list while the dialog animates closed.
	const [shown, setShown] = useState(pending);
	if (pending !== null && pending !== shown) setShown(pending);
	const targets = pending ?? shown ?? [];

	const count = targets.length;
	const visibleSet = new Set(visible);
	const hidden = targets.filter((i) => !visibleSet.has(i)).length;
	const bookmarked = targets.filter((i) => bookmarks.has(i)).length;
	const noun = count === 1 ? "request" : "requests";

	return (
		<ConfirmDialog
			open={pending !== null}
			onOpenChange={(open) => !open && cancelDelete()}
			title={`Delete ${count} ${noun}?`}
			description={
				<>
					<p>
						{count === 1 ? "It" : "They"} will be removed from the loaded HAR in this tab. You can
						undo this.
					</p>
					{(hidden > 0 || bookmarked > 0) && (
						<ul className="list-disc space-y-1 pl-5">
							{hidden > 0 && (
								<li>
									{hidden} of them {hidden === 1 ? "is" : "are"} hidden by the current filters.
								</li>
							)}
							{bookmarked > 0 && (
								<li>
									{bookmarked} {bookmarked === 1 ? "bookmark" : "bookmarks"} will be removed too.
								</li>
							)}
						</ul>
					)}
				</>
			}
			confirmLabel="Delete"
			destructive
			onConfirm={() => {
				if (!pending) return;
				deleteEntries(pending);
				toast(`Deleted ${count} ${noun}`, {
					action: undoActionFor(useHarStore.getState().history.length),
				});
			}}
		/>
	);
}
