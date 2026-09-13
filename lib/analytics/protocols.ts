import type { HAREntry } from "@/lib/har-types";
import { extractDomain, getEntryTransferSize, nonNegative } from "@/lib/har-parser";
import { getEntryHttpVersion } from "@/lib/filter-entries";
import { getResourceType } from "@/lib/resource-type";
import { percentOf } from "./format";

interface ProtocolAccumulator {
	count: number;
	totalTime: number;
	totalWait: number;
	totalSize: number;
	/** Requests with Chrome's unique `_connectionId`. */
	withConnectionId: number;
	connectionIds: Set<string>;
	/** Requests with a known (>= 0) connect timing. */
	withConnectTiming: number;
	newConnections: number;
	/** Requests with the generic `connection` field (Firefox stores the port). */
	withConnectionField: number;
	connectionKeys: Set<string>;
}

function toId(value: unknown): string | null {
	return value === undefined || value === null || value === "" ? null : String(value);
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Share of requests that did not open a new connection, or null when the HAR
 * has no usable connection information for this protocol.
 */
function getConnectionReuse(data: ProtocolAccumulator): { rate: number; basis: string } | null {
	if (data.withConnectionId > 0) {
		return {
			rate: percentOf(data.withConnectionId - data.connectionIds.size, data.withConnectionId),
			basis: `${count(data.connectionIds.size, "connection")} for ${count(
				data.withConnectionId,
				"request"
			)}`,
		};
	}
	// Chrome reports -1 and Firefox 0 for requests that reused a connection.
	if (data.withConnectTiming > 0) {
		return {
			rate: percentOf(data.count - data.newConnections, data.count),
			basis: `${count(data.newConnections, "new connection")} for ${count(
				data.count,
				"request"
			)} (from connect timings)`,
		};
	}
	if (data.withConnectionField > 0) {
		return {
			rate: percentOf(
				data.withConnectionField - data.connectionKeys.size,
				data.withConnectionField
			),
			basis: `${count(data.connectionKeys.size, "host connection")} for ${count(
				data.withConnectionField,
				"request"
			)} (approximate)`,
		};
	}
	return null;
}

export interface ProtocolStat {
	version: string;
	count: number;
	avgTime: number;
	avgWait: number;
	avgSize: number;
	reuseRate: number | null;
	reuseBasis: string;
}

export interface ProtocolAnalytics {
	protocols: ProtocolStat[];
	legacyCount: number;
	legacyShare: number;
	hasModernProtocol: boolean;
}

export function computeProtocols(entries: HAREntry[], indices: number[]): ProtocolAnalytics | null {
	if (!indices.length) return null;

	const protocolMap = new Map<string, ProtocolAccumulator>();
	let legacyCount = 0;

	for (const index of indices) {
		const entry = entries[index];
		const version = getEntryHttpVersion(entry);
		let acc = protocolMap.get(version);
		if (!acc) {
			acc = {
				count: 0,
				totalTime: 0,
				totalWait: 0,
				totalSize: 0,
				withConnectionId: 0,
				connectionIds: new Set<string>(),
				withConnectTiming: 0,
				newConnections: 0,
				withConnectionField: 0,
				connectionKeys: new Set<string>(),
			};
			protocolMap.set(version, acc);
		}

		acc.count++;
		acc.totalTime += nonNegative(entry.time);
		acc.totalWait += nonNegative(entry.timings.wait);
		acc.totalSize += getEntryTransferSize(entry);

		const connectionId = toId(entry._connectionId);
		if (connectionId !== null) {
			acc.withConnectionId++;
			acc.connectionIds.add(connectionId);
		}
		if (entry.timings.connect >= 0) {
			acc.withConnectTiming++;
			if (entry.timings.connect > 0) acc.newConnections++;
		}
		const connection = toId(entry.connection);
		if (connection !== null) {
			acc.withConnectionField++;
			acc.connectionKeys.add(`${extractDomain(entry.request.url)}|${connection}`);
		}

		// WebSockets must upgrade over HTTP/1.1, so they are not a concern.
		if (version.startsWith("HTTP/1") && getResourceType(entry) !== "ws") {
			legacyCount++;
		}
	}

	const protocols = Array.from(protocolMap, ([version, data]): ProtocolStat => {
		const reuse = getConnectionReuse(data);
		return {
			version: version === "unknown" ? "Unknown" : version,
			count: data.count,
			avgTime: data.totalTime / data.count,
			avgWait: data.totalWait / data.count,
			avgSize: data.totalSize / data.count,
			reuseRate: reuse?.rate ?? null,
			reuseBasis: reuse?.basis ?? "No connection information in this HAR",
		};
	}).sort((a, b) => b.count - a.count);

	return {
		protocols,
		legacyCount,
		legacyShare: percentOf(legacyCount, indices.length),
		hasModernProtocol: protocols.some((p) => p.version === "HTTP/2" || p.version === "HTTP/3"),
	};
}
