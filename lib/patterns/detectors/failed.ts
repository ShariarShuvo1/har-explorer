import type { HAREntry } from "@/lib/har-types";
import type { PatternDetector } from "../types";
import { isServedFromCache, plural } from "../utils";

function describeFailure(entry: HAREntry): string {
	const { status, statusText, _error } = entry.response;
	if (status > 0) return `${status} ${statusText}`.trim();
	return typeof _error === "string" && _error
		? _error
		: "No response (blocked, cancelled or network error)";
}

/** Sort rank: server errors first, then requests without a response, then 4xx. */
function failureRank(status: number): number {
	if (status >= 500) return 0;
	if (status <= 0) return 1;
	return 2;
}

export const detectFailedRequests: PatternDetector = ({ entries }) => {
	const failed: number[] = [];
	entries.forEach((entry, index) => {
		const { status } = entry.response;
		if (status >= 400 || (status <= 0 && !isServedFromCache(entry))) {
			failed.push(index);
		}
	});
	if (failed.length === 0) return null;

	let serverErrors = 0;
	let clientErrors = 0;
	let noResponse = 0;
	for (const index of failed) {
		const { status } = entries[index].response;
		if (status >= 500) serverErrors++;
		else if (status >= 400) clientErrors++;
		else noResponse++;
	}

	failed.sort(
		(a, b) =>
			failureRank(entries[a].response.status) - failureRank(entries[b].response.status) || a - b
	);

	const breakdown = [
		serverErrors && `${plural(serverErrors, "server error")} (5xx)`,
		clientErrors && `${plural(clientErrors, "client error")} (4xx)`,
		noResponse && `${noResponse} without a response`,
	].filter(Boolean);

	return {
		type: "failed",
		severity: serverErrors > 0 ? "high" : "medium",
		title: "Failed Requests",
		description: `${plural(failed.length, "request")} failed: ${breakdown.join(", ")}`,
		recommendation: "Investigate and fix these failing requests to improve reliability",
		impact:
			serverErrors > 0
				? "Server errors break functionality for users"
				: clientErrors > 0
					? "Client errors usually mean broken links, missing resources or auth problems"
					: "Requests never completed (blocked, cancelled or network failure)",
		affected: failed.map((index) => ({
			index,
			details: describeFailure(entries[index]),
		})),
	};
};
