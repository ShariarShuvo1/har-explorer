import type { HARCookie, HAREntry, HARNameValue, HARTimings } from "@/lib/har-types";
import { getBaseMimeType, nonNegative, safeParseUrl } from "@/lib/har-parser";
import type { TimingPhase } from "@/lib/timing";
import type { FieldPath, PerformanceMetrics } from "./types";

/** "200 OK", or a readable label when the request never got a response. */
export function formatStatus(status: number, statusText: string): string {
	if (!status) return "(failed)";
	return statusText ? `${status} ${statusText}` : String(status);
}

/** All values of a header; some exporters join repeated headers with newlines. */
export function getHeaderValues(headers: HARNameValue[], name: string): string[] {
	const lower = name.toLowerCase();
	return headers
		.filter((header) => header.name.toLowerCase() === lower)
		.flatMap((header) => header.value.split("\n"))
		.map((value) => value.trim())
		.filter(Boolean);
}

/** Parses a Set-Cookie header value into a HAR cookie object. */
export function parseSetCookie(header: string): HARCookie {
	const [pair, ...attributes] = header.split(";");
	const eq = pair.indexOf("=");
	const cookie: HARCookie = {
		name: eq === -1 ? "" : pair.slice(0, eq).trim(),
		value: (eq === -1 ? pair : pair.slice(eq + 1)).trim(),
	};
	for (const attribute of attributes) {
		const eqIndex = attribute.indexOf("=");
		const key = (eqIndex === -1 ? attribute : attribute.slice(0, eqIndex)).trim().toLowerCase();
		const value = eqIndex === -1 ? "" : attribute.slice(eqIndex + 1).trim();
		if (key === "secure") cookie.secure = true;
		else if (key === "httponly") cookie.httpOnly = true;
		else if (key === "samesite") cookie.sameSite = value;
		else if (key === "path") cookie.path = value;
		else if (key === "domain") cookie.domain = value;
		else if (key === "expires") cookie.expires = value;
		else if (key === "max-age") cookie.maxAge = value;
	}
	return cookie;
}

/**
 * Cookies set by the response. Raw Set-Cookie headers are preferred because
 * exporters do not always copy every attribute into `response.cookies`.
 */
export function getResponseCookies(entry: HAREntry): HARCookie[] {
	const headers = getHeaderValues(entry.response.headers, "set-cookie");
	return headers.length > 0 ? headers.map(parseSetCookie) : entry.response.cookies;
}

export function percentOf(part: number, total: number): number {
	if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
		return 0;
	}
	return Math.min(100, Math.max(0, (part / total) * 100));
}

/** Formats a number of seconds as e.g. "45s", "5m 30s", "2h 5m", "7d". */
export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "—";
	const s = Math.round(seconds);
	const join = (big: number, bigUnit: string, small: number, smallUnit: string) =>
		small ? `${big}${bigUnit} ${small}${smallUnit}` : `${big}${bigUnit}`;
	if (s < 60) return `${s}s`;
	if (s < 3600) return join(Math.floor(s / 60), "m", s % 60, "s");
	if (s < 86400) {
		return join(Math.floor(s / 3600), "h", Math.floor((s % 3600) / 60), "m");
	}
	if (s < 31536000) {
		return join(Math.floor(s / 86400), "d", Math.floor((s % 86400) / 3600), "h");
	}
	return join(Math.floor(s / 31536000), "y", Math.floor((s % 31536000) / 86400), "d");
}

// ---------------------------------------------------------------------------
// Body decoding
// ---------------------------------------------------------------------------

export function sanitizeBase64(base64: string): string {
	return base64.replace(/\s/g, "");
}

/** Decodes (standard or URL-safe) base64; returns null when it is not valid. */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> | null {
	const cleaned = sanitizeBase64(base64).replace(/-/g, "+").replace(/_/g, "/");
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) return null;
	try {
		const binary = atob(cleaned);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	} catch {
		return null;
	}
}

