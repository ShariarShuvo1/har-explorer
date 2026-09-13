"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
	Bookmark,
	BookmarkCheck,
	Download,
	Eraser,
	FileOutput,
	FolderOpen,
	Keyboard,
	Maximize,
	Monitor,
	Moon,
	PanelLeft,
	Sun,
	Undo2,
	Waves,
	X,
} from "lucide-react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import { useHarStore } from "@/lib/stores/har-store";
import { DETAIL_TABS } from "@/components/views/requests/details";
import { VIEWS } from "./nav";
import { useFileActions } from "./file-actions";
import { undoWithToast, useFullscreen } from "./app-topbar";

const MAX_REQUEST_RESULTS = 50;

export function CommandPalette() {
	const open = useHarStore((s) => s.showCommandPalette);
	const setOpen = useHarStore((s) => s.setShowCommandPalette);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				showCloseButton={false}
				className="top-[12%] translate-y-0 overflow-hidden p-0 data-[state=open]:slide-in-from-top-2 sm:max-w-xl"
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Command palette</DialogTitle>
					<DialogDescription>Search requests, switch views or run an action.</DialogDescription>
				</DialogHeader>
				{open && <PaletteBody />}
			</DialogContent>
		</Dialog>
	);
}

function PaletteBody() {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState("");
	const deferredQuery = useDeferredValue(query);
	const entries = useHarStore((s) => s.entries);
	const activeEntry = useHarStore((s) => s.activeEntry);
	const bookmarkCount = useHarStore((s) => s.bookmarks.size);
	const canUndo = useHarStore((s) => s.history.length > 0);
	const isDirty = useHarStore((s) => s.isDirty);
	const store = useHarStore.getState;
	const { setTheme } = useTheme();
	const { toggleSidebar } = useSidebar();
	const { openFile, downloadHar, closeFile } = useFileActions();
	const fullscreen = useFullscreen();

	const close = () => store().setShowCommandPalette(false);
	const run = (action: () => void) => () => {
		close();
		action();
	};

	const requestMatches = useMemo(() => {
		const q = deferredQuery.trim().toLowerCase();
		if (!q) return [];
		const results: number[] = [];
		for (let i = 0; i < entries.length && results.length < MAX_REQUEST_RESULTS; i++) {
			const { url, method } = entries[i].request;
			if (url.toLowerCase().includes(q) || `${method} ${url}`.toLowerCase().includes(q)) {
				results.push(i);
			}
		}
		return results;
	}, [deferredQuery, entries]);

	const matches = (text: string) =>
		!deferredQuery.trim() || text.toLowerCase().includes(deferredQuery.trim().toLowerCase());

	const views = VIEWS.filter((v) => matches(`${v.label} ${v.description} view go to`));
	const actions = [
		{ id: "open", label: "Open another HAR file…", icon: FolderOpen, run: openFile },
		{
			id: "download",
			label: isDirty ? "Download edited HAR" : "Download HAR",
			icon: Download,
			run: downloadHar,
		},
		...(canUndo
			? [
					{
						id: "undo",
						label: "Undo last change",
						icon: Undo2,
						run: undoWithToast,
						shortcut: "Ctrl+Z",
					},
				]
			: []),
		{
			id: "clear",
			label: "Clear all filters",
			icon: Eraser,
			run: () => store().resetAllFilters(),
			shortcut: "R",
		},
		{
			id: "overview",
			label: "Toggle waterfall overview",
			icon: Waves,
			run: () => {
				store().setViewMode("requests");
				store().setShowOverview(!store().showOverview);
			},
			shortcut: "T",
		},
		{
			id: "bookmarks",
			label: "Open bookmarks",
			icon: Bookmark,
			run: () => store().setShowBookmarksSheet(true),
		},
		...(bookmarkCount > 0
			? [
					{
						id: "bookmarked-only",
						label: "Show only bookmarked requests",
						icon: BookmarkCheck,
						run: () => {
							store().setViewMode("requests");
							store().setShowBookmarksOnly(true);
						},
					},
				]
			: []),
		{
			id: "export",
			label: "Export requests…",
			icon: FileOutput,
			run: () => store().openExportView(),
		},
		{
			id: "sidebar",
			label: "Toggle sidebar",
			icon: PanelLeft,
			run: toggleSidebar,
			shortcut: "Ctrl+B",
		},
		...(fullscreen.supported
			? [{ id: "fullscreen", label: "Toggle full screen", icon: Maximize, run: fullscreen.toggle }]
			: []),
		{
			id: "shortcuts",
			label: "Keyboard shortcuts",
			icon: Keyboard,
			run: () => store().setShowKeyboardShortcuts(true),
			shortcut: "?",
		},
		{ id: "close", label: "Close file", icon: X, run: closeFile },
	].filter((a) => matches(a.label));

	const themes = [
		{ id: "light", label: "Light theme", icon: Sun },
		{ id: "dark", label: "Dark theme", icon: Moon },
		{ id: "system", label: "System theme", icon: Monitor },
	].filter((t) => matches(`${t.label} appearance`));

	const tabs =
		activeEntry !== null ? DETAIL_TABS.filter((t) => matches(`${t.label} tab details`)) : [];

	const nothing =
		views.length + actions.length + themes.length + tabs.length + requestMatches.length === 0;

	// Without cmdk filtering the highlighted item can disappear from the list;
	// fall back to the first visible item so Enter always does something.
	const values = [
		...requestMatches.map((i) => `request-${i}`),
		...views.map((v) => `view-${v.id}`),
		...tabs.map((t) => `tab-${t.id}`),
		...actions.map((a) => `action-${a.id}`),
		...themes.map((t) => `theme-${t.id}`),
	];
	const current = values.includes(selected) ? selected : (values[0] ?? "");

	return (
		<Command
			shouldFilter={false}
			loop
			value={current}
			onValueChange={setSelected}
			className="[&_[cmdk-group-heading]]:text-xs"
		>
			<CommandInput
				value={query}
				onValueChange={setQuery}
				placeholder="Search requests by URL, or type a command…"
				className="h-12"
			/>
			<CommandList className="max-h-[min(60vh,28rem)]">
				{nothing && <CommandEmpty>No results.</CommandEmpty>}

				{requestMatches.length > 0 && (
					<CommandGroup
						heading={`Requests${requestMatches.length === MAX_REQUEST_RESULTS ? ` (first ${MAX_REQUEST_RESULTS})` : ""}`}
					>
						{requestMatches.map((index) => {
							const entry = entries[index];
							return (
								<CommandItem
									key={index}
									value={`request-${index}`}
									onSelect={run(() => store().openEntry(index))}
									className="gap-2"
								>
									<MethodBadge method={entry.request.method} className="w-14" />
									<span className="min-w-0 flex-1 truncate font-mono text-xs">
										{entry.request.url}
									</span>
									<StatusBadge status={entry.response.status} />
								</CommandItem>
							);
						})}
					</CommandGroup>
				)}

				{views.length > 0 && (
					<CommandGroup heading="Go to">
						{views.map((view) => (
							<CommandItem
								key={view.id}
								value={`view-${view.id}`}
								onSelect={run(() => store().setViewMode(view.id))}
							>
								<view.icon />
								{view.label}
								<CommandShortcut>{view.shortcut}</CommandShortcut>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{tabs.length > 0 && (
					<CommandGroup heading="Request details">
						{tabs.map((tab) => (
							<CommandItem
								key={tab.id}
								value={`tab-${tab.id}`}
								onSelect={run(() => {
									if (activeEntry !== null) store().openEntry(activeEntry, tab.id);
								})}
							>
								<tab.icon />
								Show {tab.label}
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{actions.length > 0 && (
					<>
						<CommandSeparator />
						<CommandGroup heading="Actions">
							{actions.map((action) => (
								<CommandItem
									key={action.id}
									value={`action-${action.id}`}
									onSelect={run(action.run)}
								>
									<action.icon />
									{action.label}
									{"shortcut" in action && action.shortcut && (
										<CommandShortcut>{action.shortcut}</CommandShortcut>
									)}
								</CommandItem>
							))}
						</CommandGroup>
					</>
				)}

				{themes.length > 0 && (
					<CommandGroup heading="Appearance">
						{themes.map((theme) => (
							<CommandItem
								key={theme.id}
								value={`theme-${theme.id}`}
								onSelect={run(() => setTheme(theme.id))}
							>
								<theme.icon />
								{theme.label}
							</CommandItem>
						))}
					</CommandGroup>
				)}
			</CommandList>
			<div className="hidden items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground sm:flex">
				<span>↑↓ to navigate</span>
				<span>↵ to select</span>
				<span>Esc to close</span>
			</div>
		</Command>
	);
}
