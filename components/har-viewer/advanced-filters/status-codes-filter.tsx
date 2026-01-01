import { Hash, Plus, ChevronUp, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import type { FilterSectionProps } from "./types";

export function StatusCodesFilter({
	advancedFilters,
	setAdvancedFilters,
}: FilterSectionProps) {
	const [statusCodeInput, setStatusCodeInput] = useState<string>("");

	const handleAddStatusCode = () => {
		const code = parseInt(statusCodeInput);
		if (code && !advancedFilters.statusCodes.includes(code)) {
			setAdvancedFilters({
				statusCodes: [...advancedFilters.statusCodes, code],
			});
			setStatusCodeInput("");
		}
	};

	const handleRemoveStatusCode = (code: number) => {
		setAdvancedFilters({
			statusCodes: advancedFilters.statusCodes.filter(
				(c: number) => c !== code
			),
		});
	};

	return (
		<div className="space-y-1.5">
			<label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
				<Hash className="w-3.5 h-3.5 text-blue-500" />
				Status Codes
			</label>
			<div className="flex gap-1">
				<div className="relative flex items-center flex-1">
					<input
						type="text"
						value={statusCodeInput}
						onChange={(e) => {
							const val = e.target.value.replace(/\D/g, "");
							setStatusCodeInput(val);
						}}
						onKeyDown={(e) =>
							e.key === "Enter" && handleAddStatusCode()
						}
						placeholder="404"
						className="w-full pl-2 pr-6 py-1.5 bg-background/80 border border-border/60 rounded text-xs text-foreground placeholder:text-muted/50 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
					/>
					<div className="absolute right-0.5 flex flex-col">
						<button
							aria-label="Increase Status Code"
							onClick={() => {
								const current = parseInt(
									statusCodeInput || "0"
								);
								setStatusCodeInput((current + 1).toString());
							}}
							className="p-0.5 hover:bg-blue-500/20 rounded transition-colors"
						>
							<ChevronUp className="w-2.5 h-2.5 text-blue-500" />
						</button>
						<button
							aria-label="Decrease Status Code"
							onClick={() => {
								const current = parseInt(
									statusCodeInput || "1"
								);
								setStatusCodeInput(
									Math.max(current - 1, 0).toString()
								);
							}}
							className="p-0.5 hover:bg-blue-500/20 rounded transition-colors"
						>
							<ChevronDown className="w-2.5 h-2.5 text-blue-500" />
						</button>
					</div>
				</div>
				<button
					aria-label="Add Status Code"
					onClick={handleAddStatusCode}
					className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded transition-colors"
				>
					<Plus className="w-3.5 h-3.5 text-blue-500" />
				</button>
			</div>
			{advancedFilters.statusCodes.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{advancedFilters.statusCodes.map((code: number) => (
						<span
							key={code}
							className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/20 text-blue-500 rounded text-xs font-mono border border-blue-500/30"
						>
							{code}
							<button
								aria-label={`Remove status code ${code}`}
								onClick={() => handleRemoveStatusCode(code)}
							>
								<X className="w-2.5 h-2.5" />
							</button>
						</span>
					))}
				</div>
			)}
		</div>
	);
}
