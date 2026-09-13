import type { HAREntry, ResourceType } from "@/lib/har-types";
import {
	extractPath,
	getEntryContentSize,
	getEntryTransferSize,
	getHeaderValue,
	nonNegative,
	safeParseUrl,
} from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";

/** Served without a network round trip (memory/disk/service-worker cache). */
export function isServedFromCache(entry: HAREntry): boolean {
	const fromCache = (entry as unknown as Record<string, unknown>)._fromCache;
	if (typeof fromCache === "string" && fromCache) return true;
	return (
		entry.response._transferSize === 0 &&
		entry.response.status > 0 &&
		getEntryContentSize(entry) > 0
	);
}

/** GET responses carrying explicit freshness (max-age, s-maxage or Expires). */
export function isCacheableResponse(entry: HAREntry): boolean {
	const { status, headers } = entry.response;
	if (entry.request.method !== "GET") return false;
	if (!((status >= 200 && status < 300) || [301, 304, 308].includes(status))) {
		return false;
	}

	const cacheControl = getHeaderValue(headers, "cache-control")?.toLowerCase();
	if (cacheControl) {
		if (/\b(no-store|no-cache)\b/.test(cacheControl)) return false;
		if (/\bimmutable\b/.test(cacheControl)) return true;
		const maxAge = /\b(?:s-maxage|max-age)\s*=\s*"?(\d+)/.exec(cacheControl);
		if (maxAge) return Number(maxAge[1]) > 0;
	}

	const expires = getHeaderValue(headers, "expires");
	if (expires) {
		const expiresAt = Date.parse(expires);
		const date = Date.parse(getHeaderValue(headers, "date") || entry.startedDateTime);
		return Number.isFinite(expiresAt) && Number.isFinite(date) && expiresAt > date;
	}
	return false;
}

/** Phases with TCP and TLS split apart so nothing is counted twice. */
export const BREAKDOWN_PHASES = [
	{ key: "blocked", label: "Blocked", color: "var(--phase-blocked)" },
	{ key: "dns", label: "DNS", color: "var(--phase-dns)" },
	{ key: "tcp", label: "TCP", color: "var(--phase-connect)" },
	{ key: "tls", label: "TLS", color: "var(--phase-ssl)" },
	{ key: "send", label: "Send", color: "var(--phase-send)" },
	{ key: "wait", label: "Wait (TTFB)", color: "var(--phase-wait)" },
	{ key: "receive", label: "Receive", color: "var(--phase-receive)" },
] as const;

export type BreakdownPhase = (typeof BREAKDOWN_PHASES)[number]["key"];

export interface ResourceTypeStat {
	type: ResourceType;
	count: number;
	size: number;
}

export interface SlowRequest {
	index: number;
	method: string;
	url: string;
	host: string;
	path: string;
	time: number;
	size: number;
	status: number;
	statusText: string;
}

export interface OverviewAnalytics {
	totalRequests: number;
	transferSize: number;
	contentSize: number;
	avgTime: number;
	successCount: number;
	redirectCount: number;
	clientErrorCount: number;
	serverErrorCount: number;
	failedCount: number;
	cachedCount: number;
	revalidatedCount: number;
	cacheableCount: number;
	domains: { domain: string; count: number }[];
	types: ResourceTypeStat[];
	timing: {
		key: BreakdownPhase;
		label: string;
		color: string;
		total: number;
		avg: number;
	}[];
	slowest: SlowRequest[];
}

export function computeOverview(
	entries: HAREntry[],
	indices: number[],
	{ topDomains = 10, slowest = 5 } = {}
): OverviewAnalytics | null {
	if (!indices.length) return null;

	let transferSize = 0;
	let contentSize = 0;
	let totalTime = 0;
	let successCount = 0;
	let redirectCount = 0;
	let clientErrorCount = 0;
	let serverErrorCount = 0;
	let failedCount = 0;
	let cachedCount = 0;
	let revalidatedCount = 0;
	let cacheableCount = 0;

	const phaseTotals: Record<BreakdownPhase, number> = {
		blocked: 0,
		dns: 0,
		tcp: 0,
		tls: 0,
		send: 0,
		wait: 0,
		receive: 0,
	};
	const domainMap = new Map<string, number>();
	const typeMap = new Map<ResourceType, ResourceTypeStat>();

	for (const index of indices) {
		const entry = entries[index];
		const { status } = entry.response;
		const transfer = getEntryTransferSize(entry);
		transferSize += transfer;
		contentSize += getEntryContentSize(entry);
		totalTime += nonNegative(entry.time);

		if (status >= 200 && status < 300) successCount++;
		else if (status >= 300 && status < 400) redirectCount++;
		else if (status >= 400 && status < 500) clientErrorCount++;
		else if (status >= 500) serverErrorCount++;
		else if (status <= 0) failedCount++;

		if (status === 304) revalidatedCount++;
		else if (isServedFromCache(entry)) cachedCount++;
		if (isCacheableResponse(entry)) cacheableCount++;

		const { timings } = entry;
		const ssl = nonNegative(timings.ssl);
		const connect = nonNegative(timings.connect);
		// `connect` already includes the TLS handshake per the HAR spec.
		phaseTotals.blocked += nonNegative(timings.blocked);
		phaseTotals.dns += nonNegative(timings.dns);
		phaseTotals.tcp += Math.max(0, connect - ssl);
		phaseTotals.tls += connect > 0 ? Math.min(ssl, connect) : ssl;
		phaseTotals.send += nonNegative(timings.send);
		phaseTotals.wait += nonNegative(timings.wait);
		phaseTotals.receive += nonNegative(timings.receive);

		const hostname = safeParseUrl(entry.request.url)?.hostname || "(no host)";
		domainMap.set(hostname, (domainMap.get(hostname) ?? 0) + 1);

		const type = getResourceType(entry);
		const typeStat = typeMap.get(type);
		if (typeStat) {
			typeStat.count++;
			typeStat.size += transfer;
		} else {
			typeMap.set(type, { type, count: 1, size: transfer });
		}
	}

	const domains = Array.from(domainMap, ([domain, count]) => ({ domain, count }))
		.sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
		.slice(0, topDomains);

	const types = Array.from(typeMap.values()).sort((a, b) => b.count - a.count || b.size - a.size);

	const timing = BREAKDOWN_PHASES.map(({ key, label, color }) => ({
		key,
		label,
		color,
		total: phaseTotals[key],
		avg: phaseTotals[key] / indices.length,
	})).filter(({ total }) => total > 0);

	const slowestRequests = [...indices]
		.sort((a, b) => nonNegative(entries[b].time) - nonNegative(entries[a].time))
		.slice(0, slowest)
		.map((index): SlowRequest => {
			const entry = entries[index];
			return {
				index,
				method: entry.request.method,
				url: entry.request.url,
				host: safeParseUrl(entry.request.url)?.hostname ?? "",
				path: extractPath(entry.request.url),
				time: entry.time,
				size: getEntryTransferSize(entry),
				status: entry.response.status,
				statusText: entry.response.statusText,
			};
		});

	return {
		totalRequests: indices.length,
		transferSize,
		contentSize,
		avgTime: totalTime / indices.length,
		successCount,
		redirectCount,
		clientErrorCount,
		serverErrorCount,
		failedCount,
		cachedCount,
		revalidatedCount,
		cacheableCount,
		domains,
		types,
		timing,
		slowest: slowestRequests,
	};
}
