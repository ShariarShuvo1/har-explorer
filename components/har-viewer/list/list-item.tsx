"use client";

import {
	ChevronRight,
	Trash2,
	Bookmark,
	Clock,
	HardDrive,
	FileDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useHarStore, HAREntry } from "@/lib/stores/har-store";
import { cn } from "@/lib/cn";
import { generateApiDocumentation } from "../entry-details/utils";
import {
	getMethodColor,
	getStatusColor,
	getStatusBgColor,
	formatBytes,
	formatTime,
	extractPath,
	extractDomain,
} from "@/lib/har-parser";
import { HarEntryDetails } from "@/components/har-viewer/entry-details";

interface HarListItemProps {
	entry: HAREntry;
	index: number;
}

export function HarListItem({ entry, index }: HarListItemProps) {
	const {
		selectedEntries,
		toggleSelection,
		selectEntry,
		deselectEntry,
		selectRange,
		deleteEntries,
		expandedEntry,
		setExpandedEntry,
		bookmarks,
		addBookmark,
		removeBookmark,
	} = useHarStore();

	const isSelected = selectedEntries.has(index);
	const isExpanded = expandedEntry === index;
	const isBookmarked = bookmarks.has(index);

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		deleteEntries([index]);
	};

	const handleBookmark = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isBookmarked) {
			removeBookmark(index);
		} else {
			const url = new URL(entry.request.url);
			const defaultLabel = `${entry.request.method} ${url.pathname}`;
			addBookmark(index, defaultLabel, "#00ffff");
		}
	};

	const handleExportDocs = (e: React.MouseEvent) => {
		e.stopPropagation();
		const markdown = generateApiDocumentation(entry);
		const url = new URL(entry.request.url);
		const pathname = url.pathname
			.split("/")
			.filter(Boolean)
			.join("-")
			.replace(/[^a-zA-Z0-9-_]/g, "");
		const method = entry.request.method.toLowerCase();
		const filename = `${method}-${pathname || "api"}-docs.md`;

		const blob = new Blob([markdown], { type: "text/markdown" });
		const downloadUrl = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = downloadUrl;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(downloadUrl);
	};

	const handleToggleExpand = (e: React.MouseEvent) => {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const clickX = e.clientX - rect.left;

		if (e.shiftKey) {
			selectRange(index);
			return;
		}

		if (clickX < 48) {
			toggleSelection(index);
			return;
		}

		if (!isExpanded) {
			selectEntry(index);
		} else {
			deselectEntry(index);
		}
		setExpandedEntry(isExpanded ? null : index);
	};

	const handleCheckboxClick = (e: React.MouseEvent<HTMLInputElement>) => {
		e.stopPropagation();
		if (e.shiftKey) {
			selectRange(index);
			return;
		}
		toggleSelection(index);
	};

	const domain = extractDomain(entry.request.url);
	const path = extractPath(entry.request.url);

	return (
		<div
			className={cn(
				"border-b border-border/50 transition-all",
				isExpanded && "bg-card/80 shadow-lg border-primary/30"
			)}
			data-entry-index={index}
		>
			<div
				className={cn(
					"group flex items-center gap-2 px-3 py-2 cursor-pointer transition-all",
					"hover:bg-card/60 border-l-2 border-transparent",
					isSelected &&
						"bg-primary/10 border-l-2 border-primary hover:bg-primary/15",
					isExpanded && "bg-primary/15"
				)}
				onClick={handleToggleExpand}
			>
				<input
					type="checkbox"
					checked={isSelected}
					onChange={(e) => e.stopPropagation()}
					onClick={handleCheckboxClick}
					className="w-4 h-4 shrink-0"
					aria-label="Select request"
				/>

				<div
					className={cn(
						"px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white min-w-14 text-center shrink-0",
						getMethodColor(entry.request.method)
					)}
				>
					{entry.request.method}
				</div>

				<div
					className={cn(
						"px-1.5 py-0.5 rounded text-[10px] font-mono font-bold min-w-10 text-center shrink-0 border",
						getStatusColor(entry.response.status),
						getStatusBgColor(entry.response.status)
					)}
				>
					{entry.response.status}
				</div>

				<div className="flex-1 min-w-0 flex flex-col gap-0.5">
					<div className="flex items-center gap-1.5 min-w-0">
						<span className="text-xs text-muted truncate shrink-0 max-w-32">
							{domain}
						</span>
						<span className="text-xs text-foreground font-mono truncate">
							{path}
						</span>
					</div>
					<div className="flex items-center gap-2 text-[10px] text-muted">
						<span className="truncate max-w-40">
							{entry.response.content.mimeType || "unknown"}
						</span>
						{entry.request.httpVersion && (
							<span className="text-muted/60">
								{entry.request.httpVersion}
							</span>
						)}
					</div>
				</div>

				<div className="flex items-center gap-1 text-[10px] text-muted font-mono shrink-0 min-w-16 justify-end">
					<Clock className="w-3 h-3 text-green-500/70" />
					<span
						className={cn(
							entry.time > 1000 && "text-orange-500",
							entry.time > 3000 && "text-red-500"
						)}
					>
						{formatTime(entry.time)}
					</span>
				</div>

				<div className="flex items-center gap-1 text-[10px] text-muted font-mono shrink-0 min-w-14 justify-end">
					<HardDrive className="w-3 h-3 text-purple-500/70" />
					<span>{formatBytes(entry.response.content.size)}</span>
				</div>

				<div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
					<button
						onClick={handleExportDocs}
						className="p-1.5 rounded text-muted hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
						title="Export API Documentation"
					>
						<FileDown className="w-3.5 h-3.5" />
					</button>

					<button
						onClick={handleBookmark}
						className={cn(
							"p-1.5 rounded transition-colors",
							isBookmarked
								? "text-accent bg-accent/10"
								: "text-muted hover:text-accent hover:bg-accent/10"
						)}
						title={
							isBookmarked ? "Remove Bookmark" : "Add Bookmark"
						}
					>
						<Bookmark
							className={cn(
								"w-3.5 h-3.5",
								isBookmarked && "fill-current"
							)}
						/>
					</button>

					<button
						onClick={handleDelete}
						className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
						title="Delete Entry"
					>
						<Trash2 className="w-3.5 h-3.5" />
					</button>
				</div>

				{isBookmarked && (
					<div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
				)}

				<motion.div
					animate={{ rotate: isExpanded ? 90 : 0 }}
					transition={{ duration: 0.15 }}
					className="text-muted shrink-0"
				>
					<ChevronRight className="w-4 h-4" />
				</motion.div>
			</div>

			<AnimatePresence mode="sync">
				{isExpanded && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{
							duration: 0.15,
							ease: [0.4, 0, 0.2, 1],
							opacity: { duration: 0.1 },
						}}
					>
						<HarEntryDetails entry={entry} index={index} />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
