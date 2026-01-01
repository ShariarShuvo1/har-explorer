"use client";

import { X, Filter, Zap, RotateCcw } from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";
import { StatusCodesFilter } from "./status-codes-filter";
import { SizeFilter } from "./size-filter";
import { DurationFilter } from "./duration-filter";
import { PatternFilters } from "./pattern-filters";
import { MethodsFilter } from "./methods-filter";
import { HeadersFilter } from "./headers-filter";

export function AdvancedFilters() {
	const {
		advancedFilters,
		setAdvancedFilters,
		resetAdvancedFilters,
		showAdvancedFilters,
		toggleAdvancedFilters,
	} = useHarStore();

	if (!showAdvancedFilters) return null;

	return (
		<div className="bg-linear-to-br from-card/80 via-card/60 to-card/40 border border-border/50 backdrop-blur-sm shadow-xl">
			<div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-border/50">
				<div className="flex items-center gap-2">
					<Filter className="w-4 h-4 text-primary" />
					<h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
						Advanced Filters
					</h3>
					<Zap className="w-3 h-3 text-accent animate-pulse" />
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={resetAdvancedFilters}
						className="p-1.5 hover:bg-primary/20 rounded transition-colors group"
						title="Reset Filters"
					>
						<RotateCcw className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors" />
					</button>
					<button
						onClick={toggleAdvancedFilters}
						className="p-1.5 hover:bg-destructive/20 rounded transition-colors group"
						title="Close"
					>
						<X className="w-3.5 h-3.5 text-muted group-hover:text-destructive transition-colors" />
					</button>
				</div>
			</div>

			<div className="grid grid-cols-4 gap-3 p-3">
				<StatusCodesFilter
					advancedFilters={advancedFilters}
					setAdvancedFilters={setAdvancedFilters}
				/>
				<SizeFilter
					advancedFilters={advancedFilters}
					setAdvancedFilters={setAdvancedFilters}
				/>
				<DurationFilter
					advancedFilters={advancedFilters}
					setAdvancedFilters={setAdvancedFilters}
				/>
				<PatternFilters
					advancedFilters={advancedFilters}
					setAdvancedFilters={setAdvancedFilters}
				/>
				<MethodsFilter
					advancedFilters={advancedFilters}
					setAdvancedFilters={setAdvancedFilters}
				/>
				<HeadersFilter
					advancedFilters={advancedFilters}
					setAdvancedFilters={setAdvancedFilters}
				/>
			</div>
		</div>
	);
}
