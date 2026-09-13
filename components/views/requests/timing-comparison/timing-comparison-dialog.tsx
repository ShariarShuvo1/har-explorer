"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { ArrowLeftRight, ExternalLink } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useHarStore, type HAREntry } from "@/lib/stores/har-store";
import {
	formatBytes,
	formatTime,
	getEntryContentSize,
	getEntryStartTime,
	getEntryTransferSize,
} from "@/lib/har-parser";
import { getCaptureStart } from "@/lib/filter-entries";
import {
	TIMING_BG,
	TIMING_LABELS,
	TIMING_SHORT_LABELS,
	formatSignedTime,
	getBarSegments,
	getEntryName,
	getTimingPhases,
	type BarSegment,
	type TimingPhase,
} from "@/lib/timing";
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
	ResponsiveDialogTitle,
} from "@/components/common/responsive-dialog";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";

type Tone = "better" | "worse" | "neutral" | "same";

const TONE_CLASS: Record<Tone, string> = {
	better: "text-success",
	worse: "text-destructive",
	neutral: "text-foreground",
	same: "text-muted-foreground",
};

interface CompareRow {
	key: string;
	label: string;
	phase?: TimingPhase;
	nested?: boolean;
	a: string;
	b: string;
	delta: string;
	tone: Tone;
	strong?: boolean;
}

function signedBytes(bytes: number): string {
	const sign = bytes > 0 ? "+" : bytes < 0 ? "−" : "±";
	return `${sign}${formatBytes(Math.abs(bytes))}`;
}

/** Positive differences mean B took longer or is bigger, which is worse. */
function costTone(diff: number): Tone {
	return diff > 0 ? "worse" : diff < 0 ? "better" : "same";
}

