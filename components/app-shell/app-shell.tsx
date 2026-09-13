"use client";

import { useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useHarStore } from "@/lib/stores/har-store";
import { RequestsView } from "@/components/views/requests";
import { AnalyticsView } from "@/components/views/analytics";
import { PatternsView } from "@/components/views/patterns";
import { StatisticsView } from "@/components/views/statistics";
import { CompareView } from "@/components/views/compare";
import { ExportView } from "@/components/views/export";
import { BookmarksSheet } from "@/components/views/requests/bookmarks/bookmarks-sheet";
import { TimingComparisonDialog } from "@/components/views/requests/timing-comparison/timing-comparison-dialog";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { CommandPalette } from "./command-palette";
import { GlobalKeyboardShortcuts, KeyboardShortcutsDialog } from "./keyboard-shortcuts";
import { DeleteRequestsDialog } from "./delete-dialog";
import { FileActionsProvider } from "./file-actions";

function ActiveView() {
	const viewMode = useHarStore((s) => s.viewMode);
	switch (viewMode) {
		case "analytics":
			return <AnalyticsView />;
		case "patterns":
			return <PatternsView />;
		case "statistics":
			return <StatisticsView />;
		case "compare":
			return <CompareView />;
		case "export":
			return <ExportView />;
		default:
			return <RequestsView />;
	}
}

export function AppShell() {
	// The shell only renders after a file is loaded in the browser, so the
	// window size is known: start collapsed where screen space is tight.
	const [sidebarOpen, setSidebarOpen] = useState(
		() => typeof window === "undefined" || window.innerWidth >= 1280
	);

	return (
		<FileActionsProvider>
			<SidebarProvider
				open={sidebarOpen}
				onOpenChange={setSidebarOpen}
				className="h-dvh min-h-0 overflow-hidden"
			>
				<AppSidebar />
				<SidebarInset className="min-h-0 min-w-0 overflow-hidden">
					<AppTopbar />
					<div className="flex min-h-0 flex-1 flex-col">
						<ActiveView />
					</div>
				</SidebarInset>
				<CommandPalette />
				<KeyboardShortcutsDialog />
				<GlobalKeyboardShortcuts />
				<DeleteRequestsDialog />
				<BookmarksSheet />
				<TimingComparisonDialog />
			</SidebarProvider>
		</FileActionsProvider>
	);
}
