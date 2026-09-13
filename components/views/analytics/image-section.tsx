"use client";

import { useMemo, type ComponentType } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
	AlertTriangle,
	FileArchive,
	Image as ImageIcon,
	Lightbulb,
	Sparkles,
	TrendingDown,
} from "lucide-react";
import { PageSection } from "@/components/common/page";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import { useHarStore } from "@/lib/stores/har-store";
import type { HAREntry } from "@/lib/har-types";
import { formatBytes } from "@/lib/har-parser";
import {
	IMAGE_ISSUE_DETAILS,
	computeImages,
	type ImageIssue,
	type ImageOpportunity,
} from "@/lib/analytics/images";
import { formatBytesAxis, plural } from "@/lib/analytics/format";
import { cn } from "@/lib/cn";
import { CHART_CLASS, ChartCard, Insight, SectionGrid, TooltipRow, chartColor } from "./shared";

const ISSUE_BADGE: Record<"destructive" | "warning" | "info", string> = {
	destructive: "bg-destructive/10 text-destructive",
	warning: "bg-warning/15 text-warning",
	info: "bg-info/12 text-info",
};

function issueTone(issue: ImageIssue, severity: ImageOpportunity["severity"]) {
	if (issue === "large") return severity === "high" ? "destructive" : "warning";
	if (issue === "uncompressed") return "warning";
	return "info";
}

