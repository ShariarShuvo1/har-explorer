import type {
	HARCookie,
	HARData,
	HAREntry,
	HARNameValue,
	HARPostData,
	HARTimings,
} from "./har-types";

export class HARParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "HARParseError";
	}
}

/** 500 MB. Anything larger will almost certainly exhaust the tab's memory. */
export const MAX_HAR_FILE_SIZE = 500 * 1024 * 1024;

export async function parseHARFile(file: File): Promise<HARData> {
	if (file.size === 0) {
		throw new HARParseError("The selected file is empty.");
	}
	if (file.size > MAX_HAR_FILE_SIZE) {
		throw new HARParseError(
			`The file is too large (${formatBytes(file.size)}). The maximum supported size is ${formatBytes(MAX_HAR_FILE_SIZE)}.`
		);
	}
	return parseHARText(await file.text());
}

export function parseHARText(text: string): HARData {
	// Strip a UTF-8 BOM, which some tools prepend and JSON.parse rejects.
	const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

	let raw: unknown;
	try {
		raw = JSON.parse(cleaned);
	} catch (error) {
		const detail = error instanceof Error ? `: ${error.message}` : "";
		throw new HARParseError(`The file is not valid JSON${detail}`);
	}

	return normalizeHAR(raw);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStr(value: unknown, fallback = ""): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return fallback;
}

function toNum(value: unknown, fallback: number): number {
	const num = typeof value === "string" ? Number(value) : value;
	return typeof num === "number" && Number.isFinite(num) ? num : fallback;
}

function toNameValues(value: unknown): HARNameValue[] {
	if (!Array.isArray(value)) return [];
	return value.filter(isRecord).map((item) => ({
		...item,
		name: toStr(item.name),
		value: toStr(item.value),
	}));
}

function toCookies(value: unknown): HARCookie[] {
	if (!Array.isArray(value)) return [];
	return value.filter(isRecord).map((item) => ({
		...item,
		name: toStr(item.name),
		value: toStr(item.value),
	}));
}

function normalizePostData(value: unknown): HARPostData | undefined {
	if (!isRecord(value)) return undefined;
	const postData: HARPostData = {
		...value,
		mimeType: toStr(value.mimeType),
	};
	if (value.text !== undefined) postData.text = toStr(value.text);
	if (Array.isArray(value.params)) {
		postData.params = value.params.filter(isRecord).map((param) => ({
			...param,
			name: toStr(param.name),
			...(param.value !== undefined ? { value: toStr(param.value) } : {}),
		}));
	} else {
		delete postData.params;
	}
	return postData;
}

function normalizeTimings(value: unknown): HARTimings {
	const raw = isRecord(value) ? value : {};
	const timings: HARTimings = {
		blocked: toNum(raw.blocked, -1),
		dns: toNum(raw.dns, -1),
		ssl: toNum(raw.ssl, -1),
		connect: toNum(raw.connect, -1),
		send: toNum(raw.send, 0),
		wait: toNum(raw.wait, 0),
		receive: toNum(raw.receive, 0),
	};
	for (const [key, extra] of Object.entries(raw)) {
		if (!(key in timings) && typeof extra === "number") {
			timings[key] = extra;
		}
	}
	return timings;
}

function sumTimings(timings: HARTimings): number {
	// `connect` already includes `ssl` per the HAR spec, so ssl is not added.
	return (
		nonNegative(timings.blocked) +
		nonNegative(timings.dns) +
		nonNegative(timings.connect) +
		nonNegative(timings.send) +
		nonNegative(timings.wait) +
		nonNegative(timings.receive)
	);
}

