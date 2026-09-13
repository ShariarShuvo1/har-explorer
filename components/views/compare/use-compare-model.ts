"use client";

import { useDeferredValue, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { HAREntry } from "@/lib/har-types";
import {
	classifyRow,
	compareHar,
	summarizeEntries,
	type CompareRow,
	type RowFlags,
} from "@/lib/har-compare";
import { useCompareUiStore, type CompareFilter } from "./compare-ui-store";
import { matchesFilter, matchesSearch, primaryEntry, sizeDeltaOf } from "./utils";

export type FilterCounts = Record<CompareFilter, number>;

/** Matches both captures and derives counts and the filtered, sorted rows. */
export function useCompareModel(baseline: HAREntry[], comparison: HAREntry[]) {
	const { filter, search, sortKey, sortDirection, thresholds, matchOptions } = useCompareUiStore(
		useShallow((s) => ({
			filter: s.filter,
			search: s.search,
			sortKey: s.sortKey,
			sortDirection: s.sortDirection,
			thresholds: s.thresholds,
			matchOptions: s.matchOptions,
		}))
	);
	const deferredSearch = useDeferredValue(search);

	const result = useMemo(
		() => compareHar(baseline, comparison, matchOptions),
		[baseline, comparison, matchOptions]
	);

	const summaries = useMemo(
		() => ({
			baseline: summarizeEntries(baseline),
			comparison: summarizeEntries(comparison),
		}),
		[baseline, comparison]
	);

	const flags = useMemo(() => {
		const map = new Map<string, RowFlags>();
		for (const row of result.rows) map.set(row.id, classifyRow(row, thresholds));
		return map;
	}, [result, thresholds]);

	const counts = useMemo<FilterCounts>(() => {
		const next: FilterCounts = {
			all: result.rows.length,
			changed: 0,
			added: result.added,
			removed: result.removed,
			status: 0,
			slower: 0,
			faster: 0,
		};
		for (const rowFlags of flags.values()) {
			if (rowFlags.changed) next.changed++;
			if (rowFlags.statusChanged) next.status++;
			if (rowFlags.slower) next.slower++;
			if (rowFlags.faster) next.faster++;
		}
		return next;
	}, [result, flags]);

	const visibleRows = useMemo(() => {
		const terms = deferredSearch.toLowerCase().split(/\s+/).filter(Boolean);
		const order = new Map(result.rows.map((row, i) => [row.id, i]));
		const filtered = result.rows.filter(
			(row) => matchesFilter(filter, row, flags.get(row.id)!) && matchesSearch(row, terms)
		);

		const dir = sortDirection === "asc" ? 1 : -1;
		const byOrder = (a: CompareRow, b: CompareRow) => order.get(a.id)! - order.get(b.id)!;
		const numeric =
			(value: (row: CompareRow) => number | null) => (a: CompareRow, b: CompareRow) => {
				const va = value(a);
				const vb = value(b);
				// Rows without a value (added/removed) always sort last.
				if (va === null || vb === null) {
					return va === vb ? byOrder(a, b) : va === null ? 1 : -1;
				}
				return (va - vb) * dir || byOrder(a, b);
			};

		switch (sortKey) {
			case "order":
				return dir === 1 ? filtered : filtered.reverse();
			case "url":
				return filtered.sort(
					(a, b) =>
						primaryEntry(a).request.url.localeCompare(primaryEntry(b).request.url) * dir ||
						byOrder(a, b)
				);
			case "status":
				return filtered.sort(numeric((row) => primaryEntry(row).response.status));
			case "timeDelta":
				return filtered.sort(
					numeric((row) => (row.kind === "matched" ? row.delta.timeDelta : null))
				);
			case "timePct":
				return filtered.sort(
					numeric((row) => (row.kind === "matched" ? row.delta.timeDeltaPct : null))
				);
			case "sizeDelta":
				return filtered.sort(
					numeric((row) => (row.kind === "matched" ? sizeDeltaOf(row.delta).delta : null))
				);
		}
	}, [result, flags, filter, deferredSearch, sortKey, sortDirection]);

	const identical =
		result.rows.length > 0 && counts.added === 0 && counts.removed === 0 && counts.changed === 0;

	return {
		result,
		summaries,
		flags,
		counts,
		visibleRows,
		identical,
		isFiltered: filter !== "all" || deferredSearch.trim() !== "",
	};
}
