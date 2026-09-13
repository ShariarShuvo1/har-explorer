"use client";

import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogHeader,
	ResponsiveDialogTitle,
} from "@/components/common/responsive-dialog";
import {
	getDefaultBookmarkLabel,
	DEFAULT_BOOKMARK_COLOR,
} from "@/components/views/requests/bookmarks/bookmark-utils";
import { useHarStore } from "@/lib/stores/har-store";
import { VIEWS } from "./nav";
import { isMac, undoWithToast } from "./app-topbar";

export const REQUEST_SEARCH_INPUT_ID = "request-search";

const MOD = "Mod";

const SECTIONS: { title: string; items: { keys: string[]; label: string }[] }[] = [
	{
		title: "General",
		items: [
			{ keys: [MOD, "K"], label: "Search requests or run a command" },
			{ keys: ["?"], label: "Show keyboard shortcuts" },
			{ keys: [MOD, "B"], label: "Toggle sidebar" },
			{ keys: [MOD, "Z"], label: "Undo last change" },
			...VIEWS.map((view) => ({ keys: [view.shortcut], label: `Go to ${view.label}` })),
		],
	},
	{
		title: "Requests",
		items: [
			{ keys: ["/"], label: "Focus search" },
			{ keys: ["F"], label: "Open filters" },
			{ keys: ["R"], label: "Clear all filters" },
			{ keys: ["T"], label: "Toggle waterfall overview" },
			{ keys: ["J"], label: "Next request" },
			{ keys: ["K"], label: "Previous request" },
			{ keys: ["Esc"], label: "Close details, then clear selection" },
			{ keys: [MOD, "A"], label: "Select all visible requests" },
			{ keys: ["Delete"], label: "Delete selected requests" },
			{ keys: ["B"], label: "Bookmark the open request" },
			{ keys: ["Shift", "B"], label: "Show only bookmarked requests" },
		],
	},
	{
		title: "Mouse",
		items: [
			{ keys: ["Click"], label: "Open request details" },
			{ keys: [MOD, "Click"], label: "Add or remove from selection" },
			{ keys: ["Shift", "Click"], label: "Select a range" },
			{ keys: ["Right-click"], label: "Request actions (copy as cURL, bookmark…)" },
		],
	},
];

function useModLabel() {
	return useSyncExternalStore(
		() => () => {},
		() => (isMac() ? "⌘" : "Ctrl"),
		() => "Ctrl"
	);
}

