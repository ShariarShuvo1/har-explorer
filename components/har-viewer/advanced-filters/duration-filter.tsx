import { Clock, ChevronUp, ChevronDown } from "lucide-react";
import type { FilterSectionProps } from "./types";

export function DurationFilter({
	advancedFilters,
	setAdvancedFilters,
}: FilterSectionProps) {
	return (
		<div className="space-y-1.5">
			<label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
				<Clock className="w-3.5 h-3.5 text-green-500" />
				Duration (ms)
			</label>
			<div className="grid grid-cols-2 gap-1">
				<div className="relative flex items-center">
					<input
						type="text"
						value={advancedFilters.durationMin ?? ""}
						onChange={(e) => {
							const val = e.target.value.replace(/\D/g, "");
							setAdvancedFilters({
								durationMin: val ? parseInt(val) : null,
							});
						}}
						placeholder="Min"
						className="w-full pl-2 pr-6 py-1.5 bg-background/80 border border-border/60 rounded text-xs text-foreground placeholder:text-muted/50 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-all"
					/>
					<div className="absolute right-0.5 flex flex-col">
						<button
							aria-label="Increase Minimum Duration"
							onClick={() =>
								setAdvancedFilters({
									durationMin:
										(advancedFilters.durationMin ?? 0) + 50,
								})
							}
							className="p-0.5 hover:bg-green-500/20 rounded transition-colors"
						>
							<ChevronUp className="w-2.5 h-2.5 text-green-500" />
						</button>
						<button
							aria-label="Decrease Minimum Duration"
							onClick={() =>
								setAdvancedFilters({
									durationMin: Math.max(
										(advancedFilters.durationMin ?? 50) -
											50,
										0
									),
								})
							}
							className="p-0.5 hover:bg-green-500/20 rounded transition-colors"
						>
							<ChevronDown className="w-2.5 h-2.5 text-green-500" />
						</button>
					</div>
				</div>
				<div className="relative flex items-center">
					<input
						type="text"
						value={advancedFilters.durationMax ?? ""}
						onChange={(e) => {
							const val = e.target.value.replace(/\D/g, "");
							setAdvancedFilters({
								durationMax: val ? parseInt(val) : null,
							});
						}}
						placeholder="Max"
						className="w-full pl-2 pr-6 py-1.5 bg-background/80 border border-border/60 rounded text-xs text-foreground placeholder:text-muted/50 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 transition-all"
					/>
					<div className="absolute right-0.5 flex flex-col">
						<button
							aria-label="Increase Maximum Duration"
							onClick={() =>
								setAdvancedFilters({
									durationMax:
										(advancedFilters.durationMax ?? 0) + 50,
								})
							}
							className="p-0.5 hover:bg-green-500/20 rounded transition-colors"
						>
							<ChevronUp className="w-2.5 h-2.5 text-green-500" />
						</button>
						<button
							aria-label="Decrease Maximum Duration"
							onClick={() =>
								setAdvancedFilters({
									durationMax: Math.max(
										(advancedFilters.durationMax ?? 50) -
											50,
										0
									),
								})
							}
							className="p-0.5 hover:bg-green-500/20 rounded transition-colors"
						>
							<ChevronDown className="w-2.5 h-2.5 text-green-500" />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
