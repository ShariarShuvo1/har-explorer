import { HardDrive, ChevronUp, ChevronDown } from "lucide-react";
import type { FilterSectionProps } from "./types";

export function SizeFilter({
	advancedFilters,
	setAdvancedFilters,
}: FilterSectionProps) {
	return (
		<div className="space-y-1.5">
			<label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
				<HardDrive className="w-3.5 h-3.5 text-purple-500" />
				Size (bytes)
			</label>
			<div className="grid grid-cols-2 gap-1">
				<div className="relative flex items-center">
					<input
						type="text"
						value={advancedFilters.sizeMin ?? ""}
						onChange={(e) => {
							const val = e.target.value.replace(/\D/g, "");
							setAdvancedFilters({
								sizeMin: val ? parseInt(val) : null,
							});
						}}
						placeholder="Min"
						className="w-full pl-2 pr-6 py-1.5 bg-background/80 border border-border/60 rounded text-xs text-foreground placeholder:text-muted/50 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
					/>
					<div className="absolute right-0.5 flex flex-col">
						<button
							aria-label="Increase Minimum Size"
							onClick={() =>
								setAdvancedFilters({
									sizeMin:
										(advancedFilters.sizeMin ?? 0) + 1000,
								})
							}
							className="p-0.5 hover:bg-purple-500/20 rounded transition-colors"
						>
							<ChevronUp className="w-2.5 h-2.5 text-purple-500" />
						</button>
						<button
							aria-label="Decrease Minimum Size"
							onClick={() =>
								setAdvancedFilters({
									sizeMin: Math.max(
										(advancedFilters.sizeMin ?? 1000) -
											1000,
										0
									),
								})
							}
							className="p-0.5 hover:bg-purple-500/20 rounded transition-colors"
						>
							<ChevronDown className="w-2.5 h-2.5 text-purple-500" />
						</button>
					</div>
				</div>
				<div className="relative flex items-center">
					<input
						type="text"
						value={advancedFilters.sizeMax ?? ""}
						onChange={(e) => {
							const val = e.target.value.replace(/\D/g, "");
							setAdvancedFilters({
								sizeMax: val ? parseInt(val) : null,
							});
						}}
						placeholder="Max"
						className="w-full pl-2 pr-6 py-1.5 bg-background/80 border border-border/60 rounded text-xs text-foreground placeholder:text-muted/50 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
					/>
					<div className="absolute right-0.5 flex flex-col">
						<button
							aria-label="Increase Maximum Size"
							onClick={() =>
								setAdvancedFilters({
									sizeMax:
										(advancedFilters.sizeMax ?? 0) + 1000,
								})
							}
							className="p-0.5 hover:bg-purple-500/20 rounded transition-colors"
						>
							<ChevronUp className="w-2.5 h-2.5 text-purple-500" />
						</button>
						<button
							aria-label="Decrease Maximum Size"
							onClick={() =>
								setAdvancedFilters({
									sizeMax: Math.max(
										(advancedFilters.sizeMax ?? 1000) -
											1000,
										0
									),
								})
							}
							className="p-0.5 hover:bg-purple-500/20 rounded transition-colors"
						>
							<ChevronDown className="w-2.5 h-2.5 text-purple-500" />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
