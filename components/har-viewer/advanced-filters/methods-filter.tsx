import { Code } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FilterSectionProps } from "./types";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];

export function MethodsFilter({
	advancedFilters,
	setAdvancedFilters,
}: FilterSectionProps) {
	const handleAddMethod = (method: string) => {
		if (!advancedFilters.methodFilters.includes(method)) {
			setAdvancedFilters({
				methodFilters: [...advancedFilters.methodFilters, method],
			});
		}
	};

	const handleRemoveMethod = (method: string) => {
		setAdvancedFilters({
			methodFilters: advancedFilters.methodFilters.filter(
				(m: string) => m !== method
			),
		});
	};

	return (
		<div className="space-y-1.5 col-span-2">
			<label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
				<Code className="w-3.5 h-3.5 text-pink-500" />
				HTTP Methods
			</label>
			<div className="flex flex-wrap gap-1">
				{METHODS.map((method) => {
					const isSelected =
						advancedFilters.methodFilters.includes(method);
					return (
						<button
							key={method}
							onClick={() =>
								isSelected
									? handleRemoveMethod(method)
									: handleAddMethod(method)
							}
							className={cn(
								"px-2 py-1 rounded text-xs font-bold transition-all border",
								isSelected
									? "bg-pink-500/20 text-pink-500 border-pink-500/40 shadow-sm"
									: "bg-card/50 text-muted border-border/40 hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-400"
							)}
						>
							{method}
						</button>
					);
				})}
			</div>
		</div>
	);
}
