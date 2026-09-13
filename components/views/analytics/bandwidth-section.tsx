"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Activity, Gauge, TrendingUp } from "lucide-react";
import { PageSection } from "@/components/common/page";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import type { HAREntry } from "@/lib/har-types";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { computeBandwidth } from "@/lib/analytics/bandwidth";
import { formatBytesAxis, formatMsAxis, formatSeconds } from "@/lib/analytics/format";
import {
	CHART_CLASS,
	ChartCard,
	ChartPlaceholder,
	Insight,
	SectionGrid,
	TooltipRow,
} from "./shared";

const rateConfig = { rate: { label: "Rate", color: "var(--chart-2)" } } satisfies ChartConfig;
const totalConfig = {
	total: { label: "Transferred", color: "var(--chart-1)" },
} satisfies ChartConfig;

const secondsTick = (value: unknown) => formatMsAxis(Number(value) * 1000);

function pointTime(payload: unknown): number {
	const first = Array.isArray(payload)
		? (payload[0] as { payload?: { t?: number } } | undefined)
		: undefined;
	return first?.payload?.t ?? 0;
}

export function BandwidthSection({ entries, indices }: { entries: HAREntry[]; indices: number[] }) {
	const data = useMemo(() => computeBandwidth(entries, indices), [entries, indices]);

	return (
		<PageSection
			id="analytics-bandwidth"
			className="scroll-mt-4"
			title="Bandwidth"
			description="Download rate over the capture, with bytes spread across each response's receive phase."
		>
			{!data ? (
				<ChartPlaceholder>
					No requests have a usable start time, so bandwidth cannot be charted.
				</ChartPlaceholder>
			) : (
				<>
					<StatGrid className="grid-cols-1 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-3">
						<StatCard
							icon={Gauge}
							tone="primary"
							label="Peak download rate"
							value={`${formatBytes(data.peakRate)}/s`}
							hint={`at ${formatSeconds(data.peakTime)} (${formatTime(data.bucketSize)} window)`}
						/>
						<StatCard
							icon={TrendingUp}
							tone="info"
							label="Average download rate"
							value={`${formatBytes(data.avgRate)}/s`}
							hint={`over ${formatTime(data.durationMs)}`}
						/>
						<StatCard
							icon={Activity}
							label="Total transferred"
							value={formatBytes(data.totalBytes)}
							hint={`in ${formatTime(data.durationMs)}`}
						/>
					</StatGrid>

					<SectionGrid>
						<ChartCard
							title="Transfer rate over time"
							description={`Bytes per second in ${formatTime(data.bucketSize)} windows.`}
						>
							<ChartContainer config={rateConfig} className={CHART_CLASS}>
								<AreaChart data={data.rateTimeline} margin={{ left: 0, right: 12 }}>
									<CartesianGrid vertical={false} />
									<XAxis
										dataKey="t"
										type="number"
										domain={[0, data.endSeconds]}
										tickLine={false}
										axisLine={false}
										tickFormatter={secondsTick}
										interval="preserveStartEnd"
										minTickGap={28}
									/>
									<YAxis
										width={72}
										tickLine={false}
										axisLine={false}
										tickFormatter={(value) => `${formatBytesAxis(value)}/s`}
									/>
									<ChartTooltip
										content={
											<ChartTooltipContent
												labelFormatter={(_, payload) => `at ${formatSeconds(pointTime(payload))}`}
												formatter={(value) => (
													<TooltipRow
														color="var(--color-rate)"
														label="Rate"
														value={`${formatBytes(Number(value))}/s`}
													/>
												)}
											/>
										}
									/>
									<Area
										type="stepAfter"
										dataKey="rate"
										stroke="var(--color-rate)"
										fill="var(--color-rate)"
										fillOpacity={0.2}
										isAnimationActive={false}
									/>
								</AreaChart>
							</ChartContainer>
						</ChartCard>

						<ChartCard
							title="Cumulative transfer"
							description="Total bytes received by each point in time."
						>
							<ChartContainer config={totalConfig} className={CHART_CLASS}>
								<LineChart data={data.cumulativeTimeline} margin={{ left: 0, right: 12 }}>
									<CartesianGrid vertical={false} />
									<XAxis
										dataKey="t"
										type="number"
										domain={[0, data.endSeconds]}
										tickLine={false}
										axisLine={false}
										tickFormatter={secondsTick}
										interval="preserveStartEnd"
										minTickGap={28}
									/>
									<YAxis
										width={64}
										tickLine={false}
										axisLine={false}
										tickFormatter={formatBytesAxis}
									/>
									<ChartTooltip
										content={
											<ChartTooltipContent
												labelFormatter={(_, payload) => `by ${formatSeconds(pointTime(payload))}`}
												formatter={(value) => (
													<TooltipRow
														color="var(--color-total)"
														label="Transferred"
														value={formatBytes(Number(value))}
													/>
												)}
											/>
										}
									/>
									<Line
										type="monotone"
										dataKey="total"
										stroke="var(--color-total)"
										strokeWidth={2}
										dot={false}
										isAnimationActive={false}
									/>
								</LineChart>
							</ChartContainer>
						</ChartCard>
					</SectionGrid>

					<Insight
						icon={Activity}
						title="Bandwidth analysis"
						tone={data.totalBytes > 0 && data.peakRate > data.avgRate * 3 ? "warning" : "info"}
					>
						{data.totalBytes > 0 ? (
							<>
								The download rate peaks at {formatBytes(data.peakRate)}/s around{" "}
								{formatSeconds(data.peakTime)}.
								{data.peakRate > data.avgRate * 3 &&
									" Consider deferring or lazy-loading large resources to smooth out bandwidth spikes."}
							</>
						) : (
							"No transfer size information is available for these requests."
						)}
					</Insight>
				</>
			)}
		</PageSection>
	);
}
