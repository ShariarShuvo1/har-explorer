import type { HARData, HAREntry } from "@/lib/har-types";
import { redactEntry } from "./redact";

export interface HarExportOptions {
	redact?: boolean;
}

/**
 * A HAR document containing `entries`, keeping the source log metadata
 * (version, creator, browser, comment) and only the pages those entries use.
 */
export function buildHarExport(
	source: HARData | null | undefined,
	entries: HAREntry[],
	{ redact = false }: HarExportOptions = {}
): HARData {
	const log = source?.log;
	const pageIds = new Set(
		entries.map((entry) => entry.pageref).filter((id): id is string => Boolean(id))
	);
	const pages = log?.pages?.filter((page) => page.id !== undefined && pageIds.has(page.id));

	return {
		...source,
		log: {
			...log,
			version: log?.version || "1.2",
			creator: log?.creator ?? { name: "HAR Explorer", version: "" },
			pages: pages && pages.length > 0 ? pages : undefined,
			entries: redact ? entries.map(redactEntry) : entries,
		},
	};
}

export function serializeHar(har: HARData): string {
	return JSON.stringify(har, null, 2);
}

/** Rough size of the serialized HAR, without building the (possibly huge) string. */
export function estimateHarSize(entries: HAREntry[]): number {
	let bytes = 256;
	for (const entry of entries) {
		const { request, response } = entry;
		bytes += 1600 + request.url.length * 2;
		for (const header of request.headers) bytes += header.name.length + header.value.length + 64;
		for (const header of response.headers) bytes += header.name.length + header.value.length + 64;
		for (const param of request.queryString) bytes += param.name.length + param.value.length + 64;
		bytes += request.postData?.text?.length ?? 0;
		bytes += response.content.text?.length ?? 0;
	}
	return bytes;
}
