"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/common/page";
import { FilteredNotice } from "@/components/common/filtered-notice";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useHarStore } from "@/lib/stores/har-store";
import { useFilteredEntryIndices } from "@/lib/hooks/use-filtered-entries";
import { computeOverview } from "@/lib/analytics/overview";
import { OverviewStats, RequestsSection } from "./overview-section";
import { ProtocolSection } from "./protocol-section";
import { BandwidthSection } from "./bandwidth-section";
import { ThirdPartySection } from "./third-party-section";
import { ImageSection } from "./image-section";

const SECTIONS = [
	{ id: "analytics-overview", label: "Overview" },
	{ id: "analytics-requests", label: "Requests" },
	{ id: "analytics-protocols", label: "Protocol performance" },
	{ id: "analytics-bandwidth", label: "Bandwidth" },
	{ id: "analytics-third-party", label: "Third-party impact" },
	{ id: "analytics-images", label: "Image optimization" },
];

function SectionJump() {
	return (
		<div className="w-full md:hidden">
			<Select
				value=""
				onValueChange={(id) =>
					document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
				}
			>
				<SelectTrigger className="w-full" aria-label="Jump to section">
					<SelectValue placeholder="Jump to section" />
				</SelectTrigger>
				<SelectContent position="popper">
					{SECTIONS.map((section) => (
						<SelectItem key={section.id} value={section.id}>
							{section.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

export function AnalyticsView() {
	const entries = useHarStore((s) => s.entries);
	const indices = useFilteredEntryIndices();
	const overview = useMemo(() => computeOverview(entries, indices), [entries, indices]);

	return (
		<Page>
			<PageHeader
				title="Analytics"
				description="Performance overview of the captured requests."
				actions={overview ? <SectionJump /> : undefined}
			/>
			<FilteredNotice shown={indices.length} />

			{!overview ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<BarChart3 />
						</EmptyMedia>
						<EmptyTitle>No requests to analyze</EmptyTitle>
						<EmptyDescription>
							{entries.length > 0
								? "No requests match the current filters. Adjust or clear the filters to analyze more requests."
								: "Load a HAR file to see its performance analytics."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<>
					<PageSection id="analytics-overview" className="scroll-mt-4">
						<OverviewStats data={overview} />
					</PageSection>
					<RequestsSection data={overview} />
					<ProtocolSection entries={entries} indices={indices} />
					<BandwidthSection entries={entries} indices={indices} />
					<ThirdPartySection entries={entries} indices={indices} />
					<ImageSection entries={entries} indices={indices} />
				</>
			)}
		</Page>
	);
}
