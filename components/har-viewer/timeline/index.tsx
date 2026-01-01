"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useHarStore, getResourceType } from "@/lib/stores/har-store";
import { formatTime, formatBytes, extractDomain } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import {
	Clock,
	Download,
	Upload,
	Activity,
	Layers,
	Globe,
	X,
	ChevronDown,
	ChevronRight,
	List,
} from "lucide-react";
import { TimingTooltip } from "./timing-tooltip";
import { ComparisonPanel } from "./comparison-panel";
import { TimelineRow } from "./timeline-row";
import { TIMING_COLORS, DOMAIN_COLORS } from "./constants";
import type { TimelineEntry, TooltipData } from "./types";

export function NetworkTimeline() {
	const {
		entries,
		resourceTypeFilter,
		searchText,
		showTimeline,
		setExpandedEntry,
		setScrollToIndex,
		timelineGroupMode,
		timelineHoveredEntry,
		timelineSelectedForComparison,
		expandedDomainGroups,
		setTimelineGroupMode,
		setTimelineHoveredEntry,
		setTimelineSelectedForComparison,
		toggleComparisonEntry,
		toggleDomainGroup,
	} = useHarStore();

	const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
	const timelineContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			if (
				timelineContainerRef.current &&
				!timelineContainerRef.current.contains(e.target as Node) &&
				timelineSelectedForComparison
			) {
				setTimelineSelectedForComparison(null);
			}
		};

		document.addEventListener("click", handleOutsideClick);
		return () => {
			document.removeEventListener("click", handleOutsideClick);
		};
	}, [setTimelineSelectedForComparison, timelineSelectedForComparison]);

	const timelineData = useMemo(() => {
		let filtered = entries;

		if (resourceTypeFilter !== "all") {
			filtered = entries.filter(
				(entry) => getResourceType(entry) === resourceTypeFilter
			);
		}

		if (searchText) {
			const search = searchText.toLowerCase();
			filtered = filtered.filter(
				(entry) =>
					entry.request.url.toLowerCase().includes(search) ||
					entry.request.method.toLowerCase().includes(search) ||
					entry.response.status.toString().includes(search)
			);
		}

		if (filtered.length === 0) return null;

		const startTimes = filtered.map((entry) =>
			new Date(entry.startedDateTime).getTime()
		);
		const minTime = Math.min(...startTimes);
		const maxTime = Math.max(
			...filtered.map((entry, i) => startTimes[i] + entry.time)
		);
		const totalDuration = maxTime - minTime;

		const totalSize = filtered.reduce(
			(acc, entry) => acc + (entry.response.content.size || 0),
			0
		);
		const totalRequests = filtered.length;
		const avgTime =
			filtered.reduce((acc, entry) => acc + entry.time, 0) /
			filtered.length;

		const timelineEntries: TimelineEntry[] = filtered.map(
			(entry, index) => {
				const startTime = startTimes[index];
				const endTime = startTime + entry.time;
				const offset = ((startTime - minTime) / totalDuration) * 100;
				const duration = (entry.time / totalDuration) * 100;

				const segments = [
					{ type: "blocked", value: entry.timings.blocked || 0 },
					{ type: "dns", value: entry.timings.dns || 0 },
					{ type: "connect", value: entry.timings.connect || 0 },
					{ type: "ssl", value: entry.timings.ssl || 0 },
					{ type: "send", value: entry.timings.send || 0 },
					{ type: "wait", value: entry.timings.wait || 0 },
					{ type: "receive", value: entry.timings.receive || 0 },
				].filter((s) => s.value > 0);

				return {
					entry,
					originalIndex: entries.indexOf(entry),
					offset,
					duration,
					segments,
					total: entry.time,
					startTime,
					endTime,
				};
			}
		);

		const domains = [
			...new Set(filtered.map((e) => extractDomain(e.request.url))),
		];
		const domainColorMap = new Map(
			domains.map((d, i) => [d, DOMAIN_COLORS[i % DOMAIN_COLORS.length]])
		);

		const groupedByDomain = new Map<string, TimelineEntry[]>();
		timelineEntries.forEach((te) => {
			const domain = extractDomain(te.entry.request.url);
			const existing = groupedByDomain.get(domain) || [];
			existing.push(te);
			groupedByDomain.set(domain, existing);
		});

		const groupedByType = new Map<string, TimelineEntry[]>();
		timelineEntries.forEach((te) => {
			const type = getResourceType(te.entry);
			const existing = groupedByType.get(type) || [];
			existing.push(te);
			groupedByType.set(type, existing);
		});

		return {
			entries: timelineEntries,
			totalDuration,
			minTime,
			maxTime,
			stats: {
				totalSize,
				totalRequests,
				avgTime,
				totalTime: totalDuration,
			},
			domainColorMap,
			groupedByDomain,
			groupedByType,
		};
	}, [entries, resourceTypeFilter, searchText]);

	if (!showTimeline || !timelineData) return null;

	const {
		entries: timelineEntries,
		stats,
		domainColorMap,
		groupedByDomain,
		groupedByType,
	} = timelineData;

	const handleEntryMouseEnter = (e: React.MouseEvent, te: TimelineEntry) => {
		setTimelineHoveredEntry(te.originalIndex);
		setTooltipData({
			entry: te.entry,
			x: e.clientX,
			y: e.clientY,
			segments: te.segments,
		});
	};

	const handleEntryMouseLeave = () => {
		setTimelineHoveredEntry(null);
		setTooltipData(null);
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (tooltipData) {
			setTooltipData({ ...tooltipData, x: e.clientX, y: e.clientY });
		}
	};

	const handleEntryClick = (te: TimelineEntry, e: React.MouseEvent) => {
		e.stopPropagation();
		if (e.altKey) {
			toggleComparisonEntry(te.originalIndex);
		} else {
			setExpandedEntry(te.originalIndex);
			setScrollToIndex(te.originalIndex);
			setTimelineSelectedForComparison(null);
		}
	};

	const renderDetailedView = () => {
		const groupData =
			timelineGroupMode === "domain"
				? groupedByDomain
				: timelineGroupMode === "type"
				? groupedByType
				: null;

		return (
			<div className="px-6 py-4 max-h-64 overflow-y-auto">
				<div className="space-y-2">
					{timelineGroupMode === "none"
						? timelineEntries.map((te) => (
								<TimelineRow
									key={te.originalIndex}
									te={te}
									isHighlighted={false}
									isHovered={
										timelineHoveredEntry ===
										te.originalIndex
									}
									isComparing={timelineSelectedForComparison?.includes(
										te.originalIndex
									)}
									hasAnyHover={timelineHoveredEntry !== null}
									onMouseEnter={(e) =>
										handleEntryMouseEnter(e, te)
									}
									onMouseLeave={handleEntryMouseLeave}
									onMouseMove={handleMouseMove}
									onClick={(e) => handleEntryClick(te, e)}
								/>
						  ))
						: groupData &&
						  [...groupData.entries()].map(
								([groupName, groupEntries]) => {
									const isTypeGroup =
										timelineGroupMode === "type";
									const color = isTypeGroup
										? undefined
										: domainColorMap.get(groupName);

									return (
										<div
											key={groupName}
											className="space-y-1"
										>
											<button
												onClick={() =>
													toggleDomainGroup(groupName)
												}
												className="flex items-center gap-2 w-full text-left py-1 hover:bg-card-hover rounded px-2 -mx-2"
											>
												{expandedDomainGroups.has(
													groupName
												) ? (
													<ChevronDown className="w-3 h-3 text-muted" />
												) : (
													<ChevronRight className="w-3 h-3 text-muted" />
												)}
												<div
													className={cn(
														"w-2 h-2 rounded",
														color
													)}
												/>
												<span className="text-xs font-medium text-foreground">
													{groupName}
												</span>
												<span className="text-xs text-muted">
													({groupEntries.length})
												</span>
												<span className="text-xs text-muted ml-auto">
													{formatTime(
														groupEntries.reduce(
															(acc, e) =>
																acc + e.total,
															0
														)
													)}
												</span>
											</button>
											{expandedDomainGroups.has(
												groupName
											) && (
												<div className="pl-4 space-y-1.5 border-l-2 border-border/30 ml-1.5">
													{groupEntries.map((te) => (
														<TimelineRow
															key={
																te.originalIndex
															}
															te={te}
															isHighlighted={
																false
															}
															isHovered={
																timelineHoveredEntry ===
																te.originalIndex
															}
															isComparing={timelineSelectedForComparison?.includes(
																te.originalIndex
															)}
															hasAnyHover={
																timelineHoveredEntry !==
																null
															}
															onMouseEnter={(e) =>
																handleEntryMouseEnter(
																	e,
																	te
																)
															}
															onMouseLeave={
																handleEntryMouseLeave
															}
															onMouseMove={
																handleMouseMove
															}
															onClick={(e) =>
																handleEntryClick(
																	te,
																	e
																)
															}
														/>
													))}
												</div>
											)}
										</div>
									);
								}
						  )}
				</div>
			</div>
		);
	};

	return (
		<div
			ref={timelineContainerRef}
			className="border-b border-border bg-card/30 backdrop-blur-sm relative"
		>
			<div className="px-6 py-3 border-b border-border/50">
				<div className="flex items-center justify-between">
					<div className="grid grid-cols-4 gap-4 flex-1">
						<div className="flex items-center gap-2">
							<Activity className="w-4 h-4 text-primary" />
							<div>
								<div className="text-xs text-muted">
									Requests
								</div>
								<div className="text-sm font-semibold text-foreground">
									{stats.totalRequests}
								</div>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Download className="w-4 h-4 text-blue-500" />
							<div>
								<div className="text-xs text-muted">
									Transferred
								</div>
								<div className="text-sm font-semibold text-foreground">
									{formatBytes(stats.totalSize)}
								</div>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Clock className="w-4 h-4 text-green-500" />
							<div>
								<div className="text-xs text-muted">
									Load Time
								</div>
								<div className="text-sm font-semibold text-foreground">
									{formatTime(stats.totalTime)}
								</div>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Upload className="w-4 h-4 text-orange-500" />
							<div>
								<div className="text-xs text-muted">
									Avg Time
								</div>
								<div className="text-sm font-semibold text-foreground">
									{formatTime(stats.avgTime)}
								</div>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-1 ml-4">
						<div className="flex items-center gap-0.5 bg-card-hover/50 rounded p-0.5">
							<button
								onClick={() => setTimelineGroupMode("none")}
								className={cn(
									"p-1.5 rounded transition-all",
									timelineGroupMode === "none"
										? "bg-primary text-background shadow-sm"
										: "text-muted hover:text-foreground hover:bg-card-hover"
								)}
								title="List view (default)"
							>
								<List className="w-4 h-4" />
							</button>

							<button
								onClick={() => setTimelineGroupMode("domain")}
								className={cn(
									"p-1.5 rounded transition-all",
									timelineGroupMode === "domain"
										? "bg-primary text-background shadow-sm"
										: "text-muted hover:text-foreground hover:bg-card-hover"
								)}
								title="Group by domain"
							>
								<Globe className="w-4 h-4" />
							</button>

							<button
								onClick={() => setTimelineGroupMode("type")}
								className={cn(
									"p-1.5 rounded transition-all",
									timelineGroupMode === "type"
										? "bg-primary text-background shadow-sm"
										: "text-muted hover:text-foreground hover:bg-card-hover"
								)}
								title="Group by type"
							>
								<Layers className="w-4 h-4" />
							</button>
						</div>

						{timelineSelectedForComparison && (
							<button
								onClick={() =>
									setTimelineSelectedForComparison(null)
								}
								className="p-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
								title="Clear comparison"
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>
			</div>

			{renderDetailedView()}

			<div className="px-6 py-2 border-t border-border/50 bg-card/20">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4 text-xs">
						{Object.entries(TIMING_COLORS).map(([type, color]) => (
							<div
								key={type}
								className="flex items-center gap-1.5"
							>
								<div className={cn("w-3 h-3 rounded", color)} />
								<span className="text-muted capitalize">
									{type}
								</span>
							</div>
						))}
					</div>
					<div className="text-xs text-muted">
						<span className="text-primary">Alt+Click</span> to
						compare requests
					</div>
				</div>
			</div>

			{tooltipData && <TimingTooltip data={tooltipData} />}

			{timelineSelectedForComparison && (
				<ComparisonPanel
					entries={entries}
					indices={timelineSelectedForComparison}
					onClose={() => setTimelineSelectedForComparison(null)}
				/>
			)}
		</div>
	);
}
