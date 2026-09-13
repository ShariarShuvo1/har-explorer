"use client";

import { useMemo, type ComponentType } from "react";
import {
	AlertTriangle,
	ChevronDown,
	Clock,
	Globe,
	HardDrive,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { formatSignedTime } from "@/lib/timing";
import { RESOURCE_TYPE_LABELS } from "@/lib/resource-type";
import type { ConcreteResourceType, HarSummary } from "@/lib/har-compare";
import { cn } from "@/lib/cn";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useCompareUiStore } from "./compare-ui-store";
import {
	TONE_CLASSES,
	formatPct,
	formatSignedBytes,
	formatSignedCount,
	percentOf,
	toneForDelta,
} from "./utils";

interface MetricProps {
	icon: ComponentType<{ className?: string }>;
	label: string;
	title?: string;
	baseline: number;
	comparison: number;
	format: (value: number) => string;
	formatDelta: (delta: number) => string;
	/** Minimum relative change (percent) before the delta is colored. */
	minPct?: number;
}

function Metric({
	icon,
	label,
	title,
	baseline,
	comparison,
	format,
	formatDelta,
	minPct = 0,
}: MetricProps) {
	const known = baseline >= 0 && comparison >= 0;
	const delta = known ? comparison - baseline : 0;
	const pct = known ? percentOf(baseline, comparison) : null;
	const significant = delta !== 0 && (pct === null || Math.abs(pct) >= minPct);
	const tone = toneForDelta(delta, significant);
	const TrendIcon = tone === "worse" ? TrendingUp : tone === "better" ? TrendingDown : null;

	return (
		<StatCard
			icon={icon}
			label={<span title={title}>{label}</span>}
			className="p-3 sm:p-4"
			value={
				<span title={`Baseline ${baseline >= 0 ? format(baseline) : "—"} → comparison`}>
					{comparison >= 0 ? format(comparison) : "—"}
				</span>
			}
			hint={
				known ? (
					<span className="inline-flex min-w-0 items-center gap-1">
						<span
							className={cn("inline-flex items-center gap-0.5 font-medium", TONE_CLASSES[tone])}
						>
							{TrendIcon && <TrendIcon className="size-3" aria-hidden="true" />}
							{delta === 0 ? "No change" : formatDelta(delta)}
							{delta !== 0 && pct !== null && ` (${formatPct(pct)})`}
						</span>
						<span className="truncate">· was {format(baseline)}</span>
					</span>
				) : (
					"Not available"
				)
			}
		/>
	);
}

export function SummaryStats({
	baseline,
	comparison,
}: {
	baseline: HarSummary;
	comparison: HarSummary;
}) {
	return (
		<StatGrid className="md:grid-cols-4">
			<Metric
				icon={Globe}
				label="Requests"
				baseline={baseline.requests}
				comparison={comparison.requests}
				format={(v) => v.toLocaleString()}
				formatDelta={formatSignedCount}
			/>
			<Metric
				icon={HardDrive}
				label="Transferred"
				baseline={baseline.transferSize}
				comparison={comparison.transferSize}
				format={formatBytes}
				formatDelta={formatSignedBytes}
				minPct={1}
			/>
			<Metric
				icon={Clock}
				label="Load time"
				title="First request start to last response end"
				baseline={baseline.loadTime}
				comparison={comparison.loadTime}
				format={formatTime}
				formatDelta={formatSignedTime}
				minPct={2}
			/>
			<Metric
				icon={AlertTriangle}
				label="Errors"
				title="4xx, 5xx and failed requests"
				baseline={baseline.errors}
				comparison={comparison.errors}
				format={(v) => v.toLocaleString()}
				formatDelta={formatSignedCount}
			/>
		</StatGrid>
	);
}

export function TypeBreakdown({
	baseline,
	comparison,
}: {
	baseline: HarSummary;
	comparison: HarSummary;
}) {
	const open = useCompareUiStore((s) => s.showTypeBreakdown);
	const setOpen = useCompareUiStore((s) => s.setShowTypeBreakdown);

	const rows = useMemo(() => {
		const types = new Set([
			...Object.keys(baseline.byType),
			...Object.keys(comparison.byType),
		]) as Set<ConcreteResourceType>;
		return [...types]
			.map((type) => ({
				type,
				a: baseline.byType[type] ?? { count: 0, transferSize: 0 },
				b: comparison.byType[type] ?? { count: 0, transferSize: 0 },
			}))
			.sort(
				(x, y) =>
					Math.max(y.a.transferSize, y.b.transferSize) -
					Math.max(x.a.transferSize, x.b.transferSize)
			);
	}, [baseline, comparison]);

	if (rows.length === 0) return null;

	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="rounded-xl border bg-card text-card-foreground shadow-xs"
		>
			<CollapsibleTrigger className="flex h-10 w-full items-center justify-between gap-2 rounded-xl px-4 text-left text-sm font-medium outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50">
				<span>
					By resource type
					<span className="ml-2 text-xs font-normal text-muted-foreground">
						{rows.length} {rows.length === 1 ? "type" : "types"} · resources{" "}
						{formatBytes(baseline.contentSize)} → {formatBytes(comparison.contentSize)}
					</span>
				</span>
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform",
						open && "rotate-180"
					)}
					aria-hidden="true"
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="border-t">
				<Table className="text-xs sm:text-sm">
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="pl-4">Type</TableHead>
							<TableHead className="text-right">Requests</TableHead>
							<TableHead className="text-right">Δ</TableHead>
							<TableHead className="text-right">Transferred</TableHead>
							<TableHead className="pr-4 text-right">Δ</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map(({ type, a, b }) => {
							const countDelta = b.count - a.count;
							const sizeDelta = b.transferSize - a.transferSize;
							const sizePct = percentOf(a.transferSize, b.transferSize);
							return (
								<TableRow key={type}>
									<TableCell className="pl-4 font-medium">{RESOURCE_TYPE_LABELS[type]}</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{a.count.toLocaleString()} →{" "}
										<span className="text-foreground">{b.count.toLocaleString()}</span>
									</TableCell>
									<TableCell
										className={cn(
											"text-right tabular-nums",
											TONE_CLASSES[toneForDelta(countDelta)]
										)}
									>
										{countDelta === 0 ? "—" : formatSignedCount(countDelta)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{formatBytes(a.transferSize)} →{" "}
										<span className="text-foreground">{formatBytes(b.transferSize)}</span>
									</TableCell>
									<TableCell
										className={cn(
											"pr-4 text-right tabular-nums",
											TONE_CLASSES[
												toneForDelta(sizeDelta, sizePct === null || Math.abs(sizePct) >= 1)
											]
										)}
									>
										{sizeDelta === 0
											? "—"
											: `${formatSignedBytes(sizeDelta)}${sizePct === null ? "" : ` (${formatPct(sizePct)})`}`}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</CollapsibleContent>
		</Collapsible>
	);
}