function normalizeEntry(value: unknown, index: number): HAREntry {
	if (!isRecord(value)) {
		throw new HARParseError(`Entry #${index + 1} is not an object.`);
	}

	const request = isRecord(value.request) ? value.request : {};
	const response = isRecord(value.response) ? value.response : {};
	const content = isRecord(response.content) ? response.content : {};
	const responseHeaders = toNameValues(response.headers);
	const timings = normalizeTimings(value.timings);

	const url = toStr(request.url);
	if (!url) {
		throw new HARParseError(`Entry #${index + 1} has no request URL.`);
	}

	const mimeType = toStr(content.mimeType) || getHeaderValue(responseHeaders, "content-type") || "";

	const time = toNum(value.time, NaN);

	const entry: HAREntry = {
		...value,
		startedDateTime: toStr(value.startedDateTime),
		time: Number.isFinite(time) && time >= 0 ? time : sumTimings(timings),
		request: {
			...request,
			method: toStr(request.method, "GET").toUpperCase() || "GET",
			url,
			httpVersion: toStr(request.httpVersion),
			headers: toNameValues(request.headers),
			queryString: toNameValues(request.queryString),
			cookies: toCookies(request.cookies),
			headersSize: toNum(request.headersSize, -1),
			bodySize: toNum(request.bodySize, -1),
			postData: normalizePostData(request.postData),
		},
		response: {
			...response,
			status: toNum(response.status, 0),
			statusText: toStr(response.statusText),
			httpVersion: toStr(response.httpVersion),
			headers: responseHeaders,
			cookies: toCookies(response.cookies),
			content: {
				...content,
				size: toNum(content.size, 0),
				mimeType,
				...(content.compression !== undefined
					? { compression: toNum(content.compression, 0) }
					: {}),
				...(content.text !== undefined ? { text: toStr(content.text) } : {}),
				...(content.encoding !== undefined ? { encoding: toStr(content.encoding) } : {}),
			},
			redirectURL: toStr(response.redirectURL),
			headersSize: toNum(response.headersSize, -1),
			bodySize: toNum(response.bodySize, -1),
		},
		timings,
	};

	if (entry.request.postData === undefined) {
		delete entry.request.postData;
	}
	if (typeof value.serverIPAddress !== "string") {
		delete entry.serverIPAddress;
	}

	return entry;
}

/**
 * Validates the overall HAR shape and coerces every entry into the structure
 * the UI relies on, so partially-formed exports (missing headers, null
 * content, string numbers, ...) cannot crash the viewer later on.
 */
export function normalizeHAR(raw: unknown): HARData {
	if (!isRecord(raw) || !isRecord(raw.log)) {
		throw new HARParseError(
			'This does not look like a HAR file: the top-level "log" object is missing.'
		);
	}
	const log = raw.log;
	if (!Array.isArray(log.entries)) {
		throw new HARParseError(
			'This does not look like a HAR file: "log.entries" is missing or is not an array.'
		);
	}

	const creator = isRecord(log.creator) ? log.creator : {};

	return {
		...raw,
		log: {
			...log,
			version: toStr(log.version, "1.2"),
			creator: {
				...creator,
				name: toStr(creator.name, "unknown"),
				version: toStr(creator.version),
			},
			pages: Array.isArray(log.pages) ? log.pages.filter(isRecord) : undefined,
			entries: log.entries.map(normalizeEntry),
		},
	};
}

/** HAR uses -1 for "unknown"; treat that (and NaN) as zero when summing. */
export function nonNegative(value: number | undefined | null): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return "—";
	if (bytes < 1) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function formatTime(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return "—";
	if (ms < 1) return ms === 0 ? "0 ms" : ms.toFixed(2) + " ms";
	if (ms < 1000) return Math.round(ms) + " ms";
	if (ms < 60_000) return (ms / 1000).toFixed(2) + " s";
	const minutes = Math.floor(ms / 60_000);
	const seconds = Math.round((ms % 60_000) / 1000);
	return `${minutes}m ${seconds}s`;
}

/** Returns a parsed URL, or null when the string is not an absolute URL. */
export function safeParseUrl(url: string): URL | null {
	try {
		return new URL(url);
	} catch {
		return null;
	}
}

export function extractDomain(url: string): string {
	return safeParseUrl(url)?.hostname || url;
}

export function extractPath(url: string): string {
	const parsed = safeParseUrl(url);
	return parsed ? parsed.pathname + parsed.search : url;
}

/** Path without query string or fragment; falls back to the raw string. */
export function extractPathname(url: string): string {
	const parsed = safeParseUrl(url);
	if (parsed) return parsed.pathname;
	return url.split(/[?#]/)[0];
}

export function getHeaderValue(
	headers: HARNameValue[] | undefined,
	name: string
): string | undefined {
	const lower = name.toLowerCase();
	return headers?.find((header) => header.name.toLowerCase() === lower)?.value;
}

/** The MIME type without parameters, lowercased (e.g. "text/html"). */
export function getBaseMimeType(mimeType: string | undefined): string {
	return (mimeType || "").split(";")[0].trim().toLowerCase();
}

export function getEntryStartTime(entry: HAREntry): number {
	const time = Date.parse(entry.startedDateTime);
	return Number.isFinite(time) ? time : 0;
}

/** Bytes that went over the wire, or the best available approximation. */
export function getEntryTransferSize(entry: HAREntry): number {
	const transfer = entry.response._transferSize;
	if (typeof transfer === "number" && transfer >= 0) return transfer;
	return nonNegative(entry.response.bodySize) + nonNegative(entry.response.headersSize);
}

/** Decoded response body size, falling back to the encoded body size. */
export function getEntryContentSize(entry: HAREntry): number {
	const size = entry.response.content.size;
	if (Number.isFinite(size) && size > 0) return size;
	return nonNegative(entry.response.bodySize);
}
