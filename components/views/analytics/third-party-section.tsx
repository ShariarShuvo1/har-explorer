"use client";

import { useMemo, type ComponentType } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import { PageSection } from "@/components/common/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useHarStore } from "@/lib/stores/har-store";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { HAREntry } from "@/lib/har-types";
import { formatBytes, formatTime } from "@/lib/har-parser";
import {
	THIRD_PARTY_CATEGORY_LABELS,
	computeThirdParty,
	detectFirstPartySite,
	type PartyStats,
} from "@/lib/analytics/third-party";
import { formatBytesAxis, percentOf, plural, truncateLabel } from "@/lib/analytics/format";
import { cn } from "@/lib/cn";
import {
	ChartCard,
	ChartPlaceholder,
	Insight,
	MetricRow,
	SectionGrid,
	TooltipRow,
	chartColor,
} from "./shared";

const TOP_TABLE = 10;
const TOP_CHART = 5;
const COMBINED_TIME_HINT = "Sum of request durations; parallel requests overlap";

const PARTY_COLORS = {
	"First-party": "var(--chart-1)",
	"Third-party": "var(--chart-2)",
} as const;

const distributionConfig = {
	value: { label: "Requests" },
	"First-party": { label: "First-party", color: PARTY_COLORS["First-party"] },
	"Third-party": { label: "Third-party", color: PARTY_COLORS["Third-party"] },
} satisfies ChartConfig;

