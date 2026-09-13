import { formatBytes, getEntryTransferSize, getHeaderValue } from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import type { AffectedRequest, PatternDetector } from "../types";
import { isServedFromCache, plural } from "../utils";

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

export const detectDuplicateRequests: PatternDetector = ({ entries }) => {
	const groups = new Map<string, number[]>();

	entries.forEach((entry, index) => {
		const { method, url, headers } = entry.request;
		const { status } = entry.response;
		// Preflights, revalidations, range requests, cache hits and sockets
		// legitimately repeat the same URL.
		if (
			method === "OPTIONS" ||
			status === 304 ||
			status === 206 ||
			getHeaderValue(headers, "range") !== undefined ||
			isServedFromCache(entry) ||
			getResourceType(entry) === "ws"
		) {
			return;
		}

		const body = BODYLESS_METHODS.has(method) ? "" : `\n${entry.request.postData?.text ?? ""}`;
		const key = `${method} ${url}${body}`;
		const group = groups.get(key);
		if (group) group.push(index);
		else groups.set(key, [index]);
	});

	const duplicates = [...groups.values()]
		.filter((indices) => indices.length > 1)
		.sort((a, b) => b.length - a.length || a[0] - b[0]);
	if (duplicates.length === 0) return null;

	let redundant = 0;
	let redundantBytes = 0;
	const affected: AffectedRequest[] = [];
	for (const indices of duplicates) {
		const method = entries[indices[0]].request.method;
		indices.forEach((index, position) => {
			if (position > 0) {
				redundant++;
				redundantBytes += getEntryTransferSize(entries[index]);
			}
			affected.push({
				index,
				details: `${method} #${position + 1} of ${indices.length} identical requests`,
			});
		});
	}

	return {
		type: "duplicate",
		severity: "medium",
		title: "Duplicate Requests",
		description: `${plural(duplicates.length, "request")} made more than once with the same method, URL and body`,
		recommendation:
			"Deduplicate these calls (share in-flight promises, use a client-side query cache) or make the responses cacheable",
		impact:
			`${plural(redundant, "redundant request")}` +
			(redundantBytes > 0 ? `, ${formatBytes(redundantBytes)} transferred again` : ""),
		affected,
	};
};
