"use client";

import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHarStore } from "@/lib/stores/har-store";

/** "Showing N of M requests" banner for views that respect list filters. */
export function FilteredNotice({ shown }: { shown: number }) {
	const total = useHarStore((s) => s.entries.length);
	const resetAllFilters = useHarStore((s) => s.resetAllFilters);
	if (shown === total) return null;

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm">
			<span className="text-muted-foreground">
				Showing{" "}
				<span className="font-medium text-foreground tabular-nums">{shown.toLocaleString()}</span>{" "}
				of <span className="tabular-nums">{total.toLocaleString()}</span> requests because filters
				are active.
			</span>
			<Button variant="ghost" size="sm" onClick={resetAllFilters}>
				<FilterX />
				Clear filters
			</Button>
		</div>
	);
}