export function ImageSection({ entries, indices }: { entries: HAREntry[]; indices: number[] }) {
	const openEntry = useHarStore((s) => s.openEntry);
	const data = useMemo(() => computeImages(entries, indices), [entries, indices]);

	const { formats, config } = useMemo(() => {
		const config: ChartConfig = { size: { label: "Size" } };
		const formats = (data?.formats ?? []).map((format, index) => {
			const fill = chartColor(index);
			config[format.format] = { label: format.format, color: fill };
			return { ...format, fill };
		});
		return { formats, config };
	}, [data]);

	return (
		<PageSection
			id="analytics-images"
			className="scroll-mt-4"
			title="Image optimization"
			description="Oversized images, legacy formats and missing compression."
		>
			{!data ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ImageIcon />
						</EmptyMedia>
						<EmptyTitle className="text-base">No images</EmptyTitle>
						<EmptyDescription>There are no image requests to analyze.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<>
					<StatGrid>
						<StatCard
							icon={ImageIcon}
							tone="primary"
							label="Images"
							value={data.totalImages.toLocaleString()}
						/>
						<StatCard
							icon={FileArchive}
							label="Total image size"
							value={formatBytes(data.totalImageSize)}
							hint="Decoded size"
						/>
						<StatCard
							icon={Lightbulb}
							tone={data.potentialSavings > 0 ? "warning" : "default"}
							label="Potential savings"
							value={`~${formatBytes(data.potentialSavings)}`}
							hint="Rough estimate"
						/>
						<StatCard
							icon={TrendingDown}
							tone="success"
							label="Reduction"
							value={`${data.savingsPercentage}%`}
							hint="Of total image size"
						/>
					</StatGrid>

					<SectionGrid>
						<ChartCard title="Format distribution" description="Decoded bytes per image format.">
							<ChartContainer config={config} className={CHART_CLASS}>
								<BarChart data={formats} layout="vertical" margin={{ left: 0, right: 12 }}>
									<CartesianGrid horizontal={false} />
									<XAxis
										type="number"
										tickLine={false}
										axisLine={false}
										tickFormatter={formatBytesAxis}
										minTickGap={16}
									/>
									<YAxis
										type="category"
										dataKey="format"
										width={64}
										interval={0}
										tickLine={false}
										axisLine={false}
									/>
									<ChartTooltip
										cursor={false}
										content={
											<ChartTooltipContent
												formatter={(value, _name, item) => (
													<TooltipRow
														color={item.payload?.fill}
														label="Size"
														value={`${formatBytes(Number(value))} · ${plural(Number(item.payload?.count ?? 0), "image")}`}
													/>
												)}
											/>
										}
									/>
									<Bar dataKey="size" radius={4} maxBarSize={24}>
										{formats.map((format) => (
											<Cell key={format.format} fill={format.fill} />
										))}
									</Bar>
								</BarChart>
							</ChartContainer>
						</ChartCard>

						<ChartCard title="Issues found" description="Images can have more than one issue.">
							<ul className="flex flex-col gap-2">
								<IssueCounter
									icon={AlertTriangle}
									tone="destructive"
									title="Large images"
									description="Over 100 KB each"
									count={data.largeCount}
								/>
								<IssueCounter
									icon={FileArchive}
									tone="warning"
									title="Uncompressed"
									description="SVG, ICO, BMP or TIFF sent without gzip/Brotli"
									count={data.uncompressedCount}
								/>
								<IssueCounter
									icon={Sparkles}
									tone="info"
									title="Legacy formats"
									description="JPEG, PNG, GIF, BMP or TIFF over 50 KB that could be WebP/AVIF"
									count={data.legacyCount}
								/>
							</ul>
						</ChartCard>
					</SectionGrid>

					{data.topOpportunities.length > 0 && (
						<ChartCard
							title="Top opportunities"
							description={
								data.opportunityCount > data.topOpportunities.length
									? `Showing ${data.topOpportunities.length} of ${data.opportunityCount}, largest savings first`
									: "Largest savings first"
							}
						>
							<ul className="-mx-2 flex flex-col">
								{data.topOpportunities.map((opp) => (
									<li key={opp.index}>
										<button
											type="button"
											onClick={() => openEntry(opp.index, "response")}
											title={opp.url}
											className="flex w-full min-w-0 flex-col gap-1.5 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
										>
											<div className="flex min-w-0 flex-wrap items-center gap-1.5">
												{opp.issues.map((issue) => (
													<span
														key={issue}
														className={cn(
															"inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium",
															ISSUE_BADGE[issueTone(issue, opp.severity)]
														)}
													>
														{IMAGE_ISSUE_DETAILS[issue].label}
													</span>
												))}
												<span className="text-xs text-muted-foreground">{opp.format}</span>
												<span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">
													{formatBytes(opp.size)}
												</span>
											</div>
											<span className="min-w-0 truncate font-mono text-xs">{opp.path}</span>
											<div className="flex min-w-0 flex-col gap-0.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
												<span className="min-w-0 text-muted-foreground">
													{opp.issues
														.map((issue) => IMAGE_ISSUE_DETAILS[issue].recommendation)
														.join(" · ")}
												</span>
												<span className="shrink-0 font-medium text-success">
													{opp.potentialSaving > 0
														? `Save ~${formatBytes(opp.potentialSaving)}`
														: "Savings depend on dimensions"}
												</span>
											</div>
										</button>
									</li>
								))}
							</ul>
						</ChartCard>
					)}

					{data.potentialSavings > 0 && (
						<Insight icon={Lightbulb} tone="success" title="Optimization summary">
							Modern formats and compression could reduce total image size by roughly{" "}
							{formatBytes(data.potentialSavings)} ({data.savingsPercentage}%), before any resizing.
						</Insight>
					)}
				</>
			)}
		</PageSection>
	);
}

function IssueCounter({
	icon: Icon,
	tone,
	title,
	description,
	count,
}: {
	icon: ComponentType<{ className?: string }>;
	tone: keyof typeof ISSUE_BADGE;
	title: string;
	description: string;
	count: number;
}) {
	return (
		<li className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
			<span
				className={cn(
					"flex size-8 shrink-0 items-center justify-center rounded-md",
					count > 0 ? ISSUE_BADGE[tone] : "bg-muted text-muted-foreground"
				)}
			>
				<Icon className="size-4" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-xs text-pretty text-muted-foreground">{description}</p>
			</div>
			<span className="shrink-0 text-xl font-semibold tabular-nums">{count.toLocaleString()}</span>
		</li>
	);
}
