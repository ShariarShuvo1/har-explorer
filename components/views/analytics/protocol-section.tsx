"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Network } from "lucide-react";
import { PageSection } from "@/components/common/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import type { HAREntry } from "@/lib/har-types";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { computeProtocols } from "@/lib/analytics/protocols";
import { formatBytesAxis, formatMsAxis, percentOf, plural } from "@/lib/analytics/format";
import {
	CHART_CLASS,
	ChartCard,
	Insight,
	MetricRow,
	SectionGrid,
	TooltipRow,
	chartColor,
} from "./shared";

const comparisonConfig = {
	avgTime: { label: "Avg time (left)", color: "var(--chart-2)" },
	avgSize: { label: "Avg transfer (right)", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ProtocolSection({ entries, indices }: { entries: HAREntry[]; indices: number[] }) {
	const data = useMemo(() => computeProtocols(entries, indices), [entries, indices]);

	const { rows, distributionConfig } = useMemo(() => {
		const distributionConfig: ChartConfig = { count: { label: "Requests" } };
		const rows = (data?.protocols ?? []).map((protocol, index) => {
			const fill = chartColor(index);
			distributionConfig[protocol.version] = { label: protocol.version, color: fill };
			return { ...protocol, fill };
		});
		return { rows, distributionConfig };
	}, [data]);

	if (!data) return null;
	const total = indices.length;

	return (
		<PageSection
			id="analytics-protocols"
			className="scroll-mt-4"
			title="Protocol performance"
			description="How each HTTP version performed and how well connections were reused."
		>
			<div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{rows.map((protocol) => (
					<Card key={protocol.version} className="min-w-0 gap-2 py-4 shadow-xs">
						<CardHeader className="flex items-center justify-between gap-2 px-4">
							<CardTitle className="flex min-w-0 items-center gap-2 text-sm">
								<span
									className="size-2.5 shrink-0 rounded-[2px]"
									style={{ backgroundColor: protocol.fill }}
								/>
								<span className="truncate">{protocol.version}</span>
							</CardTitle>
							<Badge variant="secondary" className="tabular-nums">
								{plural(protocol.count, "request")}
							</Badge>
						</CardHeader>
						<CardContent className="divide-y px-4">
							<MetricRow label="Avg response time" value={formatTime(protocol.avgTime)} />
							<MetricRow label="Avg wait (TTFB)" value={formatTime(protocol.avgWait)} />
							<MetricRow label="Avg transfer size" value={formatBytes(protocol.avgSize)} />
							<MetricRow
								label="Connection reuse"
								hint={protocol.reuseBasis}
								value={protocol.reuseRate === null ? "—" : `${protocol.reuseRate}%`}
								valueClassName={
									protocol.reuseRate === null ? "text-muted-foreground" : "text-success"
								}
							/>
						</CardContent>
					</Card>
				))}
			</div>

			<SectionGrid>
				<ChartCard
					title="Performance comparison"
					description="Average time (left axis) and transfer size (right axis)."
				>
					<ChartContainer config={comparisonConfig} className={CHART_CLASS}>
						<BarChart data={rows} margin={{ left: 0, right: 0 }}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="version"
								tickLine={false}
								axisLine={false}
								interval={0}
								tickFormatter={(v) => String(v)}
							/>
							<YAxis
								yAxisId="time"
								width={56}
								tickLine={false}
								axisLine={false}
								tickFormatter={formatMsAxis}
							/>
							<YAxis
								yAxisId="size"
								orientation="right"
								width={60}
								tickLine={false}
								axisLine={false}
								tickFormatter={formatBytesAxis}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										formatter={(value, name) =>
											name === "avgSize" ? (
												<TooltipRow
													color="var(--color-avgSize)"
													label="Avg transfer"
													value={formatBytes(Number(value))}
												/>
											) : (
												<TooltipRow
													color="var(--color-avgTime)"
													label="Avg time"
													value={formatTime(Number(value))}
												/>
											)
										}
									/>
								}
							/>
							<ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />} />
							<Bar
								yAxisId="time"
								dataKey="avgTime"
								fill="var(--color-avgTime)"
								radius={4}
								maxBarSize={40}
							/>
							<Bar
								yAxisId="size"
								dataKey="avgSize"
								fill="var(--color-avgSize)"
								radius={4}
								maxBarSize={40}
							/>
						</BarChart>
					</ChartContainer>
				</ChartCard>

				<ChartCard title="Protocol distribution" description="Share of requests per HTTP version.">
					<div className="flex min-w-0 flex-col gap-4 @[36rem]:flex-row @[36rem]:items-center">
						<ChartContainer
							config={distributionConfig}
							className="mx-auto aspect-square h-[200px] w-full max-w-[220px] shrink-0 @[36rem]:h-[220px]"
						>
							<PieChart>
								<ChartTooltip
									content={
										<ChartTooltipContent
											hideLabel
											nameKey="version"
											formatter={(value, _name, item) => (
												<TooltipRow
													color={item.payload?.fill}
													label={item.payload?.version}
													value={`${Number(value).toLocaleString()} · ${percentOf(Number(value), total)}%`}
												/>
											)}
										/>
									}
								/>
								<Pie
									data={rows}
									dataKey="count"
									nameKey="version"
									innerRadius="58%"
									outerRadius="90%"
									strokeWidth={2}
									stroke="var(--card)"
								>
									{rows.map((row) => (
										<Cell key={row.version} fill={row.fill} />
									))}
								</Pie>
							</PieChart>
						</ChartContainer>
						<ul className="flex min-w-0 flex-1 flex-col gap-1">
							{rows.map((row) => (
								<li
									key={row.version}
									className="flex min-w-0 items-center gap-2 px-2 py-1.5 text-sm"
								>
									<span
										className="size-2.5 shrink-0 rounded-[2px]"
										style={{ backgroundColor: row.fill }}
									/>
									<span className="min-w-0 flex-1 truncate">{row.version}</span>
									<span className="shrink-0 tabular-nums">{row.count.toLocaleString()}</span>
									<span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
										{percentOf(row.count, total)}%
									</span>
								</li>
							))}
						</ul>
					</div>
				</ChartCard>
			</SectionGrid>

			{data.legacyCount > 0 && (
				<Insight icon={Network} title="HTTP/1.x in use">
					{plural(data.legacyCount, "request")} ({data.legacyShare}%) used HTTP/1.x.{" "}
					{data.hasModernProtocol
						? "Serving those origins over HTTP/2 or HTTP/3 would allow multiplexing and header compression."
						: "HTTP/2 and HTTP/3 typically offer better performance through multiplexing and header compression."}
				</Insight>
			)}
		</PageSection>
	);
}
