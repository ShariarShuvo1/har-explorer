"use client";

import { useMemo } from "react";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { Layers, Clock } from "lucide-react";
import type { HAREntry } from "@/lib/stores/har-store";
import { getResourceType, getResourceTypeColor } from "./utils";
import type { ResourceSequenceStats } from "./types";

interface ResourceSequenceAnalysisProps {
	entries: HAREntry[];
}

export function ResourceSequenceAnalysis({
	entries,
}: ResourceSequenceAnalysisProps) {
	const analysis = useMemo(() => {
		const resourceMap = new Map<string, ResourceSequenceStats>();

		const entriesWithTiming = entries.map((entry) => {
			const startTime = new Date(entry.startedDateTime).getTime();
			const endTime = startTime + entry.time;
			return {
				entry,
				startTime,
				endTime,
			};
		});

		const minStartTime = Math.min(
			...entriesWithTiming.map((e) => e.startTime)
		);

		entriesWithTiming.forEach(({ entry, startTime, endTime }) => {
			const resourceType = getResourceType(entry);
			const relativeStartTime = startTime - minStartTime;

			const overlappingRequests = entriesWithTiming.filter(
				(other) =>
					other.startTime < endTime &&
					other.endTime > startTime &&
					getResourceType(other.entry) === resourceType &&
					other.entry !== entry
			).length;

			const existing = resourceMap.get(resourceType) || {
				resourceType,
				count: 0,
				avgStartTime: 0,
				avgDuration: 0,
				totalSize: 0,
				parallelism: 0,
				blockingCount: 0,
			};

			existing.count++;
			existing.avgStartTime += relativeStartTime;
			existing.avgDuration += entry.time;
			existing.totalSize += entry.response.content.size;
			existing.parallelism += overlappingRequests;

			if (entry.timings.blocked > 0) {
				existing.blockingCount++;
			}

			resourceMap.set(resourceType, existing);
		});

		const resourceStats = Array.from(resourceMap.values())
			.map((stat) => ({
				...stat,
				avgStartTime: stat.avgStartTime / stat.count,
				avgDuration: stat.avgDuration / stat.count,
				parallelism: stat.parallelism / stat.count,
			}))
			.sort((a, b) => a.avgStartTime - b.avgStartTime);

		const loadSequence = resourceStats.map((stat, index) => ({
			...stat,
			order: index + 1,
		}));

		const totalDuration =
			entriesWithTiming.length > 0
				? Math.max(...entriesWithTiming.map((e) => e.endTime)) -
				  minStartTime
				: 0;

		const optimalParallelism =
			resourceStats.reduce((sum, s) => sum + s.parallelism, 0) /
			(resourceStats.length || 1);

		const blockingPercentage =
			entries.length > 0
				? (resourceStats.reduce((sum, s) => sum + s.blockingCount, 0) /
						entries.length) *
				  100
				: 0;

		const criticalResourceTypes = ["document", "script", "stylesheet"];
		const criticalResources = loadSequence.filter((s) =>
			criticalResourceTypes.includes(s.resourceType)
		);

		return {
			loadSequence,
			totalDuration,
			optimalParallelism,
			blockingPercentage,
			criticalResources,
		};
	}, [entries]);

	return (
		<div className="space-y-4">
			<h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
				<Layers className="w-5 h-5" />
				Resource Loading Sequence
			</h3>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Total Load Time</p>
					<p className="text-2xl font-bold text-foreground">
						{formatTime(analysis.totalDuration)}
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Avg Parallelism</p>
					<p className="text-2xl font-bold text-accent">
						{analysis.optimalParallelism.toFixed(1)}x
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Blocking Requests</p>
					<p className="text-2xl font-bold text-yellow-500">
						{analysis.blockingPercentage.toFixed(1)}%
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Resource Types</p>
					<p className="text-2xl font-bold text-primary">
						{analysis.loadSequence.length}
					</p>
				</div>
			</div>

			<div className="p-4 bg-card/40 border border-border rounded-lg">
				<h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
					<Clock className="w-4 h-4" />
					Critical Path Resources
				</h4>
				<div className="space-y-2">
					{analysis.criticalResources.map((resource) => (
						<div
							key={resource.resourceType}
							className="flex items-center justify-between p-3 bg-card/20 rounded border border-border"
						>
							<div className="flex items-center gap-3">
								<span className="text-sm font-bold text-muted">
									#{resource.order}
								</span>
								<span
									className={cn(
										"px-3 py-1 rounded text-xs font-bold uppercase",
										getResourceTypeColor(
											resource.resourceType
										)
									)}
								>
									{resource.resourceType}
								</span>
							</div>
							<div className="flex items-center gap-4 text-sm">
								<div>
									<span className="text-muted">Start: </span>
									<span className="text-foreground font-medium">
										{formatTime(resource.avgStartTime)}
									</span>
								</div>
								<div>
									<span className="text-muted">
										Duration:{" "}
									</span>
									<span className="text-foreground font-medium">
										{formatTime(resource.avgDuration)}
									</span>
								</div>
								<div>
									<span className="text-muted">Count: </span>
									<span className="text-foreground font-bold">
										{resource.count}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="overflow-x-auto">
				<h4 className="text-lg font-semibold text-foreground mb-2">
					Load Order & Parallelism
				</h4>
				<table className="w-full border-collapse">
					<thead>
						<tr className="bg-card/60 border-b border-border">
							<th className="text-left p-3 text-sm font-semibold text-foreground">
								Order
							</th>
							<th className="text-left p-3 text-sm font-semibold text-foreground">
								Resource Type
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Count
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Avg Start
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Avg Duration
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Total Size
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Parallelism
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Blocking
							</th>
						</tr>
					</thead>
					<tbody>
						{analysis.loadSequence.map((stat, index) => {
							const blockingRate =
								(stat.blockingCount / stat.count) * 100;
							return (
								<tr
									key={stat.resourceType}
									className={cn(
										"border-b border-border hover:bg-card-hover transition-colors",
										index % 2 === 0
											? "bg-card/20"
											: "bg-card/10"
									)}
								>
									<td className="p-3 text-sm text-muted text-left">
										<span className="px-2 py-1 rounded bg-card font-bold">
											#{stat.order}
										</span>
									</td>
									<td className="p-3">
										<span
											className={cn(
												"px-3 py-1 rounded text-xs font-bold uppercase",
												getResourceTypeColor(
													stat.resourceType
												)
											)}
										>
											{stat.resourceType}
										</span>
									</td>
									<td className="p-3 text-sm text-foreground text-right font-medium">
										{stat.count}
									</td>
									<td className="p-3 text-sm text-muted text-right">
										{formatTime(stat.avgStartTime)}
									</td>
									<td className="p-3 text-sm text-muted text-right">
										{formatTime(stat.avgDuration)}
									</td>
									<td className="p-3 text-sm text-muted text-right">
										{formatBytes(stat.totalSize)}
									</td>
									<td className="p-3 text-sm text-right">
										<span
											className={cn(
												"px-2 py-1 rounded text-xs font-bold",
												stat.parallelism > 3
													? "bg-green-500/20 text-green-500"
													: stat.parallelism > 1
													? "bg-yellow-500/20 text-yellow-500"
													: "bg-red-500/20 text-red-500"
											)}
										>
											{stat.parallelism.toFixed(1)}x
										</span>
									</td>
									<td className="p-3 text-sm text-right">
										<span
											className={cn(
												"px-2 py-1 rounded text-xs font-bold",
												blockingRate > 50
													? "bg-red-500/20 text-red-500"
													: blockingRate > 20
													? "bg-yellow-500/20 text-yellow-500"
													: "bg-green-500/20 text-green-500"
											)}
										>
											{blockingRate.toFixed(0)}%
										</span>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<div className="p-4 bg-card/40 border border-border rounded-lg">
				<h4 className="text-lg font-semibold text-foreground mb-3">
					Loading Timeline Visualization
				</h4>
				<div className="space-y-2">
					{analysis.loadSequence.map((stat) => {
						const startPercent =
							(stat.avgStartTime / analysis.totalDuration) * 100;
						const widthPercent =
							(stat.avgDuration / analysis.totalDuration) * 100;
						return (
							<div
								key={stat.resourceType}
								className="relative h-8 bg-card/20 rounded overflow-hidden"
							>
								<div
									className="absolute h-full flex items-center px-2 text-xs font-bold text-white"
									style={{
										left: `${startPercent}%`,
										width: `${widthPercent}%`,
										background: `linear-gradient(90deg, ${
											stat.resourceType === "document"
												? "#8b5cf6"
												: stat.resourceType === "script"
												? "#eab308"
												: stat.resourceType ===
												  "stylesheet"
												? "#3b82f6"
												: stat.resourceType === "image"
												? "#22c55e"
												: stat.resourceType === "font"
												? "#ec4899"
												: stat.resourceType === "xhr"
												? "#f97316"
												: "#6b7280"
										}, ${
											stat.resourceType === "document"
												? "#6d28d9"
												: stat.resourceType === "script"
												? "#ca8a04"
												: stat.resourceType ===
												  "stylesheet"
												? "#2563eb"
												: stat.resourceType === "image"
												? "#16a34a"
												: stat.resourceType === "font"
												? "#db2777"
												: stat.resourceType === "xhr"
												? "#ea580c"
												: "#4b5563"
										})`,
									}}
								>
									{stat.resourceType}
								</div>
								<span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">
									{formatTime(stat.avgStartTime)}
								</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
