"use client";

import { useMemo } from "react";
import { ArrowDownUp, FileText, Package, Scale } from "lucide-react";
import { formatBytes } from "@/lib/har-parser";
import type { OverviewStatistics } from "@/lib/statistics/overview";
import {
	analyzeTransfer,
	LARGE_AVG_HEADER_BYTES,
	LARGE_REQUEST_HEADER_BYTES,
} from "@/lib/statistics/transfer";
import { useHarStore } from "@/lib/stores/har-store";
import { cn } from "@/lib/cn";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import { Progress } from "@/components/ui/progress";
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { BODY_COLOR, HEADER_COLOR, type SeriesColor } from "./colors";
import {
	Caption,
	Metric,
	SectionCard,
	StatSection,
	StatTable,
	StatTableHeader,
	ToneBadge,
	TruncationFooter,
	Unavailable,
	useTruncation,
	type SectionProps,
} from "./shared";

const MAX_DOMAIN_ROWS = 15;
const MAX_HEADER_ROWS = 10;

function BudgetBar({
	label,
	bytes,
	percentage,
	color,
}: {
	label: string;
	bytes: number;
	percentage: number;
	color: SeriesColor;
}) {
	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between gap-2 text-sm">
				<span className="flex items-center gap-2 text-muted-foreground">
					<span className={cn("size-2 rounded-full", color.fill)} />
					{label}
				</span>
				<span className="font-medium tabular-nums">
					{formatBytes(bytes)}{" "}
					<span className="text-muted-foreground">({percentage.toFixed(1)}%)</span>
				</span>
			</div>
			<Progress
				value={percentage}
				aria-label={`${label} share of transferred bytes`}
				className={cn("h-2 bg-muted", color.progress)}
			/>
		</div>
	);
}

function CompressionCard({
	compression,
	total,
}: {
	compression: OverviewStatistics["compression"];
	total: number;
}) {
	const hasData = compression.measured > 0;
	return (
		<SectionCard
			title="Compression efficiency"
			description={
				hasData
					? `Based on ${compression.measured.toLocaleString()} of ${total.toLocaleString()} responses with both encoded and decoded body sizes.`
					: "No responses report both encoded and decoded body sizes."
			}
		>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<Metric
					label="Compressed responses"
					value={
						hasData
							? `${compression.compressedCount.toLocaleString()} / ${compression.measured.toLocaleString()}`
							: "—"
					}
				/>
				<Metric
					label="Space saved"
					value={hasData ? formatBytes(compression.saved) : "—"}
					className={hasData ? "text-success" : undefined}
				/>
				<Metric
					label="Size reduction"
					value={hasData ? `${compression.ratio.toFixed(1)}%` : "—"}
					className={hasData ? "text-primary" : undefined}
				/>
			</div>
		</SectionCard>
	);
}

