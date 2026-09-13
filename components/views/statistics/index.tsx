"use client";

import { useMemo } from "react";
import { BarChart3, FilterX } from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";
import { useFilteredEntryIndices } from "@/lib/hooks/use-filtered-entries";
import { computeOverview } from "@/lib/statistics/overview";
import type { HAREntry } from "@/lib/har-types";
import { FilteredNotice } from "@/components/common/filtered-notice";
import { Page, PageHeader } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { ConnectionsSection } from "./connections-section";
import { InitiatorsSection } from "./initiators-section";
import {
	ContentTypesSection,
	DomainsSection,
	MethodsStatusSection,
	OverviewSection,
} from "./overview-sections";
import { PrioritiesSection } from "./priorities-section";
import { SectionNavList, SectionNavSelect } from "./section-nav";
import { SequenceSection } from "./sequence-section";
import { ServersSection } from "./servers-section";
import { TransferSection } from "./transfer-section";

export function StatisticsView() {
	const allEntries = useHarStore((s) => s.entries);
	const resetAllFilters = useHarStore((s) => s.resetAllFilters);
	const indices = useFilteredEntryIndices();

	const entries = useMemo(() => indices.map((index) => allEntries[index]), [indices, allEntries]);

	return (
		<Page>
			<PageHeader
				title="Statistics"
				description="Detailed breakdowns of connections, priorities, transfers and servers."
			/>
			<FilteredNotice shown={indices.length} />

			{allEntries.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<BarChart3 />
						</EmptyMedia>
						<EmptyTitle>No data to display</EmptyTitle>
						<EmptyDescription>Open a HAR file to see statistics.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : entries.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FilterX />
						</EmptyMedia>
						<EmptyTitle>No requests match the current filters</EmptyTitle>
						<EmptyDescription>
							Clear the filters to see statistics for all requests.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button variant="outline" size="sm" onClick={resetAllFilters}>
							<FilterX />
							Clear filters
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<>
					<SectionNavSelect className="lg:hidden" />
					<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_11rem] xl:grid-cols-[minmax(0,1fr)_13rem]">
						<StatisticsSections entries={entries} indices={indices} />
						<aside className="hidden lg:block">
							<SectionNavList className="sticky top-6" />
						</aside>
					</div>
				</>
			)}
		</Page>
	);
}

function StatisticsSections({ entries, indices }: { entries: HAREntry[]; indices: number[] }) {
	const overview = useMemo(() => computeOverview(entries), [entries]);

	return (
		<div className="flex min-w-0 flex-col gap-10">
			<OverviewSection overview={overview} />
			<ContentTypesSection overview={overview} />
			<MethodsStatusSection overview={overview} />
			<DomainsSection overview={overview} />
			<ConnectionsSection entries={entries} indices={indices} />
			<InitiatorsSection entries={entries} indices={indices} />
			<PrioritiesSection entries={entries} indices={indices} />
			<TransferSection entries={entries} indices={indices} compression={overview.compression} />
			<ServersSection entries={entries} indices={indices} />
			<SequenceSection entries={entries} indices={indices} />
		</div>
	);
}
