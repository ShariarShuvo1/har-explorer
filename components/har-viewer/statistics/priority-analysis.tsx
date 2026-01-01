"use client";

import { useMemo } from "react";
import { formatTime } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { ArrowUpDown, AlertTriangle } from "lucide-react";
import type { HAREntry } from "@/lib/stores/har-store";
import { getPriority, getPriorityColor } from "./utils";
import type { PriorityStats } from "./types";

interface PriorityAnalysisProps {
	entries: HAREntry[];
}

export function PriorityAnalysis({ entries }: PriorityAnalysisProps) {
	const analysis = useMemo(() => {
		const priorityMap = new Map<string, PriorityStats>();
		const entriesWithTiming = entries.map((entry) => ({
			entry,
			startTime: new Date(entry.startedDateTime).getTime(),
		}));

		const minStartTime = Math.min(
			...entriesWithTiming.map((e) => e.startTime)
		);

		entriesWithTiming.forEach(({ entry, startTime }) => {
			const priority = getPriority(entry);
			const relativeStartTime = startTime - minStartTime;

			const existing = priorityMap.get(priority) || {
				priority,
				count: 0,
				avgLoadTime: 0,
				avgStartTime: 0,
				resources: [],
			};

			existing.count++;
			existing.avgLoadTime += entry.time;
			existing.avgStartTime += relativeStartTime;
			existing.resources.push({
				url: entry.request.url,
				actualStartTime: relativeStartTime,
				duration: entry.time,
			});

			priorityMap.set(priority, existing);
		});

		const priorityStats = Array.from(priorityMap.values())
			.map((stat) => ({
				...stat,
				avgLoadTime: stat.avgLoadTime / stat.count,
				avgStartTime: stat.avgStartTime / stat.count,
			}))
			.sort((a, b) => {
				const priorityOrder = [
					"VeryHigh",
					"High",
					"Medium",
					"Low",
					"VeryLow",
				];
				return (
					priorityOrder.indexOf(a.priority) -
					priorityOrder.indexOf(b.priority)
				);
			});

		const mismatches = [];
		const highPriorityDelayed = priorityStats.find(
			(s) => s.priority === "High" || s.priority === "VeryHigh"
		);
		const lowPriorityEarly = priorityStats.find(
			(s) => s.priority === "Low" || s.priority === "VeryLow"
		);

		if (
			highPriorityDelayed &&
			lowPriorityEarly &&
			highPriorityDelayed.avgStartTime > lowPriorityEarly.avgStartTime
		) {
			mismatches.push({
				type: "High priority resources loading after low priority",
				severity: "warning",
				detail: `High priority: ${formatTime(
					highPriorityDelayed.avgStartTime
				)} vs Low priority: ${formatTime(
					lowPriorityEarly.avgStartTime
				)}`,
			});
		}

		priorityStats.forEach((stat) => {
			stat.resources.sort(
				(a, b) => b.actualStartTime - a.actualStartTime
			);
			if (stat.resources.length > 5 && stat.priority === "High") {
				const delayed = stat.resources.slice(0, 3);
				delayed.forEach((resource) => {
					if (resource.actualStartTime > 3000) {
						mismatches.push({
							type: "High priority resource delayed",
							severity: "error",
							detail: `${resource.url.substring(
								0,
								60
							)}... started at ${formatTime(
								resource.actualStartTime
							)}`,
						});
					}
				});
			}
		});

		return {
			priorityStats,
			mismatches: mismatches.slice(0, 10),
			hasPriorityData: entries.some((e) => e._priority),
		};
	}, [entries]);

	if (!analysis.hasPriorityData) {
		return (
			<div className="p-4 bg-card/40 border border-border rounded-lg">
				<h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
					<ArrowUpDown className="w-5 h-5" />
					Resource Priority Analysis
				</h3>
				<p className="text-sm text-muted">
					Priority data not available in this HAR file
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
				<ArrowUpDown className="w-5 h-5" />
				Resource Priority Analysis
			</h3>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="space-y-2">
					<h4 className="text-lg font-semibold text-foreground">
						Priority Distribution
					</h4>
					{analysis.priorityStats.map((stat) => (
						<div
							key={stat.priority}
							className="p-3 bg-card/40 rounded border border-border"
						>
							<div className="flex items-center justify-between mb-2">
								<span
									className={cn(
										"px-3 py-1 rounded text-xs font-bold uppercase",
										getPriorityColor(stat.priority)
									)}
								>
									{stat.priority}
								</span>
								<span className="text-sm font-mono font-bold text-foreground">
									{stat.count} resources
								</span>
							</div>
							<div className="grid grid-cols-2 gap-2 text-xs mb-2">
								<div>
									<span className="text-muted">
										Avg Start:{" "}
									</span>
									<span className="text-foreground font-medium">
										{formatTime(stat.avgStartTime)}
									</span>
								</div>
								<div>
									<span className="text-muted">
										Avg Duration:{" "}
									</span>
									<span className="text-foreground font-medium">
										{formatTime(stat.avgLoadTime)}
									</span>
								</div>
							</div>
							<div className="w-full bg-card rounded-full h-2 overflow-hidden">
								<div
									className="bg-accent h-full"
									style={{
										width: `${
											(stat.count / entries.length) * 100
										}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>

				<div className="space-y-2">
					<h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
						<AlertTriangle className="w-4 h-4 text-yellow-500" />
						Priority Mismatches
					</h4>
					{analysis.mismatches.length > 0 ? (
						<div className="space-y-2">
							{analysis.mismatches.map((mismatch, index) => (
								<div
									key={index}
									className={cn(
										"p-3 rounded border",
										mismatch.severity === "error"
											? "bg-red-500/10 border-red-500/30"
											: "bg-yellow-500/10 border-yellow-500/30"
									)}
								>
									<div className="flex items-start gap-2">
										<AlertTriangle
											className={cn(
												"w-4 h-4 shrink-0 mt-0.5",
												mismatch.severity === "error"
													? "text-red-500"
													: "text-yellow-500"
											)}
										/>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-semibold text-foreground">
												{mismatch.type}
											</p>
											<p className="text-xs text-muted mt-1 break-all">
												{mismatch.detail}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
							<p className="text-sm text-green-500">
								No priority mismatches detected. Resources are
								loading in optimal order.
							</p>
						</div>
					)}
				</div>
			</div>

			<div className="overflow-x-auto">
				<h4 className="text-lg font-semibold text-foreground mb-2">
					Priority vs Load Timing
				</h4>
				<table className="w-full border-collapse">
					<thead>
						<tr className="bg-card/60 border-b border-border">
							<th className="text-left p-3 text-sm font-semibold text-foreground">
								Priority
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Count
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Avg Start Time
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Avg Duration
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								% of Total
							</th>
						</tr>
					</thead>
					<tbody>
						{analysis.priorityStats.map((stat, index) => {
							const percentage =
								(stat.count / entries.length) * 100;
							return (
								<tr
									key={stat.priority}
									className={cn(
										"border-b border-border hover:bg-card-hover transition-colors",
										index % 2 === 0
											? "bg-card/20"
											: "bg-card/10"
									)}
								>
									<td className="p-3">
										<span
											className={cn(
												"px-3 py-1 rounded text-xs font-bold uppercase",
												getPriorityColor(stat.priority)
											)}
										>
											{stat.priority}
										</span>
									</td>
									<td className="p-3 text-sm text-foreground text-right font-medium">
										{stat.count}
									</td>
									<td className="p-3 text-sm text-muted text-right">
										{formatTime(stat.avgStartTime)}
									</td>
									<td className="p-3 text-sm text-muted text-right">
										{formatTime(stat.avgLoadTime)}
									</td>
									<td className="p-3 text-sm text-right">
										<div className="flex items-center justify-end gap-2">
											<div className="w-20 bg-card rounded-full h-2 overflow-hidden">
												<div
													className="bg-primary h-full"
													style={{
														width: `${percentage}%`,
													}}
												/>
											</div>
											<span className="text-muted font-medium min-w-12">
												{percentage.toFixed(1)}%
											</span>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
