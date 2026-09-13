"use client";

import { useMemo } from "react";
import { Logo } from "@/components/common/logo";
import { Bookmark, ChevronsUpDown, Download, FolderOpen, Keyboard, X } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GithubIcon } from "@/components/ui/github-icon";
import { useHarStore } from "@/lib/stores/har-store";
import { getCachedPatterns, summarizePatterns } from "@/lib/patterns";
import { REPOSITORY_URL } from "@/lib/seo/constants";
import { VIEWS } from "./nav";
import { useFileActions } from "./file-actions";

function usePatternCount(): number {
	const entries = useHarStore((s) => s.entries);
	const pages = useHarStore((s) => s.harData?.log.pages);
	return useMemo(
		() => summarizePatterns(getCachedPatterns(entries, pages)).total,
		[entries, pages]
	);
}

export function AppSidebar() {
	const viewMode = useHarStore((s) => s.viewMode);
	const setViewMode = useHarStore((s) => s.setViewMode);
	const fileName = useHarStore((s) => s.fileName);
	const requestCount = useHarStore((s) => s.entries.length);
	const isDirty = useHarStore((s) => s.isDirty);
	const bookmarkCount = useHarStore((s) => s.bookmarks.size);
	const hasComparison = useHarStore((s) => s.secondaryHarData !== null);
	const setShowBookmarksSheet = useHarStore((s) => s.setShowBookmarksSheet);
	const setShowKeyboardShortcuts = useHarStore((s) => s.setShowKeyboardShortcuts);
	const patternCount = usePatternCount();
	const { openFile, downloadHar, closeFile } = useFileActions();
	const { isMobile, setOpenMobile } = useSidebar();

	const closeOnMobile = () => {
		if (isMobile) setOpenMobile(false);
	};

	const badgeFor = (id: string): string | null => {
		if (id === "requests") return requestCount.toLocaleString();
		if (id === "patterns" && patternCount > 0) return String(patternCount);
		if (id === "compare" && hasComparison) return "•";
		return null;
	};

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent"
									tooltip={fileName ?? "HAR Explorer"}
								>
									<div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
										<Logo className="size-5" />
									</div>
									<div className="grid min-w-0 flex-1 text-left leading-tight">
										<span className="truncate text-sm font-semibold">HAR Explorer</span>
										<span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
											<span className="truncate" title={fileName ?? undefined}>
												{fileName ?? "Untitled capture"}
											</span>
											{isDirty && (
												<span
													className="size-1.5 shrink-0 rounded-full bg-warning"
													aria-label="Edited"
												/>
											)}
										</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
								side={isMobile ? "bottom" : "right"}
								align="start"
							>
								<DropdownMenuLabel className="font-normal">
									<div className="truncate text-sm font-medium">
										{fileName ?? "Untitled capture"}
									</div>
									<div className="text-xs text-muted-foreground">
										{requestCount.toLocaleString()} requests{isDirty ? " · edited" : ""}
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={openFile}>
									<FolderOpen />
									Open another file…
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={downloadHar}>
									<Download />
									{isDirty ? "Download edited HAR" : "Download HAR"}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem variant="destructive" onSelect={closeFile}>
									<X />
									Close file
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Views</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{VIEWS.map((view) => {
								const badge = badgeFor(view.id);
								return (
									<SidebarMenuItem key={view.id}>
										<SidebarMenuButton
											isActive={viewMode === view.id}
											tooltip={`${view.label} (${view.shortcut})`}
											onClick={() => {
												setViewMode(view.id);
												closeOnMobile();
											}}
										>
											<view.icon />
											<span>{view.label}</span>
										</SidebarMenuButton>
										{badge && (
											<SidebarMenuBadge className="text-muted-foreground">{badge}</SidebarMenuBadge>
										)}
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Saved</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip="Bookmarks"
									onClick={() => {
										setShowBookmarksSheet(true);
										closeOnMobile();
									}}
								>
									<Bookmark />
									<span>Bookmarks</span>
								</SidebarMenuButton>
								{bookmarkCount > 0 && (
									<SidebarMenuBadge className="text-muted-foreground">
										{bookmarkCount}
									</SidebarMenuBadge>
								)}
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip="Keyboard shortcuts (?)"
							onClick={() => {
								setShowKeyboardShortcuts(true);
								closeOnMobile();
							}}
						>
							<Keyboard />
							<span>Keyboard shortcuts</span>
						</SidebarMenuButton>
						<DropdownMenuShortcutBadge>?</DropdownMenuShortcutBadge>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton asChild tooltip="Source code on GitHub">
							<a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
								<GithubIcon />
								<span>GitHub</span>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

function DropdownMenuShortcutBadge({ children }: { children: React.ReactNode }) {
	return (
		<SidebarMenuBadge>
			<DropdownMenuShortcut className="ml-0 text-[11px]">{children}</DropdownMenuShortcut>
		</SidebarMenuBadge>
	);
}
