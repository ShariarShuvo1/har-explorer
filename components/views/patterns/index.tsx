"use client";

import { useCallback, useMemo, useState } from "react";
import {
	AlertOctagon,
	AlertTriangle,
	ChevronRight,
	CircleCheck,
	Info,
	ListFilter,
	ScanSearch,
} from "lucide-react";
import {
	SEVERITIES,
	getCachedPatterns,
	summarizePatterns,
	type Pattern,
	type PatternSeverity,
	type PatternType,
} from "@/lib/patterns";
import { useHarStore } from "@/lib/stores/har-store";
import { cn } from "@/lib/cn";
import { Page, PageHeader } from "@/components/common/page";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { PatternFilters } from "./pattern-filters";
import {
	PATTERN_DETAIL_TAB,
	PATTERN_ICONS,
	SEVERITY_ICON_SURFACE,
	SEVERITY_LABELS,
	SEVERITY_TONE,
	SeverityBadge,
} from "./pattern-meta";
import { PatternSheet } from "./pattern-sheet";

const SEVERITY_STAT_ICON: Record<PatternSeverity, typeof Info> = {
	high: AlertOctagon,
	medium: AlertTriangle,
	low: Info,
};

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
	const next = new Set(set);
	if (next.has(value)) next.delete(value);
	else next.add(value);
	return next;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
	return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}

function PatternRow({
	pattern,
	onSelect,
}: {
	pattern: Pattern;
	onSelect: (type: PatternType) => void;
}) {
	const Icon = PATTERN_ICONS[pattern.type];
	const count = pattern.affected.length;
	return (
		<li>
			<Item
				asChild
				variant="outline"
				className="w-full flex-nowrap gap-3 bg-card p-3 text-left shadow-xs hover:bg-accent/50 sm:gap-4 sm:p-4"
			>
				<button type="button" onClick={() => onSelect(pattern.type)} aria-haspopup="dialog">
					<ItemMedia className={cn("size-9 rounded-md", SEVERITY_ICON_SURFACE[pattern.severity])}>
						<Icon className="size-4" />
					</ItemMedia>
					<ItemContent className="min-w-0">
						<ItemTitle className="w-full min-w-0 flex-wrap gap-x-2 gap-y-1">
							<span className="min-w-0">{pattern.title}</span>
							<SeverityBadge severity={pattern.severity} />
						</ItemTitle>
						<ItemDescription className="text-pretty">{pattern.description}</ItemDescription>
					</ItemContent>
					<ItemActions className="shrink-0 gap-1 text-muted-foreground">
						<span className="text-xs tabular-nums" aria-label={plural(count, "affected request")}>
							{count.toLocaleString()}
							<span className="hidden sm:inline">{count === 1 ? " request" : " requests"}</span>
						</span>
						<ChevronRight className="size-4" />
					</ItemActions>
				</button>
			</Item>
		</li>
	);
}

