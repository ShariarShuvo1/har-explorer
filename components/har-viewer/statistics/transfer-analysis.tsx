"use client";

import { useMemo } from "react";
import { formatBytes, extractDomain } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { Scale, FileText } from "lucide-react";
import type { HAREntry } from "@/lib/stores/har-store";
import { getTransferSize } from "./utils";
import type { TransferStats } from "./types";

interface TransferAnalysisProps {
	entries: HAREntry[];
}

export function TransferAnalysis({ entries }: TransferAnalysisProps) {
	const analysis = useMemo(() => {
		const domainMap = new Map<string, TransferStats>();
		let totalTransferSize = 0;
		let totalContentSize = 0;
		let totalHeaderOverhead = 0;
		let entriesWithTransferData = 0;

		entries.forEach((entry) => {
			const domain = extractDomain(entry.request.url);
			const transferSize = getTransferSize(entry);
			const contentSize = entry.response.content.size;

			if (transferSize !== null) {
				entriesWithTransferData++;
				const headerSize = transferSize - contentSize;

				totalTransferSize += transferSize;
				totalContentSize += contentSize;
				totalHeaderOverhead += headerSize;

				const existing = domainMap.get(domain) || {
					domain,
					totalTransferSize: 0,
					totalContentSize: 0,
					headerOverhead: 0,
					requestCount: 0,
					avgHeaderSize: 0,
				};

				existing.totalTransferSize += transferSize;
				existing.totalContentSize += contentSize;
				existing.headerOverhead += headerSize;
				existing.requestCount++;

				domainMap.set(domain, existing);
			}
		});

		const domainStats = Array.from(domainMap.values())
			.map((stat) => ({
				...stat,
				avgHeaderSize: stat.headerOverhead / stat.requestCount,
			}))
			.sort((a, b) => b.totalTransferSize - a.totalTransferSize);

		const avgHeaderSizePerRequest =
			entriesWithTransferData > 0
				? totalHeaderOverhead / entriesWithTransferData
				: 0;

		const headerOverheadPercentage =
			totalTransferSize > 0
				? (totalHeaderOverhead / totalTransferSize) * 100
				: 0;

		const requestHeaderSizes = entries
			.map((entry) => {
				const size =
					entry.request.headersSize ||
					entry.request.headers.reduce(
						(sum: number, h) =>
							sum + h.name.length + h.value.length + 4,
						0
					);
				return {
					url: entry.request.url,
					size,
					cookieSize:
						entry.request.cookies?.reduce((sum: number, c) => {
							const name =
								typeof c === "object" && c && "name" in c
									? String(c.name)
									: "";
							const value =
								typeof c === "object" && c && "value" in c
									? String(c.value)
									: "";
							return sum + name.length + value.length + 2;
						}, 0) || 0,
				};
			})
			.sort((a, b) => b.size - a.size)
			.slice(0, 10);

		return {
			domainStats: domainStats.slice(0, 15),
			totalTransferSize,
			totalContentSize,
			totalHeaderOverhead,
			avgHeaderSizePerRequest,
			headerOverheadPercentage,
			requestHeaderSizes,
			hasTransferData: entriesWithTransferData > 0,
		};
	}, [entries]);

	if (!analysis.hasTransferData) {
		return (
			<div className="p-4 bg-card/40 border border-border rounded-lg">
				<h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
					<Scale className="w-5 h-5" />
					Transfer Size & Header Overhead
				</h3>
				<p className="text-sm text-muted">
					Transfer size data not available. Showing estimated values
					based on content size and header size.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
				<Scale className="w-5 h-5" />
				Transfer Size & Header Overhead
			</h3>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">
						Total Transfer Size
					</p>
					<p className="text-2xl font-bold text-foreground">
						{formatBytes(analysis.totalTransferSize)}
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Content Size</p>
					<p className="text-2xl font-bold text-accent">
						{formatBytes(analysis.totalContentSize)}
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Header Overhead</p>
					<p className="text-2xl font-bold text-red-500">
						{formatBytes(analysis.totalHeaderOverhead)}
					</p>
				</div>
				<div className="p-4 bg-card/40 border border-border rounded-lg">
					<p className="text-sm text-muted mb-1">Overhead %</p>
					<p className="text-2xl font-bold text-yellow-500">
						{analysis.headerOverheadPercentage.toFixed(1)}%
					</p>
				</div>
			</div>

			<div className="p-4 bg-card/40 border border-border rounded-lg">
				<h4 className="text-lg font-semibold text-foreground mb-4">
					Weight Budget Breakdown
				</h4>
				<div className="space-y-3">
					<div>
						<div className="flex justify-between text-sm mb-1">
							<span className="text-muted">Content</span>
							<span className="text-foreground font-medium">
								{formatBytes(analysis.totalContentSize)} (
								{(
									(analysis.totalContentSize /
										analysis.totalTransferSize) *
									100
								).toFixed(1)}
								%)
							</span>
						</div>
						<div className="w-full bg-card rounded-full h-3 overflow-hidden">
							<div
								className="bg-green-500 h-full"
								style={{
									width: `${
										(analysis.totalContentSize /
											analysis.totalTransferSize) *
										100
									}%`,
								}}
							/>
						</div>
					</div>
					<div>
						<div className="flex justify-between text-sm mb-1">
							<span className="text-muted">Headers</span>
							<span className="text-foreground font-medium">
								{formatBytes(analysis.totalHeaderOverhead)} (
								{analysis.headerOverheadPercentage.toFixed(1)}%)
							</span>
						</div>
						<div className="w-full bg-card rounded-full h-3 overflow-hidden">
							<div
								className="bg-red-500 h-full"
								style={{
									width: `${analysis.headerOverheadPercentage}%`,
								}}
							/>
						</div>
					</div>
					<div className="pt-2 border-t border-border">
						<p className="text-sm text-muted">
							Avg Header Size per Request:{" "}
							<span className="text-foreground font-bold">
								{formatBytes(analysis.avgHeaderSizePerRequest)}
							</span>
						</p>
					</div>
				</div>
			</div>

			<div className="overflow-x-auto">
				<h4 className="text-lg font-semibold text-foreground mb-2">
					Domain Transfer Analysis
				</h4>
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
								Transfer Size
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Content Size
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Header Overhead
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Avg Header
							</th>
						</tr>
					</thead>
					<tbody>
						{analysis.domainStats.map((stat, index) => (
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
								<td className="p-3 text-sm text-muted text-right">
									{stat.requestCount}
								</td>
								<td className="p-3 text-sm text-foreground text-right font-medium">
									{formatBytes(stat.totalTransferSize)}
								</td>
								<td className="p-3 text-sm text-muted text-right">
									{formatBytes(stat.totalContentSize)}
								</td>
								<td className="p-3 text-sm text-right">
									<span
										className={cn(
											"px-2 py-1 rounded text-xs font-bold",
											stat.headerOverhead > 10000
												? "bg-red-500/20 text-red-500"
												: "bg-yellow-500/20 text-yellow-500"
										)}
									>
										{formatBytes(stat.headerOverhead)}
									</span>
								</td>
								<td className="p-3 text-sm text-muted text-right">
									{formatBytes(stat.avgHeaderSize)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="overflow-x-auto">
				<h4 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
					<FileText className="w-4 h-4" />
					Largest Request Headers
				</h4>
				<table className="w-full border-collapse">
					<thead>
						<tr className="bg-card/60 border-b border-border">
							<th className="text-left p-3 text-sm font-semibold text-foreground">
								URL
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Header Size
							</th>
							<th className="text-right p-3 text-sm font-semibold text-foreground">
								Cookie Size
							</th>
						</tr>
					</thead>
					<tbody>
						{analysis.requestHeaderSizes.map((item, index) => (
							<tr
								key={index}
								className={cn(
									"border-b border-border hover:bg-card-hover transition-colors",
									index % 2 === 0
										? "bg-card/20"
										: "bg-card/10"
								)}
							>
								<td className="p-3 text-sm text-foreground font-mono truncate max-w-md">
									{item.url}
								</td>
								<td className="p-3 text-sm text-right">
									<span
										className={cn(
											"px-2 py-1 rounded text-xs font-bold",
											item.size > 2000
												? "bg-red-500/20 text-red-500"
												: "bg-yellow-500/20 text-yellow-500"
										)}
									>
										{formatBytes(item.size)}
									</span>
								</td>
								<td className="p-3 text-sm text-muted text-right">
									{formatBytes(item.cookieSize)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
