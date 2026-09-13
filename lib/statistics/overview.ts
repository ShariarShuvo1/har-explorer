import {
	extractDomain,
	getBaseMimeType,
	getEntryContentSize,
	getEntryTransferSize,
	getHeaderValue,
	nonNegative,
} from "@/lib/har-parser";
import type { HAREntry } from "@/lib/har-types";
import { isFailedEntry, percentOf } from "./utils";

const CONTENT_ENCODING = /\b(gzip|br|deflate|zstd|compress)\b/i;

export interface DomainStat {
	domain: string;
	count: number;
	transferSize: number;
	contentSize: number;
	totalTime: number;
	errors: number;
}

export interface MimeTypeStat {
	mimeType: string;
	count: number;
	size: number;
}

export interface OverviewStatistics {
	requestCount: number;
	totalTransferSize: number;
	totalContentSize: number;
	totalTime: number;
	failedCount: number;
	/** All domains, most requests first. */
	domainStats: DomainStat[];
	methodStats: Array<{ method: string; count: number }>;
	statusStats: Array<{ status: number; count: number }>;
	/** All base MIME types, largest first. */
	mimeTypeStats: MimeTypeStat[];
	compression: {
		measured: number;
		compressedCount: number;
		saved: number;
		ratio: number;
	};
}

/**
 * Encoded vs decoded body size, or null when it cannot be determined. Per the
 * HAR spec `content.size` is the decoded length and `content.compression` the
 * bytes saved; Chrome omits `compression`, so `bodySize` is used instead.
 */
function getCompressionSample(entry: HAREntry): { decoded: number; encoded: number } | null {
	const { content, bodySize } = entry.response;
	const decoded = content.size;
	if (!Number.isFinite(decoded) || decoded <= 0) return null;
	if (
		typeof content.compression === "number" &&
		Number.isFinite(content.compression) &&
		content.compression >= 0
	) {
		return {
			decoded,
			encoded: Math.max(0, decoded - content.compression),
		};
	}
	// A zero body size means the body was not transferred (cache, 304).
	if (bodySize > 0) return { decoded, encoded: Math.min(bodySize, decoded) };
	return null;
}

export function computeOverview(entries: HAREntry[]): OverviewStatistics {
	const domainMap = new Map<string, DomainStat>();
	const methodMap = new Map<string, number>();
	const statusMap = new Map<number, number>();
	const mimeTypeMap = new Map<string, { count: number; size: number }>();
	let totalContentSize = 0;
	let totalTransferSize = 0;
	let totalTime = 0;
	let failedCount = 0;
	let measuredCompression = 0;
	let compressedCount = 0;
	let totalDecoded = 0;
	let totalEncoded = 0;

	for (const entry of entries) {
		const domain = extractDomain(entry.request.url);
		let domainStat = domainMap.get(domain);
		if (!domainStat) {
			domainStat = {
				domain,
				count: 0,
				transferSize: 0,
				contentSize: 0,
				totalTime: 0,
				errors: 0,
			};
			domainMap.set(domain, domainStat);
		}
		const contentSize = getEntryContentSize(entry);
		const transferSize = getEntryTransferSize(entry);
		const failed = isFailedEntry(entry);
		domainStat.count++;
		domainStat.transferSize += transferSize;
		domainStat.contentSize += contentSize;
		domainStat.totalTime += entry.time;
		if (failed) {
			domainStat.errors++;
			failedCount++;
		}
		totalTransferSize += transferSize;
		totalTime += nonNegative(entry.time);

		const method = entry.request.method;
		methodMap.set(method, (methodMap.get(method) ?? 0) + 1);
		const status = entry.response.status;
		statusMap.set(status, (statusMap.get(status) ?? 0) + 1);

		const mime = getBaseMimeType(entry.response.content.mimeType) || "(none)";
		const mimeStat = mimeTypeMap.get(mime);
		if (mimeStat) {
			mimeStat.count++;
			mimeStat.size += contentSize;
		} else {
			mimeTypeMap.set(mime, { count: 1, size: contentSize });
		}
		totalContentSize += contentSize;

		const sample = getCompressionSample(entry);
		if (sample) {
			measuredCompression++;
			totalDecoded += sample.decoded;
			totalEncoded += sample.encoded;
			const encoding = getHeaderValue(entry.response.headers, "content-encoding");
			if (sample.encoded < sample.decoded || (encoding && CONTENT_ENCODING.test(encoding))) {
				compressedCount++;
			}
		}
	}

	const saved = Math.max(0, totalDecoded - totalEncoded);

	return {
		requestCount: entries.length,
		totalTransferSize,
		totalContentSize,
		totalTime,
		failedCount,
		domainStats: Array.from(domainMap.values()).sort(
			(a, b) => b.count - a.count || b.transferSize - a.transferSize
		),
		methodStats: Array.from(methodMap.entries())
			.map(([method, count]) => ({ method, count }))
			.sort((a, b) => b.count - a.count),
		statusStats: Array.from(statusMap.entries())
			.map(([status, count]) => ({ status, count }))
			.sort((a, b) => a.status - b.status),
		mimeTypeStats: Array.from(mimeTypeMap.entries())
			.map(([mimeType, data]) => ({ mimeType, ...data }))
			.sort((a, b) => b.size - a.size || b.count - a.count),
		compression: {
			measured: measuredCompression,
			compressedCount,
			saved,
			ratio: percentOf(saved, totalDecoded),
		},
	};
}
