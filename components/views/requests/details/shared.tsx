"use client";

import { useCallback, useState, type ComponentType, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { HARCookie, HAREntry } from "@/lib/har-types";
import { useHarStore } from "@/lib/stores/har-store";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CopyButton } from "@/components/common/copy-button";
import { undoWithToast } from "@/components/app-shell/app-topbar";
import type { Tone } from "@/components/common/stat-card";
import { cn } from "@/lib/cn";

/**
 * Applies an edit to the entry at `index`. The updater always receives the
 * store's current entry, so consecutive edits never overwrite each other.
 */
export function useEntryUpdate(index: number) {
	return useCallback(
		(
			updater: (entry: HAREntry) => HAREntry,
			label = "Edit request",
			message = "Request updated"
		) => {
			const state = useHarStore.getState();
			const current = state.entries[index];
			if (!current) return false;
			const next = updater(current);
			if (next === current) return false;
			state.updateEntry(index, next, label);
			// Remember which history step this toast belongs to, so its Undo never
			// reverts a newer change. Length alone is not enough once history is capped.
			const { history } = useHarStore.getState();
			const length = history.length;
			const top = history.at(-1);
			toast.success(message, {
				action: {
					label: "Undo",
					onClick: () => {
						const now = useHarStore.getState().history;
						if (now.length === length && now.at(-1) === top) undoWithToast();
						else toast("A newer change was made — use Undo in the top bar to step back");
					},
				},
			});
			return true;
		},
		[index]
	);
}

/** Vertical stack for the content of a tab panel. */
export function TabBody({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn("space-y-6 p-4", className)}>{children}</div>;
}

export function Section({
	title,
	count,
	actions,
	children,
	className,
}: {
	title: ReactNode;
	count?: number;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn("min-w-0 space-y-2", className)}>
			<div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
				<h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
					{title}
					{count !== undefined && (
						<span className="font-normal text-muted-foreground tabular-nums">({count})</span>
					)}
				</h3>
				{actions && <div className="flex flex-wrap items-center gap-1">{actions}</div>}
			</div>
			{children}
		</section>
	);
}

/** A section whose body can be collapsed with a chevron. */
export function CollapsibleSection({
	title,
	count,
	actions,
	children,
	defaultOpen = true,
}: {
	title: ReactNode;
	count?: number;
	actions?: ReactNode;
	children: ReactNode;
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<Collapsible open={open} onOpenChange={setOpen} asChild>
			<section className="min-w-0 space-y-2">
				<div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
					<CollapsibleTrigger className="-ml-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50">
						<ChevronRight
							className={cn(
								"size-4 shrink-0 text-muted-foreground transition-transform",
								open && "rotate-90"
							)}
						/>
						<span className="truncate">{title}</span>
						{count !== undefined && (
							<span className="font-normal text-muted-foreground tabular-nums">({count})</span>
						)}
					</CollapsibleTrigger>
					{actions && open && <div className="flex flex-wrap items-center gap-1">{actions}</div>}
				</div>
				<CollapsibleContent className="min-w-0">{children}</CollapsibleContent>
			</section>
		</Collapsible>
	);
}

/** Muted inline placeholder for sections without data. */
export function EmptyNote({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<p
			className={cn(
				"rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground",
				className
			)}
		>
			{children}
		</p>
	);
}

/** Label/value cell used by the summary grids. */
export function Field({
	label,
	children,
	mono,
	className,
	action,
}: {
	label: ReactNode;
	children: ReactNode;
	mono?: boolean;
	className?: string;
	action?: ReactNode;
}) {
	return (
		<div className={cn("min-w-0 space-y-0.5", className)}>
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					"flex min-w-0 items-start gap-1 text-sm break-words",
					mono && "font-mono text-xs leading-5 break-all"
				)}
			>
				<span className="min-w-0 flex-1">{children}</span>
				{action}
			</dd>
		</div>
	);
}

/** Responsive grid of `Field`s that adapts to the pane width. */
export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<dl
			className={cn(
				"grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-3 @xs:grid-cols-2 @2xl:grid-cols-3",
				className
			)}
		>
			{children}
		</dl>
	);
}

