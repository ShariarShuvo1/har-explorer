"use client";

interface TooltipPayload {
	color?: string;
	name?: string;
	value?: string | number;
}

interface CustomTooltipProps {
	active?: boolean;
	payload?: TooltipPayload[];
	label?: string;
}

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
	if (!active || !payload || !payload.length) {
		return null;
	}

	return (
		<div
			className="p-3 rounded-lg border shadow-lg"
			style={{
				backgroundColor: "var(--card)",
				borderColor: "var(--border)",
				color: "var(--foreground)",
			}}
		>
			{label && (
				<p className="font-semibold mb-2 text-foreground">{label}</p>
			)}
			{payload.map((entry: TooltipPayload, index: number) => (
				<div key={index} className="flex items-center gap-2">
					<div
						className="w-3 h-3 rounded"
						style={{ backgroundColor: entry.color }}
					/>
					<span className="text-sm text-foreground">
						{entry.name}: {entry.value}
					</span>
				</div>
			))}
		</div>
	);
}

export function getTooltipStyle() {
	return {
		contentStyle: {
			backgroundColor: "var(--card)",
			border: "1px solid var(--border)",
			borderRadius: "0.5rem",
			color: "var(--foreground)",
		},
		labelStyle: {
			color: "var(--foreground)",
		},
		itemStyle: {
			color: "var(--foreground)",
		},
	};
}
