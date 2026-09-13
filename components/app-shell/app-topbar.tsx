"use client";

import { useSyncExternalStore } from "react";
import { Maximize, Minimize, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHarStore } from "@/lib/stores/har-store";
import { VIEW_BY_ID } from "./nav";
import { ThemeMenu } from "./theme-menu";

function subscribeFullscreen(callback: () => void) {
	document.addEventListener("fullscreenchange", callback);
	return () => document.removeEventListener("fullscreenchange", callback);
}

export function useFullscreen() {
	const isFullscreen = useSyncExternalStore(
		subscribeFullscreen,
		() => document.fullscreenElement !== null,
		() => false
	);
	const supported = useSyncExternalStore(
		() => () => {},
		() => document.fullscreenEnabled,
		() => false
	);
	const toggle = async () => {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await document.documentElement.requestFullscreen();
		} catch {
			toast.error("Fullscreen isn't available here");
		}
	};
	return { isFullscreen, supported, toggle };
}

export function undoWithToast() {
	const label = useHarStore.getState().undo();
	if (label) toast(`Undid “${label}”`);
	else toast("Nothing to undo");
}

/**
 * Toast action for undoing a specific change: only undoes when that change is
 * still the latest one, so an old toast can never undo something newer.
 */
export function undoActionFor(historyLength: number) {
	return {
		label: "Undo",
		onClick: () => {
			if (useHarStore.getState().history.length === historyLength) undoWithToast();
			else toast("A newer change was made. Use Undo in the top bar to step back.");
		},
	};
}

export function isMac() {
	return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

export function AppTopbar() {
	const viewMode = useHarStore((s) => s.viewMode);
	const canUndo = useHarStore((s) => s.history.length > 0);
	const undoLabel = useHarStore((s) => s.history.at(-1)?.label);
	const setShowCommandPalette = useHarStore((s) => s.setShowCommandPalette);
	const view = VIEW_BY_ID[viewMode];
	const { isFullscreen, supported, toggle } = useFullscreen();
	const modKey = useSyncExternalStore(
		() => () => {},
		() => (isMac() ? "⌘" : "Ctrl"),
		() => "Ctrl"
	);

	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-4">
			<SidebarTrigger className="-ml-1" />
			<Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
			<div className="flex min-w-0 items-center gap-2">
				<view.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<h1 className="truncate text-sm font-medium">{view.label}</h1>
			</div>

			<div className="ml-auto flex items-center gap-1">
				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowCommandPalette(true)}
					className="hidden h-8 w-56 justify-start gap-2 px-2.5 font-normal text-muted-foreground shadow-none lg:flex xl:w-64"
				>
					<Search className="size-4" />
					<span className="min-w-0 flex-1 truncate text-left">Search or run a command…</span>
					<Kbd>{modKey}K</Kbd>
				</Button>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={() => setShowCommandPalette(true)}
							aria-label="Search or run a command"
							className="lg:hidden"
						>
							<Search />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Search ({modKey}+K)</TooltipContent>
				</Tooltip>

				{canUndo && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon-sm" onClick={undoWithToast} aria-label="Undo">
								<Undo2 />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							Undo {undoLabel ? `“${undoLabel}”` : ""} ({modKey}+Z)
						</TooltipContent>
					</Tooltip>
				)}

				{supported && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={toggle}
								aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
								className="hidden sm:inline-flex"
							>
								{isFullscreen ? <Minimize /> : <Maximize />}
							</Button>
						</TooltipTrigger>
						<TooltipContent>{isFullscreen ? "Exit full screen" : "Full screen"}</TooltipContent>
					</Tooltip>
				)}
				<ThemeMenu />
			</div>
		</header>
	);
}
