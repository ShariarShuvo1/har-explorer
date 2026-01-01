"use client";

import { useMemo } from "react";
import {
	BarChart,
	Bar,
	ResponsiveContainer,
	XAxis,
	YAxis,
	Tooltip,
	Legend,
	PieChart,
	Pie,
	Cell,
} from "recharts";
import { Network, Zap, TrendingUp } from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { getTooltipStyle } from "./custom-tooltip";

interface ProtocolAnalysisProps {
	entries: HAREntry[];
}

export function ProtocolAnalysis({ entries }: ProtocolAnalysisProps) {
	const protocolData = useMemo(() => {
		if (!entries.length) return null;

		const protocolMap = new Map<
			string,
			{
				count: number;
				totalTime: number;
				totalSize: number;
				connections: Set<string>;
			}
		>();

		entries.forEach((entry) => {
			const version = entry.request.httpVersion || "Unknown";
			const existing = protocolMap.get(version) || {
				count: 0,
				totalTime: 0,
				totalSize: 0,
				connections: new Set<string>(),
			};

			existing.count++;
			existing.totalTime += entry.time;
			existing.totalSize += entry.response.content.size;
			if (entry.connection) {
				existing.connections.add(entry.connection);
			}

			protocolMap.set(version, existing);
		});

		const protocols = Array.from(protocolMap.entries())
			.map(([version, data]) => ({
				version,
				count: data.count,
				avgTime: Math.round(data.totalTime / data.count),
				avgSize: Math.round(data.totalSize / data.count),
				totalSize: data.totalSize,
				connectionReuse: data.count - data.connections.size,
				reuseRate:
					data.connections.size > 0
						? Math.round(
								((data.count - data.connections.size) /
									data.count) *
									100
						  )
						: 0,
			}))
			.sort((a, b) => b.count - a.count);

		const comparison = protocols.map((p) => ({
			version: p.version,
			"Avg Time (ms)": p.avgTime,
			"Avg Size (KB)": Math.round(p.avgSize / 1024),
		}));

		const distribution = protocols.map((p) => ({
			version: p.version,
			count: p.count,
			percentage: Math.round((p.count / entries.length) * 100),
		}));

		return {
			protocols,
			comparison,
			distribution,
			hasMultipleProtocols: protocols.length > 1,
		};
	}, [entries]);

	if (!protocolData) {
		return null;
	}

	const COLORS = ["#00ffff", "#ff00ff", "#00ff88", "#ffaa00", "#ff5555"];
	const tooltipStyle = getTooltipStyle();

	return (
		<div className="space-y-6">
			<div>
				<div className="flex items-center gap-2 mb-4">
					<Network className="w-5 h-5 text-primary" />
					<h3 className="text-xl font-semibold text-foreground">
						Protocol Performance Analysis
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
					{protocolData.protocols.map((protocol, index) => (
						<div
							key={protocol.version}
							className="p-4 bg-card/40 border border-border rounded-lg"
						>
							<div className="flex items-center justify-between mb-3">
								<span className="text-sm font-semibold text-muted">
									{protocol.version}
								</span>
								<span
									className="px-2 py-1 rounded text-xs font-bold"
									style={{
										backgroundColor: `${
											COLORS[index % COLORS.length]
										}20`,
										color: COLORS[index % COLORS.length],
									}}
								>
									{protocol.count} requests
								</span>
							</div>
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-xs text-muted">
										Avg Response Time
									</span>
									<span className="text-sm font-medium text-foreground">
										{formatTime(protocol.avgTime)}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-xs text-muted">
										Avg Size
									</span>
									<span className="text-sm font-medium text-foreground">
										{formatBytes(protocol.avgSize)}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-xs text-muted">
										Connection Reuse
									</span>
									<span className="text-sm font-medium text-accent">
										{protocol.reuseRate}%
									</span>
								</div>
							</div>
						</div>
					))}
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
							<Zap className="w-4 h-4 text-secondary" />
							Performance Comparison
						</h4>
						<ResponsiveContainer width="100%" height={250}>
							<BarChart data={protocolData.comparison}>
								<XAxis
									dataKey="version"
									tick={{ fill: "var(--foreground)" }}
								/>
								<YAxis tick={{ fill: "var(--muted)" }} />
								<Tooltip {...tooltipStyle} />
								<Legend
									wrapperStyle={{
										color: "var(--foreground)",
									}}
								/>
								<Bar
									dataKey="Avg Time (ms)"
									fill="#ff00ff"
									radius={[4, 4, 0, 0]}
								/>
								<Bar
									dataKey="Avg Size (KB)"
									fill="#00ffff"
									radius={[4, 4, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
							<TrendingUp className="w-4 h-4 text-accent" />
							Protocol Distribution
						</h4>
						<ResponsiveContainer width="100%" height={250}>
							<PieChart>
								<Pie
									data={protocolData.distribution}
									dataKey="count"
									nameKey="version"
									cx="50%"
									cy="50%"
									outerRadius={80}
									label
								>
									{protocolData.distribution.map(
										(_, index) => (
											<Cell
												key={`cell-${index}`}
												fill={
													COLORS[
														index % COLORS.length
													]
												}
											/>
										)
									)}
								</Pie>
								<Tooltip {...tooltipStyle} />
							</PieChart>
						</ResponsiveContainer>
					</div>
				</div>

				{protocolData.hasMultipleProtocols && (
					<div className="mt-4 p-4 bg-accent/10 border border-accent/30 rounded-lg">
						<p className="text-sm text-foreground">
							<span className="font-semibold">Insight:</span>{" "}
							Multiple HTTP versions detected. HTTP/2 and HTTP/3
							typically offer better performance through
							multiplexing and header compression.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
