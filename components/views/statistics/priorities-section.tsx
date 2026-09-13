"use client";

import { useMemo } from "react";
import { ArrowUpDown, ChevronRight, CircleCheck, TriangleAlert } from "lucide-react";
import { formatTime } from "@/lib/har-parser";
import {
	analyzePriorities,
	getPriorityLabel,
	LATE_START_THRESHOLD_MS,
} from "@/lib/statistics/priorities";
import { percentOf } from "@/lib/statistics/utils";
import { useHarStore } from "@/lib/stores/har-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { priorityColor } from "./colors";
import {
	SectionCard,
	SeriesBadge,
	ShareBar,
	StatSection,
	StatTable,
	StatTableHeader,
	TruncationFooter,
	Unavailable,
	useTruncation,
	type SectionProps,
} from "./shared";

const MAX_LATE_WARNINGS = 5;
const WARNING_ALERT = "border-warning/30 bg-warning/5 [&>svg]:text-warning";

export function PrioritiesSection({ entries, indices }: SectionProps) {
	const openEntry = useHarStore((s) => s.openEntry);
	const analysis = useMemo(() => analyzePriorities(entries, indices), [entries, indices]);
	const truncation = useTruncation(analysis.late.length, MAX_LATE_WARNINGS);

	if (!analysis.hasPriorityData) {
		return (
			<StatSection id="stats-priorities" title="Priorities">
				<Unavailable icon={ArrowUpDown} title="Priority data not available">
					<p>Priority data is not available for these requests.</p>
				</Unavailable>
			</StatSection>
		);
	}

	const { averageMismatch, late } = analysis;
	const hasMismatches = averageMismatch !== null || late.length > 0;

	return (
		<StatSection
			id="stats-priorities"
			title="Priorities"
			description="Browser resource priorities compared with when requests actually started."
		>
			<SectionCard
				title="Priority vs load timing"
				description="Start times are relative to the first request"
				contentClassName="p-0 sm:p-0"
			>
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>Priority</TableHead>
							<TableHead className="text-right">Count</TableHead>
							<TableHead
								className="text-right"
								title="Average time after the first request started"
							>
								Avg start time
							</TableHead>
							<TableHead className="text-right">Avg duration</TableHead>
							<TableHead className="text-right">% of total</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{analysis.priorityStats.map((stat) => (
							<TableRow key={stat.priority}>
								<TableCell>
									<SeriesBadge color={priorityColor(stat.priority)}>
										{getPriorityLabel(stat.priority)}
									</SeriesBadge>
								</TableCell>
								<TableCell className="text-right font-medium tabular-nums">
									{stat.count.toLocaleString()}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{stat.avgStartTime === null ? "—" : formatTime(stat.avgStartTime)}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatTime(stat.avgDuration)}
								</TableCell>
								<TableCell>
									<ShareBar
										value={percentOf(stat.count, entries.length)}
										color={priorityColor(stat.priority)}
										label={`${getPriorityLabel(stat.priority)} share of requests`}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</StatTable>
			</SectionCard>

			{!hasMismatches ? (
				<Alert role="status" className="border-success/30 bg-success/5 [&>svg]:text-success">
					<CircleCheck />
					<AlertTitle>No priority mismatches detected</AlertTitle>
				</Alert>
			) : (
				<div className="flex flex-col gap-3">
					{averageMismatch && (
						<Alert role="note" className={WARNING_ALERT}>
							<TriangleAlert />
							<AlertTitle className="line-clamp-none">
								High priority resources start later than low priority ones on average
							</AlertTitle>
							<AlertDescription>
								<p>
									High/Very High: {formatTime(averageMismatch.highAvg)} vs Low/Very Low:{" "}
									{formatTime(averageMismatch.lowAvg)} after the first request
								</p>
							</AlertDescription>
						</Alert>
					)}
					{late.length > 0 && (
						<SectionCard
							title={
								<span className="flex items-center gap-2">
									<TriangleAlert className="size-4 text-warning" aria-hidden="true" />
									Render-critical high priority resources started late
								</span>
							}
							description={`${late.length.toLocaleString()} document, stylesheet, script or font requests started more than ${formatTime(LATE_START_THRESHOLD_MS)} after their page's first request`}
							contentClassName="p-0 sm:p-0"
							footer={<TruncationFooter state={truncation} noun="late resources" />}
						>
							<ul className="divide-y">
								{late.slice(0, truncation.shown).map((item) => (
									<li key={item.entryIndex}>
										<button
											type="button"
											onClick={() => openEntry(item.entryIndex, "timing")}
											title={`${item.url}\nOpen this request's timing`}
											className="flex w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-6"
										>
											<span className="min-w-0 flex-1 truncate font-mono text-xs">{item.url}</span>
											<span className="shrink-0 text-xs text-warning tabular-nums">
												+{formatTime(item.pageOffset)}
											</span>
											<ChevronRight
												className="size-4 shrink-0 text-muted-foreground"
												aria-hidden="true"
											/>
										</button>
									</li>
								))}
							</ul>
						</SectionCard>
					)}
				</div>
			)}
		</StatSection>
	);
}
