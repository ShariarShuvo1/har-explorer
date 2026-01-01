"use client";

import { useMemo } from "react";
import { useHarStore } from "@/lib/stores/har-store";
import {
	formatBytes,
	formatTime,
	extractDomain,
	getMethodColor,
	getStatusColor,
} from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ConnectionAnalysis } from "./connection-analysis";
import { InitiatorAnalysis } from "./initiator-analysis";
import { PriorityAnalysis } from "./priority-analysis";
import { TransferAnalysis } from "./transfer-analysis";
import { ServerLocationAnalysis } from "./server-location";
import { ResourceSequenceAnalysis } from "./resource-sequence";

export function StatisticsView() {
	const { entries } = useHarStore();

	const statistics = useMemo(() => {
		if (!entries.length) return null;

		const domainMap = new Map<
			string,
			{
				count: number;
				totalSize: number;
				totalTime: number;
				errors: number;
				methods: Set<string>;
			}
		>();

		entries.forEach((entry) => {
			const domain = extractDomain(entry.request.url);
			const existing = domainMap.get(domain) || {
				count: 0,
				totalSize: 0,
				totalTime: 0,
				errors: 0,
				methods: new Set<string>(),
			};

			existing.count++;
			existing.totalSize += entry.response.content.size;
			existing.totalTime += entry.time;
			if (entry.response.status >= 400) existing.errors++;
			existing.methods.add(entry.request.method);

			domainMap.set(domain, existing);
		});

		const domainStats = Array.from(domainMap.entries())
			.map(([domain, data]) => ({
				domain,
				...data,
				avgTime: data.totalTime / data.count,
				avgSize: data.totalSize / data.count,
				methodCount: data.methods.size,
				errorRate: (data.errors / data.count) * 100,
			}))
			.sort((a, b) => b.count - a.count);

		const methodMap = new Map<string, number>();
		const statusMap = new Map<number, number>();
		const mimeTypeMap = new Map<string, { count: number; size: number }>();

		entries.forEach((entry) => {
			methodMap.set(
				entry.request.method,
				(methodMap.get(entry.request.method) || 0) + 1
			);
			statusMap.set(
				entry.response.status,
				(statusMap.get(entry.response.status) || 0) + 1
			);

			const mime = entry.response.content.mimeType;
			const existing = mimeTypeMap.get(mime) || { count: 0, size: 0 };
			mimeTypeMap.set(mime, {
				count: existing.count + 1,
				size: existing.size + entry.response.content.size,
			});
		});

		const methodStats = Array.from(methodMap.entries())
			.map(([method, count]) => ({ method, count }))
			.sort((a, b) => b.count - a.count);

		const statusStats = Array.from(statusMap.entries())
			.map(([status, count]) => ({ status, count }))
			.sort((a, b) => a.status - b.status);

		const mimeTypeStats = Array.from(mimeTypeMap.entries())
			.map(([mimeType, data]) => ({ mimeType, ...data }))
			.sort((a, b) => b.size - a.size)
			.slice(0, 15);

		const compressionStats = entries.reduce(
			(acc, entry) => {
				const compression = entry.response.content.compression || 0;
				const uncompressed = entry.response.content.size + compression;
				acc.totalUncompressed += uncompressed;
				acc.totalCompressed += entry.response.content.size;
				if (compression > 0) acc.compressedCount++;
				return acc;
			},
			{ totalUncompressed: 0, totalCompressed: 0, compressedCount: 0 }
		);

		const compressionRatio =
			compressionStats.totalUncompressed > 0
				? ((compressionStats.totalUncompressed -
						compressionStats.totalCompressed) /
						compressionStats.totalUncompressed) *
				  100
				: 0;

		return {
			domainStats,
			methodStats,
			statusStats,
			mimeTypeStats,
			compressionStats: {
				...compressionStats,
				ratio: compressionRatio,
			},
		};
	}, [entries]);

	if (!statistics) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted">
				<p>No data to display</p>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-auto p-6 space-y-8">
			<h2 className="text-2xl font-bold text-foreground">
				Detailed Statistics
			</h2>

			<ConnectionAnalysis entries={entries} />

			<div className="border-t border-border" />

			<InitiatorAnalysis entries={entries} />

			<div className="border-t border-border" />

			<PriorityAnalysis entries={entries} />

			<div className="border-t border-border" />

			<TransferAnalysis entries={entries} />

			<div className="border-t border-border" />

			<ServerLocationAnalysis entries={entries} />

			<div className="border-t border-border" />

			<ResourceSequenceAnalysis entries={entries} />

			<div className="border-t border-border" />

			<div className="space-y-4">
				<h3 className="text-xl font-semibold text-foreground">
					Domain Statistics
				</h3>
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr className="bg-card/60 border-b border-border">
								<th className="text-left p-3 text-sm font-semibold text-foreground">
									Domain
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									Requests
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									Total Size
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									Avg Size
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									Avg Time
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									Errors
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									Error Rate
								</th>
							</tr>
						</thead>
						<tbody>
							{statistics.domainStats.map((stat, index) => (
								<tr
									key={stat.domain}
									className={cn(
										"border-b border-border hover:bg-card-hover transition-colors",
										index % 2 === 0
											? "bg-card/20"
											: "bg-card/10"
									)}
								>
									<td className="p-3 text-sm text-foreground font-mono truncate max-w-xs">
										{stat.domain}
									</td>
									<td className="p-3 text-sm text-foreground text-right font-medium">
										{stat.count}
									</td>
									<td className="p-3 text-sm text-muted text-right">
										{formatBytes(stat.totalSize)}
									</td>
									<td className="p-3 text-sm text-muted text-right">
										{formatBytes(stat.avgSize)}
									</td>
									<td className="p-3 text-sm text-muted text-right">
										{formatTime(stat.avgTime)}
									</td>
									<td className="p-3 text-sm text-right">
										<span
											className={cn(
												"px-2 py-1 rounded text-xs font-bold",
												stat.errors > 0
													? "bg-red-500/20 text-red-500"
													: "text-muted"
											)}
										>
											{stat.errors}
										</span>
									</td>
									<td className="p-3 text-sm text-right">
										<div className="flex items-center justify-end gap-1">
											{stat.errorRate > 10 ? (
												<TrendingUp className="w-3 h-3 text-red-500" />
											) : stat.errorRate > 0 ? (
												<Minus className="w-3 h-3 text-yellow-500" />
											) : (
												<TrendingDown className="w-3 h-3 text-green-500" />
											)}
											<span
												className={cn(
													"font-medium",
													stat.errorRate > 10 &&
														"text-red-500",
													stat.errorRate > 0 &&
														stat.errorRate <= 10 &&
														"text-yellow-500",
													stat.errorRate === 0 &&
														"text-green-500"
												)}
											>
												{stat.errorRate.toFixed(1)}%
											</span>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="space-y-4">
					<h3 className="text-xl font-semibold text-foreground">
						HTTP Methods
					</h3>
					<div className="space-y-2">
						{statistics.methodStats.map((stat) => (
							<div
								key={stat.method}
								className="flex items-center justify-between p-3 bg-card/40 rounded border border-border"
							>
								<span
									className={cn(
										"px-3 py-1 rounded text-xs font-bold",
										getMethodColor(stat.method)
									)}
								>
									{stat.method}
								</span>
								<div className="flex items-center gap-4">
									<div className="w-32 bg-card rounded-full h-2 overflow-hidden">
										<div
											className="bg-primary h-full"
											style={{
												width: `${
													(stat.count /
														entries.length) *
													100
												}%`,
											}}
										/>
									</div>
									<span className="text-sm font-mono font-bold text-foreground min-w-12 text-right">
										{stat.count}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="space-y-4">
					<h3 className="text-xl font-semibold text-foreground">
						Status Codes
					</h3>
					<div className="space-y-2">
						{statistics.statusStats.map((stat) => (
							<div
								key={stat.status}
								className="flex items-center justify-between p-3 bg-card/40 rounded border border-border"
							>
								<span
									className={cn(
										"px-3 py-1 rounded text-xs font-bold",
										getStatusColor(stat.status)
									)}
								>
									{stat.status}
								</span>
								<div className="flex items-center gap-4">
									<div className="w-32 bg-card rounded-full h-2 overflow-hidden">
										<div
											className="bg-secondary h-full"
											style={{
												width: `${
													(stat.count /
														entries.length) *
													100
												}%`,
											}}
										/>
									</div>
									<span className="text-sm font-mono font-bold text-foreground min-w-12 text-right">
										{stat.count}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="space-y-4">
				<h3 className="text-xl font-semibold text-foreground">
					Content Types
				</h3>
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr className="bg-card/60 border-b border-border">
								<th className="text-left p-3 text-sm font-semibold text-foreground">
									MIME Type
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									Count
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									Total Size
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									Avg Size
								</th>
								<th className="text-right p-3 text-sm font-semibold text-foreground">
									% of Total
								</th>
							</tr>
						</thead>
						<tbody>
							{statistics.mimeTypeStats.map((stat, index) => {
								const totalSize = entries.reduce(
									(sum, e) => sum + e.response.content.size,
									0
								);
								const percentage =
									(stat.size / totalSize) * 100;
								return (
									<tr
										key={stat.mimeType}
										className={cn(
											"border-b border-border hover:bg-card-hover transition-colors",
											index % 2 === 0
												? "bg-card/20"
												: "bg-card/10"
										)}
									>
										<td className="p-3 text-sm text-foreground font-mono truncate max-w-xs">
											{stat.mimeType}
										</td>
										<td className="p-3 text-sm text-muted text-right">
											{stat.count}
										</td>
										<td className="p-3 text-sm text-foreground text-right font-medium">
											{formatBytes(stat.size)}
										</td>
										<td className="p-3 text-sm text-muted text-right">
											{formatBytes(
												stat.size / stat.count
											)}
										</td>
										<td className="p-3 text-sm text-right">
											<div className="flex items-center justify-end gap-2">
												<div className="w-20 bg-card rounded-full h-2 overflow-hidden">
													<div
														className="bg-accent h-full"
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

			<div className="p-4 bg-card/40 border border-border rounded-lg">
				<h3 className="text-xl font-semibold text-foreground mb-4">
					Compression Efficiency
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<p className="text-sm text-muted mb-1">
							Compressed Resources
						</p>
						<p className="text-2xl font-bold text-foreground">
							{statistics.compressionStats.compressedCount} /{" "}
							{entries.length}
						</p>
					</div>
					<div>
						<p className="text-sm text-muted mb-1">Space Saved</p>
						<p className="text-2xl font-bold text-accent">
							{formatBytes(
								statistics.compressionStats.totalUncompressed -
									statistics.compressionStats.totalCompressed
							)}
						</p>
					</div>
					<div>
						<p className="text-sm text-muted mb-1">
							Compression Ratio
						</p>
						<p className="text-2xl font-bold text-primary">
							{statistics.compressionStats.ratio.toFixed(1)}%
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
