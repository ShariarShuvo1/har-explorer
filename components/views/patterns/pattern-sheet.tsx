"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import type { Pattern } from "@/lib/patterns";
import { cn } from "@/lib/cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { AffectedRequestRow } from "./affected-request-row";
import {
	AFFECTED_PAGE_SIZE,
	PATTERN_CATEGORY,
	PATTERN_ICONS,
	SEVERITY_ICON_SURFACE,
	SeverityBadge,
} from "./pattern-meta";

function AffectedRequests({
	pattern,
	entries,
	onOpenEntry,
}: {
	pattern: Pattern;
	entries: HAREntry[];
	onOpenEntry: (index: number) => void;
}) {
	const [visibleCount, setVisibleCount] = useState(AFFECTED_PAGE_SIZE);
	const { affected } = pattern;
	const shown = affected.slice(0, visibleCount);
	const remaining = affected.length - shown.length;

	return (
		<section aria-labelledby="pattern-affected-heading" className="space-y-2">
			<div className="flex items-baseline justify-between gap-2">
				<h3 id="pattern-affected-heading" className="text-sm font-semibold">
					Affected requests
				</h3>
				<span className="text-xs text-muted-foreground tabular-nums">
					{shown.length < affected.length
						? `${shown.length} of ${affected.length}`
						: affected.length}
				</span>
			</div>
			<p className="text-xs text-muted-foreground">
				Select a request to open it in the request list. Hover for timing and size details.
			</p>
			<ul className="-mx-3 divide-y divide-border/60">
				{shown.map(({ index, details }) => {
					const entry = entries[index];
					if (!entry) return null;
					return (
						<AffectedRequestRow
							key={index}
							entry={entry}
							index={index}
							details={details}
							onOpen={onOpenEntry}
						/>
					);
				})}
			</ul>
			{remaining > 0 && (
				<Button
					variant="outline"
					size="sm"
					className="h-9 w-full sm:h-8"
					onClick={() => setVisibleCount((count) => count + AFFECTED_PAGE_SIZE)}
				>
					Show {Math.min(remaining, AFFECTED_PAGE_SIZE)} more ({remaining} remaining)
				</Button>
			)}
		</section>
	);
}

interface PatternSheetProps {
	pattern: Pattern | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entries: HAREntry[];
	onOpenEntry: (index: number) => void;
}

export function PatternSheet({
	pattern,
	open,
	onOpenChange,
	entries,
	onOpenEntry,
}: PatternSheetProps) {
	const Icon = pattern ? PATTERN_ICONS[pattern.type] : null;

	return (
		<Sheet open={open && pattern !== null} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full gap-0 sm:max-w-xl"
				// Focusing the first row on open would pop its hover card.
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				{pattern && Icon ? (
					<>
						<SheetHeader className="border-b pr-12">
							<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<SeverityBadge severity={pattern.severity} />
								<span>{PATTERN_CATEGORY[pattern.type]}</span>
							</div>
							<SheetTitle className="flex items-center gap-2 text-base">
								<span
									className={cn(
										"flex size-7 shrink-0 items-center justify-center rounded-md",
										SEVERITY_ICON_SURFACE[pattern.severity]
									)}
								>
									<Icon className="size-4" />
								</span>
								<span className="min-w-0">{pattern.title}</span>
							</SheetTitle>
							<SheetDescription>{pattern.description}</SheetDescription>
						</SheetHeader>

						<div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
							{pattern.impact && (
								<div className="space-y-1">
									<h3 className="text-sm font-semibold">Impact</h3>
									<p className="text-sm text-muted-foreground">{pattern.impact}</p>
								</div>
							)}

							<Alert>
								<Lightbulb className="text-primary!" />
								<AlertTitle>Recommendation</AlertTitle>
								<AlertDescription>
									<p>{pattern.recommendation}</p>
								</AlertDescription>
							</Alert>

							<AffectedRequests
								key={pattern.type}
								pattern={pattern}
								entries={entries}
								onOpenEntry={onOpenEntry}
							/>
						</div>
					</>
				) : (
					<SheetHeader>
						<SheetTitle>Issue details</SheetTitle>
						<SheetDescription>This issue is no longer detected.</SheetDescription>
					</SheetHeader>
				)}
			</SheetContent>
		</Sheet>
	);
}
