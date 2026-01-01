"use client";

import {
	Zap,
	TrendingUp,
	TrendingDown,
	AlertCircle,
	CheckCircle,
	Clock,
	Lightbulb,
	TriangleAlert,
} from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { formatTime } from "@/lib/har-parser";
import { DetailSection, CompactCard } from "./shared-components";
import { calculatePerformanceMetrics } from "./utils";
import { cn } from "@/lib/cn";

interface PerformanceTabProps {
	entry: HAREntry;
}

function PerformanceMetric({
	label,
	value,
	percentage,
	color,
}: {
	label: string;
	value: string;
	percentage: number;
	color: string;
}) {
	return (
		<div className="bg-card/40 border border-border/30 rounded p-2">
			<div className="flex items-center justify-between mb-1">
				<span className="text-[9px] text-muted uppercase">{label}</span>
				<span className={cn("text-[9px] font-mono font-bold", color)}>
					{percentage.toFixed(1)}%
				</span>
			</div>
			<div className="font-mono text-xs font-medium text-foreground mb-1">
				{value}
			</div>
			<div className="h-1 bg-card/60 rounded-full overflow-hidden">
				<div
					className={cn("h-full", color.replace("text-", "bg-"))}
					style={{ width: `${Math.min(percentage, 100)}%` }}
				/>
			</div>
		</div>
	);
}

function PerformanceScore({ score }: { score: number }) {
	let color = "text-red-500";
	let bg = "bg-red-500/10";
	let border = "border-red-500/30";
	let label = "Poor";
	let Icon = AlertCircle;

	if (score >= 90) {
		color = "text-green-500";
		bg = "bg-green-500/10";
		border = "border-green-500/30";
		label = "Excellent";
		Icon = CheckCircle;
	} else if (score >= 70) {
		color = "text-blue-500";
		bg = "bg-blue-500/10";
		border = "border-blue-500/30";
		label = "Good";
		Icon = TrendingUp;
	} else if (score >= 50) {
		color = "text-yellow-500";
		bg = "bg-yellow-500/10";
		border = "border-yellow-500/30";
		label = "Average";
		Icon = TrendingDown;
	}

	return (
		<div
			className={cn(
				"rounded-lg p-4 border-2 text-center space-y-2",
				bg,
				border
			)}
		>
			<Icon className={cn("w-8 h-8 mx-auto", color)} />
			<div className={cn("text-4xl font-bold font-mono", color)}>
				{score.toFixed(0)}
			</div>
			<div className={cn("text-sm font-medium uppercase", color)}>
				{label}
			</div>
			<div className="text-[10px] text-muted">Performance Score</div>
		</div>
	);
}

