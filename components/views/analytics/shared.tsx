"use client";

import type { ComponentType, ReactNode } from "react";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

export const CHART_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--chart-6)",
	"var(--chart-7)",
	"var(--chart-8)",
];

export const chartColor = (index: number) => CHART_COLORS[index % CHART_COLORS.length];

/** Standard responsive chart box; overrides ChartContainer's aspect-video. */
export const CHART_CLASS = "aspect-auto h-[240px] w-full sm:h-[280px]";

/** Two-column grid used inside sections. */
export function SectionGrid({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div className={cn("grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2", className)}>{children}</div>
	);
}

export function ChartCard({
	title,
	description,
	action,
	children,
	className,
	contentClassName,
}: {
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
	contentClassName?: string;
}) {
	return (
		<Card className={cn("min-w-0 gap-4 py-5 shadow-xs", className)}>
			<CardHeader className="px-4 sm:px-5">
				<CardTitle className="text-sm">{title}</CardTitle>
				{description && <CardDescription className="text-xs">{description}</CardDescription>}
				{action && <CardAction>{action}</CardAction>}
			</CardHeader>
			<CardContent className={cn("@container min-w-0 px-4 sm:px-5", contentClassName)}>
				{children}
			</CardContent>
		</Card>
	);
}

/** One row of a ChartTooltipContent `formatter`, replacing the default row. */
export function TooltipRow({
	color,
	label,
	value,
}: {
	color?: string;
	label: ReactNode;
	value: ReactNode;
}) {
	return (
		<div className="flex w-full items-center gap-2">
			{color && (
				<span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
			)}
			<span className="text-muted-foreground">{label}</span>
			<span className="ml-auto pl-3 font-mono font-medium text-foreground tabular-nums">
				{value}
			</span>
		</div>
	);
}

export function MetricRow({
	label,
	value,
	hint,
	valueClassName,
}: {
	label: ReactNode;
	value: ReactNode;
	hint?: ReactNode;
	valueClassName?: string;
}) {
	return (
		<div className="flex min-w-0 items-baseline justify-between gap-3 py-1.5">
			<div className="min-w-0">
				<div className="text-xs text-muted-foreground">{label}</div>
				{hint && <div className="truncate text-[11px] text-muted-foreground/80">{hint}</div>}
			</div>
			<div className={cn("shrink-0 text-sm font-medium tabular-nums", valueClassName)}>{value}</div>
		</div>
	);
}

export function ChartPlaceholder({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
			{children}
		</div>
	);
}

const INSIGHT_TONE = {
	default: "",
	warning: "border-warning/40 bg-warning/5 [&>svg]:text-warning",
	destructive: "border-destructive/40 bg-destructive/5 [&>svg]:text-destructive",
	info: "border-info/40 bg-info/5 [&>svg]:text-info",
	success: "border-success/40 bg-success/5 [&>svg]:text-success",
} as const;

export function Insight({
	icon: Icon,
	title,
	children,
	tone = "info",
}: {
	icon: ComponentType<{ className?: string }>;
	title: ReactNode;
	children: ReactNode;
	tone?: keyof typeof INSIGHT_TONE;
}) {
	return (
		<Alert className={INSIGHT_TONE[tone]}>
			<Icon />
			<AlertTitle className="line-clamp-none">{title}</AlertTitle>
			<AlertDescription className="text-pretty">{children}</AlertDescription>
		</Alert>
	);
}