export function KeyboardShortcutsDialog() {
	const open = useHarStore((s) => s.showKeyboardShortcuts);
	const setOpen = useHarStore((s) => s.setShowKeyboardShortcuts);
	const mod = useModLabel();

	return (
		<ResponsiveDialog open={open} onOpenChange={setOpen}>
			<ResponsiveDialogContent size="lg">
				<ResponsiveDialogHeader>
					<ResponsiveDialogTitle>Keyboard shortcuts</ResponsiveDialogTitle>
					<ResponsiveDialogDescription>
						Shortcuts are ignored while you are typing in a field.
					</ResponsiveDialogDescription>
				</ResponsiveDialogHeader>
				<ResponsiveDialogBody className="grid gap-6 sm:grid-cols-2">
					{SECTIONS.map((section) => (
						<section
							key={section.title}
							className={section.title === "Mouse" ? "sm:col-span-2" : undefined}
						>
							<h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
								{section.title}
							</h3>
							<ul className="divide-y rounded-lg border">
								{section.items.map((item) => (
									<li
										key={item.label}
										className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
									>
										<span className="min-w-0">{item.label}</span>
										<KbdGroup className="shrink-0">
											{item.keys.map((key) => (
												<Kbd key={key}>{key === MOD ? mod : key}</Kbd>
											))}
										</KbdGroup>
									</li>
								))}
							</ul>
						</section>
					))}
				</ResponsiveDialogBody>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

const NON_TEXT_INPUT_TYPES = new Set([
	"checkbox",
	"radio",
	"button",
	"submit",
	"reset",
	"range",
	"color",
	"file",
]);

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
	return (
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement ||
		target.isContentEditable ||
		target.closest(".cm-editor") !== null
	);
}

/**
 * Overlays that own the keyboard while open (dialogs, menus, drawers). The
 * request details sheet on small screens is excluded so J/K/B keep working.
 */
function overlayOpen(): boolean {
	return (
		document.querySelector(
			'[role="dialog"][data-state="open"]:not([data-details-sheet]), [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [data-vaul-drawer][data-state="open"]'
		) !== null
	);
}

/** An inline editor has unsaved input; shortcuts must not navigate away from it. */
function editorOpen(): boolean {
	return document.querySelector('[data-editing="true"]') !== null;
}

export function focusRequestSearch() {
	const state = useHarStore.getState();
	const focus = () => {
		const input = document.getElementById(REQUEST_SEARCH_INPUT_ID);
		if (input instanceof HTMLInputElement) {
			input.focus();
			input.select();
		}
	};
	if (state.viewMode !== "requests") {
		state.setViewMode("requests");
		requestAnimationFrame(() => requestAnimationFrame(focus));
	} else {
		focus();
	}
}

export function GlobalKeyboardShortcuts() {
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.isComposing) return;
			const state = useHarStore.getState();
			const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
			const mod = e.metaKey || e.ctrlKey;

			if (mod && !e.altKey && !e.shiftKey && key === "k") {
				e.preventDefault();
				state.setShowCommandPalette(!state.showCommandPalette);
				return;
			}

			// While an inline editor has unsaved input, nothing may navigate away or undo under it.
			if (isTypingTarget(e.target) || overlayOpen() || editorOpen()) return;
			const inRequests = state.viewMode === "requests";

			if (mod && !e.altKey) {
				if (key === "z" && !e.shiftKey) {
					e.preventDefault();
					undoWithToast();
				} else if (key === "a" && inRequests && !e.shiftKey) {
					e.preventDefault();
					const visible = state.visibleEntryIndices;
					const all = visible.length > 0 && visible.every((i) => state.selectedEntries.has(i));
					if (all) state.deselectAll();
					else state.selectAll();
				} else if (key === "f" && inRequests && !e.shiftKey) {
					e.preventDefault();
					focusRequestSearch();
				}
				return;
			}
			if (e.altKey || e.repeat) return;

			if (e.key === "?") {
				e.preventDefault();
				state.setShowKeyboardShortcuts(true);
				return;
			}

			if (!e.shiftKey && /^[1-6]$/.test(key)) {
				e.preventDefault();
				state.setViewMode(VIEWS[Number(key) - 1].id);
				return;
			}

			if (key === "/") {
				e.preventDefault();
				focusRequestSearch();
				return;
			}

			if (e.key === "Escape") {
				if (state.activeEntry !== null) {
					e.preventDefault();
					state.setActiveEntry(null);
				} else if (state.selectedEntries.size > 0) {
					e.preventDefault();
					state.deselectAll();
				}
				return;
			}

			if (!inRequests) return;

			if (e.shiftKey) {
				if (key === "b" && (state.bookmarks.size > 0 || state.showBookmarksOnly)) {
					e.preventDefault();
					state.toggleBookmarksOnly();
				}
				return;
			}

			switch (key) {
				case "j":
				case "ArrowDown":
					if (key === "ArrowDown" && state.activeEntry === null) return;
					e.preventDefault();
					state.stepActiveEntry(1);
					return;
				case "k":
				case "ArrowUp":
					if (key === "ArrowUp" && state.activeEntry === null) return;
					e.preventDefault();
					state.stepActiveEntry(-1);
					return;
				case "f":
					e.preventDefault();
					state.setShowFiltersPanel(true);
					return;
				case "r":
					e.preventDefault();
					state.resetAllFilters();
					toast("Filters cleared");
					return;
				case "t":
					e.preventDefault();
					state.setShowOverview(!state.showOverview);
					return;
				case "Delete":
				case "Backspace":
					if (state.selectedEntries.size > 0) {
						e.preventDefault();
						state.requestDelete([...state.selectedEntries]);
					} else if (state.activeEntry !== null) {
						e.preventDefault();
						state.requestDelete([state.activeEntry]);
					}
					return;
				case "b": {
					const index = state.activeEntry;
					if (index === null) return;
					e.preventDefault();
					if (state.bookmarks.has(index)) {
						state.removeBookmark(index);
						toast("Bookmark removed");
					} else {
						state.addBookmark(
							index,
							getDefaultBookmarkLabel(state.entries[index]),
							DEFAULT_BOOKMARK_COLOR
						);
						toast.success("Bookmarked");
					}
					return;
				}
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return null;
}
