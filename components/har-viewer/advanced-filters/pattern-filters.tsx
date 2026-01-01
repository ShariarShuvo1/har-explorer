import { Globe, Route } from "lucide-react";
import type { FilterSectionProps } from "./types";

export function PatternFilters({
	advancedFilters,
	setAdvancedFilters,
}: FilterSectionProps) {
	return (
		<>
			<div className="space-y-1.5">
				<label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
					<Globe className="w-3.5 h-3.5 text-cyan-500" />
					Domain
				</label>
				<input
					type="text"
					value={advancedFilters.domainPattern}
					onChange={(e) =>
						setAdvancedFilters({
							domainPattern: e.target.value,
						})
					}
					placeholder="api.example.com"
					className="w-full px-2 py-1.5 bg-background/80 border border-border/60 rounded text-xs text-foreground placeholder:text-muted/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
				/>
			</div>

			<div className="space-y-1.5">
				<label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
					<Route className="w-3.5 h-3.5 text-orange-500" />
					Path Pattern
				</label>
				<input
					type="text"
					value={advancedFilters.pathPattern}
					onChange={(e) =>
						setAdvancedFilters({ pathPattern: e.target.value })
					}
					placeholder="^/api/.*"
					className="w-full px-2 py-1.5 bg-background/80 border border-border/60 rounded text-xs text-foreground placeholder:text-muted/50 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
				/>
			</div>
		</>
	);
}
