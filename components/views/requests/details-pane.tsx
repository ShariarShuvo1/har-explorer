"use client";

import {
	ChevronDown,
	ChevronUp,
	Maximize2,
	Minimize2,
	MoreHorizontal,
	Star,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import { CopyButton } from "@/components/common/copy-button";
import { useHarStore } from "@/lib/stores/har-store";
import { getEntryName } from "@/lib/timing";
import { cn } from "@/lib/cn";
import { RequestDetailsContent } from "./details";
import { RequestMenuItems, requestActions } from "./request-actions";

function IconAction({
	label,
	onClick,
	disabled,
	children,
	className,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClick}
					disabled={disabled}
					aria-label={label}
					className={className}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

/** Header + tabbed details for the active request. */
export function DetailsPane({
	index,
	canMaximize,
	onClose,
}: {
	index: number;
	/** The split view can grow to full width; sheets are already full size. */
	canMaximize: boolean;
	onClose: () => void;
}) {
	const entry = useHarStore((s) => s.entries[index]);
	const maximized = useHarStore((s) => s.detailsMaximized);
	const setMaximized = useHarStore((s) => s.setDetailsMaximized);
	const stepActiveEntry = useHarStore((s) => s.stepActiveEntry);
	const position = useHarStore((s) => s.visibleEntryIndices.indexOf(index));
	const visibleCount = useHarStore((s) => s.visibleEntryIndices.length);
	const isBookmarked = useHarStore((s) => s.bookmarks.has(index));

	if (!entry) return null;
	const name = getEntryName(entry.request.url);

	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			<div className="flex shrink-0 flex-col gap-1 border-b px-3 py-2.5 sm:px-4">
				<div className="flex items-center gap-2">
					<MethodBadge method={entry.request.method} />
					<StatusBadge status={entry.response.status} statusText={entry.response.statusText} />
					<h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={name}>
						{name}
					</h2>
					<div className="-mr-1.5 flex shrink-0 items-center">
						<IconAction
							label="Previous request (K)"
							onClick={() => stepActiveEntry(-1)}
							disabled={position <= 0}
						>
							<ChevronUp />
						</IconAction>
						<IconAction
							label="Next request (J)"
							onClick={() => stepActiveEntry(1)}
							disabled={position === -1 || position >= visibleCount - 1}
						>
							<ChevronDown />
						</IconAction>
						<IconAction
							label={isBookmarked ? "Remove bookmark (B)" : "Bookmark (B)"}
							onClick={() => requestActions.toggleBookmark(index)}
						>
							<Star className={cn(isBookmarked && "fill-warning text-warning")} />
						</IconAction>
						<DropdownMenu>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon-sm" aria-label="More actions">
											<MoreHorizontal />
										</Button>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent>More actions</TooltipContent>
							</Tooltip>
							<DropdownMenuContent align="end" className="w-60">
								<RequestMenuItems index={index} kind="dropdown" />
							</DropdownMenuContent>
						</DropdownMenu>
						{canMaximize && (
							<IconAction
								label={maximized ? "Restore split view" : "Expand details"}
								onClick={() => setMaximized(!maximized)}
							>
								{maximized ? <Minimize2 /> : <Maximize2 />}
							</IconAction>
						)}
						<IconAction label="Close (Esc)" onClick={onClose}>
							<X />
						</IconAction>
					</div>
				</div>
				<div className="flex min-w-0 items-center gap-1">
					<p
						className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
						title={entry.request.url}
					>
						{entry.request.url}
					</p>
					<CopyButton
						value={entry.request.url}
						label="Copy URL"
						successMessage="URL copied"
						className="size-6"
					/>
					{position >= 0 && (
						<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
							{position + 1} / {visibleCount}
						</span>
					)}
				</div>
			</div>
			<RequestDetailsContent key={index} entry={entry} index={index} />
		</div>
	);
}
