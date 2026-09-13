"use client";

import { useMemo } from "react";
import { Clock, Hourglass, Layers, Shapes, Timer } from "lucide-react";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { RESOURCE_TYPE_LABELS } from "@/lib/resource-type";
import { analyzeSequence } from "@/lib/statistics/sequence";
import { percentOf } from "@/lib/statistics/utils";
import { cn } from "@/lib/cn";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { resourceTypeColor } from "./colors";
import {
	Caption,
	SectionCard,
	SeriesBadge,
	StatSection,
	StatTable,
	StatTableHeader,
	ToneBadge,
	Unavailable,
	type SectionProps,
} from "./shared";

function formatParallelism(value: number | null): string {
	return value === null ? "—" : `${value.toFixed(1)}x`;
}

export function SequenceSection({ entries }: SectionProps) {
	const analysis = useMemo(() => analyzeSequence(entries), [entries]);

	if (analysis.timedCount === 0) {
		return (
			<StatSection id="stats-sequence" title="Loading sequence">
				<Unavailable icon={Layers} title="Start times not available">
					<p>
						None of these requests has a valid start time, so the loading sequence cannot be
						reconstructed.
					</p>
				</Unavailable>
			</StatSection>
		);
	}

	const { totalDuration } = analysis;
	const untimed = entries.length - analysis.timedCount;

	return (
		<StatSection
			id="stats-sequence"
			title="Loading sequence"
			description="The order resource types loaded in and how much they overlapped."
		>
			{untimed > 0 && (
				<Caption>
					<p>{untimed.toLocaleString()} requests without a valid start time are excluded.</p>
				</Caption>
			)}

			<StatGrid>
				<StatCard
					label="Total load time"
					value={formatTime(totalDuration)}
					hint="First request start to last response end"
					icon={Timer}
					tone="primary"
				/>
				<StatCard
					label="Avg parallelism"
					value={formatParallelism(analysis.avgParallelism)}
					hint={`Peak: ${analysis.peakConcurrency.toLocaleString()} concurrent`}
					icon={Layers}
					tone="success"
				/>
				<StatCard
					label="Queued requests"
					value={`${analysis.queuedPercentage.toFixed(1)}%`}
					hint={`Avg queued/stalled: ${formatTime(analysis.avgBlocked)}`}
					icon={Hourglass}
					tone="warning"
				/>
				<StatCard
					label="Resource types"
					value={analysis.loadSequence.length}
					icon={Shapes}
					tone="info"
				/>
			</StatGrid>

			<SectionCard
				title={
					<span className="flex items-center gap-2">
						<Clock className="size-4 text-muted-foreground" aria-hidden="true" />
						Critical path resources
					</span>
				}
				description="Documents, stylesheets and scripts in load order"
				contentClassName="p-0 sm:p-0"
			>
				{analysis.criticalResources.length > 0 ? (
					<ul className="divide-y">
						{analysis.criticalResources.map((resource) => (
							<li
								key={resource.resourceType}
								className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6"
							>
								<div className="flex items-center gap-3">
									<span className="w-7 text-sm font-medium text-muted-foreground tabular-nums">
										#{resource.order}
									</span>
									<SeriesBadge color={resourceTypeColor(resource.resourceType)}>
										{RESOURCE_TYPE_LABELS[resource.resourceType]}
									</SeriesBadge>
								</div>
								<dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
									<div className="flex gap-1.5">
										<dt className="text-muted-foreground">Avg start</dt>
										<dd className="font-medium tabular-nums">
											{formatTime(resource.avgStartTime)}
										</dd>
									</div>
									<div className="flex gap-1.5">
										<dt className="text-muted-foreground">Avg duration</dt>
										<dd className="font-medium tabular-nums">{formatTime(resource.avgDuration)}</dd>
									</div>
									<div className="flex gap-1.5">
										<dt className="text-muted-foreground">Count</dt>
										<dd className="font-medium tabular-nums">{resource.count.toLocaleString()}</dd>
									</div>
								</dl>
							</li>
						))}
					</ul>
				) : (
					<p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-6">
						No document, stylesheet or script requests.
					</p>
				)}
			</SectionCard>

			<SectionCard title="Load order & parallelism" contentClassName="p-0 sm:p-0">
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>Order</TableHead>
							<TableHead>Resource type</TableHead>
							<TableHead className="text-right">Count</TableHead>
							<TableHead className="text-right">Avg start</TableHead>
							<TableHead className="text-right">Avg duration</TableHead>
							<TableHead className="text-right">Total size</TableHead>
							<TableHead
								className="text-right"
								title="Average number of requests of this type in flight while any of them was loading"
							>
								Avg parallelism
							</TableHead>
							<TableHead
								className="text-right"
								title="Requests that spent time queued or stalled before being sent"
							>
								Queued
							</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{analysis.loadSequence.map((stat) => {
							const queuedRate = percentOf(stat.queuedCount, stat.count);
							return (
								<TableRow key={stat.resourceType}>
									<TableCell className="text-muted-foreground tabular-nums">
										#{stat.order}
									</TableCell>
									<TableCell>
										<SeriesBadge color={resourceTypeColor(stat.resourceType)}>
											{RESOURCE_TYPE_LABELS[stat.resourceType]}
										</SeriesBadge>
									</TableCell>
									<TableCell className="text-right font-medium tabular-nums">
										{stat.count.toLocaleString()}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{formatTime(stat.avgStartTime)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{formatTime(stat.avgDuration)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{formatBytes(stat.totalSize)}
									</TableCell>
									<TableCell className="text-right">
										<ToneBadge
											tone={
												stat.parallelism !== null && stat.parallelism >= 2 ? "success" : "default"
											}
										>
											{formatParallelism(stat.parallelism)}
										</ToneBadge>
									</TableCell>
									<TableCell className="text-right">
										<ToneBadge
											tone={
												queuedRate > 50 ? "destructive" : queuedRate > 20 ? "warning" : "success"
											}
										>
											{queuedRate.toFixed(0)}%
										</ToneBadge>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</StatTable>
			</SectionCard>

			<SectionCard
				title="Loading timeline"
				description="Each bar spans from the first request of that type starting to the last one finishing."
			>
				<div className="space-y-3">
					<div className="hidden grid-cols-[6rem_minmax(0,1fr)_9rem] gap-3 text-xs text-muted-foreground tabular-nums sm:grid">
						<span />
						<div className="flex justify-between">
							<span>0 ms</span>
							<span>{formatTime(totalDuration)}</span>
						</div>
						<span />
					</div>
					{analysis.loadSequence.map((stat) => {
						const left = totalDuration > 0 ? percentOf(stat.firstStart, totalDuration) : 0;
						const width =
							totalDuration > 0 ? percentOf(stat.lastEnd - stat.firstStart, totalDuration) : 100;
						const label = RESOURCE_TYPE_LABELS[stat.resourceType];
						const range = `${formatTime(stat.firstStart)} – ${formatTime(stat.lastEnd)}`;
						return (
							<div
								key={stat.resourceType}
								className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[6rem_minmax(0,1fr)_9rem]"
							>
								<span className="truncate text-xs font-medium">{label}</span>
								<div
									className="relative h-5 overflow-hidden rounded bg-muted"
									role="img"
									aria-label={`${label}: ${range}`}
								>
									<div
										className={cn(
											"absolute inset-y-0 rounded",
											resourceTypeColor(stat.resourceType).fill
										)}
										style={{
											left: `${Math.min(left, 99.5)}%`,
											width: `max(${Math.min(width, 100 - left)}%, 0.5%)`,
										}}
										title={range}
									/>
								</div>
								<span className="col-start-2 text-xs text-muted-foreground tabular-nums sm:col-start-auto sm:text-right">
									{range}
								</span>
							</div>
						);
					})}
				</div>
			</SectionCard>
		</StatSection>
	);
}
