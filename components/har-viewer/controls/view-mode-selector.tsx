"use client";

import { BarChart3, List, TrendingUp, PieChart, FileDown } from "lucide-react";
import { useHarStore, ViewMode } from "@/lib/stores/har-store";
import { cn } from "@/lib/cn";

export function ViewModeSelector() {
	const { viewMode, setViewMode } = useHarStore();

	const modes: Array<{ id: ViewMode; icon: typeof List; label: string }> = [
		{ id: "list", icon: List, label: "List" },
		{ id: "analytics", icon: BarChart3, label: "Analytics" },
		{ id: "patterns", icon: TrendingUp, label: "Patterns" },
		{ id: "statistics", icon: PieChart, label: "Statistics" },
		{ id: "export", icon: FileDown, label: "Export" },
	];

	return (
		<div className="flex items-center gap-1 p-1 bg-card/40 rounded-lg border border-border">
			{modes.map((mode) => {
				const Icon = mode.icon;
				const isActive = viewMode === mode.id;
				return (
					<button
						key={mode.id}
						onClick={() => setViewMode(mode.id)}
						className={cn(
							"flex items-center gap-2 px-3 py-2 rounded transition-all",
							"hover:bg-primary/10 hover:text-primary",
							isActive && "bg-primary/20 text-primary shadow-sm"
						)}
						title={mode.label}
					>
						<Icon className="w-4 h-4" />
						<span className="text-sm font-medium">
							{mode.label}
						</span>
					</button>
				);
			})}
		</div>
	);
}