const sizeConfig = {
	size: { label: "Transferred", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ThirdPartySection({
	entries,
	indices,
}: {
	entries: HAREntry[];
	indices: number[];
}) {
	const pages = useHarStore((s) => s.harData?.log.pages);
	const isMobile = useIsMobile();
	// Detected from the whole capture so filtering never changes which site is "first".
	const firstPartySite = useMemo(() => detectFirstPartySite(entries, pages), [entries, pages]);
	const data = useMemo(
		() => computeThirdParty(entries, indices, firstPartySite),
		[entries, indices, firstPartySite]
	);

	if (!data) return null;

	const total = indices.length;
	const hasThirdParty = data.thirdPartyTotal.count > 0;
	const distribution = data.distribution.map((slice) => ({
		...slice,
		fill: PARTY_COLORS[slice.name],
	}));
	const topDomains = data.domains.slice(0, TOP_TABLE);
	const chartDomains = data.domains.slice(0, TOP_CHART);

	return (
		<PageSection
			id="analytics-third-party"
			className="scroll-mt-4"
			title="Third-party impact"
			description="Requests to domains outside the captured site and what they cost."
		>
			<div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
				<PartyCard
					icon={ShieldCheck}
					title="First-party"
					subtitle={data.firstPartySite || "Unknown site"}
					subtitleTitle={
						data.firstPartySite ? `${data.firstPartySite} and its subdomains` : undefined
					}
					color={PARTY_COLORS["First-party"]}
					stats={data.firstParty}
					total={total}
				/>
				<PartyCard
					icon={ExternalLink}
					title="Third-party"
					subtitle={plural(data.thirdPartyDomainCount, "domain")}
					color={PARTY_COLORS["Third-party"]}
					stats={data.thirdPartyTotal}
					total={total}
					showScriptTime
				/>
			</div>

			<SectionGrid>
				<ChartCard
					title="Request distribution"
					description="First-party versus third-party requests."
				>
					<ChartContainer
						config={distributionConfig}
						className="mx-auto aspect-square h-[200px] w-full max-w-[240px] sm:h-[220px]"
					>
						<PieChart>
							<ChartTooltip
								content={
									<ChartTooltipContent
										hideLabel
										nameKey="name"
										formatter={(value, _name, item) => (
											<TooltipRow
												color={item.payload?.fill}
												label={item.payload?.name}
												value={`${Number(value).toLocaleString()} · ${percentOf(Number(value), total)}%`}
											/>
										)}
									/>
								}
							/>
							<Pie
								data={distribution}
								dataKey="value"
								nameKey="name"
								innerRadius="58%"
								outerRadius="90%"
								strokeWidth={2}
								stroke="var(--card)"
							>
								{distribution.map((slice) => (
									<Cell key={slice.name} fill={slice.fill} />
								))}
							</Pie>
						</PieChart>
					</ChartContainer>
					<div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
						{distribution.map((slice) => (
							<span key={slice.name} className="flex items-center gap-1.5">
								<span className="size-2.5 rounded-[2px]" style={{ backgroundColor: slice.fill }} />
								{slice.name}
								<span className="text-muted-foreground tabular-nums">
									{slice.value.toLocaleString()} ({percentOf(slice.value, total)}%)
								</span>
							</span>
						))}
					</div>
				</ChartCard>

				<ChartCard title="Categories" description="Third-party domains grouped by provider type.">
					{data.categories.length > 0 ? (
						<ul className="flex flex-col gap-3">
							{data.categories.map((category, index) => (
								<li key={category.name} className="min-w-0">
									<div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
										<span className="flex min-w-0 items-center gap-2">
											<span
												className="size-2.5 shrink-0 rounded-[2px]"
												style={{ backgroundColor: chartColor(index) }}
											/>
											<span className="truncate font-medium">
												{THIRD_PARTY_CATEGORY_LABELS[category.name]}
											</span>
											<span className="shrink-0 text-xs text-muted-foreground">
												{plural(category.domains, "domain")}
											</span>
										</span>
										<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
											{plural(category.count, "request")} · {formatBytes(category.size)}
										</span>
									</div>
									<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full"
											style={{
												width: `${Math.max(2, percentOf(category.count, data.thirdPartyTotal.count))}%`,
												backgroundColor: chartColor(index),
											}}
										/>
									</div>
								</li>
							))}
						</ul>
					) : (
						<ChartPlaceholder>No third-party domains.</ChartPlaceholder>
					)}
				</ChartCard>
			</SectionGrid>

			<ChartCard
				title="Top third-party domains"
				description={
					hasThirdParty
						? `By transfer size · showing ${topDomains.length} of ${data.thirdPartyDomainCount}`
						: undefined
				}
			>
				{hasThirdParty ? (
					<div className="flex min-w-0 flex-col gap-4">
						<ChartContainer
							config={sizeConfig}
							className="aspect-auto h-[200px] w-full sm:h-[220px]"
						>
							<BarChart data={chartDomains} layout="vertical" margin={{ left: 0, right: 12 }}>
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
									dataKey="domain"
									width={isMobile ? 100 : 170}
									interval={0}
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => truncateLabel(value, isMobile ? 14 : 26)}
								/>
								<ChartTooltip
									cursor={false}
									content={
										<ChartTooltipContent
											formatter={(value, _name, item) => (
												<TooltipRow
													color="var(--color-size)"
													label="Transferred"
													value={`${formatBytes(Number(value))} · ${plural(Number(item.payload?.count ?? 0), "request")}`}
												/>
											)}
										/>
									}
								/>
								<Bar dataKey="size" fill="var(--color-size)" radius={4} maxBarSize={24} />
							</BarChart>
						</ChartContainer>

						<div className="hidden md:block">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Domain</TableHead>
										<TableHead>Category</TableHead>
										<TableHead className="text-right">Requests</TableHead>
										<TableHead className="text-right">Transferred</TableHead>
										<TableHead className="text-right">Combined time</TableHead>
										<TableHead className="text-right">Script & CSS time</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{topDomains.map((domain) => (
										<TableRow key={domain.domain}>
											<TableCell
												className="max-w-[280px] truncate font-mono text-xs"
												title={domain.domain}
											>
												{domain.domain}
											</TableCell>
											<TableCell>
												<Badge variant="outline">
													{THIRD_PARTY_CATEGORY_LABELS[domain.category]}
												</Badge>
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{domain.count.toLocaleString()}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatBytes(domain.size)}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatTime(domain.time)}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatTime(domain.scriptTime)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						<ul className="flex flex-col divide-y rounded-lg border md:hidden">
							{topDomains.map((domain) => (
								<li key={domain.domain} className="flex min-w-0 flex-col gap-1.5 p-3">
									<div className="flex min-w-0 items-center justify-between gap-2">
										<span className="min-w-0 truncate font-mono text-xs" title={domain.domain}>
											{domain.domain}
										</span>
										<Badge variant="outline">{THIRD_PARTY_CATEGORY_LABELS[domain.category]}</Badge>
									</div>
									<div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
										<span>
											Requests{" "}
											<span className="text-foreground tabular-nums">
												{domain.count.toLocaleString()}
											</span>
										</span>
										<span>
											Transferred{" "}
											<span className="text-foreground tabular-nums">
												{formatBytes(domain.size)}
											</span>
										</span>
										<span>
											Time{" "}
											<span className="text-foreground tabular-nums">
												{formatTime(domain.time)}
											</span>
										</span>
										<span>
											Script & CSS{" "}
											<span className="text-foreground tabular-nums">
												{formatTime(domain.scriptTime)}
											</span>
										</span>
									</div>
								</li>
							))}
						</ul>
					</div>
				) : (
					<ChartPlaceholder>
						No third-party requests. Everything was served from{" "}
						{data.firstPartySite || "the main site"}.
					</ChartPlaceholder>
				)}
			</ChartCard>

			{data.thirdPartyTotal.scriptTime > 1000 && (
				<Insight icon={AlertTriangle} tone="destructive" title="Third-party scripts slow the page">
					Third-party scripts and stylesheets took a combined{" "}
					{formatTime(data.thirdPartyTotal.scriptTime)} to load. Consider async or defer loading, or
					evaluate whether these resources are necessary.
				</Insight>
			)}
		</PageSection>
	);
}

function PartyCard({
	icon: Icon,
	title,
	subtitle,
	subtitleTitle,
	color,
	stats,
	total,
	showScriptTime = false,
}: {
	icon: ComponentType<{ className?: string }>;
	title: string;
	subtitle: string;
	subtitleTitle?: string;
	color: string;
	stats: PartyStats;
	total: number;
	showScriptTime?: boolean;
}) {
	return (
		<Card className="min-w-0 gap-2 py-4 shadow-xs">
			<CardHeader className="flex items-center gap-3 px-4">
				<span
					className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground"
					style={{ backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)` }}
				>
					<Icon className="size-4" />
				</span>
				<div className="min-w-0">
					<CardTitle className="text-sm">{title}</CardTitle>
					<CardDescription className="truncate font-mono text-xs" title={subtitleTitle}>
						{subtitle}
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent className="divide-y px-4">
				<MetricRow
					label="Requests"
					value={`${stats.count.toLocaleString()} (${percentOf(stats.count, total)}%)`}
				/>
				<MetricRow label="Transferred" value={formatBytes(stats.size)} />
				<MetricRow label="Combined time" hint={COMBINED_TIME_HINT} value={formatTime(stats.time)} />
				{showScriptTime && (
					<MetricRow
						label="Script & CSS time"
						hint="Scripts and stylesheets can block rendering"
						value={formatTime(stats.scriptTime)}
						valueClassName={cn(stats.scriptTime > 1000 && "text-destructive")}
					/>
				)}
			</CardContent>
		</Card>
	);
}
