"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { CompareRow, RowFlags } from "@/lib/har-compare";
import { formatBytes, formatTime, getEntryTransferSize } from "@/lib/har-parser";
import { formatSignedTime } from "@/lib/timing";
import { StatusBadge } from "@/components/common/badges";
import { cn } from "@/lib/cn";
import {
	TONE_CLASSES,
	changeLabel,
	formatPct,
	formatSignedBytes,
	primaryEntry,
	sizeDeltaOf,
	toneForDelta,
	type ChangeTone,
} from "./utils";

const CHANGE_BADGE: Record<ChangeTone, string> = {
	better: "border-success/30 bg-success/10 text-success",
	worse: "border-destructive/30 bg-destructive/10 text-destructive",
	primary: "border-primary/30 bg-primary/10 text-primary",
	neutral: "border-transparent text-muted-foreground",
};

export function ChangeBadge({
	row,
	flags,
	className,
}: {
	row: CompareRow;
	flags?: RowFlags;
	className?: string;
}) {
	const { label, tone } = changeLabel(row, flags);
	return (
		<span
			className={cn(
				"inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[11px] font-medium",
				CHANGE_BADGE[tone],
				className
			)}
		>
			{label}
		</span>
	);
}

/** Left border colour that marks a row's kind. */
export function rowAccent(row: CompareRow, flags?: RowFlags) {
	if (row.kind === "added") return "border-l-success";
	if (row.kind === "removed") return "border-l-destructive";
	return flags?.changed ? "border-l-primary/60" : "border-l-transparent";
}

export function StatusChange({ row }: { row: CompareRow }) {
	if (row.kind !== "matched") {
		const entry = row.kind === "added" ? row.comparison : row.baseline;
		return <StatusBadge status={entry.response.status} />;
	}
	return (
		<span className="inline-flex min-w-0 items-center gap-1">
			<StatusBadge status={row.baseline.response.status} />
			{row.delta.statusChanged && (
				<>
					<ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-label="to" />
					<StatusBadge status={row.comparison.response.status} />
				</>
			)}
		</span>
	);
}

function ValuePair({
	before,
	after,
	delta,
	deltaClass,
	align = "right",
}: {
	before: string;
	after: string;
	delta: ReactNode;
	deltaClass?: string;
	align?: "left" | "right";
}) {
	return (
		<div
			className={cn(
				"min-w-0 font-mono text-[11px] leading-tight tabular-nums",
				align === "right" ? "text-right" : "text-left"
			)}
		>
			<div className={cn("truncate text-xs font-medium", deltaClass)}>{delta}</div>
			<div className="truncate text-muted-foreground">
				{before} <span aria-label="to">→</span> {after}
			</div>
		</div>
	);
}

export function timeDeltaText(row: CompareRow & { kind: "matched" }) {
	const { delta } = row;
	if (Math.round(delta.timeDelta) === 0) return "±0 ms";
	return `${formatSignedTime(delta.timeDelta)}${delta.timeDeltaPct === null ? "" : ` (${formatPct(delta.timeDeltaPct)})`}`;
}

export function sizeDeltaText(row: CompareRow & { kind: "matched" }) {
	const size = sizeDeltaOf(row.delta);
	if (size.delta === 0) return "±0 B";
	return `${size.label === "body" ? "body " : ""}${formatSignedBytes(size.delta)}${size.pct === null ? "" : ` (${formatPct(size.pct)})`}`;
}

export function TimeCell({
	row,
	flags,
	align,
}: {
	row: CompareRow;
	flags?: RowFlags;
	align?: "left" | "right";
}) {
	if (row.kind !== "matched") {
		const time = formatTime(primaryEntry(row).time);
		return (
			<ValuePair
				align={align}
				before={row.kind === "added" ? "—" : time}
				after={row.kind === "added" ? time : "—"}
				delta={row.kind === "added" ? "new" : "removed"}
				deltaClass="text-muted-foreground"
			/>
		);
	}
	const tone = toneForDelta(row.delta.timeDelta, !!(flags?.slower || flags?.faster));
	return (
		<ValuePair
			align={align}
			before={formatTime(row.baseline.time)}
			after={formatTime(row.comparison.time)}
			delta={timeDeltaText(row)}
			deltaClass={TONE_CLASSES[tone]}
		/>
	);
}

export function SizeCell({
	row,
	flags,
	align,
}: {
	row: CompareRow;
	flags?: RowFlags;
	align?: "left" | "right";
}) {
	if (row.kind !== "matched") {
		const size = formatBytes(getEntryTransferSize(primaryEntry(row)));
		return (
			<ValuePair
				align={align}
				before={row.kind === "added" ? "—" : size}
				after={row.kind === "added" ? size : "—"}
				delta={row.kind === "added" ? "new" : "removed"}
				deltaClass="text-muted-foreground"
			/>
		);
	}
	const tone = toneForDelta(sizeDeltaOf(row.delta).delta, !!flags?.sizeChanged);
	return (
		<ValuePair
			align={align}
			before={formatBytes(getEntryTransferSize(row.baseline))}
			after={formatBytes(getEntryTransferSize(row.comparison))}
			delta={sizeDeltaText(row)}
			deltaClass={TONE_CLASSES[tone]}
		/>
	);
}
