import type { HAREntry } from "@/lib/har-types";
import { formatTime, getBaseMimeType, safeParseUrl } from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import type { AffectedRequest, PatternDetector } from "../types";
import { THRESHOLDS } from "../constants";
import { isApiPath, plural } from "../utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "/v1/users/123" → "/v1/users/:id", so calls for different IDs group together. */
function toEndpointTemplate(pathname: string): string {
	return pathname
		.split("/")
		.map((segment) =>
			/^\d+$/.test(segment) || UUID.test(segment) || /^[0-9a-f]{16,}$/i.test(segment)
				? ":id"
				: segment
		)
		.join("/");
}

function isApiCall(entry: HAREntry, pathname: string): boolean {
	if (entry.request.method === "OPTIONS") return false;
	const type = getResourceType(entry);
	if (type === "fetch") {
		// Event streams are long-lived and cannot be batched.
		return (
			getBaseMimeType(entry.response.content.mimeType) !== "text/event-stream" &&
			entry._resourceType?.toLowerCase() !== "eventsource"
		);
	}
	return type === "other" && isApiPath(pathname);
}

interface Burst {
	endpoint: string;
	indices: number[];
	span: number;
}

export const detectApiBatchingOpportunities: PatternDetector = ({
	entries,
	startTimes,
	chronological,
}) => {
	const groups = new Map<string, number[]>();
	for (const index of chronological) {
		const entry = entries[index];
		const url = safeParseUrl(entry.request.url);
		if (!url || !isApiCall(entry, url.pathname)) continue;
		const key = `${entry.request.method} ${url.host}${toEndpointTemplate(url.pathname)}`;
		const group = groups.get(key);
		if (group) group.push(index);
		else groups.set(key, [index]);
	}

	const bursts: Burst[] = [];
	const addBurst = (endpoint: string, indices: number[]) => {
		// Repeating the exact same call is a duplicate, not a batching candidate.
		const distinct = new Set(
			indices.map(
				(index) => `${entries[index].request.url}\n${entries[index].request.postData?.text ?? ""}`
			)
		);
		if (distinct.size < 2) return;
		bursts.push({
			endpoint,
			indices,
			span: startTimes[indices[indices.length - 1]] - startTimes[indices[0]],
		});
	};

	for (const [endpoint, indices] of groups) {
		let burst: number[] = [];
		for (const index of indices) {
			if (
				burst.length > 0 &&
				startTimes[index] - startTimes[burst[0]] > THRESHOLDS.API_BATCHING_WINDOW_MS
			) {
				addBurst(endpoint, burst);
				burst = [];
			}
			burst.push(index);
		}
		addBurst(endpoint, burst);
	}
	if (bursts.length === 0) return null;

	bursts.sort((a, b) => b.indices.length - a.indices.length || a.indices[0] - b.indices[0]);
	const totalRequests = bursts.reduce((sum, burst) => sum + burst.indices.length, 0);
	const affected: AffectedRequest[] = bursts.flatMap(({ endpoint, indices, span }) =>
		indices.map((index) => ({
			index,
			details: `${indices.length} calls to ${endpoint} within ${formatTime(span)}`,
		}))
	);

	return {
		type: "api-batching",
		severity: bursts.some((burst) => burst.indices.length >= 5) ? "medium" : "low",
		title: "API Batching Opportunities",
		description: `${totalRequests} API calls in ${plural(bursts.length, "burst")} to the same endpoint within ${THRESHOLDS.API_BATCHING_WINDOW_MS / 1000} seconds`,
		recommendation:
			"Implement batch API endpoints or GraphQL to combine multiple requests into single calls",
		impact: `Batching could save ${plural(totalRequests - bursts.length, "round-trip")}`,
		affected,
	};
};
