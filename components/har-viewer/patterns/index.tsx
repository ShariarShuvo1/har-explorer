"use client";

import { useMemo, useState } from "react";
import {
	AlertTriangle,
	RefreshCw,
	GitMerge,
	Shield,
	Database,
	TrendingUp,
	Clock,
	Lock,
	Cookie,
	Layers,
	AlertCircle,
	Filter,
	X,
} from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";
import { formatBytes } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { Pattern, PatternFilters } from "./types";
import { SEVERITY_LABELS, THRESHOLDS } from "./constants";
import { extractDomain } from "./utils";
import { detectWaterfallGaps } from "./detectors/waterfall-gaps";
import { detectMixedContent } from "./detectors/mixed-content";
import { detectLargeCookies } from "./detectors/large-cookies";
import { detectApiBatchingOpportunities } from "./detectors/api-batching";
import { detectPriorityMismatches } from "./detectors/priority-mismatch";
import { detectTimingAnomalies } from "./detectors/timing-anomalies";
import { PatternTooltip } from "./pattern-tooltip";
import type { HAREntry } from "@/lib/stores/har-store";

export function PatternAnalyzer() {
	const { entries, setScrollToIndex, setExpandedEntry } = useHarStore();
	const [filters, setFilters] = useState<PatternFilters>({
		severity: new Set(["high", "medium", "low"]),
		types: new Set(),
	});
	const [showFilters, setShowFilters] = useState(false);
	const [tooltipData, setTooltipData] = useState<{
		entry: HAREntry;
		x: number;
		y: number;
		details?: string;
	} | null>(null);

	const allPatterns = useMemo<Pattern[]>(() => {
		if (!entries.length) return [];

		const detected: Pattern[] = [];

		const newDetectors = [
			detectWaterfallGaps,
			detectMixedContent,
			detectLargeCookies,
			detectApiBatchingOpportunities,
			detectPriorityMismatches,
			detectTimingAnomalies,
		];

		for (const detector of newDetectors) {
			const pattern = detector(entries);
			if (pattern) {
				detected.push(pattern);
			}
		}

		const urlMap = new Map<string, number[]>();
		entries.forEach((entry, index) => {
			const url = entry.request.url;
			if (!urlMap.has(url)) {
				urlMap.set(url, []);
			}
			urlMap.get(url)!.push(index);
		});

		const duplicates = Array.from(urlMap.entries()).filter(
			([, indices]) => indices.length > 1
		);
		if (duplicates.length > 0) {
			const allIndices = duplicates.flatMap(([, indices]) => indices);
			detected.push({
				type: "duplicate",
				severity: "medium",
				title: "Duplicate Requests Detected",
				description: `Found ${duplicates.length} URLs requested multiple times`,
				count: duplicates.reduce(
					(sum, [, indices]) => sum + indices.length - 1,
					0
				),
				examples: duplicates.slice(0, 5).map(([url, indices]) => ({
					url,
					index: indices[0],
					details: `${indices.length} times`,
				})),
				recommendation:
					"Consider caching or deduplicating these requests to improve performance",
				impact: `${duplicates.reduce(
					(sum, [, indices]) => sum + indices.length - 1,
					0
				)} redundant requests`,
				allAffectedIndices: allIndices,
			});
		}

		const failedRequests = entries
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) => entry.response.status >= 400);
		if (failedRequests.length > 0) {
			const has5xx = failedRequests.some(
				({ entry }) => entry.response.status >= 500
			);
			detected.push({
				type: "failed",
				severity: has5xx ? "high" : "medium",
				title: "Failed Requests",
				description: `${failedRequests.length} requests failed with 4xx or 5xx status codes`,
				count: failedRequests.length,
				examples: failedRequests
					.slice(0, 5)
					.map(({ entry, index }) => ({
						url: entry.request.url,
						index,
						details: `${entry.response.status} ${entry.response.statusText}`,
					})),
				recommendation:
					"Investigate and fix these failing requests to improve reliability",
				impact: has5xx
					? "Server errors affecting user experience"
					: "Client errors indicate broken links or auth issues",
				allAffectedIndices: failedRequests.map(({ index }) => index),
			});
		}

		const redirects = entries
			.map((entry, index) => ({ entry, index }))
			.filter(
				({ entry }) =>
					entry.response.status >= 300 && entry.response.status < 400
			);
		if (redirects.length > 0) {
			detected.push({
				type: "redirect",
				severity: "low",
				title: "Redirect Chains",
				description: `${redirects.length} requests resulted in redirects`,
				count: redirects.length,
				examples: redirects.slice(0, 5).map(({ entry, index }) => ({
					url: entry.request.url,
					index,
					details: `→ ${entry.response.redirectURL || "unknown"}`,
				})),
				recommendation:
					"Update URLs to point directly to final destinations to reduce latency",
				impact: `Each redirect adds ~100-200ms roundtrip time`,
				allAffectedIndices: redirects.map(({ index }) => index),
			});
		}

		const corsIssues = entries
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) => {
				const hasOrigin = entry.request.headers.some(
					(h) => h.name.toLowerCase() === "origin"
				);
				const hasAccessControl = entry.response.headers.some(
					(h) =>
						h.name.toLowerCase() === "access-control-allow-origin"
				);
				return (
					hasOrigin &&
					!hasAccessControl &&
					entry.response.status === 200
				);
			});
		if (corsIssues.length > 0) {
			detected.push({
				type: "cors",
				severity: "high",
				title: "Potential CORS Issues",
				description: `${corsIssues.length} cross-origin requests missing CORS headers`,
				count: corsIssues.length,
				examples: corsIssues.slice(0, 5).map(({ entry, index }) => ({
					url: entry.request.url,
					index,
					details: extractDomain(entry.request.url),
				})),
				recommendation:
					"Add proper Access-Control-Allow-Origin headers to these resources",
				impact: "Requests may fail in production due to browser CORS policy",
				allAffectedIndices: corsIssues.map(({ index }) => index),
			});
		}

		const uncachedResources = entries
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) => {
				const cacheControl = entry.response.headers.find(
					(h) => h.name.toLowerCase() === "cache-control"
				);
				const expires = entry.response.headers.find(
					(h) => h.name.toLowerCase() === "expires"
				);
				const isStatic =
					entry.request.url.match(
						/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf)$/i
					) !== null;
				return (
					isStatic &&
					(!cacheControl ||
						cacheControl.value.includes("no-cache")) &&
					!expires
				);
			});
		if (uncachedResources.length > 0) {
			const totalSize = uncachedResources.reduce(
				(sum, { entry }) => sum + entry.response.content.size,
				0
			);
			detected.push({
				type: "uncached",
				severity: "medium",
				title: "Missing Cache Headers",
				description: `${uncachedResources.length} static resources without proper cache headers`,
				count: uncachedResources.length,
				examples: uncachedResources
					.slice(0, 5)
					.map(({ entry, index }) => ({
						url: entry.request.url,
						index,
						details: formatBytes(entry.response.content.size),
					})),
				recommendation:
					"Add Cache-Control headers to static assets to improve load times",
				impact: `${formatBytes(totalSize)} redownloaded on every visit`,
				allAffectedIndices: uncachedResources.map(({ index }) => index),
			});
		}

		const sortedByTime = [...entries].sort(
			(a, b) =>
				new Date(a.startedDateTime).getTime() -
				new Date(b.startedDateTime).getTime()
		);
		let sequentialCount = 0;
		const sequentialIndices: number[] = [];
		for (let i = 1; i < sortedByTime.length; i++) {
			const prevEnd =
				new Date(sortedByTime[i - 1].startedDateTime).getTime() +
				sortedByTime[i - 1].time;
			const currentStart = new Date(
				sortedByTime[i].startedDateTime
			).getTime();
			if (currentStart >= prevEnd) {
				sequentialCount++;
				sequentialIndices.push(entries.indexOf(sortedByTime[i]));
			}
		}
		if (
			sequentialCount >
			entries.length * THRESHOLDS.SEQUENTIAL_LOADING_PERCENT
		) {
			detected.push({
				type: "sequential",
				severity: "medium",
				title: "Sequential Loading Pattern",
				description: `${Math.round(
					(sequentialCount / entries.length) * 100
				)}% of requests loaded sequentially`,
				count: sequentialCount,
				examples: [],
				recommendation:
					"Enable HTTP/2 or parallelize resource loading to improve page load time",
				impact: "Requests waiting unnecessarily instead of loading in parallel",
				allAffectedIndices: sequentialIndices,
			});
		}

		return detected.sort((a, b) => {
			const severityOrder = { high: 0, medium: 1, low: 2 };
			return severityOrder[a.severity] - severityOrder[b.severity];
		});
	}, [entries]);

	const patterns = useMemo(() => {
		let filtered = allPatterns;

		if (filters.severity.size < 3) {
			filtered = filtered.filter((p) => filters.severity.has(p.severity));
		}

		if (filters.types.size > 0) {
			filtered = filtered.filter((p) => filters.types.has(p.type));
		}

		return filtered;
	}, [allPatterns, filters]);

	const handleClickExample = (index: number) => {
		setExpandedEntry(index);
		setScrollToIndex(index);
	};

	const handleMouseEnter = (
		e: React.MouseEvent<HTMLButtonElement>,
		entry: HAREntry,
		details?: string
	) => {
		setTooltipData({
			entry,
			x: e.clientX,
			y: e.clientY,
			details,
		});
	};

	const handleMouseLeave = () => {
		setTooltipData(null);
	};

	const toggleSeverityFilter = (severity: "high" | "medium" | "low") => {
		setFilters((prev) => {
			const next = new Set(prev.severity);
			if (next.has(severity)) {
				next.delete(severity);
			} else {
				next.add(severity);
			}
			return { ...prev, severity: next };
		});
	};

	const toggleTypeFilter = (type: Pattern["type"]) => {
		setFilters((prev) => {
			const next = new Set(prev.types);
			if (next.has(type)) {
				next.delete(type);
			} else {
				next.add(type);
			}
			return { ...prev, types: next };
		});
	};

	const clearFilters = () => {
		setFilters({
			severity: new Set(["high", "medium", "low"]),
			types: new Set(),
		});
	};

	const hasActiveFilters =
		filters.severity.size < 3 || filters.types.size > 0;

	if (!allPatterns.length) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center text-muted p-6">
				<TrendingUp className="w-16 h-16 mb-4 text-accent" />
				<p className="text-lg font-medium">No patterns detected</p>
				<p className="text-sm mt-2">Your HAR file looks optimized!</p>
			</div>
		);
	}

	const getIcon = (type: Pattern["type"]) => {
		switch (type) {
			case "duplicate":
				return RefreshCw;
			case "failed":
				return AlertTriangle;
			case "redirect":
				return GitMerge;
			case "cors":
				return Shield;
			case "uncached":
				return Database;
			case "sequential":
				return TrendingUp;
			case "waterfall-gaps":
				return Clock;
			case "mixed-content":
				return Lock;
			case "large-cookies":
				return Cookie;
			case "api-batching":
				return Layers;
			case "priority-mismatch":
				return AlertCircle;
			case "timing-anomalies":
				return Clock;
		}
	};

	const getSeverityColor = (severity: Pattern["severity"]) => {
		switch (severity) {
			case "high":
				return "text-red-500 bg-red-500/10 border-red-500/30";
			case "medium":
				return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
			case "low":
				return "text-blue-500 bg-blue-500/10 border-blue-500/30";
		}
	};

	return (
		<div className="flex-1 overflow-auto p-6 space-y-6">
			<div className="flex items-start justify-between">
				<div>
					<h2 className="text-2xl font-bold text-foreground">
						Pattern Analysis
					</h2>
					<p className="text-sm text-muted mt-1">
						Detected {allPatterns.length} potential issues or
						patterns
						{patterns.length !== allPatterns.length &&
							` (showing ${patterns.length} filtered)`}
					</p>
				</div>

				<button
					onClick={() => setShowFilters(!showFilters)}
					className={cn(
						"flex items-center gap-2 px-3 py-2 rounded border transition-colors",
						showFilters
							? "bg-accent/20 border-accent text-foreground"
							: "bg-card border-border text-muted hover:text-foreground hover:border-accent"
					)}
				>
					<Filter className="w-4 h-4" />
					<span className="text-sm font-medium">Filters</span>
					{hasActiveFilters && (
						<span className="px-1.5 py-0.5 rounded-full bg-accent text-xs font-bold">
							{3 - filters.severity.size + filters.types.size}
						</span>
					)}
				</button>
			</div>

			{showFilters && (
				<div className="p-4 bg-card border border-border rounded-lg space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-semibold text-foreground">
							Filter Patterns
						</h3>
						{hasActiveFilters && (
							<button
								onClick={clearFilters}
								className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
							>
								<X className="w-3 h-3" />
								Clear
							</button>
						)}
					</div>

					<div>
						<p className="text-xs font-medium text-muted uppercase mb-2">
							Severity
						</p>
						<div className="flex flex-wrap gap-2">
							{(
								["high", "medium", "low"] as Array<
									"high" | "medium" | "low"
								>
							).map((severity) => (
								<button
									key={severity}
									onClick={() =>
										toggleSeverityFilter(severity)
									}
									className={cn(
										"px-3 py-1.5 rounded border text-sm font-medium transition-colors",
										filters.severity.has(severity)
											? severity === "high"
												? "bg-red-500/20 border-red-500/50 text-red-500"
												: severity === "medium"
												? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500"
												: "bg-blue-500/20 border-blue-500/50 text-blue-500"
											: "bg-card border-border text-muted hover:border-accent"
									)}
								>
									{SEVERITY_LABELS[severity]}
								</button>
							))}
						</div>
					</div>

					{allPatterns.length > 0 && (
						<div>
							<p className="text-xs font-medium text-muted uppercase mb-2">
								Pattern Types
							</p>
							<div className="flex flex-wrap gap-2">
								{Array.from(
									new Set(allPatterns.map((p) => p.type))
								).map((type) => {
									const pattern = allPatterns.find(
										(p) => p.type === type
									)!;
									const Icon = getIcon(type);
									return (
										<button
											key={type}
											onClick={() =>
												toggleTypeFilter(type)
											}
											className={cn(
												"flex items-center gap-2 px-3 py-1.5 rounded border text-sm transition-colors",
												filters.types.has(type)
													? "bg-accent/20 border-accent text-foreground"
													: "bg-card border-border text-muted hover:text-foreground hover:border-accent"
											)}
										>
											<Icon className="w-3.5 h-3.5" />
											<span>{pattern.title}</span>
										</button>
									);
								})}
							</div>
						</div>
					)}
				</div>
			)}

			{patterns.length === 0 && hasActiveFilters ? (
				<div className="flex-1 flex flex-col items-center justify-center text-muted p-6">
					<Filter className="w-16 h-16 mb-4 text-muted/50" />
					<p className="text-lg font-medium">
						No patterns match filters
					</p>
					<button
						onClick={clearFilters}
						className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-foreground rounded border border-border transition-colors"
					>
						Clear Filters
					</button>
				</div>
			) : (
				<div className="space-y-4">
					{patterns.map((pattern, patternIndex) => {
						const Icon = getIcon(pattern.type);

						return (
							<div
								key={patternIndex}
								className={cn(
									"p-3 border rounded-lg transition-all",
									getSeverityColor(pattern.severity)
								)}
							>
								<div className="flex items-start gap-3">
									<div className="p-2.5 rounded bg-card/40 shrink-0">
										<Icon className="w-5 h-5" />
									</div>
									<div className="flex-1 space-y-2.5 min-w-0">
										<div>
											<div className="flex items-center gap-2 mb-1 flex-wrap">
												<h3 className="text-base font-semibold text-foreground">
													{pattern.title}
												</h3>
												<span className="px-1.5 py-0.5 rounded text-xs font-bold uppercase">
													{pattern.severity}
												</span>
											</div>
											<p className="text-sm text-foreground/80">
												{pattern.description}
											</p>
											{pattern.impact && (
												<p className="text-xs text-foreground/70 mt-0.5 font-medium">
													Impact: {pattern.impact}
												</p>
											)}
										</div>

										{pattern.allAffectedIndices &&
											pattern.allAffectedIndices.length >
												0 && (
												<div className="space-y-1.5">
													<p className="text-xs font-medium text-muted uppercase">
														Affected Requests (
														{
															pattern
																.allAffectedIndices
																.length
														}
														)
													</p>
													<div className="space-y-1 max-h-48 overflow-y-auto">
														{pattern.allAffectedIndices.map(
															(idx) => {
																const entry =
																	entries[
																		idx
																	];
																const exampleData =
																	pattern.examples.find(
																		(ex) =>
																			ex.index ===
																			idx
																	);
																return (
																	<button
																		key={
																			idx
																		}
																		onClick={() =>
																			handleClickExample(
																				idx
																			)
																		}
																		onMouseEnter={(
																			e
																		) =>
																			handleMouseEnter(
																				e,
																				entry,
																				exampleData?.details
																			)
																		}
																		onMouseLeave={
																			handleMouseLeave
																		}
																		className="w-full text-left p-1.5 bg-card/40 hover:bg-card-hover rounded border border-border transition-colors group"
																		title={
																			entry
																				.request
																				.url
																		}
																	>
																		<div className="flex items-center gap-2">
																			<span
																				className={cn(
																					"px-1.5 py-0.5 rounded text-xs font-medium shrink-0",
																					entry
																						.response
																						.status >=
																						200 &&
																						entry
																							.response
																							.status <
																							300
																						? "bg-green-500/20 text-green-500"
																						: entry
																								.response
																								.status >=
																						  400
																						? "bg-red-500/20 text-red-500"
																						: "bg-blue-500/20 text-blue-500"
																				)}
																			>
																				{
																					entry
																						.response
																						.status
																				}
																			</span>
																			<span className="text-xs font-mono text-foreground truncate flex-1">
																				{
																					entry
																						.request
																						.url
																				}
																			</span>
																		</div>
																		{exampleData?.details && (
																			<p className="text-xs text-muted mt-0.5 ml-12">
																				{
																					exampleData.details
																				}
																			</p>
																		)}
																	</button>
																);
															}
														)}
													</div>
												</div>
											)}

										<div className="p-2.5 bg-card/60 rounded border border-border">
											<p className="text-xs font-medium text-muted mb-0.5">
												Recommendation:
											</p>
											<p className="text-xs text-foreground leading-relaxed">
												{pattern.recommendation}
											</p>
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
			{tooltipData && (
				<PatternTooltip
					entry={tooltipData.entry}
					x={tooltipData.x}
					y={tooltipData.y}
					details={tooltipData.details}
				/>
			)}
		</div>
	);
}
