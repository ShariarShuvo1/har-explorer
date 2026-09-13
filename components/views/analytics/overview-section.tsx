"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
	Ban,
	CheckCircle2,
	Clock,
	CornerDownRight,
	Globe,
	HardDrive,
	XCircle,
	Zap,
} from "lucide-react";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import { PageSection } from "@/components/common/page";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import { useHarStore } from "@/lib/stores/har-store";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { RESOURCE_TYPE_LABELS } from "@/lib/resource-type";
import type { ResourceType } from "@/lib/har-types";
import type { OverviewAnalytics } from "@/lib/analytics/overview";
import { formatMsAxis, percentOf, truncateLabel } from "@/lib/analytics/format";
import {
	CHART_CLASS,
	ChartCard,
	ChartPlaceholder,
	SectionGrid,
	TooltipRow,
	chartColor,
} from "./shared";

export function OverviewStats({ data }: { data: OverviewAnalytics }) {
	const total = data.totalRequests;
	const errorCount = data.clientErrorCount + data.serverErrorCount;
	return (
		<StatGrid>
			<StatCard icon={Globe} tone="primary" label="Requests" value={total.toLocaleString()} />
			<StatCard
				icon={HardDrive}
				tone="info"
				label="Transferred"
				value={formatBytes(data.transferSize)}
				hint={`${formatBytes(data.contentSize)} resources`}
			/>
			<StatCard icon={Clock} label="Avg response time" value={formatTime(data.avgTime)} />
			<StatCard
				icon={Zap}
				tone="primary"
				label="Served from cache"
				value={`${percentOf(data.cachedCount + data.revalidatedCount, total)}%`}
				hint={`${data.cachedCount.toLocaleString()} cached · ${data.revalidatedCount.toLocaleString()} revalidated · ${data.cacheableCount.toLocaleString()} cacheable`}
			/>
			<StatCard
				icon={CheckCircle2}
				tone="success"
				label="Successful (2xx)"
				value={data.successCount.toLocaleString()}
				hint={`${percentOf(data.successCount, total)}% of requests`}
			/>
			<StatCard
				icon={CornerDownRight}
				tone="info"
				label="Redirects & not modified (3xx)"
				value={data.redirectCount.toLocaleString()}
				hint={`${percentOf(data.redirectCount, total)}% of requests`}
			/>
			<StatCard
				icon={XCircle}
				tone={errorCount > 0 ? "destructive" : "default"}
				label="Errors (4xx/5xx)"
				value={errorCount.toLocaleString()}
				hint={`${data.clientErrorCount.toLocaleString()} client · ${data.serverErrorCount.toLocaleString()} server`}
			/>
			<StatCard
				icon={Ban}
				tone={data.failedCount > 0 ? "warning" : "default"}
				label="Failed / no response"
				value={data.failedCount.toLocaleString()}
				hint="Blocked, cancelled or status 0"
			/>
		</StatGrid>
	);
}

export function RequestsSection({ data }: { data: OverviewAnalytics }) {
	return (
		<PageSection
			id="analytics-requests"
			className="scroll-mt-4"
			title="Requests"
			description="What was requested, from where, and where the time went."
		>
			<SectionGrid>
				<ResourceTypesCard data={data} />
				<TopDomainsCard data={data} />
				<TimingBreakdownCard data={data} />
				<SlowestRequestsCard data={data} />
			</SectionGrid>
		</PageSection>
	);
}