function looksLikeBase64(text: string): boolean {
	const cleaned = sanitizeBase64(text);
	return cleaned.length >= 4 && cleaned.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(cleaned);
}

function getCharset(mimeType: string): string | undefined {
	return /;\s*charset\s*=\s*"?([^";\s]+)/i.exec(mimeType)?.[1];
}

export function isJsonMimeType(mimeType: string): boolean {
	return getBaseMimeType(mimeType).includes("json");
}

export function isTextualMimeType(mimeType: string): boolean {
	const base = getBaseMimeType(mimeType);
	return (
		base.startsWith("text/") ||
		/(json|xml|javascript|ecmascript|graphql|yaml|csv|x-www-form-urlencoded)/.test(base)
	);
}

function decodeBytes(
	bytes: Uint8Array<ArrayBuffer>,
	charset: string | undefined,
	fatal = false
): string | null {
	try {
		return new TextDecoder(charset || "utf-8", { fatal }).decode(bytes);
	} catch {
		if (!charset) return null;
		// Unknown charset label: fall back to UTF-8.
		return decodeBytes(bytes, undefined, fatal);
	}
}

export type ResponseBody =
	| { kind: "none" }
	| { kind: "text"; text: string; wasBase64: boolean }
	| { kind: "binary"; base64: string };

/**
 * Interprets `content.text` using `content.encoding` and the MIME type:
 * textual bodies are returned as decoded text, binary ones as clean base64.
 */
export function getResponseBody(content: HAREntry["response"]["content"]): ResponseBody {
	const raw = content.text;
	if (!raw) return { kind: "none" };

	const mimeType = content.mimeType || "";
	const charset = getCharset(mimeType);
	const isBase64 = content.encoding?.trim().toLowerCase() === "base64";

	if (isTextualMimeType(mimeType)) {
		if (!isBase64) return { kind: "text", text: raw, wasBase64: false };
		const bytes = base64ToBytes(raw);
		const text = bytes && decodeBytes(bytes, charset);
		return text !== null && text !== undefined
			? { kind: "text", text, wasBase64: true }
			: { kind: "text", text: raw, wasBase64: false };
	}

	if (!getBaseMimeType(mimeType)) {
		if (!isBase64) return { kind: "text", text: raw, wasBase64: false };
		// Unknown type: show it as text only if it is valid UTF-8.
		const bytes = base64ToBytes(raw);
		const text = bytes && decodeBytes(bytes, charset, true);
		if (typeof text === "string") {
			return { kind: "text", text, wasBase64: true };
		}
		return { kind: "binary", base64: sanitizeBase64(raw) };
	}

	// Binary type. Some exporters omit `encoding` even though the body is base64.
	if (isBase64 || looksLikeBase64(raw)) {
		return { kind: "binary", base64: sanitizeBase64(raw) };
	}
	return { kind: "text", text: raw, wasBase64: false };
}

