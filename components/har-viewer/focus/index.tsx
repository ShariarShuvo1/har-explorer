"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, HardDrive, Focus, ChevronRight, Bookmark } from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";
import { useThemeStore } from "@/lib/stores/theme-store";
import { cn } from "@/lib/cn";
import {
	getMethodColor,
	getStatusColor,
	getStatusBgColor,
	formatBytes,
	formatTime,
	extractPath,
	extractDomain,
} from "@/lib/har-parser";
import { TAB_CONFIG } from "../entry-details/constants";
import { FocusProvider } from "../entry-details/focus-context";
import { GeneralTab } from "../entry-details/general-tab";
import { HeadersTab } from "../entry-details/headers-tab";
import { RequestTab } from "../entry-details/request-tab";
import { ResponseTab } from "../entry-details/response-tab";
import { TimingsTab } from "../entry-details/timings-tab";
import { SecurityTab } from "../entry-details/security-tab";
import { CacheTab } from "../entry-details/cache-tab";
import { PerformanceTab } from "../entry-details/performance-tab";
import { ExportTab } from "../entry-details/export-tab";

export function FocusedEntryOverlay() {
	const {
		entries,
		focusedEntry,
		setFocusedEntry,
		activeTab,
		setActiveTab,
		updateEntry,
		bookmarks,
	} = useHarStore();
	const { theme } = useThemeStore();

	const entry = focusedEntry !== null ? entries[focusedEntry] : null;
	const isBookmarked = focusedEntry !== null && bookmarks.has(focusedEntry);

	const handleClose = useCallback(() => {
		setFocusedEntry(null);
	}, [setFocusedEntry]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && focusedEntry !== null) {
				handleClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [focusedEntry, handleClose]);

	useEffect(() => {
		if (focusedEntry !== null) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [focusedEntry]);

	const handleUpdateField = (path: string[], value: string | number) => {
		if (focusedEntry === null || !entry) return;

		const updatedEntry = JSON.parse(JSON.stringify(entry));
		let current: Record<string, unknown> = updatedEntry;

		for (let i = 0; i < path.length - 1; i++) {
			if (!current[path[i]]) {
				current[path[i]] = {};
			}
			current = current[path[i]] as Record<string, unknown>;
		}

		current[path[path.length - 1]] = value;
		updateEntry(focusedEntry, updatedEntry);
	};

	if (!entry) return null;

	const domain = extractDomain(entry.request.url);
	const path = extractPath(entry.request.url);

	return (
		<AnimatePresence>
			{focusedEntry !== null && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
				>
					<div
						className={cn(
							"flex items-center gap-3 px-4 py-3 border-b border-border/50",
							"bg-card/80"
						)}
					>
						<ChevronRight className="w-4 h-4 text-primary" />

						<div
							className={cn(
								"px-2 py-1 rounded text-xs font-mono font-bold text-white shrink-0",
								getMethodColor(entry.request.method)
							)}
						>
							{entry.request.method}
						</div>

						<div
							className={cn(
								"px-2 py-1 rounded text-xs font-mono font-bold shrink-0 border",
								getStatusColor(entry.response.status),
								getStatusBgColor(entry.response.status)
							)}
						>
							{entry.response.status}
						</div>

						<div className="flex-1 min-w-0 flex flex-col gap-0.5">
							<div className="flex items-center gap-2 min-w-0">
								<span className="text-sm text-muted truncate shrink-0 max-w-48">
									{domain}
								</span>
								<span className="text-sm text-foreground font-mono truncate">
									{path}
								</span>
							</div>
							<div className="flex items-center gap-3 text-xs text-muted">
								<span className="truncate max-w-60">
									{entry.response.content.mimeType ||
										"unknown"}
								</span>
								{entry.request.httpVersion && (
									<span className="text-muted/60">
										{entry.request.httpVersion}
									</span>
								)}
							</div>
						</div>

						<div className="flex items-center gap-4 shrink-0">
							<div className="flex items-center gap-1.5 text-xs text-muted font-mono">
								<Clock className="w-3.5 h-3.5 text-green-500/70" />
								<span
									className={cn(
										entry.time > 1000 && "text-orange-500",
										entry.time > 3000 && "text-red-500"
									)}
								>
									{formatTime(entry.time)}
								</span>
							</div>

							<div className="flex items-center gap-1.5 text-xs text-muted font-mono">
								<HardDrive className="w-3.5 h-3.5 text-purple-500/70" />
								<span>
									{formatBytes(entry.response.content.size)}
								</span>
							</div>

							{isBookmarked && (
								<Bookmark className="w-4 h-4 text-accent fill-current" />
							)}
						</div>
					</div>

					<div className="flex items-center border-b border-border/50 bg-primary/5 overflow-x-auto">
						{TAB_CONFIG.map((tab) => {
							const Icon = tab.icon;
							return (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id)}
									className={cn(
										"flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all relative border-b-2 border-transparent whitespace-nowrap",
										activeTab === tab.id
											? "text-primary border-b-primary bg-primary/10"
											: "text-muted hover:text-foreground hover:bg-card/40"
									)}
								>
									<Icon className="w-3.5 h-3.5" />
									{tab.label}
								</button>
							);
						})}

						<div className="flex-1" />

						<button
							onClick={handleClose}
							className={cn(
								"flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all",
								"text-primary bg-primary/10 hover:bg-primary/20"
							)}
							title="Exit Focus Mode (ESC)"
						>
							<Focus className="w-3.5 h-3.5" />
							Unfocus
						</button>
					</div>

					<div className="flex-1 overflow-auto p-3">
						<FocusProvider isFocusMode={true}>
							{activeTab === "general" && (
								<GeneralTab
									entry={entry}
									onUpdateField={handleUpdateField}
								/>
							)}
							{activeTab === "headers" && (
								<HeadersTab
									entry={entry}
									onUpdateField={handleUpdateField}
								/>
							)}
							{activeTab === "request" && (
								<RequestTab
									entry={entry}
									onUpdateField={handleUpdateField}
								/>
							)}
							{activeTab === "response" && (
								<ResponseTab
									entry={entry}
									theme={theme}
									onUpdateField={handleUpdateField}
								/>
							)}
							{activeTab === "timings" && (
								<TimingsTab
									entry={entry}
									onUpdateField={handleUpdateField}
								/>
							)}
							{activeTab === "security" && (
								<SecurityTab entry={entry} />
							)}
							{activeTab === "cache" && (
								<CacheTab entry={entry} />
							)}
							{activeTab === "performance" && (
								<PerformanceTab entry={entry} />
							)}
							{activeTab === "export" && (
								<ExportTab entry={entry} />
							)}
						</FocusProvider>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
