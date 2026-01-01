import { HAREntry } from "@/lib/stores/har-store";
import { Pattern } from "../types";
import { THRESHOLDS } from "../constants";
import { extractDomain, isApiRequest } from "../utils";

export function detectApiBatchingOpportunities(
	entries: HAREntry[]
): Pattern | null {
	const apiRequests = entries
		.map((entry, index) => ({
			entry,
			index,
			url: entry.request.url,
			domain: extractDomain(entry.request.url),
			path: new URL(entry.request.url).pathname,
			timestamp: new Date(entry.startedDateTime).getTime(),
		}))
		.filter(({ url }) => isApiRequest(url));

	if (apiRequests.length < 2) return null;

	const domainPathGroups = new Map<
		string,
		Array<{ index: number; url: string; timestamp: number }>
	>();

	for (const req of apiRequests) {
		const key = `${req.domain}:${req.path
			.split("/")
			.slice(0, -1)
			.join("/")}`;
		if (!domainPathGroups.has(key)) {
			domainPathGroups.set(key, []);
		}
		domainPathGroups.get(key)!.push({
			index: req.index,
			url: req.url,
			timestamp: req.timestamp,
		});
	}

	const batchingOpportunities: Array<{
		group: string;
		requests: Array<{ index: number; url: string; timestamp: number }>;
		timeWindow: number;
	}> = [];

	for (const [key, requests] of domainPathGroups.entries()) {
		if (requests.length < 2) continue;

		const sorted = requests.sort((a, b) => a.timestamp - b.timestamp);
		const timeWindow =
			sorted[sorted.length - 1].timestamp - sorted[0].timestamp;

		if (timeWindow <= THRESHOLDS.API_BATCHING_WINDOW_MS) {
			batchingOpportunities.push({
				group: key,
				requests: sorted,
				timeWindow,
			});
		}
	}

	if (batchingOpportunities.length === 0) return null;

	const totalRequests = batchingOpportunities.reduce(
		(sum, opp) => sum + opp.requests.length,
		0
	);
	const potentialSavings = totalRequests - batchingOpportunities.length;

	const sortedByCount = batchingOpportunities.sort(
		(a, b) => b.requests.length - a.requests.length
	);

	const allAffectedIndices = sortedByCount.flatMap((opp) =>
		opp.requests.map((r) => r.index)
	);

	return {
		type: "api-batching",
		severity: "medium",
		title: "API Batching Opportunities",
		description: `${totalRequests} API calls to ${batchingOpportunities.length} endpoints could be batched`,
		count: totalRequests,
		examples: sortedByCount.slice(0, 5).flatMap((opp) =>
			opp.requests.slice(0, 2).map((r) => ({
				url: r.url,
				index: r.index,
				details: `${
					opp.requests.length
				} similar calls within ${Math.round(opp.timeWindow)}ms`,
			}))
		),
		recommendation:
			"Implement batch API endpoints or GraphQL to combine multiple requests into single calls",
		impact: `Could reduce to ${batchingOpportunities.length} requests (${potentialSavings} fewer round-trips)`,
		allAffectedIndices,
	};
}