function ResourceTypesCard({ data }: { data: OverviewAnalytics }) {
	const setResourceTypeFilter = useHarStore((s) => s.setResourceTypeFilter);
	const setViewMode = useHarStore((s) => s.setViewMode);

	const { rows, config } = useMemo(() => {
		const config: ChartConfig = { count: { label: "Requests" } };
		const rows = data.types.map((item, index) => {
			const label = RESOURCE_TYPE_LABELS[item.type];
			const fill = chartColor(index);
			config[item.type] = { label, color: fill };
			return { ...item, label, fill };
		});
		return { rows, config };
	}, [data.types]);

	const showType = (type: ResourceType) => {
		setResourceTypeFilter(type);
		setViewMode("requests");
	};

	return (
		<ChartCard title="Resource types" description="Click a type to list its requests.">
			<div className="flex min-w-0 flex-col gap-4 @[36rem]:flex-row @[36rem]:items-center">
				<ChartContainer
					config={config}
					className="mx-auto aspect-square h-[200px] w-full max-w-[220px] shrink-0 @[36rem]:h-[220px]"
				>
					<PieChart>
						<ChartTooltip
							content={
								<ChartTooltipContent
									hideLabel
									nameKey="type"
									formatter={(value, _name, item) => (
										<TooltipRow
											color={item.payload?.fill}
											label={item.payload?.label}
											value={`${Number(value).toLocaleString()} · ${percentOf(Number(value), data.totalRequests)}%`}
										/>
									)}
								/>
							}
						/>
						<Pie
							data={rows}
							dataKey="count"
							nameKey="type"
							innerRadius="58%"
							outerRadius="90%"
							strokeWidth={2}
							stroke="var(--card)"
						>
							{rows.map((row) => (
								<Cell key={row.type} fill={row.fill} />
							))}
							<Label
								content={({ viewBox }) => {
									if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
									return (
										<text
											x={viewBox.cx}
											y={viewBox.cy}
											textAnchor="middle"
											dominantBaseline="middle"
										>
											<tspan
												x={viewBox.cx}
												y={viewBox.cy}
												className="fill-foreground text-xl font-semibold"
											>
												{data.totalRequests.toLocaleString()}
											</tspan>
											<tspan
												x={viewBox.cx}
												y={(viewBox.cy ?? 0) + 18}
												className="fill-muted-foreground text-xs"
											>
												requests
											</tspan>
										</text>
									);
								}}
							/>
						</Pie>
					</PieChart>
				</ChartContainer>
				<ul className="flex min-w-0 flex-1 flex-col">
					{rows.map((row) => (
						<li key={row.type}>
							<button
								type="button"
								onClick={() => showType(row.type)}
								className="flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
							>
								<span
									className="size-2.5 shrink-0 rounded-[2px]"
									style={{ backgroundColor: row.fill }}
								/>
								<span className="min-w-0 flex-1 truncate">{row.label}</span>
								<span className="w-12 shrink-0 text-right tabular-nums">
									{row.count.toLocaleString()}
								</span>
								<span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
									{percentOf(row.count, data.totalRequests)}%
								</span>
								<span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
									{formatBytes(row.size)}
								</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		</ChartCard>
	);
}

const domainConfig = {
	count: { label: "Requests", color: "var(--chart-1)" },
} satisfies ChartConfig;

function TopDomainsCard({ data }: { data: OverviewAnalytics }) {
	const isMobile = useIsMobile();
	return (
		<ChartCard title="Top domains" description={`By request count · top ${data.domains.length}`}>
			<ChartContainer config={domainConfig} className={CHART_CLASS}>
				<BarChart data={data.domains} layout="vertical" margin={{ left: 0, right: 12 }}>
					<CartesianGrid horizontal={false} />
					<XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
					<YAxis
						type="category"
						dataKey="domain"
						width={isMobile ? 100 : 150}
						interval={0}
						tickLine={false}
						axisLine={false}
						tickFormatter={(value) => truncateLabel(value, isMobile ? 14 : 22)}
					/>
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								formatter={(value) => (
									<TooltipRow
										color="var(--color-count)"
										label="Requests"
										value={Number(value).toLocaleString()}
									/>
								)}
							/>
						}
					/>
					<Bar dataKey="count" fill="var(--color-count)" radius={4} maxBarSize={22} />
				</BarChart>
			</ChartContainer>
		</ChartCard>
	);
}

function TimingBreakdownCard({ data }: { data: OverviewAnalytics }) {
	const config = useMemo(() => {
		const config: ChartConfig = { total: { label: "Total" } };
		for (const phase of data.timing) config[phase.key] = { label: phase.label, color: phase.color };
		return config;
	}, [data.timing]);

	return (
		<ChartCard
			title="Timing breakdown"
			description="Time in each phase, summed across requests. TCP excludes the TLS handshake."
		>
			{data.timing.length > 0 ? (
				<ChartContainer config={config} className={CHART_CLASS}>
					<BarChart data={data.timing} layout="vertical" margin={{ left: 0, right: 12 }}>
						<CartesianGrid horizontal={false} />
						<XAxis
							type="number"
							tickLine={false}
							axisLine={false}
							tickFormatter={formatMsAxis}
							minTickGap={16}
						/>
						<YAxis
							type="category"
							dataKey="label"
							width={84}
							interval={0}
							tickLine={false}
							axisLine={false}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									formatter={(value, _name, item) => (
										<div className="grid w-full gap-1">
											<TooltipRow
												color={item.payload?.color}
												label="Total"
												value={formatTime(Number(value))}
											/>
											<TooltipRow
												label="Average"
												value={formatTime(Number(item.payload?.avg ?? 0))}
											/>
										</div>
									)}
								/>
							}
						/>
						<Bar dataKey="total" radius={4} maxBarSize={24}>
							{data.timing.map((phase) => (
								<Cell key={phase.key} fill={phase.color} />
							))}
						</Bar>
					</BarChart>
				</ChartContainer>
			) : (
				<ChartPlaceholder>No timing data available.</ChartPlaceholder>
			)}
		</ChartCard>
	);
}

function SlowestRequestsCard({ data }: { data: OverviewAnalytics }) {
	const openEntry = useHarStore((s) => s.openEntry);
	return (
		<ChartCard title="Slowest requests" description="Open a request to inspect its timing.">
			<ul className="-mx-2 flex flex-col">
				{data.slowest.map((req) => (
					<li key={req.index}>
						<button
							type="button"
							onClick={() => openEntry(req.index, "timing")}
							title={`${req.method} ${req.url}`}
							className="flex w-full min-w-0 flex-col gap-1 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
						>
							<div className="flex min-w-0 items-center gap-2">
								<StatusBadge status={req.status} statusText={req.statusText} />
								<MethodBadge method={req.method} />
								<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
									{req.host}
								</span>
								<span className="shrink-0 text-sm font-semibold tabular-nums">
									{formatTime(req.time)}
								</span>
							</div>
							<div className="flex min-w-0 items-center gap-2">
								<span className="min-w-0 flex-1 truncate font-mono text-xs">{req.path}</span>
								<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
									{formatBytes(req.size)}
								</span>
							</div>
						</button>
					</li>
				))}
			</ul>
		</ChartCard>
	);
}
