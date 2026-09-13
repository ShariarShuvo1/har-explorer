import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Scrollable page body used by every view except the request list. */
export function Page({
	children,
	className,
	width = "default",
}: {
	children: ReactNode;
	className?: string;
	/** "default" caps line length for readability; "full" uses all space. */
	width?: "default" | "full";
}) {
	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div
				className={cn(
					"mx-auto flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8",
					width === "default" && "max-w-7xl",
					className
				)}
			>
				{children}
			</div>
		</div>
	);
}

export function PageHeader({
	title,
	description,
	actions,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}
		>
			<div className="min-w-0 space-y-1">
				<h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
				{description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
			</div>
			{actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
		</div>
	);
}

export function PageSection({
	title,
	description,
	actions,
	children,
	className,
	id,
}: {
	title?: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	id?: string;
}) {
	return (
		<section id={id} className={cn("flex flex-col gap-3", className)}>
			{(title || actions) && (
				<div className="flex flex-wrap items-end justify-between gap-2">
					<div className="min-w-0 space-y-0.5">
						{title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
						{description && <p className="text-sm text-muted-foreground">{description}</p>}
					</div>
					{actions && <div className="flex items-center gap-2">{actions}</div>}
				</div>
			)}
			{children}
		</section>
	);
}
