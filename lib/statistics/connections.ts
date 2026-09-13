import { extractDomain, getEntryTransferSize } from "@/lib/har-parser";
import { getEntryHttpVersion } from "@/lib/filter-entries";
import type { HAREntry } from "@/lib/har-types";
import { percentOf } from "./utils";

export interface ConnectionStats {
	connection: string;
	requestCount: number;
	domains: string[];
	protocols: string[];
	totalSize: number;
	totalTime: number;
}

export interface ProtocolConnectionStats {
	protocol: string;
	connectionCount: number;
	requestCount: number;
	avgRequestsPerConnection: number;
}

export interface ConnectionAnalysis {
	/** All connections, most requests first. */
	connectionStats: ConnectionStats[];
	totalConnections: number;
	reusedConnections: number;
	reuseRate: number;
	requestsOnReusedRate: number;
	avgRequestsPerConnection: number;
	protocolStats: ProtocolConnectionStats[];
	requestsWithConnection: number;
	usesConnectionField: boolean;
	/** Requests with `timings.connect > 0`, used when IDs are missing. */
	newConnectionRequests: number;
}

function toIdString(value: unknown): string | null {
	if (typeof value === "string") return value.trim() || null;
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return null;
}

/**
 * Chrome's `_connectionId` identifies the socket. The spec's `connection`
 * field is less reliable (some tools store the remote port there), so it is
 * scoped to the server IP to avoid merging unrelated servers.
 */
function getConnectionKey(entry: HAREntry): { key: string; fromConnectionField: boolean } | null {
	const connectionId = toIdString(entry._connectionId);
	if (connectionId) return { key: connectionId, fromConnectionField: false };
	const connection = toIdString(entry.connection);
	if (!connection) return null;
	const ip = entry.serverIPAddress?.trim();
	return {
		key: ip ? `${connection} @ ${ip}` : connection,
		fromConnectionField: true,
	};
}

export function analyzeConnections(entries: HAREntry[]): ConnectionAnalysis {
	const connectionMap = new Map<
		string,
		{
			requestCount: number;
			domains: Set<string>;
			protocols: Set<string>;
			totalSize: number;
			totalTime: number;
		}
	>();
	const protocolMap = new Map<string, { connections: Set<string>; requests: number }>();
	let requestsWithConnection = 0;
	let usesConnectionField = false;
	let newConnectionRequests = 0;

	for (const entry of entries) {
		if (entry.timings.connect > 0) newConnectionRequests++;

		const connection = getConnectionKey(entry);
		if (!connection) continue;
		requestsWithConnection++;
		if (connection.fromConnectionField) usesConnectionField = true;

		const protocol = getEntryHttpVersion(entry);
		let stat = connectionMap.get(connection.key);
		if (!stat) {
			stat = {
				requestCount: 0,
				domains: new Set<string>(),
				protocols: new Set<string>(),
				totalSize: 0,
				totalTime: 0,
			};
			connectionMap.set(connection.key, stat);
		}
		stat.requestCount++;
		stat.totalSize += getEntryTransferSize(entry);
		stat.totalTime += entry.time;
		stat.domains.add(extractDomain(entry.request.url));
		stat.protocols.add(protocol);

		let protocolStat = protocolMap.get(protocol);
		if (!protocolStat) {
			protocolStat = { connections: new Set<string>(), requests: 0 };
			protocolMap.set(protocol, protocolStat);
		}
		protocolStat.connections.add(connection.key);
		protocolStat.requests++;
	}

	const connectionStats: ConnectionStats[] = Array.from(connectionMap.entries())
		.map(([connection, stat]) => ({
			connection,
			requestCount: stat.requestCount,
			domains: Array.from(stat.domains),
			protocols: Array.from(stat.protocols),
			totalSize: stat.totalSize,
			totalTime: stat.totalTime,
		}))
		.sort((a, b) => b.requestCount - a.requestCount);
	const totalConnections = connectionStats.length;
	let reusedConnections = 0;
	let requestsOnReused = 0;
	for (const stat of connectionStats) {
		if (stat.requestCount > 1) {
			reusedConnections++;
			requestsOnReused += stat.requestCount;
		}
	}

	const protocolStats = Array.from(protocolMap.entries())
		.map(([protocol, stat]) => ({
			protocol,
			connectionCount: stat.connections.size,
			requestCount: stat.requests,
			avgRequestsPerConnection: stat.requests / Math.max(1, stat.connections.size),
		}))
		.sort((a, b) => b.requestCount - a.requestCount);

	return {
		connectionStats,
		totalConnections,
		reusedConnections,
		reuseRate: percentOf(reusedConnections, totalConnections),
		requestsOnReusedRate: percentOf(requestsOnReused, requestsWithConnection),
		avgRequestsPerConnection: totalConnections > 0 ? requestsWithConnection / totalConnections : 0,
		protocolStats,
		requestsWithConnection,
		usesConnectionField,
		newConnectionRequests,
	};
}
