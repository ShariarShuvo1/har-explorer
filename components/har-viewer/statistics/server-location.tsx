"use client";

import { useMemo } from "react";
import { formatBytes, formatTime, extractDomain } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { Globe, Server, Cloud } from "lucide-react";
import type { HAREntry } from "@/lib/stores/har-store";
import { detectCDN } from "./utils";
import type { ServerLocationStats } from "./types";

interface ServerLocationAnalysisProps {
	entries: HAREntry[];
}

export function ServerLocationAnalysis({
	entries,
}: ServerLocationAnalysisProps) {
	const analysis = useMemo(() => {
		const serverMap = new Map<string, ServerLocationStats>();

		entries.forEach((entry) => {
			const serverIP = entry.serverIPAddress || "unknown";
			const domain = extractDomain(entry.request.url);

			const dnsTime = entry.timings.dns || 0;
			const connectTime = entry.timings.connect || 0;
			const sslTime = entry.timings.ssl || 0;
			const latency = dnsTime + connectTime + sslTime;

			const existing = serverMap.get(serverIP) || {
				serverIP,
				domain: domain,
				requestCount: 0,
				avgLatency: 0,
				totalSize: 0,
				isCDN: detectCDN(domain),
				errorCount: 0,
			};

			existing.requestCount++;
			existing.avgLatency += latency;
			existing.totalSize += entry.response.content.size;
			if (entry.response.status >= 400) existing.errorCount++;

			serverMap.set(serverIP, existing);
		});

		const serverStats = Array.from(serverMap.values())
			.map((stat) => ({
				...stat,
				avgLatency: stat.avgLatency / stat.requestCount,
			}))
			.sort((a, b) => b.requestCount - a.requestCount);

		const cdnStats = serverStats.filter((s) => s.isCDN);
		const originStats = serverStats.filter((s) => !s.isCDN);

		const totalCDNRequests = cdnStats.reduce(
			(sum, s) => sum + s.requestCount,
			0
		);
		const totalOriginRequests = originStats.reduce(
			(sum, s) => sum + s.requestCount,
			0
		);

		const avgCDNLatency =
			cdnStats.length > 0
				? cdnStats.reduce((sum, s) => sum + s.avgLatency, 0) /
				  cdnStats.length
				: 0;

		const avgOriginLatency =
			originStats.length > 0
				? originStats.reduce((sum, s) => sum + s.avgLatency, 0) /
				  originStats.length
				: 0;

		const uniqueDomains = new Set(serverStats.map((s) => s.domain));
		const ipPerDomain = serverStats.length / uniqueDomains.size;

		return {
			serverStats: serverStats.slice(0, 20),
			cdnStats: cdnStats.slice(0, 10),
			originStats: originStats.slice(0, 10),
			totalCDNRequests,
			totalOriginRequests,
			avgCDNLatency,
			avgOriginLatency,
			uniqueServers: serverStats.length,
			uniqueDomains: uniqueDomains.size,
			ipPerDomain,
			hasServerData: entries.some((e) => e.serverIPAddress),
		};
	}, [entries]);

	if (!analysis.hasServerData) {
		return (
			<div className="p-4 bg-card/40 border border-border rounded-lg">
				<h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
					<Globe className="w-5 h-5" />
					Server Location & CDN Analysis
				</h3>
				<p className="text-sm text-muted">
					Server IP data not available in this HAR file
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
				<Globe className="w-5 h-5" />
				Server Location & CDN Analysis
			</h3>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Unique Servers</p>
					<p className="text-2xl font-bold text-foreground">
						{analysis.uniqueServers}
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">CDN Requests</p>
					<p className="text-2xl font-bold text-accent">
						{analysis.totalCDNRequests}
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Origin Requests</p>
					<p className="text-2xl font-bold text-secondary">
						{analysis.totalOriginRequests}
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">IPs per Domain</p>
					<p className="text-2xl font-bold text-primary">
						{analysis.ipPerDomain.toFixed(1)}
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
						<Cloud className="w-4 h-4 text-green-500" />
						CDN Performance
					</h4>
					<div className="space-y-3">
						<div>
							<p className="text-sm text-muted mb-1">
								Total CDN Requests
							</p>
							<p className="text-xl font-bold text-foreground">
								{analysis.totalCDNRequests}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted mb-1">
								Avg CDN Latency
							</p>
							<p className="text-xl font-bold text-green-500">
								{formatTime(analysis.avgCDNLatency)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted mb-1">
								CDN Servers
							</p>
							<p className="text-xl font-bold text-accent">
								{analysis.cdnStats.length}
							</p>
						</div>
					</div>
				</div>

				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
						<Server className="w-4 h-4 text-blue-500" />
						Origin Performance
					</h4>
					<div className="space-y-3">
						<div>
							<p className="text-sm text-muted mb-1">
								Total Origin Requests
							</p>
							<p className="text-xl font-bold text-foreground">
								{analysis.totalOriginRequests}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted mb-1">
								Avg Origin Latency
							</p>
							<p className="text-xl font-bold text-blue-500">
								{formatTime(analysis.avgOriginLatency)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted mb-1">
								Origin Servers
							</p>
							<p className="text-xl font-bold text-secondary">
								{analysis.originStats.length}
							</p>
						</div>
					</div>
				</div>
			</div>

			{analysis.avgCDNLatency > 0 && analysis.avgOriginLatency > 0 && (
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<h4 className="text-lg font-semibold text-foreground mb-3">
						CDN Effectiveness
					</h4>
					<div className="space-y-2">
						<div className="flex justify-between items-center">
							<span className="text-sm text-muted">
								Latency Improvement
							</span>
							<span
								className={cn(
									"text-lg font-bold",
									analysis.avgCDNLatency <
										analysis.avgOriginLatency
										? "text-green-500"
										: "text-red-500"
								)}
							>
								{analysis.avgCDNLatency <
								analysis.avgOriginLatency
									? "-"
									: "+"}
								{Math.abs(
									((analysis.avgCDNLatency -
										analysis.avgOriginLatency) /
										analysis.avgOriginLatency) *
										100
								).toFixed(1)}
								%
							</span>
						</div>
						<div className="w-full bg-card rounded-full h-3 overflow-hidden flex">
							<div
								className="bg-green-500 flex items-center justify-center text-xs text-white font-bold"
								style={{
									width: `${
										(analysis.totalCDNRequests /
											(analysis.totalCDNRequests +
												analysis.totalOriginRequests)) *
										100
									}%`,
								}}
							>
								CDN
							</div>
							<div
								className="bg-blue-500 flex items-center justify-center text-xs text-white font-bold"
								style={{
									width: `${
										(analysis.totalOriginRequests /
											(analysis.totalCDNRequests +
												analysis.totalOriginRequests)) *
										100
									}%`,
								}}
							>
								Origin
							</div>
						</div>
					</div>
				</div>
			)}

			<div className="overflow-x-auto">
				<h4 className="text-lg font-semibold text-foreground mb-2">
					Server Distribution
				</h4>
				<table className="w-full border-collapse">
					<thead>
						<tr className="bg-card/60 border-b border-border">
							<th className="text-left p-3 text-sm font-semibold text-foreground">
								Server IP
							</th>
							<th className="text-left p-3 text-sm font-semibold text-foreground">
								Domain
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Requests
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Avg Latency
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Total Size
							</th>
							<th className="text-center p-3 text-sm font-semibold text-foreground">
								Type
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Errors
							</th>
						</tr>
					</thead>
					<tbody>
						{analysis.serverStats.map((stat, index) => (
							<tr
								key={stat.serverIP}
								className={cn(
									"border-b border-border hover:bg-card-hover transition-colors",
									index % 2 === 0
										? "bg-card/20"
										: "bg-card/10"
								)}
							>
								<td className="p-3 text-sm text-foreground font-mono">
									{stat.serverIP}
								</td>
								<td className="p-3 text-sm text-muted font-mono truncate max-w-xs">
									{stat.domain}
								</td>
								<td className="p-3 text-sm text-foreground text-right font-medium">
									{stat.requestCount}
								</td>
								<td className="p-3 text-sm text-right">
									<span
										className={cn(
											"px-2 py-1 rounded text-xs font-bold",
											stat.avgLatency < 100
												? "bg-green-500/20 text-green-500"
												: stat.avgLatency < 300
												? "bg-yellow-500/20 text-yellow-500"
												: "bg-red-500/20 text-red-500"
										)}
									>
										{formatTime(stat.avgLatency)}
									</span>
								</td>
								<td className="p-3 text-sm text-muted text-right">
									{formatBytes(stat.totalSize)}
								</td>
								<td className="p-3 text-center">
									{stat.isCDN ? (
										<span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-500 flex items-center justify-center gap-1">
											<Cloud className="w-3 h-3" />
											CDN
										</span>
									) : (
										<span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-500 flex items-center justify-center gap-1">
											<Server className="w-3 h-3" />
											Origin
										</span>
									)}
								</td>
								<td className="p-3 text-sm text-right">
									{stat.errorCount > 0 ? (
										<span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-500">
											{stat.errorCount}
										</span>
									) : (
										<span className="text-muted">0</span>
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