const CHIP_TONES: Record<Tone, string> = {
	default: "border-border bg-muted/40 text-foreground",
	primary: "border-primary/30 bg-primary/10 text-primary",
	success: "border-success/30 bg-success/10 text-success",
	warning: "border-warning/30 bg-warning/10 text-warning",
	destructive: "border-destructive/30 bg-destructive/10 text-destructive",
	info: "border-info/30 bg-info/10 text-info",
};

/** Compact metric: label on top, value below, tinted by tone. */
export function StatChip({
	label,
	value,
	tone = "default",
	icon: Icon,
	hint,
	className,
}: {
	label: ReactNode;
	value: ReactNode;
	tone?: Tone;
	icon?: ComponentType<{ className?: string }>;
	hint?: string;
	className?: string;
}) {
	return (
		<div
			className={cn("min-w-0 rounded-lg border px-3 py-2", CHIP_TONES[tone], className)}
			title={hint}
		>
			<div className="flex items-center gap-1.5 text-xs opacity-80">
				{Icon && <Icon className="size-3.5 shrink-0" />}
				<span className="truncate">{label}</span>
			</div>
			<div className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</div>
		</div>
	);
}

export const TONE_BADGE: Record<Tone, string> = {
	default: "border-border bg-muted text-muted-foreground",
	primary: "border-primary/30 bg-primary/10 text-primary",
	success: "border-success/30 bg-success/10 text-success",
	warning: "border-warning/30 bg-warning/10 text-warning",
	destructive: "border-destructive/30 bg-destructive/10 text-destructive",
	info: "border-info/30 bg-info/10 text-info",
};

function CookieAttribute({ label, value }: { label: string; value?: unknown }) {
	if (value === undefined || value === null || value === "" || value === false) {
		return null;
	}
	return (
		<Badge variant="outline" className="max-w-full font-mono text-[11px] font-normal">
			<span className="truncate">{value === true ? label : `${label}=${String(value)}`}</span>
		</Badge>
	);
}

export function CookieList({ cookies, emptyText }: { cookies: HARCookie[]; emptyText: string }) {
	if (cookies.length === 0) return <EmptyNote>{emptyText}</EmptyNote>;

	return (
		<ul className="divide-y overflow-hidden rounded-lg border">
			{cookies.map((cookie, i) => {
				const maxAge = typeof cookie.maxAge === "string" ? cookie.maxAge : undefined;
				return (
					<li key={`${cookie.name}-${i}`} className="group min-w-0 space-y-1.5 px-3 py-2">
						<div className="flex items-start justify-between gap-2">
							<span className="min-w-0 text-[13px] font-medium break-all">
								{cookie.name || <span className="text-muted-foreground italic">(unnamed)</span>}
							</span>
							<CopyButton
								value={`${cookie.name}=${cookie.value}`}
								label={`Copy cookie ${cookie.name}`}
								className="-my-1 size-7"
							/>
						</div>
						<div className="max-h-24 overflow-auto font-mono text-xs break-all">
							{cookie.value || (
								<span className="font-sans text-muted-foreground italic">empty value</span>
							)}
						</div>
						<div className="flex flex-wrap gap-1">
							<CookieAttribute label="Domain" value={cookie.domain} />
							<CookieAttribute label="Path" value={cookie.path} />
							<CookieAttribute label="Expires" value={cookie.expires} />
							<CookieAttribute label="Max-Age" value={maxAge} />
							<CookieAttribute label="SameSite" value={cookie.sameSite} />
							<CookieAttribute label="Secure" value={cookie.secure} />
							<CookieAttribute label="HttpOnly" value={cookie.httpOnly} />
						</div>
					</li>
				);
			})}
		</ul>
	);
}

export function formatStartedDateTime(value: string): string {
	const time = Date.parse(value);
	if (!Number.isFinite(time)) return value || "—";
	return new Date(time).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		fractionalSecondDigits: 3,
	});
}
