"use client";

import { useMemo } from "react";
import {
	BarChart,
	Bar,
	PieChart,
	Pie,
	Cell,
	ResponsiveContainer,
	XAxis,
	YAxis,
	Tooltip,
} from "recharts";
import {
	Clock,
	HardDrive,
	CheckCircle,
	XCircle,
	Globe,
	Zap,
} from "lucide-react";
import { useHarStore, getResourceType } from "@/lib/stores/har-store";
import { formatBytes, formatTime, extractDomain } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { ProtocolAnalysis } from "./protocol-analysis";
import { BandwidthTimeline } from "./bandwidth-timeline";
import { ThirdPartyImpact } from "./third-party-impact";
import { ImageOptimization } from "./image-optimization";
import { getTooltipStyle } from "./custom-tooltip";

export function AnalyticsDashboard() {
	const { entries } = useHarStore();

	const analytics = useMemo(() => {
		if (!entries.length) return null;

		const totalSize = entries.reduce(
			(sum, e) => sum + e.response.content.size,
			0
		);
		const totalTime = entries.reduce((sum, e) => sum + e.time, 0);
		const avgTime = totalTime / entries.length;

		const successCount = entries.filter(
			(e) => e.response.status >= 200 && e.response.status < 300
		).length;
		const errorCount = entries.filter(
			(e) => e.response.status >= 400
		).length;
		const cacheableCount = entries.filter((e) => {
			const cacheControl = e.response.headers.find(
				(h) => h.name.toLowerCase() === "cache-control"
			);
			return cacheControl && !cacheControl.value.includes("no-cache");
		}).length;

		const domainMap = new Map<string, { count: number; size: number }>();
		entries.forEach((entry) => {
			const domain = extractDomain(entry.request.url);
			const existing = domainMap.get(domain) || { count: 0, size: 0 };
			domainMap.set(domain, {
				count: existing.count + 1,
				size: existing.size + entry.response.content.size,
			});
		});

		const domainData = Array.from(domainMap.entries())
			.map(([domain, data]) => ({ domain, ...data }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		const typeMap = new Map<string, number>();
		entries.forEach((entry) => {
			const type = getResourceType(entry);
			typeMap.set(type, (typeMap.get(type) || 0) + 1);
		});

		const typeData = Array.from(typeMap.entries())
			.map(([type, count]) => ({ type, count }))
			.filter(({ type }) => type !== "all")
			.sort((a, b) => b.count - a.count);

		const timingPhases = {
			dns: entries.reduce(
				(sum, e) => sum + (e.timings.dns > 0 ? e.timings.dns : 0),
				0
			),
			connect: entries.reduce(
				(sum, e) =>
					sum + (e.timings.connect > 0 ? e.timings.connect : 0),
				0
			),
			ssl: entries.reduce(
				(sum, e) => sum + (e.timings.ssl > 0 ? e.timings.ssl : 0),
				0
			),
			send: entries.reduce((sum, e) => sum + e.timings.send, 0),
			wait: entries.reduce((sum, e) => sum + e.timings.wait, 0),
			receive: entries.reduce((sum, e) => sum + e.timings.receive, 0),
		};

		const timingData = Object.entries(timingPhases)
			.map(([phase, time]) => ({ phase, time: Math.round(time) }))
			.filter(({ time }) => time > 0);

		const slowestRequests = [...entries]
			.sort((a, b) => b.time - a.time)
			.slice(0, 5)
			.map((entry, index) => ({
				index,
				url: entry.request.url,
				time: entry.time,
				size: entry.response.content.size,
				status: entry.response.status,
			}));

		return {
			totalSize,
			totalTime,
			avgTime,
			successCount,
			errorCount,
			cacheableCount,
			totalRequests: entries.length,
			domainData,
			typeData,
			timingData,
			slowestRequests,
		};
	}, [entries]);

	if (!analytics) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted">
				<p>No data to analyze</p>
			</div>
		);
	}

	const COLORS = [
		"#00ffff",
		"#ff00ff",
		"#00ff88",
		"#ffaa00",
		"#ff5555",
		"#5555ff",
		"#55ff55",
		"#ff55ff",
		"#55ffff",
		"#ffff55",
	];

	const tooltipStyle = getTooltipStyle();

	return (
		<div className="flex-1 overflow-auto p-6 space-y-8">
			<h2 className="text-2xl font-bold text-foreground">
				Performance Analytics
			</h2>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-primary/20 rounded">
							<Globe className="w-5 h-5 text-primary" />
						</div>
						<div>
							<p className="text-xs text-muted">Total Requests</p>
							<p className="text-2xl font-bold text-foreground">
								{analytics.totalRequests}
							</p>
						</div>
					</div>
				</div>

				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-accent/20 rounded">
							<HardDrive className="w-5 h-5 text-accent" />
						</div>
						<div>
							<p className="text-xs text-muted">Total Size</p>
							<p className="text-2xl font-bold text-foreground">
								{formatBytes(analytics.totalSize)}
							</p>
						</div>
					</div>
				</div>

				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-secondary/20 rounded">
							<Clock className="w-5 h-5 text-secondary" />
						</div>
						<div>
							<p className="text-xs text-muted">
								Avg Response Time
							</p>
							<p className="text-2xl font-bold text-foreground">
								{formatTime(analytics.avgTime)}
							</p>
						</div>
					</div>
				</div>

				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-accent/20 rounded">
							<Zap className="w-5 h-5 text-accent" />
						</div>
						<div>
							<p className="text-xs text-muted">Cache Hit Rate</p>
							<p className="text-2xl font-bold text-foreground">
								{Math.round(
									(analytics.cacheableCount /
										analytics.totalRequests) *
										100
								)}
								%
							</p>
						</div>
					</div>
				</div>

				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-green-500/20 rounded">
							<CheckCircle className="w-5 h-5 text-green-500" />
						</div>
						<div>
							<p className="text-xs text-muted">
								Successful (2xx)
							</p>
							<p className="text-2xl font-bold text-foreground">
								{analytics.successCount}
							</p>
						</div>
					</div>
				</div>

				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-red-500/20 rounded">
							<XCircle className="w-5 h-5 text-red-500" />
						</div>
						<div>
							<p className="text-xs text-muted">
								Errors (4xx/5xx)
							</p>
							<p className="text-2xl font-bold text-foreground">
								{analytics.errorCount}
							</p>
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<h3 className="text-lg font-semibold text-foreground mb-4">
						Resource Type Distribution
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<PieChart>
							<Pie
								data={analytics.typeData}
								dataKey="count"
								nameKey="type"
								cx="50%"
								cy="50%"
								outerRadius={100}
								label
							>
								{analytics.typeData.map((_, index) => (
									<Cell
										key={`cell-${index}`}
										fill={COLORS[index % COLORS.length]}
									/>
								))}
							</Pie>
							<Tooltip {...tooltipStyle} />
						</PieChart>
					</ResponsiveContainer>
				</div>

				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<h3 className="text-lg font-semibold text-foreground mb-4">
						Top Domains by Request Count
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={analytics.domainData}>
							<XAxis
								dataKey="domain"
								angle={-45}
								textAnchor="end"
								height={100}
								tick={{ fontSize: 10 }}
							/>
							<YAxis />
							<Tooltip {...tooltipStyle} />
							<Bar dataKey="count" fill="#00ffff" />
						</BarChart>
					</ResponsiveContainer>
				</div>

				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<h3 className="text-lg font-semibold text-foreground mb-4">
						Timing Breakdown
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={analytics.timingData}>
							<XAxis dataKey="phase" />
							<YAxis />
							<Tooltip {...tooltipStyle} />
							<Bar dataKey="time" fill="#ff00ff" />
						</BarChart>
					</ResponsiveContainer>
				</div>

				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<h3 className="text-lg font-semibold text-foreground mb-4">
						Slowest Requests
					</h3>
					<div className="space-y-2">
						{analytics.slowestRequests.map((req) => (
							<div
								key={req.index}
								className="p-3 bg-card rounded border border-border hover:bg-card-hover transition-colors"
							>
								<div className="flex items-center justify-between mb-1">
									<span
										className={cn(
											"px-2 py-1 rounded text-xs font-bold",
											req.status >= 200 &&
												req.status < 300 &&
												"bg-green-500/20 text-green-500",
											req.status >= 400 &&
												"bg-red-500/20 text-red-500"
										)}
									>
										{req.status}
									</span>
									<span className="text-sm font-mono font-bold text-secondary">
										{formatTime(req.time)}
									</span>
								</div>
								<p className="text-xs text-muted truncate font-mono">
									{req.url}
								</p>
								<p className="text-xs text-muted mt-1">
									{formatBytes(req.size)}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>

			<ProtocolAnalysis entries={entries} />

			<BandwidthTimeline entries={entries} />

			<ThirdPartyImpact entries={entries} />

			<ImageOptimization entries={entries} />
		</div>
	);
}