export function PatternsView() {
	const entries = useHarStore((s) => s.entries);
	const pages = useHarStore((s) => s.harData?.log.pages);
	const openEntry = useHarStore((s) => s.openEntry);

	const [severityFilter, setSeverityFilter] = useState<Set<PatternSeverity>>(() => new Set());
	const [typeFilter, setTypeFilter] = useState<Set<PatternType>>(() => new Set());
	// The type stays set while the sheet animates closed so its content remains.
	const [selectedType, setSelectedType] = useState<PatternType | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);

	// Deliberately ignores the request list filters: issues describe the whole capture.
	// Shared cache with the sidebar badge, so the file is only scanned once.
	const allPatterns = useMemo(() => getCachedPatterns(entries, pages), [entries, pages]);
	const summary = useMemo(() => summarizePatterns(allPatterns), [allPatterns]);

	const affectedByPattern = useMemo(() => {
		const all = new Set<number>();
		const bySeverity = Object.fromEntries(
			SEVERITIES.map((severity) => [severity, new Set<number>()])
		) as Record<PatternSeverity, Set<number>>;
		for (const pattern of allPatterns) {
			for (const { index } of pattern.affected) {
				all.add(index);
				bySeverity[pattern.severity].add(index);
			}
		}
		return { all: all.size, bySeverity };
	}, [allPatterns]);

	// Types selected earlier may no longer be detected after entries change;
	// ignore those so they cannot hide everything without a visible toggle.
	const activeTypes = useMemo(
		() =>
			new Set<PatternType>(
				allPatterns.map((pattern) => pattern.type).filter((type) => typeFilter.has(type))
			),
		[allPatterns, typeFilter]
	);

	const groups = useMemo(() => {
		const visible = allPatterns.filter(
			(pattern) =>
				(severityFilter.size === 0 || severityFilter.has(pattern.severity)) &&
				(activeTypes.size === 0 || activeTypes.has(pattern.type))
		);
		return SEVERITIES.map((severity) => ({
			severity,
			patterns: visible.filter((pattern) => pattern.severity === severity),
		})).filter((group) => group.patterns.length > 0);
	}, [allPatterns, severityFilter, activeTypes]);

	const visibleCount = groups.reduce((sum, group) => sum + group.patterns.length, 0);
	const hasFilters = severityFilter.size + activeTypes.size > 0;

	const selectedPattern = useMemo(
		() => allPatterns.find((pattern) => pattern.type === selectedType) ?? null,
		[allPatterns, selectedType]
	);

	const clearFilters = useCallback(() => {
		setSeverityFilter(new Set());
		setTypeFilter(new Set());
	}, []);

	const toggleSeverity = useCallback(
		(severity: PatternSeverity) => setSeverityFilter((prev) => toggleInSet(prev, severity)),
		[]
	);
	const toggleType = useCallback(
		(type: PatternType) => setTypeFilter((prev) => toggleInSet(prev, type)),
		[]
	);

	const selectPattern = useCallback((type: PatternType) => {
		setSelectedType(type);
		setSheetOpen(true);
	}, []);

	const jumpToEntry = useCallback(
		(index: number) => {
			setSheetOpen(false);
			openEntry(index, selectedType ? PATTERN_DETAIL_TAB[selectedType] : undefined);
		},
		[openEntry, selectedType]
	);

	const description =
		entries.length === 0
			? "There are no requests to check."
			: `Checks all ${plural(entries.length, "request")} in the file for common performance, reliability and security problems. List filters don't apply here.`;

	return (
		<Page>
			<PageHeader
				title="Patterns"
				description={description}
				actions={
					allPatterns.length > 0 && (
						<PatternFilters
							patterns={allPatterns}
							severityCounts={summary.bySeverity}
							severity={severityFilter}
							types={activeTypes}
							onToggleSeverity={toggleSeverity}
							onToggleType={toggleType}
							onClear={clearFilters}
						/>
					)
				}
			/>

			{allPatterns.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							{entries.length === 0 ? <ScanSearch /> : <CircleCheck />}
						</EmptyMedia>
						<EmptyTitle>No issues detected</EmptyTitle>
						<EmptyDescription>
							{entries.length === 0
								? "Load a HAR file with requests to check it for issues."
								: "None of the checks found a problem in this file."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<>
					<StatGrid className="md:grid-cols-4 xl:grid-cols-4">
						<StatCard
							label="All issues"
							value={summary.total}
							hint={`${plural(affectedByPattern.all, "request")} affected`}
							icon={ScanSearch}
							tone="primary"
							onClick={hasFilters ? clearFilters : undefined}
						/>
						{SEVERITIES.map((severity) => {
							const active = severityFilter.has(severity);
							return (
								<StatCard
									key={severity}
									label={SEVERITY_LABELS[severity]}
									value={summary.bySeverity[severity]}
									hint={`${plural(affectedByPattern.bySeverity[severity].size, "request")} affected`}
									icon={SEVERITY_STAT_ICON[severity]}
									tone={SEVERITY_TONE[severity]}
									onClick={() => toggleSeverity(severity)}
									pressed={active}
								/>
							);
						})}
					</StatGrid>

					{visibleCount === 0 ? (
						<Empty className="border">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<ListFilter />
								</EmptyMedia>
								<EmptyTitle>No issues match the filters</EmptyTitle>
								<EmptyDescription>
									{allPatterns.length === 1
										? "The only detected issue is"
										: `All ${allPatterns.length} detected issues are`}{" "}
									hidden by the severity or type filter.
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button variant="outline" size="sm" onClick={clearFilters}>
									Clear filters
								</Button>
							</EmptyContent>
						</Empty>
					) : (
						<div className="flex flex-col gap-6">
							{hasFilters && (
								<p className="-mb-3 text-xs text-muted-foreground">
									Showing {visibleCount} of {plural(allPatterns.length, "issue")}
								</p>
							)}
							{groups.map((group) => (
								<section
									key={group.severity}
									aria-labelledby={`patterns-${group.severity}`}
									className="flex flex-col gap-2"
								>
									<h2
										id={`patterns-${group.severity}`}
										className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
									>
										{SEVERITY_LABELS[group.severity]} severity
										<span className="tabular-nums">{group.patterns.length}</span>
									</h2>
									<ul className="flex flex-col gap-2">
										{group.patterns.map((pattern) => (
											<PatternRow key={pattern.type} pattern={pattern} onSelect={selectPattern} />
										))}
									</ul>
								</section>
							))}
						</div>
					)}
				</>
			)}

			<PatternSheet
				pattern={selectedPattern}
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				entries={entries}
				onOpenEntry={jumpToEntry}
			/>
		</Page>
	);
}
