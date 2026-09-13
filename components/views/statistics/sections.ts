export const STATISTICS_SECTIONS = [
	{ id: "stats-overview", label: "Overview" },
	{ id: "stats-content-types", label: "Content types" },
	{ id: "stats-methods-status", label: "Methods & status codes" },
	{ id: "stats-domains", label: "Domains" },
	{ id: "stats-connections", label: "Connections" },
	{ id: "stats-initiators", label: "Initiators" },
	{ id: "stats-priorities", label: "Priorities" },
	{ id: "stats-transfer", label: "Transfer & compression" },
	{ id: "stats-servers", label: "Servers & CDNs" },
	{ id: "stats-sequence", label: "Loading sequence" },
] as const;

export type StatisticsSectionId = (typeof STATISTICS_SECTIONS)[number]["id"];

export function scrollToSection(id: StatisticsSectionId) {
	document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
