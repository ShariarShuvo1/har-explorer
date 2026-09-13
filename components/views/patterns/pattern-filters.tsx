"use client";

import { ChevronDown, ListFilter, Tags, X } from "lucide-react";
import { SEVERITIES, type Pattern, type PatternSeverity, type PatternType } from "@/lib/patterns";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PATTERN_ICONS, SEVERITY_LABELS } from "./pattern-meta";

function FilterCount({ count }: { count: number }) {
	if (count === 0) return null;
	return (
		<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
			{count}
		</span>
	);
}

// Keeps the menu open so several options can be toggled in one go.
const keepOpen = (event: Event) => event.preventDefault();

interface PatternFiltersProps {
	patterns: Pattern[];
	severityCounts: Record<PatternSeverity, number>;
	severity: ReadonlySet<PatternSeverity>;
	types: ReadonlySet<PatternType>;
	onToggleSeverity: (severity: PatternSeverity) => void;
	onToggleType: (type: PatternType) => void;
	onClear: () => void;
}

export function PatternFilters({
	patterns,
	severityCounts,
	severity,
	types,
	onToggleSeverity,
	onToggleType,
	onClear,
}: PatternFiltersProps) {
	const active = severity.size + types.size > 0;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm" className="h-9 sm:h-8">
						<ListFilter />
						Severity
						<FilterCount count={severity.size} />
						<ChevronDown className="text-muted-foreground" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-52">
					<DropdownMenuLabel className="text-xs text-muted-foreground">
						Filter by severity
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{SEVERITIES.map((value) => (
						<DropdownMenuCheckboxItem
							key={value}
							checked={severity.has(value)}
							onCheckedChange={() => onToggleSeverity(value)}
							onSelect={keepOpen}
						>
							<span className="flex-1">{SEVERITY_LABELS[value]}</span>
							<span className="text-xs text-muted-foreground tabular-nums">
								{severityCounts[value]}
							</span>
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="h-9 sm:h-8"
						disabled={patterns.length === 0}
					>
						<Tags />
						Type
						<FilterCount count={types.size} />
						<ChevronDown className="text-muted-foreground" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-2rem))]">
					<DropdownMenuLabel className="text-xs text-muted-foreground">
						Filter by issue type
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{patterns.map(({ type, title, affected }) => {
						const Icon = PATTERN_ICONS[type];
						return (
							<DropdownMenuCheckboxItem
								key={type}
								checked={types.has(type)}
								onCheckedChange={() => onToggleType(type)}
								onSelect={keepOpen}
							>
								<Icon className="text-muted-foreground" />
								<span className="min-w-0 flex-1 truncate">{title}</span>
								<span
									className="text-xs text-muted-foreground tabular-nums"
									aria-label={`${affected.length} affected requests`}
								>
									{affected.length}
								</span>
							</DropdownMenuCheckboxItem>
						);
					})}
				</DropdownMenuContent>
			</DropdownMenu>

			{active && (
				<Button variant="ghost" size="sm" className="h-9 sm:h-8" onClick={onClear}>
					<X />
					Clear
				</Button>
			)}
		</>
	);
}
