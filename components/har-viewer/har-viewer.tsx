"use client";

import { useHarStore } from "@/lib/stores/har-store";
import { HarHeader } from "@/components/har-viewer/header";
import { HarControls } from "@/components/har-viewer/controls";
import { HarList } from "@/components/har-viewer/list";
import { NetworkTimeline } from "@/components/har-viewer/timeline";
import { AdvancedFilters } from "@/components/har-viewer/advanced-filters";
import { AnalyticsDashboard } from "@/components/har-viewer/analytics";
import { StatisticsView } from "@/components/har-viewer/statistics";
import { PatternAnalyzer } from "@/components/har-viewer/patterns";
import { BookmarksPanel } from "@/components/har-viewer/bookmarks";
import { FocusedEntryOverlay } from "@/components/har-viewer/focus";
import { ExportView } from "@/components/har-viewer/export";
import {
	KeyboardShortcutsModal,
	KeyboardShortcutsHandler,
} from "@/components/har-viewer/keyboard";

export function HarViewer() {
	const {
		harData,
		selectedEntries,
		deleteEntries,
		showDeleteConfirm,
		setShowDeleteConfirm,
		viewMode,
		showBookmarksPanel,
	} = useHarStore();

	if (!harData) return null;

	const handleConfirmDelete = () => {
		deleteEntries(Array.from(selectedEntries));
		setShowDeleteConfirm(false);
	};

	const renderContent = () => {
		switch (viewMode) {
			case "analytics":
				return <AnalyticsDashboard />;
			case "patterns":
				return <PatternAnalyzer />;
			case "statistics":
				return <StatisticsView />;
			case "export":
				return <ExportView />;

			case "list":
			default:
				return (
					<>
						<NetworkTimeline />
						<AdvancedFilters />
						<HarList />
					</>
				);
		}
	};

	return (
		<div className="fixed inset-0 flex flex-col bg-background overflow-visible">
			<KeyboardShortcutsHandler />
			<HarHeader />
			{viewMode === "list" && <HarControls />}

			<div className="flex-1 flex overflow-hidden relative">
				<div className="flex-1 flex flex-col overflow-hidden">
					{renderContent()}
				</div>
				{viewMode === "list" && showBookmarksPanel && (
					<div className="w-80 border-l border-border overflow-auto bg-card/20">
						<BookmarksPanel />
					</div>
				)}
			</div>

			<KeyboardShortcutsModal />
			<FocusedEntryOverlay />

			{showDeleteConfirm && (
				<>
					<div
						className="fixed inset-0 bg-black/50 z-90 backdrop-blur-sm"
						onClick={() => setShowDeleteConfirm(false)}
					/>
					<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-95 w-full flex items-center justify-center pointer-events-none">
						<div
							className="bg-card rounded-lg border-2 border-destructive/30 p-8 max-w-md w-full mx-4 shadow-2xl pointer-events-auto bg-linear-to-b from-card to-card/80"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center gap-3 mb-4">
								<h3 className="text-lg font-bold text-foreground">
									Delete Selected Entries?
								</h3>
							</div>
							<p className="text-sm text-muted mb-8 leading-relaxed">
								Are you sure you want to delete{" "}
								<span className="font-semibold text-foreground">
									{selectedEntries.size} selected{" "}
									{selectedEntries.size === 1
										? "entry"
										: "entries"}
								</span>
								? This action cannot be undone.
							</p>
							<div className="flex items-center gap-3 justify-end">
								<button
									onClick={() => setShowDeleteConfirm(false)}
									className="px-5 py-2.5 rounded-lg border-2 border-border bg-transparent text-foreground hover:bg-card/50 transition-all font-medium text-sm"
								>
									Cancel
								</button>
								<button
									onClick={handleConfirmDelete}
									className="px-5 py-2.5 rounded-lg border-2 border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/85 active:scale-95 transition-all font-bold text-sm shadow-lg hover:shadow-destructive/30"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