export function TimingComparisonDialog() {
	const { pair, entries, setTimingComparison } = useHarStore(
		useShallow((s) => ({
			pair: s.timingComparison,
			entries: s.entries,
			setTimingComparison: s.setTimingComparison,
		}))
	);

	const first = pair ? entries[pair[0]] : undefined;
	const second = pair ? entries[pair[1]] : undefined;
	const valid = pair !== null && first !== undefined && second !== undefined;

	// A pair pointing at removed entries (e.g. after undo) cannot be shown.
	useEffect(() => {
		if (pair !== null && !valid) setTimingComparison(null);
	}, [pair, valid, setTimingComparison]);

	return (
		<ResponsiveDialog
			open={valid}
			onOpenChange={(open) => {
				if (!open) setTimingComparison(null);
			}}
		>
			<ResponsiveDialogContent size="xl">
				<ResponsiveDialogHeader>
					<ResponsiveDialogTitle>Timing comparison</ResponsiveDialogTitle>
					<ResponsiveDialogDescription>
						How request B spent its time compared with request A.
					</ResponsiveDialogDescription>
				</ResponsiveDialogHeader>
				{valid && (
					<ComparisonContent
						indexA={pair[0]}
						indexB={pair[1]}
						first={first}
						second={second}
						entries={entries}
					/>
				)}
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function ComparisonContent({
	indexA,
	indexB,
	first,
	second,
	entries,
}: {
	indexA: number;
	indexB: number;
	first: HAREntry;
	second: HAREntry;
	entries: HAREntry[];
}) {
	const openEntry = useHarStore((s) => s.openEntry);
	const setTimingComparison = useHarStore((s) => s.setTimingComparison);
	const captureStart = useMemo(() => getCaptureStart(entries), [entries]);

	const barA = getBarSegments(first);
	const barB = getBarSegments(second);
	const scale = Math.max(barA.duration, barB.duration);

	const phaseRows = useMemo<CompareRow[]>(() => {
		const phasesB = getTimingPhases(second);
		return getTimingPhases(first)
			.map((pa, i) => ({ pa, pb: phasesB[i] }))
			.filter(({ pa, pb }) => (pa.value ?? 0) > 0 || (pb.value ?? 0) > 0)
			.map(({ pa, pb }): CompareRow => {
				const diff = pa.value === null || pb.value === null ? null : pb.value - pa.value;
				return {
					key: pa.phase,
					label: TIMING_LABELS[pa.phase],
					phase: pa.phase,
					nested: pa.nested || pb.nested,
					a: pa.value === null ? "—" : formatTime(pa.value),
					b: pb.value === null ? "—" : formatTime(pb.value),
					delta: diff === null ? "—" : formatSignedTime(diff),
					tone: diff === null ? "same" : costTone(diff),
				};
			});
	}, [first, second]);

	const difference = second.time - first.time;

	const detailRows = useMemo<CompareRow[]>(() => {
		const startA = getEntryStartTime(first);
		const startB = getEntryStartTime(second);
		const hasStarts = startA > 0 && startB > 0;
		const offset = (start: number) =>
			start > 0 && captureStart > 0 ? `+${formatTime(start - captureStart)}` : "—";
		const contentA = getEntryContentSize(first);
		const contentB = getEntryContentSize(second);
		const transferA = getEntryTransferSize(first);
		const transferB = getEntryTransferSize(second);
		return [
			{
				key: "total",
				label: "Total time",
				a: formatTime(first.time),
				b: formatTime(second.time),
				delta: formatSignedTime(difference),
				tone: costTone(difference),
				strong: true,
			},
			{
				key: "start",
				label: "Started (from first request)",
				a: offset(startA),
				b: offset(startB),
				delta: hasStarts ? formatSignedTime(startB - startA) : "—",
				tone: hasStarts && startB !== startA ? "neutral" : "same",
			},
			{
				key: "content",
				label: "Response size",
				a: formatBytes(contentA),
				b: formatBytes(contentB),
				delta: signedBytes(contentB - contentA),
				tone: costTone(contentB - contentA),
			},
			{
				key: "transfer",
				label: "Transferred",
				a: formatBytes(transferA),
				b: formatBytes(transferB),
				delta: signedBytes(transferB - transferA),
				tone: costTone(transferB - transferA),
			},
		];
	}, [first, second, captureStart, difference]);

	const legendPhases = useMemo(() => {
		const phases = new Set<TimingPhase>();
		for (const segment of [...barA.segments, ...barB.segments]) {
			phases.add(segment.phase);
			if (segment.sslPct) phases.add("ssl");
		}
		return [...phases];
	}, [barA.segments, barB.segments]);

	const open = (index: number) => {
		setTimingComparison(null);
		openEntry(index);
	};

	return (
		<>
			<ResponsiveDialogBody className="flex flex-col gap-6">
				<div className="grid gap-3 md:grid-cols-2">
					<RequestSummary label="A" entry={first} />
					<RequestSummary label="B" entry={second} />
				</div>

				<section className="flex flex-col gap-2" aria-label="Timing bars">
					<ComparisonBar
						label="A"
						segments={barA.segments}
						duration={barA.duration}
						scale={scale}
					/>
					<ComparisonBar
						label="B"
						segments={barB.segments}
						duration={barB.duration}
						scale={scale}
					/>
					{legendPhases.length > 0 && (
						<ul className="flex flex-wrap gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
							{legendPhases.map((phase) => (
								<li key={phase} className="flex items-center gap-1.5">
									<span className={cn("size-2 rounded-sm", TIMING_BG[phase])} aria-hidden="true" />
									{TIMING_SHORT_LABELS[phase]}
								</li>
							))}
						</ul>
					)}
				</section>

				<p className="rounded-lg bg-muted/50 px-3 py-2 text-center text-sm text-muted-foreground">
					{difference === 0 ? (
						"Both requests took the same time."
					) : (
						<>
							B is{" "}
							<span className={cn("font-semibold", TONE_CLASS[costTone(difference)])}>
								{formatTime(Math.abs(difference))} {difference > 0 ? "slower" : "faster"}
							</span>{" "}
							than A
							{first.time > 0 && ` (${Math.round((Math.abs(difference) / first.time) * 100)}%)`}.
						</>
					)}
				</p>

				<CompareTable
					title="Phase"
					rows={phaseRows}
					emptyText="Neither request has timing phases."
				/>
				<CompareTable title="Metric" rows={detailRows} />
			</ResponsiveDialogBody>
			<ResponsiveDialogFooter className="gap-2 sm:justify-between">
				<Button variant="outline" onClick={() => setTimingComparison([indexB, indexA])}>
					<ArrowLeftRight />
					Swap A/B
				</Button>
				<div className="grid grid-cols-2 gap-2 sm:flex">
					<Button variant="outline" onClick={() => open(indexA)}>
						<ExternalLink />
						Open A
					</Button>
					<Button variant="outline" onClick={() => open(indexB)}>
						<ExternalLink />
						Open B
					</Button>
				</div>
			</ResponsiveDialogFooter>
		</>
	);
}

function SideLabel({ children }: { children: ReactNode }) {
	return (
		<span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-foreground text-[11px] font-semibold text-background">
			{children}
		</span>
	);
}

function RequestSummary({ label, entry }: { label: string; entry: HAREntry }) {
	return (
		<div className="flex min-w-0 flex-col gap-2 rounded-lg border p-3">
			<div className="flex min-w-0 items-center gap-2">
				<SideLabel>{label}</SideLabel>
				<span className="min-w-0 flex-1 truncate text-sm font-medium" title={entry.request.url}>
					{getEntryName(entry.request.url)}
				</span>
				<span className="shrink-0 text-sm font-semibold tabular-nums">
					{formatTime(entry.time)}
				</span>
			</div>
			<div className="flex min-w-0 items-center gap-2">
				<MethodBadge method={entry.request.method} />
				<StatusBadge
					status={entry.response.status}
					statusText={entry.response.statusText}
					showText
				/>
			</div>
			<p
				className="line-clamp-2 font-mono text-xs break-all text-muted-foreground"
				title={entry.request.url}
			>
				{entry.request.url}
			</p>
		</div>
	);
}

function ComparisonBar({
	label,
	segments,
	duration,
	scale,
}: {
	label: string;
	segments: BarSegment[];
	duration: number;
	scale: number;
}) {
	return (
		<div className="flex items-center gap-2">
			<SideLabel>{label}</SideLabel>
			<div className="h-4 min-w-0 flex-1 overflow-hidden rounded bg-muted">
				<div
					className="flex h-full overflow-hidden rounded"
					style={{ width: scale > 0 ? `${(duration / scale) * 100}%` : 0, minWidth: 2 }}
				>
					{segments.map((segment) => (
						<div
							key={segment.phase}
							className={cn("relative h-full shrink-0", TIMING_BG[segment.phase])}
							style={{ width: `${segment.pct}%` }}
							title={`${TIMING_LABELS[segment.phase]}`}
						>
							{segment.sslPct ? (
								<div
									className={cn("absolute inset-y-0 right-0", TIMING_BG.ssl)}
									style={{ width: `${segment.sslPct}%` }}
								/>
							) : null}
						</div>
					))}
				</div>
			</div>
			<span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
				{formatTime(duration)}
			</span>
		</div>
	);
}

function RowLabel({ row }: { row: CompareRow }) {
	return (
		<span className={cn("flex min-w-0 items-center gap-2", row.nested && "pl-4")}>
			{row.phase && (
				<span
					className={cn("size-2 shrink-0 rounded-sm", TIMING_BG[row.phase])}
					aria-hidden="true"
				/>
			)}
			<span className={cn("min-w-0", row.strong && "font-semibold")}>
				{row.label}
				{row.nested && <span className="text-muted-foreground"> (part of connect)</span>}
			</span>
		</span>
	);
}

function CompareTable({
	title,
	rows,
	emptyText,
}: {
	title: string;
	rows: CompareRow[];
	emptyText?: string;
}) {
	if (rows.length === 0) {
		return emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null;
	}

	return (
		<>
			<div className="hidden overflow-hidden rounded-lg border md:block">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/40 hover:bg-muted/40">
							<TableHead>{title}</TableHead>
							<TableHead className="text-right">A</TableHead>
							<TableHead className="text-right">B</TableHead>
							<TableHead className="text-right">Difference (B − A)</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.key}>
								<TableCell>
									<RowLabel row={row} />
								</TableCell>
								<TableCell className={cn("text-right tabular-nums", row.strong && "font-semibold")}>
									{row.a}
								</TableCell>
								<TableCell className={cn("text-right tabular-nums", row.strong && "font-semibold")}>
									{row.b}
								</TableCell>
								<TableCell
									className={cn(
										"text-right tabular-nums",
										TONE_CLASS[row.tone],
										row.strong && "font-semibold"
									)}
								>
									{row.delta}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<ul className="flex flex-col divide-y rounded-lg border md:hidden" aria-label={title}>
				{rows.map((row) => (
					<li key={row.key} className="flex flex-col gap-1.5 px-3 py-2.5 text-sm">
						<RowLabel row={row} />
						<dl className="grid grid-cols-3 gap-2 text-xs">
							<div className="min-w-0">
								<dt className="text-muted-foreground">A</dt>
								<dd className="truncate tabular-nums">{row.a}</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-muted-foreground">B</dt>
								<dd className="truncate tabular-nums">{row.b}</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-muted-foreground">B − A</dt>
								<dd className={cn("truncate font-medium tabular-nums", TONE_CLASS[row.tone])}>
									{row.delta}
								</dd>
							</div>
						</dl>
					</li>
				))}
			</ul>
		</>
	);
}
