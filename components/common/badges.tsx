import type { ResourceType } from "@/lib/har-types";
import { RESOURCE_TYPE_LABELS } from "@/lib/resource-type";
import { cn } from "@/lib/cn";

const METHOD_CLASSES: Record<string, string> = {
	GET: "text-sky-700 bg-sky-500/10 dark:text-sky-300",
	POST: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300",
	PUT: "text-amber-700 bg-amber-500/12 dark:text-amber-300",
	PATCH: "text-violet-700 bg-violet-500/10 dark:text-violet-300",
	DELETE: "text-rose-700 bg-rose-500/10 dark:text-rose-300",
	OPTIONS: "text-slate-600 bg-slate-500/10 dark:text-slate-300",
	HEAD: "text-slate-600 bg-slate-500/10 dark:text-slate-300",
};

export function MethodBadge({ method, className }: { method: string; className?: string }) {
	const upper = method.toUpperCase();
	return (
		<span
			className={cn(
				"inline-flex h-5 shrink-0 items-center justify-center rounded px-1.5 font-mono text-[11px] leading-none font-semibold",
				METHOD_CLASSES[upper] ?? "bg-muted text-foreground",
				className
			)}
		>
			{upper || "—"}
		</span>
	);
}

export function statusTone(status: number) {
	if (status <= 0) return "destructive" as const;
	if (status >= 500) return "destructive" as const;
	if (status >= 400) return "warning" as const;
	if (status >= 300) return "info" as const;
	if (status >= 200) return "success" as const;
	return "default" as const;
}

const STATUS_CLASSES = {
	success: "text-success",
	info: "text-info",
	warning: "text-warning",
	destructive: "text-destructive",
	default: "text-muted-foreground",
};

const STATUS_DOT = {
	success: "bg-success",
	info: "bg-info",
	warning: "bg-warning",
	destructive: "bg-destructive",
	default: "bg-muted-foreground",
};

/** Status code with a coloured dot, e.g. "● 404". */
export function StatusBadge({
	status,
	statusText,
	className,
	showText = false,
}: {
	status: number;
	statusText?: string;
	className?: string;
	showText?: boolean;
}) {
	const tone = statusTone(status);
	return (
		<span
			className={cn(
				"inline-flex min-w-0 items-center gap-1.5 font-mono text-xs font-medium tabular-nums",
				STATUS_CLASSES[tone],
				className
			)}
			title={statusText ? `${status} ${statusText}` : undefined}
		>
			<span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[tone])} />
			{status > 0 ? status : "Failed"}
			{showText && statusText && (
				<span className="truncate font-sans font-normal text-muted-foreground">{statusText}</span>
			)}
		</span>
	);
}

export function ResourceTypeBadge({ type, className }: { type: ResourceType; className?: string }) {
	return (
		<span className={cn("truncate text-xs text-muted-foreground", className)}>
			{RESOURCE_TYPE_LABELS[type]}
		</span>
	);
}
