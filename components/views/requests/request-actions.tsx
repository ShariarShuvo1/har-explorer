"use client";

import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import {
	Bookmark,
	BookmarkMinus,
	BookmarkPlus,
	Braces,
	CheckSquare,
	Copy,
	FileDown,
	Filter,
	GitCompareArrows,
	Link2,
	PanelRight,
	Pencil,
	Square,
	Terminal,
	Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { copyText } from "@/components/common/copy-button";
import { useHarStore } from "@/lib/stores/har-store";
import { safeParseUrl } from "@/lib/har-parser";
import {
	generateApiDocumentation,
	generateCurl,
	generateFetch,
	generatePowershell,
} from "@/lib/codegen";
import { downloadTextFile, getEntryFileStem } from "@/lib/api-docs/download";
import { DEFAULT_BOOKMARK_COLOR, getDefaultBookmarkLabel } from "./bookmarks/bookmark-utils";

/** Lets menus anywhere in the Requests view open the bookmark editor. */
export const RequestsUiContext = createContext<{
	editBookmark: (index: number) => void;
}>({ editBookmark: () => {} });

export const useRequestsUi = () => useContext(RequestsUiContext);

function entryAt(index: number) {
	return useHarStore.getState().entries[index];
}

export const requestActions = {
	copyUrl: (index: number) => copyText(entryAt(index).request.url, "URL copied"),
	copyCurl: (index: number) => copyText(generateCurl(entryAt(index)), "cURL command copied"),
	copyFetch: (index: number) => copyText(generateFetch(entryAt(index)), "fetch call copied"),
	copyPowershell: (index: number) =>
		copyText(generatePowershell(entryAt(index)), "PowerShell command copied"),
	copyResponse: (index: number) => {
		const text = entryAt(index).response.content.text;
		if (!text) {
			toast("This response has no captured body");
			return;
		}
		void copyText(text, "Response body copied");
	},
	downloadDocs: (index: number) => {
		const entry = entryAt(index);
		try {
			downloadTextFile(
				generateApiDocumentation(entry),
				`${getEntryFileStem(entry)}-docs.md`,
				"text/markdown"
			);
			toast.success("API documentation downloaded");
		} catch {
			toast.error("Couldn't generate documentation for this request");
		}
	},
	filterByDomain: (index: number) => {
		const host = safeParseUrl(entryAt(index).request.url)?.hostname;
		if (!host) return;
		useHarStore.getState().setAdvancedFilters({ domainPattern: host });
		toast(`Showing requests to ${host}`, {
			action: {
				label: "Undo",
				onClick: () => useHarStore.getState().setAdvancedFilters({ domainPattern: "" }),
			},
		});
	},
	toggleBookmark: (index: number) => {
		const state = useHarStore.getState();
		const existing = state.bookmarks.get(index);
		if (existing) {
			state.removeBookmark(index);
			toast("Bookmark removed", {
				action: {
					label: "Undo",
					onClick: () =>
						useHarStore
							.getState()
							.addBookmark(index, existing.label, existing.color, existing.note),
				},
			});
		} else {
			state.addBookmark(
				index,
				getDefaultBookmarkLabel(state.entries[index]),
				DEFAULT_BOOKMARK_COLOR
			);
			toast.success("Bookmarked");
		}
	},
	compareWith: (a: number, b: number) => useHarStore.getState().setTimingComparison([a, b]),
	remove: (indices: number[]) => useHarStore.getState().requestDelete(indices),
};

type MenuKind = "context" | "dropdown";

const PRIMITIVES = {
	context: {
		Item: ContextMenuItem,
		Separator: ContextMenuSeparator,
		Shortcut: ContextMenuShortcut,
		Sub: ContextMenuSub,
		SubTrigger: ContextMenuSubTrigger,
		SubContent: ContextMenuSubContent,
	},
	dropdown: {
		Item: DropdownMenuItem,
		Separator: DropdownMenuSeparator,
		Shortcut: DropdownMenuShortcut,
		Sub: DropdownMenuSub,
		SubTrigger: DropdownMenuSubTrigger,
		SubContent: DropdownMenuSubContent,
	},
} as const;

/**
 * Menu items shared by the row context menu and the details pane "More" menu,
 * so both offer exactly the same actions.
 */
export function RequestMenuItems({
	index,
	kind,
	showOpen = false,
}: {
	index: number;
	kind: MenuKind;
	showOpen?: boolean;
}) {
	const P = PRIMITIVES[kind] as unknown as {
		Item: ComponentType<{
			onSelect?: () => void;
			variant?: "default" | "destructive";
			disabled?: boolean;
			children: ReactNode;
		}>;
		Separator: ComponentType;
		Shortcut: ComponentType<{ children: ReactNode }>;
		Sub: ComponentType<{ children: ReactNode }>;
		SubTrigger: ComponentType<{ children: ReactNode }>;
		SubContent: ComponentType<{ children: ReactNode; className?: string }>;
	};
	const isBookmarked = useHarStore((s) => s.bookmarks.has(index));
	const isSelected = useHarStore((s) => s.selectedEntries.has(index));
	const selected = useHarStore((s) => s.selectedEntries);
	const hasBody = useHarStore((s) => Boolean(s.entries[index]?.response.content.text));
	const { editBookmark } = useRequestsUi();
	const otherSelected = [...selected].filter((i) => i !== index);
	const store = useHarStore.getState;
	const deleteTargets = isSelected && selected.size > 1 ? [...selected] : [index];

	return (
		<>
			{showOpen && (
				<>
					<P.Item onSelect={() => store().openEntry(index)}>
						<PanelRight />
						Open details
					</P.Item>
					<P.Separator />
				</>
			)}
			<P.Sub>
				<P.SubTrigger>
					<Copy />
					Copy
				</P.SubTrigger>
				<P.SubContent className="w-52">
					<P.Item onSelect={() => requestActions.copyUrl(index)}>
						<Link2 />
						URL
					</P.Item>
					<P.Item onSelect={() => requestActions.copyCurl(index)}>
						<Terminal />
						As cURL
					</P.Item>
					<P.Item onSelect={() => requestActions.copyFetch(index)}>
						<Braces />
						As fetch
					</P.Item>
					<P.Item onSelect={() => requestActions.copyPowershell(index)}>
						<Terminal />
						As PowerShell
					</P.Item>
					<P.Separator />
					<P.Item disabled={!hasBody} onSelect={() => requestActions.copyResponse(index)}>
						<Copy />
						Response body
					</P.Item>
				</P.SubContent>
			</P.Sub>
			<P.Item onSelect={() => requestActions.downloadDocs(index)}>
				<FileDown />
				Download API docs
			</P.Item>
			<P.Separator />
			<P.Item onSelect={() => requestActions.toggleBookmark(index)}>
				{isBookmarked ? <BookmarkMinus /> : <BookmarkPlus />}
				{isBookmarked ? "Remove bookmark" : "Bookmark"}
				<P.Shortcut>B</P.Shortcut>
			</P.Item>
			{isBookmarked && (
				<P.Item onSelect={() => editBookmark(index)}>
					<Pencil />
					Edit bookmark…
				</P.Item>
			)}
			{!isBookmarked && (
				<P.Item onSelect={() => editBookmark(index)}>
					<Bookmark />
					Bookmark with label…
				</P.Item>
			)}
			<P.Separator />
			<P.Item onSelect={() => store().toggleSelection(index)}>
				{isSelected ? <Square /> : <CheckSquare />}
				{isSelected ? "Deselect" : "Select"}
			</P.Item>
			{otherSelected.length === 1 && (
				<P.Item onSelect={() => requestActions.compareWith(otherSelected[0], index)}>
					<GitCompareArrows />
					Compare timing with selected
				</P.Item>
			)}
			<P.Item onSelect={() => requestActions.filterByDomain(index)}>
				<Filter />
				Only show this domain
			</P.Item>
			<P.Separator />
			<P.Item variant="destructive" onSelect={() => requestActions.remove(deleteTargets)}>
				<Trash2 />
				{deleteTargets.length > 1 ? `Delete ${deleteTargets.length} selected` : "Delete request"}
				<P.Shortcut>Del</P.Shortcut>
			</P.Item>
		</>
	);
}
