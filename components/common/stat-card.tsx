import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "default" | "primary" | "success" | "warning" | "destructive" | "info";

const TONE_ICON: Record<Tone, string> = {
	default: "bg-muted text-muted-foreground",
	primary: "bg-primary/10 text-primary",
	success: "bg-success/12 text-success",
	warning: "bg-warning/15 text-warning",
	destructive: "bg-destructive/10 text-destructive",
	info: "bg-info/12 text-info",
};

export const TONE_TEXT: Record<Tone, string> = {
	default: "text-foreground",
	primary: "text-primary",
	success: "text-success",
	warning: "text-warning",
	destructive: "text-destructive",
	info: "text-info",
};

interface StatCardProps {
	label: ReactNode;
	value: ReactNode;
	hint?: ReactNode;
	icon?: ComponentType<{ className?: string }>;
	tone?: Tone;
	className?: string;
	onClick?: () => void;
	/** For toggle cards: renders aria-pressed and a selected style. */
	pressed?: boolean;
}

/** A single metric. Renders as a button when `onClick` is given. */
export function StatCard({
	label,
	value,
	hint,
	icon: Icon,
	tone = "default",
	className,
	onClick,
	pressed,
}: StatCardProps) {
	const content = (
		<>
			<div className="flex items-center justify-between gap-2">
				<span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
				{Icon && (
					<span
						className={cn(
							// Hidden on phones so two-column grids keep room for the label.
							"hidden size-7 shrink-0 items-center justify-center rounded-md sm:flex",
							TONE_ICON[tone]
						)}
					>
						<Icon className="size-3.5" />
					</span>
				)}
			</div>
			<div className="mt-1.5 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
				{value}
			</div>
			{hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
		</>
	);

	const classes = cn(
		"min-w-0 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-xs",
		onClick &&
			"transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
		pressed && "border-primary/50 bg-accent ring-1 ring-primary/30",
		className
	);

	if (onClick) {
		return (
			<button type="button" onClick={onClick} aria-pressed={pressed} className={classes}>
				{content}
			</button>
		);
	}
	return <div className={classes}>{content}</div>;
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4", className)}>
			{children}
		</div>
	);
}
