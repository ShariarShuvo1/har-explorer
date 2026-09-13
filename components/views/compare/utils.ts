import { formatBytes } from "@/lib/har-parser";
import type { HAREntry } from "@/lib/har-types";
import { isErrorStatus, type CompareRow, type PairDelta, type RowFlags } from "@/lib/har-compare";
import type { CompareFilter } from "./compare-ui-store";

export type DeltaTone = "better" | "worse" | "neutral";

/** Every compared metric (time, size, requests, errors) is better when lower. */
export function toneForDelta(delta: number, significant = delta !== 0): DeltaTone {
	if (!significant || delta === 0) return "neutral";
	return delta > 0 ? "worse" : "better";
}

export const TONE_CLASSES: Record<DeltaTone, string> = {
	better: "text-success",
	worse: "text-destructive",
	neutral: "text-muted-foreground",
};

const sign = (value: number) => (value > 0 ? "+" : value < 0 ? "−" : "±");

export function formatSignedBytes(delta: number): string {
	return `${sign(delta)}${formatBytes(Math.abs(delta))}`;
}

export function formatSignedCount(delta: number): string {
	return `${sign(delta)}${Math.abs(delta).toLocaleString()}`;
}

export function formatPct(pct: number | null): string {
	if (pct === null) return "new";
	if (!Number.isFinite(pct)) return "—";
	const abs = Math.abs(pct);
	const text = abs >= 100 ? Math.round(abs).toString() : abs.toFixed(1);
	return `${sign(Math.round(pct * 10))}${text}%`;
}

export function percentOf(from: number, to: number): number | null {
	if (from === 0) return to === 0 ? 0 : null;
	return ((to - from) / from) * 100;
}

export function rowEntries(row: CompareRow): {
	baseline: HAREntry | null;
	comparison: HAREntry | null;
} {
	return {
		baseline: row.kind === "added" ? null : row.baseline,
		comparison: row.kind === "removed" ? null : row.comparison,
	};
}

/** Transfer size delta, falling back to the body size delta when transfer is unchanged. */
export function sizeDeltaOf(delta: PairDelta): {
	delta: number;
	pct: number | null;
	label: "transfer" | "body";
} {
	if (delta.transferDelta !== 0 || delta.contentDelta === 0) {
		return {
			delta: delta.transferDelta,
			pct: delta.transferDeltaPct,
			label: "transfer",
		};
	}
	return { delta: delta.contentDelta, pct: delta.contentDeltaPct, label: "body" };
}

/** The entry that represents the row (baseline preferred). */
export function primaryEntry(row: CompareRow): HAREntry {
	return row.kind === "added" ? row.comparison : row.baseline;
}

export type ChangeTone = DeltaTone | "primary";

export function changeLabel(
	row: CompareRow,
	flags: RowFlags | undefined
): { label: string; tone: ChangeTone } {
	if (row.kind === "added") return { label: "Added", tone: "better" };
	if (row.kind === "removed") return { label: "Removed", tone: "worse" };
	if (!flags) return { label: "Same", tone: "neutral" };
	if (flags.statusChanged) {
		const before = isErrorStatus(row.baseline.response.status);
		const after = isErrorStatus(row.comparison.response.status);
		return {
			label: "Status",
			tone: before === after ? "primary" : after ? "worse" : "better",
		};
	}
	if (flags.slower) return { label: "Slower", tone: "worse" };
	if (flags.faster) return { label: "Faster", tone: "better" };
	if (flags.sizeChanged) {
		const larger = sizeDeltaOf(row.delta).delta > 0;
		return { label: larger ? "Larger" : "Smaller", tone: larger ? "worse" : "better" };
	}
	if (flags.mimeChanged) return { label: "Type", tone: "primary" };
	if (flags.headersChanged) return { label: "Headers", tone: "neutral" };
	return { label: "Same", tone: "neutral" };
}

export function matchesFilter(filter: CompareFilter, row: CompareRow, flags: RowFlags) {
	switch (filter) {
		case "all":
			return true;
		case "added":
			return row.kind === "added";
		case "removed":
			return row.kind === "removed";
		case "changed":
			return flags.changed;
		case "status":
			return flags.statusChanged;
		case "slower":
			return flags.slower;
		case "faster":
			return flags.faster;
	}
}

export function matchesSearch(row: CompareRow, terms: string[]): boolean {
	if (terms.length === 0) return true;
	const parts: string[] = [];
	if (row.kind !== "added") {
		parts.push(
			row.baseline.request.method,
			row.baseline.request.url,
			String(row.baseline.response.status)
		);
	}
	if (row.kind !== "removed") {
		parts.push(
			row.comparison.request.method,
			row.comparison.request.url,
			String(row.comparison.response.status)
		);
	}
	const haystack = parts.join(" ").toLowerCase();
	return terms.every((term) => haystack.includes(term));
}
