"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { HAREntry } from "@/lib/stores/har-store";
import { formatTime } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { GitCompare, X } from "lucide-react";
import { TIMING_COLORS } from "./constants";

export function ComparisonPanel({
	entries,
	indices,
	onClose,
}: {
	entries: HAREntry[];
	indices: [number, number];
	onClose: () => void;
}) {
	const entry1 = entries[indices[0]];
	const entry2 = indices[1] >= 0 ? entries[indices[1]] : null;
	const [position, setPosition] = useState(() => {
		if (typeof window !== "undefined") {
			return {
				x: Math.max(0, (window.innerWidth - 800) / 2),
				y: 500,
			};
		}
		return { x: 0, y: 0 };
	});
	const [isDragging, setIsDragging] = useState(false);
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
	const panelRef = useRef<HTMLDivElement>(null);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if ((e.target as HTMLElement).closest("button")) return;
			setIsDragging(true);
			setDragOffset({
				x: e.clientX - position.x,
				y: e.clientY - position.y,
			});
		},
		[position]
	);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging) return;
			setPosition({
				x: e.clientX - dragOffset.x,
				y: e.clientY - dragOffset.y,
			});
		},
		[isDragging, dragOffset]
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	useEffect(() => {
		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			return () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};
		}
	}, [isDragging, handleMouseMove, handleMouseUp]);

	if (!entry1) return null;

	const getSegments = (entry: HAREntry) =>
		[
			{ type: "blocked", value: entry.timings.blocked || 0 },
			{ type: "dns", value: entry.timings.dns || 0 },
			{ type: "connect", value: entry.timings.connect || 0 },
			{ type: "ssl", value: entry.timings.ssl || 0 },
			{ type: "send", value: entry.timings.send || 0 },
			{ type: "wait", value: entry.timings.wait || 0 },
			{ type: "receive", value: entry.timings.receive || 0 },
		].filter((s) => s.value > 0);

	const content = (
		<div
			ref={panelRef}
			className="fixed bg-card border-2 border-accent/50 rounded-lg shadow-2xl w-200 max-w-[90vw]"
			style={{
				left: position.x,
				top: position.y,
				zIndex: 999999,
				cursor: isDragging ? "grabbing" : "grab",
			}}
			onMouseDown={handleMouseDown}
		>
			<div className="flex items-center justify-between p-4 pb-2 border-b border-border/50">
				<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
					<GitCompare className="w-4 h-4 text-primary" />
					Timing Comparison
					<span className="text-xs text-muted font-normal">
						(drag to move)
					</span>
				</div>
				<button
					onClick={onClose}
					className="p-1 rounded hover:bg-card-hover text-muted hover:text-foreground transition-colors"
					title="Close comparison"
				>
					<X className="w-4 h-4" />
				</button>
			</div>

			<div className="grid grid-cols-2 gap-4 p-4">
				<div className="space-y-2">
					<div className="text-xs text-muted truncate">
						{new URL(entry1.request.url).pathname}
					</div>
					<div className="space-y-1">
						{getSegments(entry1).map((s) => (
							<div
								key={s.type}
								className="flex items-center gap-2"
							>
								<div
									className={cn(
										"w-2 h-2 rounded",
										TIMING_COLORS[s.type]
									)}
								/>
								<span className="text-xs text-muted capitalize flex-1">
									{s.type}
								</span>
								<span className="text-xs font-mono">
									{formatTime(s.value)}
								</span>
							</div>
						))}
						<div className="text-xs font-semibold text-primary pt-1 border-t border-border/50">
							Total: {formatTime(entry1.time)}
						</div>
					</div>
				</div>

				{entry2 ? (
					<div className="space-y-2">
						<div className="text-xs text-muted truncate">
							{new URL(entry2.request.url).pathname}
						</div>
						<div className="space-y-1">
							{getSegments(entry2).map((s) => (
								<div
									key={s.type}
									className="flex items-center gap-2"
								>
									<div
										className={cn(
											"w-2 h-2 rounded",
											TIMING_COLORS[s.type]
										)}
									/>
									<span className="text-xs text-muted capitalize flex-1">
										{s.type}
									</span>
									<span className="text-xs font-mono">
										{formatTime(s.value)}
									</span>
								</div>
							))}
							<div className="text-xs font-semibold text-primary pt-1 border-t border-border/50">
								Total: {formatTime(entry2.time)}
							</div>
						</div>
					</div>
				) : (
					<div className="flex items-center justify-center text-xs text-muted">
						Click another request to compare
					</div>
				)}
			</div>

			{entry2 && (
				<div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted text-center">
					Difference:{" "}
					<span
						className={cn(
							"font-semibold",
							entry1.time > entry2.time
								? "text-red-500"
								: "text-green-500"
						)}
					>
						{entry1.time > entry2.time ? "+" : ""}
						{formatTime(entry1.time - entry2.time)}
					</span>
				</div>
			)}
		</div>
	);

	if (typeof document === "undefined") return null;
	return createPortal(content, document.body);
}
