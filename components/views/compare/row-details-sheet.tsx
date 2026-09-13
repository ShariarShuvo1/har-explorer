"use client";

import { ExternalLink, Shuffle } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import type { CompareRow } from "@/lib/har-compare";
import {
	extractPath,
	formatBytes,
	formatTime,
	getEntryContentSize,
	getEntryTransferSize,
} from "@/lib/har-parser";
import { TIMING_BG, formatSignedTime, type TimingPhase } from "@/lib/timing";
import { cn } from "@/lib/cn";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	TONE_CLASSES,
	formatPct,
	formatSignedBytes,
	percentOf,
	rowEntries,
	toneForDelta,
} from "./utils";

interface Metric {
	label: string;
	kind: "time" | "bytes" | "text";
	get: (entry: HAREntry) => number | string;
	/** Timing phases HAR marks as -1 when they did not happen. */
	optional?: boolean;
	phase?: TimingPhase;
}

const GENERAL: Metric[] = [
	{
		label: "Status",
		kind: "text",
		get: (e) => `${e.response.status} ${e.response.statusText}`.trim(),
	},
	{ label: "MIME type", kind: "text", get: (e) => e.response.content.mimeType || "—" },
	{
		label: "HTTP version",
		kind: "text",
		get: (e) => e.response.httpVersion || e.request.httpVersion || "—",
	},
	{ label: "Server IP", kind: "text", get: (e) => e.serverIPAddress || "—" },
];

const TIMINGS: Metric[] = [
	{ label: "Total time", kind: "time", get: (e) => e.time },
	{
		label: "Blocked",
		kind: "time",
		get: (e) => e.timings.blocked,
		optional: true,
		phase: "blocked",
	},
	{ label: "DNS", kind: "time", get: (e) => e.timings.dns, optional: true, phase: "dns" },
	{
		label: "Connect (incl. SSL)",
		kind: "time",
		get: (e) => e.timings.connect,
		optional: true,
		phase: "connect",
	},
	{ label: "SSL", kind: "time", get: (e) => e.timings.ssl, optional: true, phase: "ssl" },
	{ label: "Send", kind: "time", get: (e) => e.timings.send, phase: "send" },
	{ label: "Wait (TTFB)", kind: "time", get: (e) => e.timings.wait, phase: "wait" },
	{ label: "Receive", kind: "time", get: (e) => e.timings.receive, phase: "receive" },
];

const SIZES: Metric[] = [
	{ label: "Transferred", kind: "bytes", get: getEntryTransferSize },
	{ label: "Resource size", kind: "bytes", get: getEntryContentSize },
];

function formatMetric(metric: Metric, value: number | string): string {
	if (typeof value === "string") return value;
	if (metric.kind === "time") return formatTime(value);
	return formatBytes(value);
}

function DeltaValue({ metric, a, b }: { metric: Metric; a: number | string; b: number | string }) {
	if (typeof a === "string" || typeof b === "string") {
		return a === b ? (
			<span className="text-muted-foreground">—</span>
		) : (
			<span className="text-primary">changed</span>
		);
	}
	const known = (v: number) => (metric.optional ? v >= 0 : Number.isFinite(v));
	if (!known(a) && !known(b)) return <span className="text-muted-foreground">—</span>;
	const from = Math.max(0, a);
	const to = Math.max(0, b);
	const delta = to - from;
	if (Math.abs(delta) < 0.5) return <span className="text-muted-foreground">±0</span>;
	const pct = percentOf(from, to);
	return (
		<span className={TONE_CLASSES[toneForDelta(delta)]}>
			{metric.kind === "time" ? formatSignedTime(delta) : formatSignedBytes(delta)}
			{pct !== null && <span className="opacity-75"> ({formatPct(pct)})</span>}
		</span>
	);
}

