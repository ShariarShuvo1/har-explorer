"use client";

import { createPortal } from "react-dom";
import { getResourceType } from "@/lib/stores/har-store";
import { formatTime, formatBytes } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { TooltipData } from "./types";
import { TIMING_COLORS, TYPE_COLORS } from "./constants";

export function TimingTooltip({ data }: { data: TooltipData }) {
	const { entry, x, y, segments } = data;
	const resourceType = getResourceType(entry);

	const content = (
		<div
			className="fixed bg-card border-2 border-primary/50 rounded-lg shadow-2xl p-4 min-w-72 max-w-96 pointer-events-none"
			style={{
				left: x + 8,
				top: y + 8,
				zIndex: 999999,
			}}
		>
			<div className="flex items-start justify-between gap-2 mb-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span
							className={cn(
								"px-2 py-0.5 rounded text-xs font-semibold",
								TYPE_COLORS[resourceType]
							)}
						>
							{resourceType.toUpperCase()}
						</span>
						<span className="text-xs font-mono text-muted">
							{entry.request.method}
						</span>
						<span
							className={cn(
								"text-xs font-semibold",
								entry.response.status >= 400
									? "text-red-500"
									: "text-green-500"
							)}
						>
							{entry.response.status}
						</span>
					</div>
					<div className="text-xs text-foreground font-medium truncate">
						{entry.request.url}
					</div>
				</div>
			</div>

			<div className="space-y-2 mb-3">
				<div className="text-xs text-muted font-semibold uppercase tracking-wide">
					Timing Breakdown
				</div>
				<div className="space-y-1.5">
					{segments.map((segment) => (
						<div
							key={segment.type}
							className="flex items-center gap-2"
						>
							<div
								className={cn(
									"w-3 h-3 rounded",
									TIMING_COLORS[segment.type]
								)}
							/>
							<span className="text-xs text-muted capitalize flex-1">
								{segment.type}
							</span>
							<span className="text-xs font-mono text-foreground">
								{formatTime(segment.value)}
							</span>
						</div>
					))}
					<div className="flex items-center gap-2 pt-1 border-t border-border/50">
						<div className="w-3 h-3" />
						<span className="text-xs text-foreground font-semibold flex-1">
							Total
						</span>
						<span className="text-xs font-mono text-primary font-semibold">
							{formatTime(entry.time)}
						</span>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-4 text-xs text-muted">
				<span>
					Size:{" "}
					<span className="text-foreground font-medium">
						{formatBytes(entry.response.content.size || 0)}
					</span>
				</span>
				<span>
					MIME:{" "}
					<span className="text-foreground font-medium">
						{entry.response.content.mimeType.split(";")[0]}
					</span>
				</span>
			</div>
		</div>
	);

	if (typeof document === "undefined") return null;
	return createPortal(content, document.body);
}
