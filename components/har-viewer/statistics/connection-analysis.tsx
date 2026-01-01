"use client";

import { useMemo } from "react";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { Network, Zap } from "lucide-react";
import type { HAREntry } from "@/lib/stores/har-store";
import type { ConnectionStats } from "./types";

interface ConnectionAnalysisProps {
	entries: HAREntry[];
}

export function ConnectionAnalysis({ entries }: ConnectionAnalysisProps) {
	const analysis = useMemo(() => {
		const connectionMap = new Map<string, ConnectionStats>();
		const protocolConnectionCount = new Map<string, Set<string>>();

		let totalConnections = 0;
		let reusedConnections = 0;

		entries.forEach((entry) => {
			const connectionId = entry.connection || "unknown";
			const protocol =
				entry.response.httpVersion ||
				entry.request.httpVersion ||
				"HTTP/1.1";

			if (!protocolConnectionCount.has(protocol)) {
				protocolConnectionCount.set(protocol, new Set());
			}
			protocolConnectionCount.get(protocol)!.add(connectionId);

			const existing = connectionMap.get(connectionId) || {
				connection: connectionId,
				requestCount: 0,
				domains: new Set<string>(),
				totalSize: 0,
				avgTime: 0,
				protocol: protocol,
				reused: false,
			};

			existing.requestCount++;
			existing.totalSize += entry.response.content.size;
			existing.avgTime += entry.time;

			const url = new URL(entry.request.url);
			existing.domains.add(url.hostname);

			if (existing.requestCount > 1) {
				existing.reused = true;
			}

			connectionMap.set(connectionId, existing);
		});

		const connectionStats = Array.from(connectionMap.values())
			.map((stat) => ({
				...stat,
				avgTime: stat.avgTime / stat.requestCount,
			}))
			.sort((a, b) => b.requestCount - a.requestCount);

		connectionStats.forEach((stat) => {
			totalConnections++;
			if (stat.reused) reusedConnections++;
		});

		const reuseRate =
			totalConnections > 0
				? (reusedConnections / totalConnections) * 100
				: 0;

		const avgRequestsPerConnection =
			connectionStats.reduce((sum, stat) => sum + stat.requestCount, 0) /
			(totalConnections || 1);

		const protocolStats = Array.from(protocolConnectionCount.entries()).map(
			([protocol, connections]) => ({
				protocol,
				connectionCount: connections.size,
				avgRequestsPerConnection:
					entries.filter(
						(e) =>
							(e.response.httpVersion ||
								e.request.httpVersion) === protocol
					).length / connections.size,
			})
		);

		return {
			connectionStats: connectionStats.slice(0, 20),
			totalConnections,
			reusedConnections,
			reuseRate,
			avgRequestsPerConnection,
			protocolStats,
		};
	}, [entries]);

	if (!entries.some((e) => e.connection)) {
		return (
			<div className="p-4 bg-card/40 border border-border rounded-lg">
				<h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
					<Network className="w-5 h-5" />
					Connection Pooling & Reuse
				</h3>
				<p className="text-sm text-muted">
					Connection data not available in this HAR file
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
				<Network className="w-5 h-5" />
				Connection Pooling & Reuse
			</h3>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Total Connections</p>
					<p className="text-2xl font-bold text-foreground">
						{analysis.totalConnections}
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">
						Reused Connections
					</p>
					<p className="text-2xl font-bold text-accent">
						{analysis.reusedConnections}
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Reuse Rate</p>
					<p className="text-2xl font-bold text-primary">
						{analysis.reuseRate.toFixed(1)}%
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">
						Avg Requests/Connection
					</p>
					<p className="text-2xl font-bold text-secondary">
						{analysis.avgRequestsPerConnection.toFixed(1)}
					</p>
				</div>
			</div>

			<div className="space-y-2">
				<h4 className="text-lg font-semibold text-foreground">
					Protocol Connection Efficiency
				</h4>
				{analysis.protocolStats.map((stat) => (
					<div
						key={stat.protocol}
						className="flex items-center justify-between p-3 bg-card/40 rounded border border-border"
					>
						<div className="flex items-center gap-3">
							<Zap className="w-4 h-4 text-primary" />
							<span className="text-sm font-semibold text-foreground">
								{stat.protocol}
							</span>
						</div>
						<div className="flex items-center gap-6">
							<div>
								<span className="text-xs text-muted">
									Connections:{" "}
								</span>
								<span className="text-sm font-bold text-foreground">
									{stat.connectionCount}
								</span>
							</div>
							<div>
								<span className="text-xs text-muted">
									Avg Reqs/Conn:{" "}
								</span>
								<span className="text-sm font-bold text-accent">
									{stat.avgRequestsPerConnection.toFixed(1)}
								</span>
							</div>
						</div>
					</div>
				))}
			</div>

			<div className="overflow-x-auto">
				<h4 className="text-lg font-semibold text-foreground mb-2">
					Top Connections by Request Count
				</h4>
				<table className="w-full border-collapse">
					<thead>
						<tr className="bg-card/60 border-b border-border">
							<th className="text-left p-3 text-sm font-semibold text-foreground">
								Connection ID
							</th>
							<th className="text-left p-3 text-sm font-semibold text-foreground">
								Protocol
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Requests
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Domains
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Total Size
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Avg Time
							</th>
							<th className="text-center p-3 text-sm font-semibold text-foreground">
								Reused
							</th>
						</tr>
					</thead>
					<tbody>
						{analysis.connectionStats.map((stat, index) => (
							<tr
								key={stat.connection}
								className={cn(
									"border-b border-border hover:bg-card-hover transition-colors",
									index % 2 === 0
										? "bg-card/20"
										: "bg-card/10"
								)}
							>
								<td className="p-3 text-sm text-foreground font-mono">
									{stat.connection}
								</td>
								<td className="p-3 text-sm text-muted">
									{stat.protocol}
								</td>
								<td className="p-3 text-sm text-foreground text-right font-medium">
									{stat.requestCount}
								</td>
								<td className="p-3 text-sm text-muted text-right">
									{stat.domains.size}
								</td>
								<td className="p-3 text-sm text-muted text-right">
									{formatBytes(stat.totalSize)}
								</td>
								<td className="p-3 text-sm text-muted text-right">
									{formatTime(stat.avgTime)}
								</td>
								<td className="p-3 text-center">
									{stat.reused ? (
										<span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-500">
											Yes
										</span>
									) : (
										<span className="px-2 py-1 rounded text-xs font-bold bg-gray-500/20 text-gray-500">
											No
										</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
