import {
	BarChart3,
	FileOutput,
	GitCompareArrows,
	List,
	ShieldAlert,
	Table2,
	type LucideIcon,
} from "lucide-react";
import type { ViewMode } from "@/lib/stores/har-store";

export interface ViewConfig {
	id: ViewMode;
	label: string;
	description: string;
	icon: LucideIcon;
	/** Digit shortcut (1-6). */
	shortcut: string;
}

export const VIEWS: ViewConfig[] = [
	{
		id: "requests",
		label: "Requests",
		description: "Browse, filter and inspect every request",
		icon: List,
		shortcut: "1",
	},
	{
		id: "analytics",
		label: "Analytics",
		description: "Charts for types, domains, timings and bandwidth",
		icon: BarChart3,
		shortcut: "2",
	},
	{
		id: "patterns",
		label: "Patterns",
		description: "Detected performance and correctness issues",
		icon: ShieldAlert,
		shortcut: "3",
	},
	{
		id: "statistics",
		label: "Statistics",
		description: "Connections, priorities, transfers and servers",
		icon: Table2,
		shortcut: "4",
	},
	{
		id: "compare",
		label: "Compare",
		description: "Compare this file with another HAR",
		icon: GitCompareArrows,
		shortcut: "5",
	},
	{
		id: "export",
		label: "Export",
		description: "Markdown, OpenAPI or HAR export",
		icon: FileOutput,
		shortcut: "6",
	},
];

export const VIEW_BY_ID = Object.fromEntries(VIEWS.map((v) => [v.id, v])) as Record<
	ViewMode,
	ViewConfig
>;