export function PerformanceTab({ entry }: PerformanceTabProps) {
	const metrics = calculatePerformanceMetrics(entry);

	const performanceScore =
		100 -
		Math.min(
			100,
			(metrics.ttfb / 1000) * 10 +
				(metrics.totalTime / 3000) * 20 +
				(metrics.dnsLookup / 100) * 10 +
				(metrics.tcpConnection / 100) * 10
		);

	const recommendations: Array<{ text: string; type: "info" | "warning" }> =
		[];

	if (metrics.dnsLookup > 100) {
		recommendations.push({
			text: `DNS lookup is slow (${formatTime(
				metrics.dnsLookup
			)}). Consider using a CDN or DNS prefetching.`,
			type: "warning",
		});
	}

	if (metrics.ttfb > 200) {
		recommendations.push({
			text: `Time to First Byte is high (${formatTime(
				metrics.ttfb
			)}). Optimize server response time.`,
			type: "warning",
		});
	}

	if (metrics.tcpConnection > 100) {
		recommendations.push({
			text: `TCP connection time is slow (${formatTime(
				metrics.tcpConnection
			)}). Consider using HTTP/2 or HTTP/3.`,
			type: "warning",
		});
	}

	if (metrics.contentDownload > 500) {
		recommendations.push({
			text: `Content download is slow (${formatTime(
				metrics.contentDownload
			)}). Consider compression or reducing payload size.`,
			type: "warning",
		});
	}

	if (metrics.efficiency < 20) {
		recommendations.push({
			text: `Low download efficiency (${metrics.efficiency.toFixed(
				1
			)}%). Most time spent on latency, not transfer.`,
			type: "info",
		});
	}

	if (recommendations.length === 0) {
		recommendations.push({
			text: "Performance looks good! No major bottlenecks detected.",
			type: "info",
		});
	}

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 gap-3">
				<PerformanceScore score={performanceScore} />
				<div className="space-y-2">
					<CompactCard
						label="Total Time"
						value={formatTime(metrics.totalTime)}
						icon={<Clock className="w-3 h-3 text-primary" />}
					/>
					<CompactCard
						label="TTFB"
						value={formatTime(metrics.ttfb)}
						icon={<Zap className="w-3 h-3 text-yellow-500" />}
						className={
							metrics.ttfb > 200
								? "bg-orange-500/10 border-orange-500/30"
								: ""
						}
					/>
					<CompactCard
						label="Download"
						value={formatTime(metrics.downloadTime)}
						icon={
							<TrendingDown className="w-3 h-3 text-blue-500" />
						}
					/>
				</div>
			</div>

			<DetailSection
				title="Time Breakdown"
				icon={<Clock className="w-3.5 h-3.5 text-cyan-500" />}
			>
				<div className="grid grid-cols-2 gap-2">
					<PerformanceMetric
						label="DNS Lookup"
						value={formatTime(metrics.dnsLookup)}
						percentage={
							(metrics.dnsLookup / metrics.totalTime) * 100
						}
						color="text-cyan-500"
					/>
					<PerformanceMetric
						label="TCP Connection"
						value={formatTime(metrics.tcpConnection)}
						percentage={
							(metrics.tcpConnection / metrics.totalTime) * 100
						}
						color="text-orange-500"
					/>
					<PerformanceMetric
						label="TLS Handshake"
						value={formatTime(metrics.tlsHandshake)}
						percentage={
							(metrics.tlsHandshake / metrics.totalTime) * 100
						}
						color="text-green-500"
					/>
					<PerformanceMetric
						label="Request Sent"
						value={formatTime(metrics.requestSent)}
						percentage={
							(metrics.requestSent / metrics.totalTime) * 100
						}
						color="text-blue-500"
					/>
					<PerformanceMetric
						label="Server Processing"
						value={formatTime(metrics.serverProcessing)}
						percentage={
							(metrics.serverProcessing / metrics.totalTime) * 100
						}
						color="text-purple-500"
					/>
					<PerformanceMetric
						label="Content Download"
						value={formatTime(metrics.contentDownload)}
						percentage={
							(metrics.contentDownload / metrics.totalTime) * 100
						}
						color="text-pink-500"
					/>
				</div>
			</DetailSection>

			<DetailSection
				title="Performance Insights"
				icon={<TrendingUp className="w-3.5 h-3.5 text-green-500" />}
			>
				<div className="space-y-1.5">
					{recommendations.map((rec, i) => (
						<div
							key={i}
							className={cn(
								"text-xs p-2 rounded border flex items-start gap-1.5",
								rec.type === "warning"
									? "bg-orange-500/10 text-orange-400 border-orange-500/30"
									: "bg-blue-500/10 text-blue-400 border-blue-500/30"
							)}
						>
							{rec.type === "warning" ? (
								<TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
							) : (
								<Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
							)}
							<span>{rec.text}</span>
						</div>
					))}
				</div>
			</DetailSection>

			<DetailSection
				title="Network Efficiency"
				icon={<Zap className="w-3.5 h-3.5 text-yellow-500" />}
			>
				<div className="bg-card/40 border border-border/30 rounded p-3">
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs text-muted">
							Download vs Total Time
						</span>
						<span className="text-xs font-mono font-bold text-primary">
							{metrics.efficiency.toFixed(1)}%
						</span>
					</div>
					<div className="h-2 bg-card/60 rounded-full overflow-hidden">
						<div
							className="h-full bg-linear-to-r from-blue-500 to-purple-500"
							style={{ width: `${metrics.efficiency}%` }}
						/>
					</div>
					<p className="text-[10px] text-muted mt-2">
						{metrics.efficiency < 20
							? "Low efficiency: Most time spent on network latency"
							: metrics.efficiency > 60
							? "High efficiency: Most time spent on actual data transfer"
							: "Moderate efficiency: Balanced latency and transfer"}
					</p>
				</div>
			</DetailSection>
		</div>
	);
}