function MetricTable({
	title,
	metrics,
	baseline,
	comparison,
}: {
	title: string;
	metrics: Metric[];
	baseline: HAREntry | null;
	comparison: HAREntry | null;
}) {
	const both = !!baseline && !!comparison;
	return (
		<section className="space-y-2">
			<h3 className="text-sm font-semibold">{title}</h3>
			<div className="overflow-hidden rounded-lg border">
				<Table className="text-xs">
					<TableHeader>
						<TableRow className="bg-muted/50 hover:bg-muted/50">
							<TableHead className="pl-3 text-muted-foreground">Metric</TableHead>
							<TableHead className="text-right text-muted-foreground">Baseline</TableHead>
							<TableHead className="text-right text-muted-foreground">Comparison</TableHead>
							{both && <TableHead className="pr-3 text-right text-muted-foreground">Δ</TableHead>}
						</TableRow>
					</TableHeader>
					<TableBody>
						{metrics.map((metric) => {
							const a = baseline ? metric.get(baseline) : null;
							const b = comparison ? metric.get(comparison) : null;
							const isStatus = metric.label === "Status";
							const cell = (value: number | string | null, entry: HAREntry | null) =>
								value === null || !entry ? (
									<span className="text-muted-foreground">—</span>
								) : isStatus ? (
									<StatusBadge
										status={entry.response.status}
										statusText={entry.response.statusText}
										showText
										className="justify-end"
									/>
								) : (
									formatMetric(metric, value)
								);
							return (
								<TableRow key={metric.label}>
									<TableCell className="pl-3 text-muted-foreground">
										<span className="inline-flex items-center gap-2">
											{metric.phase && (
												<span
													className={cn("size-2 rounded-sm", TIMING_BG[metric.phase])}
													aria-hidden="true"
												/>
											)}
											{metric.label}
										</span>
									</TableCell>
									<TableCell className="max-w-40 truncate text-right font-mono tabular-nums">
										{cell(a, baseline)}
									</TableCell>
									<TableCell className="max-w-40 truncate text-right font-mono tabular-nums">
										{cell(b, comparison)}
									</TableCell>
									{both && a !== null && b !== null && (
										<TableCell className="pr-3 text-right font-mono tabular-nums">
											<DeltaValue metric={metric} a={a} b={b} />
										</TableCell>
									)}
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}

function UrlLine({ label, url }: { label: string; url: string }) {
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs font-medium text-muted-foreground">{label}</span>
				<CopyButton value={url} label={`Copy ${label.toLowerCase()}`} successMessage="URL copied" />
			</div>
			<code className="block rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs break-all">
				{url}
			</code>
		</div>
	);
}

interface RowDetailsSheetProps {
	row: CompareRow | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	baselineName: string;
	comparisonName: string;
	onJump: (row: CompareRow) => void;
}

export function RowDetailsSheet({
	row,
	open,
	onOpenChange,
	baselineName,
	comparisonName,
	onJump,
}: RowDetailsSheetProps) {
	return (
		<Sheet open={open && !!row} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl lg:max-w-2xl">
				{row && (
					<RowDetails
						row={row}
						baselineName={baselineName}
						comparisonName={comparisonName}
						onJump={onJump}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}

function RowDetails({
	row,
	baselineName,
	comparisonName,
	onJump,
}: {
	row: CompareRow;
	baselineName: string;
	comparisonName: string;
	onJump: (row: CompareRow) => void;
}) {
	const { baseline, comparison } = rowEntries(row);
	const entry = (baseline ?? comparison)!;
	const kindLabel =
		row.kind === "added"
			? "Only in comparison"
			: row.kind === "removed"
				? "Only in baseline"
				: row.matchedBy === "pattern"
					? "Matched by URL pattern"
					: "Matched";
	const headerDiffs = row.kind === "matched" ? row.delta.headerDiffs : [];

	return (
		<>
			<SheetHeader className="border-b pr-12">
				<p
					className={cn(
						"inline-flex items-center gap-1 text-xs font-medium",
						row.kind === "added" && "text-success",
						row.kind === "removed" && "text-destructive",
						row.kind === "matched" && "text-primary"
					)}
				>
					{row.kind === "matched" && row.matchedBy === "pattern" && (
						<Shuffle className="size-3" aria-hidden="true" />
					)}
					{kindLabel}
				</p>
				<SheetTitle className="flex min-w-0 items-center gap-2">
					<MethodBadge method={entry.request.method} />
					<span className="truncate font-mono text-sm" title={entry.request.url}>
						{extractPath(entry.request.url)}
					</span>
				</SheetTitle>
				<SheetDescription className="truncate text-xs">
					<span title={baselineName}>{baselineName}</span> vs{" "}
					<span title={comparisonName}>{comparisonName}</span>
				</SheetDescription>
			</SheetHeader>

			<div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
				<div className="space-y-3">
					{baseline && <UrlLine label="Baseline URL" url={baseline.request.url} />}
					{comparison && (!baseline || comparison.request.url !== baseline.request.url) && (
						<UrlLine label="Comparison URL" url={comparison.request.url} />
					)}
				</div>

				<MetricTable
					title="General"
					metrics={GENERAL}
					baseline={baseline}
					comparison={comparison}
				/>
				<MetricTable title="Timing" metrics={TIMINGS} baseline={baseline} comparison={comparison} />
				<MetricTable title="Size" metrics={SIZES} baseline={baseline} comparison={comparison} />

				{row.kind === "matched" && (
					<section className="space-y-2">
						<h3 className="text-sm font-semibold">Response header differences</h3>
						{headerDiffs.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								No differences (volatile headers such as date, age and request ids are ignored).
							</p>
						) : (
							<ul className="divide-y overflow-hidden rounded-lg border">
								{headerDiffs.map((diff) => (
									<li key={diff.name} className="space-y-1 p-3 font-mono text-xs">
										<p className="font-medium text-foreground">{diff.name}</p>
										<p className="flex gap-2 break-all">
											<span className="shrink-0 text-destructive" aria-label="Baseline">
												−
											</span>
											{diff.baseline === null ? (
												<span className="text-muted-foreground italic">absent</span>
											) : (
												<span className="text-destructive">{diff.baseline}</span>
											)}
										</p>
										<p className="flex gap-2 break-all">
											<span className="shrink-0 text-success" aria-label="Comparison">
												+
											</span>
											{diff.comparison === null ? (
												<span className="text-muted-foreground italic">absent</span>
											) : (
												<span className="text-success">{diff.comparison}</span>
											)}
										</p>
									</li>
								))}
							</ul>
						)}
					</section>
				)}
			</div>

			<SheetFooter className="mt-0 border-t sm:flex-row sm:items-center sm:justify-between">
				<p className="text-xs text-muted-foreground">
					{baseline
						? "The baseline request is part of the loaded file."
						: "This request only exists in the comparison file, so it is not in the request list."}
				</p>
				<div className="flex gap-2 sm:shrink-0">
					<SheetClose asChild>
						<Button variant="outline" className="flex-1 sm:flex-none">
							Close
						</Button>
					</SheetClose>
					{baseline && (
						<Button className="flex-1 sm:flex-none" onClick={() => onJump(row)}>
							<ExternalLink />
							Open in request list
						</Button>
					)}
				</div>
			</SheetFooter>
		</>
	);
}
