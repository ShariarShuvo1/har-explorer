"use client";

import { useEffect } from "react";
import { X, Keyboard } from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";

const SHORTCUTS = [
	{
		category: "Navigation",
		items: [
			{ keys: ["1"], description: "Switch to List View" },
			{ keys: ["2"], description: "Switch to Analytics View" },
			{ keys: ["3"], description: "Switch to Pattern Analysis" },
			{ keys: ["4"], description: "Switch to Statistics View" },
			{ keys: ["5"], description: "Switch to Compare View" },
		],
	},
	{
		category: "Actions",
		items: [
			{ keys: ["Ctrl", "A"], description: "Select All Entries" },
			{
				keys: ["Alt"],
				description:
					"Hold Alt + Click Select Button to Invert Selection",
			},
			{ keys: ["Escape"], description: "Close Modals/Deselect" },
			{ keys: ["T"], description: "Toggle Timeline" },
		],
	},
	{
		category: "Filters",
		items: [
			{ keys: ["Shift", "F"], description: "Toggle Advanced Filters" },
			{ keys: ["Shift", "B"], description: "Toggle Bookmarks Only" },
			{ keys: ["R"], description: "Reset Filters" },
		],
	},
	{
		category: "Help",
		items: [{ keys: ["?"], description: "Show Keyboard Shortcuts" }],
	},
];

export function KeyboardShortcutsModal() {
	const { showKeyboardShortcuts, toggleKeyboardShortcuts } = useHarStore();

	useEffect(() => {
		if (!showKeyboardShortcuts) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				toggleKeyboardShortcuts();
			}
		};

		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [showKeyboardShortcuts, toggleKeyboardShortcuts]);

	if (!showKeyboardShortcuts) return null;

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			toggleKeyboardShortcuts();
		}
	};

	return (
		<div
			className="fixed inset-0 z-100 flex items-center justify-center bg-background/80 backdrop-blur-sm"
			onClick={handleBackdropClick}
		>
			<div className="bg-linear-to-br from-card/80 via-card/60 to-card/40 border border-border/50 backdrop-blur-sm shadow-xl rounded max-w-2xl w-full max-h-[90vh] overflow-auto m-4">
				<div className="sticky top-0 bg-primary/5 border-b border-border/50 px-4 py-2 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Keyboard className="w-4 h-4 text-primary" />
						<h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
							Keyboard Shortcuts
						</h2>
					</div>
					<button
						aria-label="Close Keyboard Shortcuts"
						onClick={toggleKeyboardShortcuts}
						className="p-1.5 hover:bg-destructive/20 rounded transition-colors group"
					>
						<X className="w-3.5 h-3.5 text-muted group-hover:text-destructive transition-colors" />
					</button>
				</div>

				<div className="p-4 space-y-4">
					{SHORTCUTS.map((section) => (
						<div key={section.category}>
							<h3 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
								{section.category}
							</h3>
							<div className="space-y-1.5">
								{section.items.map((item, index) => (
									<div
										key={index}
										className="flex items-center justify-between py-1.5 px-2 bg-background/40 rounded border border-border/30 hover:bg-background/60 transition-colors"
									>
										<span className="text-xs text-foreground">
											{item.description}
										</span>
										<div className="flex items-center gap-1">
											{item.keys.map((key, keyIndex) => (
												<span
													key={keyIndex}
													className="flex items-center gap-0.5"
												>
													<kbd className="px-2 py-0.5 bg-primary/10 border border-primary/30 rounded text-[10px] font-mono font-bold text-primary shadow-sm min-w-6 text-center">
														{key}
													</kbd>
													{keyIndex <
														item.keys.length -
															1 && (
														<span className="text-muted text-[10px]">
															+
														</span>
													)}
												</span>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>

				<div className="sticky bottom-0 bg-primary/5 border-t border-border/50 px-4 py-2 text-center">
					<p className="text-[10px] text-muted">
						Press{" "}
						<kbd className="px-1.5 py-0.5 bg-primary/10 border border-primary/30 rounded text-[10px] font-mono text-primary">
							Escape
						</kbd>{" "}
						to close
					</p>
				</div>
			</div>
		</div>
	);
}

export function KeyboardShortcutsHandler() {
	const {
		setViewMode,
		toggleKeyboardShortcuts,
		toggleTimeline,
		toggleAdvancedFilters,
		toggleBookmarksOnly,
		resetAdvancedFilters,
		selectAll,
		deselectAll,
		expandedEntry,
		setExpandedEntry,
	} = useHarStore();

	useEffect(() => {
		const handleKeyPress = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			if (e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault();
				toggleKeyboardShortcuts();
				return;
			}

			if (e.key === "Escape") {
				if (expandedEntry !== null) {
					setExpandedEntry(null);
				} else {
					deselectAll();
				}
				return;
			}

			if (e.key === "1" && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault();
				setViewMode("list");
				return;
			}

			if (e.key === "2" && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault();
				setViewMode("analytics");
				return;
			}

			if (e.key === "3" && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault();
				setViewMode("patterns");
				return;
			}

			if (e.key === "4" && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault();
				setViewMode("statistics");
				return;
			}

			if (e.key === "t" && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault();
				toggleTimeline();
				return;
			}

			if (
				e.key === "F" &&
				e.shiftKey &&
				!e.ctrlKey &&
				!e.altKey &&
				!e.metaKey
			) {
				e.preventDefault();
				toggleAdvancedFilters();
				return;
			}

			if (
				e.key === "B" &&
				e.shiftKey &&
				!e.ctrlKey &&
				!e.altKey &&
				!e.metaKey
			) {
				e.preventDefault();
				toggleBookmarksOnly();
				return;
			}

			if (
				e.key === "r" &&
				!e.ctrlKey &&
				!e.altKey &&
				!e.metaKey &&
				!e.shiftKey
			) {
				e.preventDefault();
				resetAdvancedFilters();
				return;
			}

			if (e.key === "a" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
				e.preventDefault();
				selectAll();
				return;
			}
		};

		window.addEventListener("keydown", handleKeyPress);
		return () => window.removeEventListener("keydown", handleKeyPress);
	}, [
		setViewMode,
		toggleKeyboardShortcuts,
		toggleTimeline,
		toggleAdvancedFilters,
		toggleBookmarksOnly,
		resetAdvancedFilters,
		selectAll,
		deselectAll,
		expandedEntry,
		setExpandedEntry,
	]);

	return null;
}
