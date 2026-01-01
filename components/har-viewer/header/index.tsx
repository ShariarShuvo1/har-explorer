"use client";

import { X, HelpCircle } from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";
import { IconButton } from "@/components/ui/icon-button";
import { ThemeToggle } from "@/components/controls/theme-toggle";
import { FullscreenToggle } from "@/components/controls/fullscreen-toggle";
import { ViewModeSelector } from "../controls/view-mode-selector";
import Image from "next/image";

export function HarHeader() {
	const clearHarData = useHarStore((state) => state.clearHarData);
	const harData = useHarStore((state) => state.harData);
	const toggleKeyboardShortcuts = useHarStore(
		(state) => state.toggleKeyboardShortcuts
	);

	return (
		<div className="flex items-center justify-between px-6 py-2 border-b border-border bg-card/50 backdrop-blur-sm gap-4">
			<div className="flex items-center gap-3">
				<Image
					src="/icon.png"
					alt="HAR Explorer"
					width={24}
					height={24}
					className="w-6 h-6"
				/>
				<div>
					<h1 className="text-lg font-bold text-foreground">
						HAR Explorer
					</h1>
					<p className="text-xs text-muted">
						{harData?.log.entries.length || 0} requests
					</p>
				</div>
			</div>

			<div className="flex-1 flex justify-center">
				<ViewModeSelector />
			</div>

			<div className="flex items-center gap-2">
				<IconButton
					onClick={toggleKeyboardShortcuts}
					className="hover:bg-primary/10 hover:text-primary"
					title="Keyboard Shortcuts (?)"
				>
					<HelpCircle className="w-5 h-5" />
				</IconButton>
				<div className="w-px h-6 bg-border" />
				<FullscreenToggle />
				<div className="w-px h-6 bg-border" />
				<ThemeToggle />
				<div className="w-px h-6 bg-border" />
				<IconButton
					onClick={clearHarData}
					className="hover:bg-destructive/10 hover:text-destructive"
				>
					<X className="w-5 h-5" />
				</IconButton>
			</div>
		</div>
	);
}
