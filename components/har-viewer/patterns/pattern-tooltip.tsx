"use client";

import { createPortal } from "react-dom";
import { HAREntry, getResourceType } from "@/lib/stores/har-store";
import { formatTime, formatBytes } from "@/lib/har-parser";
import { cn } from "@/lib/cn";

interface PatternTooltipProps {
	entry: HAREntry;
	x: number;
	y: number;
	details?: string;
}

export function PatternTooltip({ entry, x, y, details }: PatternTooltipProps) {
	const resourceType = getResourceType(entry);
	const timings = entry.timings;

	const offsetX = 12;
	const offsetY = 12;
	let tooltipX = x + offsetX;
	let tooltipY = y + offsetY;

	const tooltipWidth = 320;
	const tooltipHeight = 300;

	if (tooltipX + tooltipWidth > window.innerWidth) {
		tooltipX = x - tooltipWidth - offsetX;
	}
	if (tooltipY + tooltipHeight > window.innerHeight) {
		tooltipY = y - tooltipHeight - offsetY;
	}

	const content = (
		<div
			className="fixed bg-card border-2 border-primary/50 rounded-lg shadow-2xl p-3 min-w-64 max-w-80 pointer-events-none"
			style={{
				left: tooltipX,
				top: tooltipY,
				zIndex: 999999,
			}}
		>
			<div className="flex items-start justify-between gap-2 mb-2">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1 flex-wrap">
						<span
							className={cn(
								"px-1.5 py-0.5 rounded text-xs font-semibold",
								resourceType === "doc"
									? "bg-blue-500/20 text-blue-500"
									: resourceType === "css"
									? "bg-purple-500/20 text-purple-500"
									: resourceType === "js"
									? "bg-yellow-500/20 text-yellow-500"
									: resourceType === "img"
									? "bg-green-500/20 text-green-500"
									: resourceType === "font"
									? "bg-pink-500/20 text-pink-500"
									: resourceType === "fetch"
									? "bg-cyan-500/20 text-cyan-500"
									: "bg-gray-500/20 text-gray-500"
							)}
						>
							{resourceType.toUpperCase()}
						</span>
						<span className="text-xs font-mono text-muted">
							{entry.request.method}
						</span>
						<span
							className={cn(
								"text-xs font-semibold px-1.5 py-0.5 rounded",
								entry.response.status >= 200 &&
									entry.response.status < 300
									? "bg-green-500/20 text-green-500"
									: entry.response.status >= 400
									? "bg-red-500/20 text-red-500"
									: "bg-blue-500/20 text-blue-500"
							)}
						>
							{entry.response.status}
						</span>
					</div>
					<div
						className="text-xs text-foreground font-medium truncate"
						title={entry.request.url}
					>
						{entry.request.url}
					</div>
				</div>
			</div>

			{details && (
				<div className="mb-2 p-2 bg-accent/10 rounded border border-accent/30">
					<p className="text-xs text-foreground">{details}</p>
				</div>
			)}

			<div className="space-y-1.5 mb-2">
				<div className="text-xs text-muted font-semibold uppercase tracking-wide">
					Performance
				</div>
				<div className="grid grid-cols-2 gap-x-3 gap-y-1">
					<div className="flex justify-between">
						<span className="text-xs text-muted">Total:</span>
						<span className="text-xs font-mono text-foreground font-medium">
							{formatTime(entry.time)}
						</span>
					</div>
					{timings.wait > 0 && (
						<div className="flex justify-between">
							<span className="text-xs text-muted">Wait:</span>
							<span className="text-xs font-mono text-foreground">
								{formatTime(timings.wait)}
							</span>
						</div>
					)}
					{timings.dns > 0 && (
						<div className="flex justify-between">
							<span className="text-xs text-muted">DNS:</span>
							<span className="text-xs font-mono text-foreground">
								{formatTime(timings.dns)}
							</span>
						</div>
					)}
					{timings.connect > 0 && (
						<div className="flex justify-between">
							<span className="text-xs text-muted">Connect:</span>
							<span className="text-xs font-mono text-foreground">
								{formatTime(timings.connect)}
							</span>
						</div>
					)}
					{timings.ssl > 0 && (
						<div className="flex justify-between">
							<span className="text-xs text-muted">SSL:</span>
							<span className="text-xs font-mono text-foreground">
								{formatTime(timings.ssl)}
							</span>
						</div>
					)}
					{timings.receive > 0 && (
						<div className="flex justify-between">
							<span className="text-xs text-muted">
								Download:
							</span>
							<span className="text-xs font-mono text-foreground">
								{formatTime(timings.receive)}
							</span>
						</div>
					)}
				</div>
			</div>

			<div className="flex items-center gap-3 text-xs text-muted pt-1.5 border-t border-border/50">
				<span>
					Size:{" "}
					<span className="text-foreground font-medium">
						{formatBytes(entry.response.content.size || 0)}
					</span>
				</span>
				{entry.response.content.mimeType && (
					<span className="truncate">
						Type:{" "}
						<span className="text-foreground font-medium">
							{entry.response.content.mimeType.split(";")[0]}
						</span>
					</span>
				)}
			</div>
		</div>
	);

	return typeof window !== "undefined"
		? createPortal(content, document.body)
		: null;
}
