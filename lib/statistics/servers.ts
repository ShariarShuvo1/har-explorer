import { extractDomain, getEntryTransferSize, nonNegative } from "@/lib/har-parser";
import type { HAREntry } from "@/lib/har-types";
import { detectCDNProvider } from "./cdn";
import { isFailedEntry } from "./utils";

export interface ServerStats {
	serverIP: string;
	domains: string[];
	requestCount: number;
	/** DNS + connect (which includes TLS), averaged over new connections. */
	avgSetup: number | null;
	avgWait: number;
	totalSize: number;
	cdnProviders: string[];
	errorCount: number;
}

export interface ServerGroupSummary {
	serverCount: number;
	requestCount: number;
	avgSetup: number | null;
	avgWait: number | null;
}

export interface ServerAnalysis {
	/** All servers, most requests first. */
	serverStats: ServerStats[];
	uniqueServers: number;
	cdn: ServerGroupSummary;
	origin: ServerGroupSummary;
	ipsPerDomain: number;
	requestsWithoutIP: number;
}

interface ServerAccumulator {
	serverIP: string;
	domains: Set<string>;
	requestCount: number;
	totalSetupTime: number;
	setupSamples: number;
	totalWait: number;
	totalSize: number;
	cdnProviders: Set<string>;
	errorCount: number;
}

function normalizeIP(ip: string | undefined): string | null {
	const trimmed = ip?.trim();
	return trimmed ? trimmed.replace(/^\[(.*)\]$/, "$1") : null;
}

function summarize(stats: ServerAccumulator[]): ServerGroupSummary {
	let requestCount = 0;
	let setupTotal = 0;
	let setupSamples = 0;
	let waitTotal = 0;
	for (const stat of stats) {
		requestCount += stat.requestCount;
		setupTotal += stat.totalSetupTime;
		setupSamples += stat.setupSamples;
		waitTotal += stat.totalWait;
	}
	return {
		serverCount: stats.length,
		requestCount,
		avgSetup: setupSamples > 0 ? setupTotal / setupSamples : null,
		avgWait: requestCount > 0 ? waitTotal / requestCount : null,
	};
}

export function analyzeServers(entries: HAREntry[]): ServerAnalysis {
	const serverMap = new Map<string, ServerAccumulator>();
	const domainIPs = new Map<string, Set<string>>();
	let requestsWithoutIP = 0;

	for (const entry of entries) {
		const serverIP = normalizeIP(entry.serverIPAddress);
		if (!serverIP) {
			requestsWithoutIP++;
			continue;
		}
		const domain = extractDomain(entry.request.url);

		let stat = serverMap.get(serverIP);
		if (!stat) {
			stat = {
				serverIP,
				domains: new Set<string>(),
				requestCount: 0,
				totalSetupTime: 0,
				setupSamples: 0,
				totalWait: 0,
				totalSize: 0,
				cdnProviders: new Set<string>(),
				errorCount: 0,
			};
			serverMap.set(serverIP, stat);
		}
		stat.domains.add(domain);
		stat.requestCount++;
		stat.totalSize += getEntryTransferSize(entry);
		stat.totalWait += nonNegative(entry.timings.wait);
		if (isFailedEntry(entry)) stat.errorCount++;

		// `connect` already includes the TLS handshake, so ssl is not added.
		if (entry.timings.connect > 0) {
			stat.totalSetupTime += nonNegative(entry.timings.dns) + entry.timings.connect;
			stat.setupSamples++;
		}

		const provider = detectCDNProvider(entry);
		if (provider) stat.cdnProviders.add(provider);

		let ips = domainIPs.get(domain);
		if (!ips) {
			ips = new Set<string>();
			domainIPs.set(domain, ips);
		}
		ips.add(serverIP);
	}

	const accumulators = Array.from(serverMap.values()).sort(
		(a, b) => b.requestCount - a.requestCount
	);

	let ipCountTotal = 0;
	for (const ips of domainIPs.values()) ipCountTotal += ips.size;

	return {
		serverStats: accumulators.map((stat) => ({
			serverIP: stat.serverIP,
			domains: Array.from(stat.domains),
			requestCount: stat.requestCount,
			avgSetup: stat.setupSamples > 0 ? stat.totalSetupTime / stat.setupSamples : null,
			avgWait: stat.totalWait / stat.requestCount,
			totalSize: stat.totalSize,
			cdnProviders: Array.from(stat.cdnProviders),
			errorCount: stat.errorCount,
		})),
		uniqueServers: accumulators.length,
		cdn: summarize(accumulators.filter((s) => s.cdnProviders.size > 0)),
		origin: summarize(accumulators.filter((s) => s.cdnProviders.size === 0)),
		ipsPerDomain: domainIPs.size > 0 ? ipCountTotal / domainIPs.size : 0,
		requestsWithoutIP,
	};
}
