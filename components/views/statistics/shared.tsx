"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { HAREntry } from "@/lib/har-types";
import type { Tone } from "@/components/common/stat-card";
import { PageSection } from "@/components/common/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { TableHeader } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StatisticsSectionId } from "./sections";
import type { SeriesColor } from "./colors";

/** Props shared by every statistics section. */
export interface SectionProps {
	/** Filtered entries in chronological order. */
	entries: HAREntry[];
	/** Store index for each item of `entries`. */
	indices: number[];
}

export function StatSection({
	id,
	title,
	description,
	children,
}: {
	id: StatisticsSectionId;
	title: string;
	description?: ReactNode;
	children: ReactNode;
}) {
	return (
		<PageSection id={id} title={title} description={description} className="scroll-mt-6 gap-4">
			{children}
		</PageSection>
	);
}

export function SectionCard({
	title,
	description,
	action,
	children,
	footer,
	className,
	contentClassName,
}: {
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
	/** Defaults to padded content; pass "p-0" for edge-to-edge tables. */
	contentClassName?: string;
}) {
	return (
		<Card className={cn("min-w-0 gap-0 overflow-hidden py-0 shadow-xs", className)}>
			<CardHeader className="gap-1 border-b px-4 py-3.5 sm:px-6 [.border-b]:pb-3.5">
				<CardTitle className="text-sm">{title}</CardTitle>
				{description && <CardDescription className="text-xs">{description}</CardDescription>}
				{action && <CardAction>{action}</CardAction>}
			</CardHeader>
			<CardContent className={cn("min-w-0 flex-1 p-4 sm:p-6", contentClassName)}>
				{children}
			</CardContent>
			{footer}
		</Card>
	);
}

const CELL_PADDING =
	"[&_td]:px-3 [&_th]:px-3 [&_tr>:first-child]:pl-4 [&_tr>:last-child]:pr-4 sm:[&_tr>:first-child]:pl-6 sm:[&_tr>:last-child]:pr-6";

/** Table that scrolls horizontally inside its card when it is wider than the page. */
export function StatTable({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div className="overflow-x-auto">
			<table
				data-slot="table"
				className={cn("w-full caption-bottom text-sm", CELL_PADDING, className)}
			>
				{children}
			</table>
		</div>
	);
}

export function StatTableHeader({ children }: { children: ReactNode }) {
	return (
		<TableHeader className="bg-card text-xs [&_th]:h-9 [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
			{children}
		</TableHeader>
	);
}

const SHOW_ALL_LIMIT = 1000;
const SHOW_MORE_STEP = 500;

/** "Show all" state for a truncated list. */
export function useTruncation(total: number, initial: number) {
	const [limit, setLimit] = useState(initial);
	const shown = Math.min(total, limit);
	return {
		shown,
		total,
		initial,
		showMore: () =>
			setLimit((current) => (total - current <= SHOW_ALL_LIMIT ? total : current + SHOW_MORE_STEP)),
		showLess: () => setLimit(initial),
	};
}

export function TruncationFooter({
	state,
	noun,
}: {
	state: ReturnType<typeof useTruncation>;
	noun: string;
}) {
	const { shown, total, initial } = state;
	if (total <= initial) return null;
	const remaining = total - shown;
	return (
		<div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground sm:px-6">
			<span className="tabular-nums">
				{remaining > 0
					? `Showing top ${shown.toLocaleString()} of ${total.toLocaleString()} ${noun}`
					: `Showing all ${total.toLocaleString()} ${noun}`}
			</span>
			{remaining > 0 ? (
				<Button variant="ghost" size="sm" onClick={state.showMore}>
					{remaining <= SHOW_ALL_LIMIT ? "Show all" : `Show ${SHOW_MORE_STEP} more`}
				</Button>
			) : (
				<Button variant="ghost" size="sm" onClick={state.showLess}>
					Show less
				</Button>
			)}
		</div>
	);
}

export function Unavailable({
	icon: Icon,
	title,
	children,
}: {
	icon: ComponentType<{ className?: string }>;
	title: string;
	children: ReactNode;
}) {
	return (
		<Card className="gap-0 border-dashed py-0 shadow-none">
			<Empty className="p-6 md:p-8">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon />
					</EmptyMedia>
					<EmptyTitle className="text-base">{title}</EmptyTitle>
					<EmptyDescription className="space-y-1">{children}</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</Card>
	);
}

export function Caption({ children }: { children: ReactNode }) {
	return <div className="space-y-1 text-xs text-pretty text-muted-foreground">{children}</div>;
}

const TONE_BADGE: Record<Tone, string> = {
	default: "bg-muted text-muted-foreground",
	primary: "bg-primary/10 text-primary",
	success: "bg-success/12 text-success",
	warning: "bg-warning/15 text-warning",
	destructive: "bg-destructive/10 text-destructive",
	info: "bg-info/12 text-info",
};

export function ToneBadge({
	tone = "default",
	children,
	className,
	title,
}: {
	tone?: Tone;
	children: ReactNode;
	className?: string;
	title?: string;
}) {
	return (
		<Badge
			variant="outline"
			title={title}
			className={cn("border-transparent tabular-nums", TONE_BADGE[tone], className)}
		>
			{children}
		</Badge>
	);
}

/** Outline badge with a colored dot, used for types and priorities. */
export function SeriesBadge({
	color,
	children,
	className,
}: {
	color: SeriesColor;
	children: ReactNode;
	className?: string;
}) {
	return (
		<Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
			<span className={cn("size-2 shrink-0 rounded-full", color.fill)} />
			{children}
		</Badge>
	);
}

export function ShareBar({
	value,
	color,
	label,
	className,
}: {
	value: number;
	color?: SeriesColor;
	label?: string;
	className?: string;
}) {
	return (
		<div className={cn("flex items-center justify-end gap-2", className)}>
			<Progress
				value={value}
				aria-label={label}
				className={cn("h-1.5 w-16 bg-muted sm:w-20", color?.progress)}
			/>
			<span className="w-12 text-right text-muted-foreground tabular-nums">
				{value.toFixed(1)}%
			</span>
		</div>
	);
}

export function Metric({
	label,
	value,
	className,
}: {
	label: ReactNode;
	value: ReactNode;
	className?: string;
}) {
	return (
		<div className="min-w-0">
			<div className="truncate text-xs text-muted-foreground">{label}</div>
			<div
				className={cn(
					"mt-0.5 truncate text-lg font-semibold tracking-tight tabular-nums",
					className
				)}
			>
				{value}
			</div>
		</div>
	);
}

/** Trigger showing the full domain list in a tooltip. */
export function DomainList({
	domains,
	children,
	className,
}: {
	domains: string[];
	children: ReactNode;
	className?: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					tabIndex={0}
					className={cn(
						"cursor-default rounded-sm tabular-nums underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
						className
					)}
				>
					{children}
				</span>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs">
				<ul className="space-y-0.5 font-mono break-all">
					{domains.slice(0, 20).map((domain) => (
						<li key={domain}>{domain}</li>
					))}
					{domains.length > 20 && <li>+{domains.length - 20} more</li>}
				</ul>
			</TooltipContent>
		</Tooltip>
	);
}

export function plural(count: number, singular: string, pluralForm?: string) {
	return `${count.toLocaleString()} ${count === 1 ? singular : (pluralForm ?? singular + "s")}`;
}
