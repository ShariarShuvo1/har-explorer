"use client";

import { useMemo } from "react";
import {
	AreaChart,
	Area,
	LineChart,
	Line,
	ResponsiveContainer,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
} from "recharts";
import { Activity, TrendingUp, Gauge } from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { formatBytes } from "@/lib/har-parser";
import { getTooltipStyle } from "./custom-tooltip";

interface BandwidthTimelineProps {
	entries: HAREntry[];
}

export function BandwidthTimeline({ entries }: BandwidthTimelineProps) {
	const bandwidthData = useMemo(() => {
		if (!entries.length) return null;

		const sortedEntries = [...entries].sort(
			(a, b) =>
				new Date(a.startedDateTime).getTime() -
				new Date(b.startedDateTime).getTime()
		);

		const startTime = new Date(sortedEntries[0].startedDateTime).getTime();
		const endTime =
			new Date(
				sortedEntries[sortedEntries.length - 1].startedDateTime
			).getTime() + sortedEntries[sortedEntries.length - 1].time;
		const totalDuration = endTime - startTime;

		const bucketSize =
			totalDuration > 10000 ? 500 : totalDuration > 5000 ? 200 : 100;
		const bucketCount = Math.ceil(totalDuration / bucketSize);

		const buckets = Array.from({ length: bucketCount }, (_, i) => ({
			time: Math.round((i * bucketSize) / 1000),
			bytes: 0,
			requests: 0,
			cumulative: 0,
		}));

		let cumulativeBytes = 0;

		sortedEntries.forEach((entry) => {
			const entryStart =
				new Date(entry.startedDateTime).getTime() - startTime;
			const entryEnd = entryStart + entry.time;
			const size = entry.response.content.size;

			for (let i = 0; i < buckets.length; i++) {
				const bucketStart = i * bucketSize;
				const bucketEnd = (i + 1) * bucketSize;

				if (entryEnd >= bucketStart && entryStart < bucketEnd) {
					buckets[i].bytes += size;
					buckets[i].requests++;
					break;
				}
			}
		});

		buckets.forEach((bucket) => {
			cumulativeBytes += bucket.bytes;
			bucket.cumulative = cumulativeBytes;
		});

		const peakBandwidth = Math.max(...buckets.map((b) => b.bytes));
		const peakTime =
			buckets.find((b) => b.bytes === peakBandwidth)?.time || 0;

		const avgBandwidth =
			buckets.reduce((sum, b) => sum + b.bytes, 0) / buckets.length;

		const dataRateTimeline = buckets.map((bucket) => ({
			time: `${bucket.time}s`,
			timeValue: bucket.time,
			"Data (KB)": Math.round(bucket.bytes / 1024),
			"Rate (KB/s)": Math.round(
				bucket.bytes / (bucketSize / 1000) / 1024
			),
			requests: bucket.requests,
		}));

		const cumulativeTimeline = buckets.map((bucket) => ({
			time: `${bucket.time}s`,
			timeValue: bucket.time,
			"Total MB": (bucket.cumulative / (1024 * 1024)).toFixed(2),
		}));

		return {
			dataRateTimeline,
			cumulativeTimeline,
			peakBandwidth,
			peakTime,
			avgBandwidth,
			totalBytes: cumulativeBytes,
			duration: totalDuration / 1000,
		};
	}, [entries]);

	if (!bandwidthData) {
		return null;
	}

	const tooltipStyle = getTooltipStyle();

	return (
		<div className="space-y-6">
			<div>
				<div className="flex items-center gap-2 mb-4">
					<Activity className="w-5 h-5 text-secondary" />
					<h3 className="text-xl font-semibold text-foreground">
						Bandwidth Utilization Timeline
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-secondary/20 rounded">
								<Gauge className="w-5 h-5 text-secondary" />
							</div>
							<div>
								<p className="text-xs text-muted">
									Peak Bandwidth
								</p>
								<p className="text-lg font-bold text-foreground">
									{formatBytes(bandwidthData.peakBandwidth)}
								</p>
								<p className="text-xs text-muted mt-1">
									at {bandwidthData.peakTime.toFixed(1)}s
								</p>
							</div>
						</div>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-accent/20 rounded">
								<TrendingUp className="w-5 h-5 text-accent" />
							</div>
							<div>
								<p className="text-xs text-muted">
									Avg Bandwidth
								</p>
								<p className="text-lg font-bold text-foreground">
									{formatBytes(bandwidthData.avgBandwidth)}
								</p>
								<p className="text-xs text-muted mt-1">
									per interval
								</p>
							</div>
						</div>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-primary/20 rounded">
								<Activity className="w-5 h-5 text-primary" />
							</div>
							<div>
								<p className="text-xs text-muted">
									Total Transfer
								</p>
								<p className="text-lg font-bold text-foreground">
									{formatBytes(bandwidthData.totalBytes)}
								</p>
								<p className="text-xs text-muted mt-1">
									in {bandwidthData.duration.toFixed(2)}s
								</p>
							</div>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-4">
							Data Transfer Rate Over Time
						</h4>
						<ResponsiveContainer width="100%" height={250}>
							<AreaChart data={bandwidthData.dataRateTimeline}>
								<defs>
									<linearGradient
										id="colorRate"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="#ff00ff"
											stopOpacity={0.8}
										/>
										<stop
											offset="95%"
											stopColor="#ff00ff"
											stopOpacity={0.1}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="var(--border)"
								/>
								<XAxis
									dataKey="time"
									tick={{
										fill: "var(--muted)",
										fontSize: 11,
									}}
									interval="preserveStartEnd"
								/>
								<YAxis
									tick={{
										fill: "var(--muted)",
										fontSize: 11,
									}}
									label={{
										value: "KB/s",
										angle: -90,
										position: "insideLeft",
										fill: "var(--muted)",
									}}
								/>
								<Tooltip {...tooltipStyle} />
								<Area
									type="monotone"
									dataKey="Rate (KB/s)"
									stroke="#ff00ff"
									fillOpacity={1}
									fill="url(#colorRate)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-4">
							Cumulative Data Transfer
						</h4>
						<ResponsiveContainer width="100%" height={250}>
							<LineChart data={bandwidthData.cumulativeTimeline}>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="var(--border)"
								/>
								<XAxis
									dataKey="time"
									tick={{
										fill: "var(--muted)",
										fontSize: 11,
									}}
									interval="preserveStartEnd"
								/>
								<YAxis
									tick={{
										fill: "var(--muted)",
										fontSize: 11,
									}}
									label={{
										value: "MB",
										angle: -90,
										position: "insideLeft",
										fill: "var(--muted)",
									}}
								/>
								<Tooltip {...tooltipStyle} />
								<Line
									type="monotone"
									dataKey="Total MB"
									stroke="#00ffff"
									strokeWidth={2}
									dot={{ fill: "#00ffff", r: 3 }}
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>

				<div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
					<p className="text-sm text-foreground">
						<span className="font-semibold">Analysis:</span> Peak
						bandwidth occurs at {bandwidthData.peakTime.toFixed(1)}
						s, transferring{" "}
						{formatBytes(bandwidthData.peakBandwidth)}.
						{bandwidthData.peakBandwidth >
							bandwidthData.avgBandwidth * 3 &&
							" Consider optimizing resource loading to reduce peak bandwidth spikes."}
					</p>
				</div>
			</div>
		</div>
	);
}
