"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useHarStore } from "@/lib/stores/har-store";
import { downloadTextFile, getHarFileStem } from "@/lib/api-docs/download";
import { serializeHar } from "@/lib/api-docs/har-export";
import { useHarLoader, useHarDropTarget } from "@/lib/hooks/use-har-loader";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadingOverlay } from "@/components/landing/loading-overlay";

interface FileActions {
	/** Opens the file picker, confirming first when unsaved work would be lost. */
	openFile: () => void;
	downloadHar: () => void;
	/** Closes the file, confirming first when unsaved work would be lost. */
	closeFile: () => void;
}

const FileActionsContext = createContext<FileActions | null>(null);

export function useFileActions(): FileActions {
	const context = useContext(FileActionsContext);
	if (!context) throw new Error("useFileActions must be used inside FileActionsProvider");
	return context;
}

function downloadCurrentHar() {
	const { harData, fileName, isDirty } = useHarStore.getState();
	if (!harData) return;
	const stem = getHarFileStem(fileName);
	downloadTextFile(
		serializeHar(harData),
		`${stem}${isDirty ? "-edited" : ""}.har`,
		"application/json"
	);
	toast.success("HAR file downloaded");
}

/**
 * Owns the "open another file", "download" and "close" flows for the app shell,
 * including the confirmation shown when edits or bookmarks would be discarded.
 */
export function FileActionsProvider({ children }: { children: ReactNode }) {
	const loader = useHarLoader();
	// The Compare view has its own drop target for the second file.
	const viewMode = useHarStore((s) => s.viewMode);
	const [pending, setPending] = useState<"open" | "close" | null>(null);
	// Files dropped while there is unsaved work wait for confirmation.
	const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
	const { isDragging, dropProps } = useHarDropTarget(loader, {
		enabled: viewMode !== "compare",
		onFiles: (files) => {
			const { isDirty: dirty, bookmarks } = useHarStore.getState();
			if (dirty || bookmarks.size > 0) {
				setDroppedFiles(files);
				setPending("open");
			} else {
				void loader.loadFiles(files);
			}
		},
	});
	// Keep the dialog text stable while it animates closed.
	const [lastPending, setLastPending] = useState<"open" | "close">("close");
	if (pending !== null && pending !== lastPending) setLastPending(pending);
	const shownAction = pending ?? lastPending;
	const isDirty = useHarStore((s) => s.isDirty);
	const bookmarkCount = useHarStore((s) => s.bookmarks.size);
	const hasUnsavedWork = isDirty || bookmarkCount > 0;

	const run = useCallback(
		(action: "open" | "close", files: File[] | null = null) => {
			if (action === "open" && files) void loader.loadFiles(files);
			else if (action === "open") loader.openFilePicker();
			else useHarStore.getState().clearHarData();
		},
		[loader]
	);

	const request = useCallback(
		(action: "open" | "close") => {
			if (hasUnsavedWork) setPending(action);
			else run(action);
		},
		[hasUnsavedWork, run]
	);

	const actions = useMemo<FileActions>(
		() => ({
			openFile: () => request("open"),
			closeFile: () => request("close"),
			downloadHar: downloadCurrentHar,
		}),
		[request]
	);

	const lost = [
		isDirty && "your edits and deletions",
		bookmarkCount > 0 && `${bookmarkCount} ${bookmarkCount === 1 ? "bookmark" : "bookmarks"}`,
	].filter(Boolean);

	return (
		<FileActionsContext.Provider value={actions}>
			<div className="contents" {...dropProps}>
				{children}
			</div>
			{loader.fileInput}
			<LoadingOverlay loading={loader.loading} />
			{isDragging && (
				<div className="pointer-events-none fixed inset-3 z-[60] flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/80 backdrop-blur-sm">
					<p className="text-lg font-medium">Drop to open this HAR file</p>
				</div>
			)}
			<ConfirmDialog
				open={pending !== null}
				onOpenChange={(open) => {
					if (open) return;
					setPending(null);
					setDroppedFiles(null);
				}}
				title={shownAction === "open" ? "Open another file?" : "Close this file?"}
				description={<p>This discards {lost.join(" and ")}. Nothing is saved outside this tab.</p>}
				confirmLabel={shownAction === "open" ? "Discard and open" : "Discard and close"}
				destructive
				secondaryAction={
					isDirty
						? {
								label: "Download first",
								onClick: () => {
									const action = pending;
									const files = droppedFiles;
									downloadCurrentHar();
									setPending(null);
									setDroppedFiles(null);
									if (action) run(action, files);
								},
							}
						: undefined
				}
				onConfirm={() => {
					const action = pending;
					const files = droppedFiles;
					setPending(null);
					setDroppedFiles(null);
					if (action) run(action, files);
				}}
			/>
		</FileActionsContext.Provider>
	);
}