/** Pretty-prints JSON bodies; any other text (or invalid JSON) is returned as-is. */
export function formatResponseContent(text: string, mimeType: string): string {
	if (!text) return "";
	if (isJsonMimeType(mimeType)) {
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}
	return text;
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

function setIn(node: unknown, path: FieldPath, depth: number, value: unknown): unknown {
	if (depth === path.length) return value;
	const key = path[depth];

	if (Array.isArray(node)) {
		const index = Number(key);
		if (!Number.isInteger(index) || index < 0 || index > node.length) {
			return node;
		}
		const copy = node.slice();
		copy[index] = setIn(copy[index], path, depth + 1, value);
		return copy;
	}

	const record = typeof node === "object" && node !== null ? (node as Record<string, unknown>) : {};
	return {
		...record,
		[key]: setIn(record[String(key)], path, depth + 1, value),
	};
}

/** Returns a copy of `entry` with the field at `path` replaced; untouched branches are shared. */
export function setEntryField(entry: HAREntry, path: FieldPath, value: unknown): HAREntry {
	if (path.length === 0) return entry;
	return setIn(entry, path, 0, value) as HAREntry;
}

/** Sets the request URL and keeps `queryString` in sync with it. */
export function withRequestUrl(entry: HAREntry, url: string): HAREntry {
	const parsed = safeParseUrl(url);
	const queryString = parsed
		? Array.from(parsed.searchParams, ([name, value]) => ({ name, value }))
		: entry.request.queryString;
	return { ...entry, request: { ...entry.request, url, queryString } };
}

/** Sets the query parameters and rewrites the URL's search part to match. */
export function withQueryString(entry: HAREntry, queryString: HARNameValue[]): HAREntry {
	const parsed = safeParseUrl(entry.request.url);
	if (!parsed) {
		return { ...entry, request: { ...entry.request, queryString } };
	}
	const params = new URLSearchParams();
	queryString.forEach((param) => params.append(param.name, param.value));
	parsed.search = params.toString();
	return {
		...entry,
		request: { ...entry.request, queryString, url: parsed.toString() },
	};
}

/** Sets the request body text; url-encoded form params are re-derived from it. */
export function withPostDataText(entry: HAREntry, text: string): HAREntry {
	const postData = entry.request.postData ?? { mimeType: "" };
	const next = { ...postData, text };
	if (getBaseMimeType(postData.mimeType) === "application/x-www-form-urlencoded") {
		next.params = Array.from(new URLSearchParams(text), ([name, value]) => ({
			name,
			value,
		}));
	}
	return { ...entry, request: { ...entry.request, postData: next } };
}

/** Stores edited (decoded) body text; a base64 body becomes plain text. */
export function withResponseText(entry: HAREntry, text: string): HAREntry {
	const content = { ...entry.response.content, text };
	delete content.encoding;
	return { ...entry, response: { ...entry.response, content } };
}

/** Accepts ISO 8601 timestamps (or anything Date can parse) and returns an ISO string. */
export function normalizeTimestamp(value: string): string | null {
	const trimmed = value.trim();
	const time = Date.parse(trimmed);
	if (!trimmed || !Number.isFinite(time)) return null;
	// Keep the user's ISO string (and its UTC offset) when it already is one.
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed) ? trimmed : new Date(time).toISOString();
}

// ---------------------------------------------------------------------------
// Timings & performance
// ---------------------------------------------------------------------------

/**
 * Splits the HAR timings into non-overlapping phases. `connect` includes `ssl`
 * per the spec; exporters that report a TLS time larger than the connect time
 * evidently did not include it, so nothing is subtracted in that case.
 */
export function getPhaseDurations(timings: HARTimings): Record<TimingPhase, number> {
	const ssl = nonNegative(timings.ssl);
	const connect = nonNegative(timings.connect);
	return {
		blocked: nonNegative(timings.blocked),
		dns: nonNegative(timings.dns),
		connect: ssl <= connect ? connect - ssl : connect,
		ssl,
		send: nonNegative(timings.send),
		wait: nonNegative(timings.wait),
		receive: nonNegative(timings.receive),
	};
}

export function calculatePerformanceMetrics(entry: HAREntry): PerformanceMetrics {
	const phases = getPhaseDurations(entry.timings);
	const phaseTotal = Object.values(phases).reduce((sum, v) => sum + v, 0);
	const totalTime = nonNegative(entry.time);
	const breakdownTotal = Math.max(totalTime, phaseTotal);

	const ttfb =
		phases.blocked + phases.dns + phases.connect + phases.ssl + phases.send + phases.wait;

	return {
		totalTime,
		breakdownTotal,
		ttfb,
		blocked: phases.blocked,
		dnsLookup: phases.dns,
		tcpConnection: phases.connect,
		tlsHandshake: phases.ssl,
		requestSent: phases.send,
		serverProcessing: phases.wait,
		contentDownload: phases.receive,
		efficiency: percentOf(phases.receive, breakdownTotal),
		hasTimingData: breakdownTotal > 0,
	};
}
