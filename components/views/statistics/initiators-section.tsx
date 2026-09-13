"use client";

import { useMemo } from "react";
import { CornerDownRight, GitBranch, Layers } from "lucide-react";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { analyzeInitiators, getInitiatorLabel } from "@/lib/statistics/initiators";
import { percentOf } from "@/lib/statistics/utils";
import { useHarStore } from "@/lib/stores/har-store";
import { cn } from "@/lib/cn";
import { StatCard } from "@/components/common/stat-card";
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { initiatorColor } from "./colors";
import {
	SeriesBadge,
	SectionCard,
	ShareBar,
	StatSection,
	StatTable,
	StatTableHeader,
	ToneBadge,
	TruncationFooter,
	Unavailable,
	plural,
	useTruncation,
	type SectionProps,
} from "./shared";

const MAX_TOP_INITIATORS = 15;

export function InitiatorsSection({ entries, indices }: SectionProps) {
	const openEntry = useHarStore((s) => s.openEntry);
	const analysis = useMemo(() => analyzeInitiators(entries, indices), [entries, indices]);
	const truncation = useTruncation(analysis.topInitiators.length, MAX_TOP_INITIATORS);

	if (!analysis.hasInitiatorData) {
		return (
			<StatSection id="stats-initiators" title="Initiators">
				<Unavailable icon={GitBranch} title="Initiator data not available">
					<p>Initiator data is not available for these requests.</p>
				</Unavailable>
			</StatSection>
		);
	}

	const { longestChain, maxStackDepth } = analysis;
	const hasChain = longestChain.length > 1;

	return (
		<StatSection
			id="stats-initiators"
			title="Initiators"
			description="What triggered each request, and how deep the loading chains go."
		>
			<SectionCard title="Initiator type distribution" contentClassName="p-0 sm:p-0">
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>Type</TableHead>
							<TableHead className="text-right">Requests</TableHead>
							<TableHead className="text-right">Transferred</TableHead>
							<TableHead className="text-right">Avg time</TableHead>
							<TableHead className="text-right">Domains</TableHead>
							<TableHead className="text-right">Share</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{analysis.initiatorStats.map((stat) => (
							<TableRow key={stat.type}>
								<TableCell>
									<SeriesBadge color={initiatorColor(stat.type)}>
										{getInitiatorLabel(stat.type)}
									</SeriesBadge>
								</TableCell>
								<TableCell className="text-right font-medium tabular-nums">
									{stat.count.toLocaleString()}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatBytes(stat.totalSize)}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatTime(stat.totalTime / stat.count)}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{stat.domainCount.toLocaleString()}
								</TableCell>
								<TableCell>
									<ShareBar
										value={percentOf(stat.count, entries.length)}
										color={initiatorColor(stat.type)}
										label={`${getInitiatorLabel(stat.type)} share of requests`}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</StatTable>
			</SectionCard>

			<div
				className={cn(
					"grid items-start gap-4",
					(hasChain || maxStackDepth > 0) && "lg:grid-cols-2"
				)}
			>
				<SectionCard
					title="Top initiating URLs"
					description="Documents and scripts that triggered the most requests"
					contentClassName="p-0 sm:p-0"
					footer={<TruncationFooter state={truncation} noun="initiating URLs" />}
				>
					{analysis.topInitiators.length > 0 ? (
						<ul className="divide-y">
							{analysis.topInitiators.slice(0, truncation.shown).map((item) => (
								<li key={item.url} className="flex min-w-0 items-center gap-3 px-4 py-2.5 sm:px-6">
									<span className="min-w-0 flex-1 truncate font-mono text-xs" title={item.url}>
										{item.url}
									</span>
									<ToneBadge tone="primary">{plural(item.count, "req")}</ToneBadge>
								</li>
							))}
						</ul>
					) : (
						<p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-6">
							No initiator URLs or call stacks recorded
						</p>
					)}
				</SectionCard>

				<div className="flex min-w-0 flex-col gap-4">
					{(hasChain || maxStackDepth > 0) && (
						<div className="grid grid-cols-2 gap-3">
							{hasChain && (
								<StatCard
									label="Longest initiator chain"
									value={`${longestChain.length} levels`}
									icon={GitBranch}
									tone="primary"
								/>
							)}
							{maxStackDepth > 0 && (
								<StatCard
									label="Max call stack depth"
									value={plural(maxStackDepth, "frame")}
									hint="Including async parent stacks"
									icon={Layers}
									tone="info"
								/>
							)}
						</div>
					)}
					{hasChain && (
						<SectionCard
							title="Longest initiator chain"
							description="Each request was triggered by the one above it"
						>
							<ol className="space-y-1 font-mono text-xs">
								{longestChain.map((link, position) => {
									const entryIndex = link.entryIndex;
									return (
										<li
											key={link.url}
											className="flex min-w-0 items-center gap-1.5"
											style={{
												paddingLeft: `${Math.min(position, 8) * 0.75}rem`,
											}}
										>
											{position === 0 ? (
												<span
													className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
													aria-hidden="true"
												/>
											) : (
												<CornerDownRight
													className="size-3 shrink-0 text-muted-foreground"
													aria-hidden="true"
												/>
											)}
											{entryIndex === null ? (
												<span className="min-w-0 truncate" title={link.url}>
													{link.url}
												</span>
											) : (
												<button
													type="button"
													onClick={() => openEntry(entryIndex)}
													title={`${link.url}\nOpen this request`}
													className="min-w-0 truncate rounded-sm text-left hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
												>
													{link.url}
												</button>
											)}
										</li>
									);
								})}
							</ol>
						</SectionCard>
					)}
				</div>
			</div>
		</StatSection>
	);
}