export function TransferSection({
	entries,
	indices,
	compression,
}: SectionProps & { compression: OverviewStatistics["compression"] }) {
	const openEntry = useHarStore((s) => s.openEntry);
	const analysis = useMemo(() => analyzeTransfer(entries, indices), [entries, indices]);
	const domainTruncation = useTruncation(analysis.domainStats.length, MAX_DOMAIN_ROWS);
	const headerTruncation = useTruncation(analysis.requestHeaderSizes.length, MAX_HEADER_ROWS);

	const compressionCard = <CompressionCard compression={compression} total={entries.length} />;

	if (analysis.measuredCount === 0) {
		return (
			<StatSection id="stats-transfer" title="Transfer & compression">
				<Unavailable icon={Scale} title="Transfer sizes not available">
					<p>Transfer size data is not available for these requests.</p>
				</Unavailable>
				{compressionCard}
			</StatSection>
		);
	}

	return (
		<StatSection
			id="stats-transfer"
			title="Transfer & compression"
			description="Bytes on the wire split into headers and bodies, and how much compression saved."
		>
			{(analysis.estimatedCount > 0 || analysis.measuredCount < entries.length) && (
				<Caption>
					{analysis.estimatedCount > 0 && (
						<p>
							Sizes for {analysis.estimatedCount.toLocaleString()} of{" "}
							{analysis.measuredCount.toLocaleString()} requests are partly estimated from header
							names and values. HTTP/2 and HTTP/3 compress headers, so real overhead is usually
							lower.
						</p>
					)}
					{analysis.measuredCount < entries.length && (
						<p>
							{(entries.length - analysis.measuredCount).toLocaleString()} requests without any size
							information are excluded.
						</p>
					)}
				</Caption>
			)}

			<StatGrid>
				<StatCard
					label="Total transferred"
					value={formatBytes(analysis.totalTransferSize)}
					icon={ArrowDownUp}
					tone="primary"
				/>
				<StatCard
					label="Response bodies"
					value={formatBytes(analysis.totalBodySize)}
					hint={`${formatBytes(analysis.totalContentSize)} decoded`}
					icon={Package}
					tone="success"
				/>
				<StatCard
					label="Response headers"
					value={formatBytes(analysis.totalHeaderSize)}
					icon={FileText}
					tone="destructive"
				/>
				<StatCard
					label="Header overhead"
					value={`${analysis.headerPercentage.toFixed(1)}%`}
					icon={Scale}
					tone="warning"
				/>
			</StatGrid>

			<div className="grid items-start gap-4 lg:grid-cols-2">
				<SectionCard title="Weight budget breakdown">
					<div className="space-y-4">
						<BudgetBar
							label="Body"
							bytes={analysis.totalBodySize}
							percentage={analysis.bodyPercentage}
							color={BODY_COLOR}
						/>
						<BudgetBar
							label="Headers"
							bytes={analysis.totalHeaderSize}
							percentage={analysis.headerPercentage}
							color={HEADER_COLOR}
						/>
						<p className="border-t pt-3 text-sm text-muted-foreground">
							Avg response header size per request:{" "}
							<span className="font-medium text-foreground tabular-nums">
								{formatBytes(analysis.avgHeaderSizePerRequest)}
							</span>
						</p>
					</div>
				</SectionCard>
				{compressionCard}
			</div>

			<SectionCard
				title="Domain transfer analysis"
				description="Largest transfer first"
				contentClassName="p-0 sm:p-0"
				footer={<TruncationFooter state={domainTruncation} noun="domains" />}
			>
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>Domain</TableHead>
							<TableHead className="text-right">Requests</TableHead>
							<TableHead className="text-right">Transferred</TableHead>
							<TableHead className="text-right">Body</TableHead>
							<TableHead className="text-right">Headers</TableHead>
							<TableHead className="text-right">Avg header</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{analysis.domainStats.slice(0, domainTruncation.shown).map((stat) => {
							const avgHeader = stat.totalHeaderSize / stat.requestCount;
							return (
								<TableRow key={stat.domain}>
									<TableCell
										className="max-w-[14rem] truncate font-mono text-xs sm:max-w-xs"
										title={stat.domain}
									>
										{stat.domain}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{stat.requestCount.toLocaleString()}
									</TableCell>
									<TableCell className="text-right font-medium tabular-nums">
										{formatBytes(stat.totalTransferSize)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{formatBytes(stat.totalBodySize)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{formatBytes(stat.totalHeaderSize)}
									</TableCell>
									<TableCell className="text-right">
										<ToneBadge
											tone={avgHeader > LARGE_AVG_HEADER_BYTES ? "destructive" : "warning"}
										>
											{formatBytes(avgHeader)}
										</ToneBadge>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</StatTable>
			</SectionCard>

			<SectionCard
				title="Largest request headers"
				description="Select a request to inspect its headers"
				contentClassName="p-0 sm:p-0"
				footer={<TruncationFooter state={headerTruncation} noun="requests" />}
			>
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>URL</TableHead>
							<TableHead className="text-right">Header size</TableHead>
							<TableHead className="text-right">Cookie size</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{analysis.requestHeaderSizes.slice(0, headerTruncation.shown).map((item) => (
							<TableRow key={item.entryIndex}>
								<TableCell className="max-w-[16rem] sm:max-w-md lg:max-w-xl">
									<button
										type="button"
										onClick={() => openEntry(item.entryIndex, "headers")}
										title={`${item.url}\nOpen this request's headers`}
										className="block w-full truncate rounded-sm text-left font-mono text-xs hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
									>
										{item.url}
									</button>
								</TableCell>
								<TableCell className="text-right">
									<ToneBadge
										tone={item.size > LARGE_REQUEST_HEADER_BYTES ? "destructive" : "warning"}
										title={item.estimated ? "Estimated from header names and values" : undefined}
									>
										{item.estimated ? "~" : ""}
										{formatBytes(item.size)}
									</ToneBadge>
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatBytes(item.cookieSize)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</StatTable>
			</SectionCard>
		</StatSection>
	);
}
