import { useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import type { FilterSectionProps } from "./types";

export function HeadersFilter({
	advancedFilters,
	setAdvancedFilters,
}: FilterSectionProps) {
	const [headerName, setHeaderName] = useState("");
	const [headerValue, setHeaderValue] = useState("");

	const handleAddHeader = () => {
		if (headerName && headerValue) {
			setAdvancedFilters({
				headerMatches: [
					...advancedFilters.headerMatches,
					{ name: headerName, value: headerValue },
				],
			});
			setHeaderName("");
			setHeaderValue("");
		}
	};

	const handleRemoveHeader = (index: number) => {
		setAdvancedFilters({
			headerMatches: advancedFilters.headerMatches.filter(
				(_: Record<string, string>, i: number) => i !== index
			),
		});
	};

	return (
		<div className="space-y-1.5 col-span-4">
			<label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
				<FileText className="w-3.5 h-3.5 text-yellow-500" />
				Header Matches
			</label>
			<div className="flex gap-1">
				<input
					type="text"
					value={headerName}
					onChange={(e) => setHeaderName(e.target.value)}
					placeholder="Header name"
					className="flex-1 px-2 py-1.5 bg-background/80 border border-border/60 rounded text-xs text-foreground placeholder:text-muted/50 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
				/>
				<input
					type="text"
					value={headerValue}
					onChange={(e) => setHeaderValue(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleAddHeader()}
					placeholder="Header value"
					className="flex-1 px-2 py-1.5 bg-background/80 border border-border/60 rounded text-xs text-foreground placeholder:text-muted/50 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all"
				/>
				<button
					aria-label="Add Header Match"
					onClick={handleAddHeader}
					className="p-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 rounded transition-colors"
				>
					<Plus className="w-3.5 h-3.5 text-yellow-500" />
				</button>
			</div>
			{advancedFilters.headerMatches.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{advancedFilters.headerMatches.map(
						(header: Record<string, string>, index: number) => (
							<div
								key={index}
								className="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded"
							>
								<span className="text-xs text-yellow-500 font-mono font-medium">
									{header.name}: {header.value}
								</span>
								<button
									aria-label={`Remove header match ${header.name}: ${header.value}`}
									onClick={() => handleRemoveHeader(index)}
								>
									<X className="w-2.5 h-2.5 text-yellow-500 hover:text-yellow-400" />
								</button>
							</div>
						)
					)}
				</div>
			)}
		</div>
	);
}
