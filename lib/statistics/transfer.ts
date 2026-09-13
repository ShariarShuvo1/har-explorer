import { extractDomain, extractPath, getEntryContentSize } from "@/lib/har-parser";
import type { HAREntry, HARNameValue } from "@/lib/har-types";
import { percentOf } from "./utils";

export const LARGE_AVG_HEADER_BYTES = 1024;
export const LARGE_REQUEST_HEADER_BYTES = 2000;

export interface TransferDomainStats {
	domain: string;
	requestCount: number;
	totalTransferSize: number;
	totalBodySize: number;
	totalHeaderSize: number;
}

export interface RequestHeaderSize {
	entryIndex: number;
	url: string;
	size: number;
	estimated: boolean;
	cookieSize: number;
}

export interface TransferAnalysis {
	/** All domains, largest transfer first. */
	domainStats: TransferDomainStats[];
	totalTransferSize: number;
	totalBodySize: number;
	totalHeaderSize: number;
	totalContentSize: number;
	bodyPercentage: number;
	headerPercentage: number;
	avgHeaderSizePerRequest: number;
	/** Request header sizes of every entry, largest first. */
	requestHeaderSizes: RequestHeaderSize[];
	measuredCount: number;
	estimatedCount: number;
}

/** Size of a header block as serialized in HTTP/1.x, including the blank line. */
function estimateHeaderBlock(startLine: string, headers: HARNameValue[]): number {
	let size = 2;
	// HTTP/2+ exports list pseudo-headers instead of a start line.
	if (!headers.some((header) => header.name.startsWith(":"))) {
		size += startLine.length + 2;
	}
	for (const header of headers) {
		size += header.name.length + header.value.length + 4;
	}
	return size;
}

interface TransferBreakdown {
	transfer: number;
	body: number;
	headers: number;
	estimated: boolean;
}

/**
 * Splits the bytes on the wire into response headers and body. Known values
 * are used first; the header size is derived from `_transferSize - bodySize`
 * when possible and only estimated from the header list as a last resort.
 */
function getTransferBreakdown(entry: HAREntry): TransferBreakdown | null {
	const { response } = entry;
	const reported =
		typeof response._transferSize === "number" &&
		Number.isFinite(response._transferSize) &&
		response._transferSize >= 0
			? response._transferSize
			: null;
	const bodySize = response.bodySize >= 0 ? response.bodySize : null;
	let headers = response.headersSize >= 0 ? response.headersSize : null;
	let estimated = false;

	if (headers === null && reported !== null && bodySize !== null) {
		headers = Math.max(0, reported - bodySize);
	}
	if (headers === null) {
		if (reported === null && bodySize === null && response.headers.length === 0) {
			return null;
		}
		headers = estimateHeaderBlock(
			`${response.httpVersion || "HTTP/1.1"} ${response.status} ${response.statusText}`,
			response.headers
		);
		if (reported !== null) headers = Math.min(headers, reported);
		estimated = true;
	}

	let body = bodySize;
	if (body === null) {
		body = reported !== null ? Math.max(0, reported - headers) : 0;
		if (reported === null) estimated = true;
	}

	return { transfer: reported ?? body + headers, body, headers, estimated };
}

function getRequestHeaderSize(entry: HAREntry): {
	size: number;
	estimated: boolean;
} {
	const { request } = entry;
	if (request.headersSize >= 0) {
		return { size: request.headersSize, estimated: false };
	}
	return {
		size: estimateHeaderBlock(
			`${request.method} ${extractPath(request.url)} ${request.httpVersion || "HTTP/1.1"}`,
			request.headers
		),
		estimated: true,
	};
}

function getRequestCookieSize(entry: HAREntry): number {
	let size = 0;
	for (const header of entry.request.headers) {
		if (header.name.toLowerCase() === "cookie") size += header.value.length;
	}
	if (size > 0) return size;
	entry.request.cookies.forEach((cookie, index) => {
		size += cookie.name.length + cookie.value.length + 1 + (index ? 2 : 0);
	});
	return size;
}

export function analyzeTransfer(entries: HAREntry[], indices: number[]): TransferAnalysis {
	const domainMap = new Map<string, TransferDomainStats>();
	let totalTransferSize = 0;
	let totalBodySize = 0;
	let totalHeaderSize = 0;
	let totalContentSize = 0;
	let measuredCount = 0;
	let estimatedCount = 0;

	for (const entry of entries) {
		const breakdown = getTransferBreakdown(entry);
		if (!breakdown) continue;
		measuredCount++;
		if (breakdown.estimated) estimatedCount++;

		totalTransferSize += breakdown.transfer;
		totalBodySize += breakdown.body;
		totalHeaderSize += breakdown.headers;
		totalContentSize += getEntryContentSize(entry);

		const domain = extractDomain(entry.request.url);
		let stat = domainMap.get(domain);
		if (!stat) {
			stat = {
				domain,
				requestCount: 0,
				totalTransferSize: 0,
				totalBodySize: 0,
				totalHeaderSize: 0,
			};
			domainMap.set(domain, stat);
		}
		stat.requestCount++;
		stat.totalTransferSize += breakdown.transfer;
		stat.totalBodySize += breakdown.body;
		stat.totalHeaderSize += breakdown.headers;
	}

	const requestHeaderSizes = entries
		.map((entry, position) => ({
			entryIndex: indices[position],
			url: entry.request.url,
			...getRequestHeaderSize(entry),
			cookieSize: getRequestCookieSize(entry),
		}))
		.sort((a, b) => b.size - a.size);

	const partsTotal = totalBodySize + totalHeaderSize;

	return {
		domainStats: Array.from(domainMap.values()).sort(
			(a, b) => b.totalTransferSize - a.totalTransferSize
		),
		totalTransferSize,
		totalBodySize,
		totalHeaderSize,
		totalContentSize,
		bodyPercentage: percentOf(totalBodySize, partsTotal),
		headerPercentage: percentOf(totalHeaderSize, partsTotal),
		avgHeaderSizePerRequest: measuredCount > 0 ? totalHeaderSize / measuredCount : 0,
		requestHeaderSizes,
		measuredCount,
		estimatedCount,
	};
}
