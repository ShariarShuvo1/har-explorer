import type { HARCookie, HAREntry, HARNameValue, HARPostData } from "@/lib/har-types";
import { isFormUrlEncodedMimeType, isJsonMimeType, isMultipartMimeType } from "./http";

/** Plain token so it survives URL/form encoding and shell quoting unchanged. */
export const REDACTED = "REDACTED";

const SENSITIVE_HEADERS = new Set([
	"authorization",
	"proxy-authorization",
	"cookie",
	"set-cookie",
	"x-api-key",
	"api-key",
	"apikey",
	"x-auth-token",
	"x-access-token",
	"x-refresh-token",
	"x-csrf-token",
	"x-xsrf-token",
	"x-amz-security-token",
	"x-goog-api-key",
	"ocp-apim-subscription-key",
]);

const SENSITIVE_NAME_PARTS =
	/passw(?:or)?d|passwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|credential|signature|session|csrf|xsrf/i;

const SENSITIVE_EXACT_NAMES =
	/^(?:auth|authorization|key|sig|pwd|pass|otp|pin|ssn|jwt|sid|code_verifier)$/i;

/** Headers whose values are URLs that may carry tokens in the query or fragment. */
const URL_HEADERS = new Set([":path", "location", "referer", "content-location"]);

export function isSensitiveName(name: string): boolean {
	const lower = name.trim().toLowerCase();
	return (
		SENSITIVE_HEADERS.has(lower) ||
		SENSITIVE_NAME_PARTS.test(lower) ||
		SENSITIVE_EXACT_NAMES.test(lower)
	);
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value.replace(/\+/g, " "));
	} catch {
		return value;
	}
}

/** Redacts values of sensitive `name=value` pairs, leaving the rest byte-for-byte intact. */
function redactQueryString(query: string): string {
	return query
		.split("&")
		.map((pair) => {
			const eq = pair.indexOf("=");
			if (eq === -1) return pair;
			const name = pair.slice(0, eq);
			return isSensitiveName(safeDecode(name)) ? `${name}=${REDACTED}` : pair;
		})
		.join("&");
}

export function redactUrl(url: string): string {
	const hashIndex = url.indexOf("#");
	const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
	const queryIndex = beforeHash.indexOf("?");
	const base = (queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex))
		// user:password@host
		.replace(/^([a-z][a-z0-9+.-]*:\/\/[^/?#@:]*:)[^/?#@]*@/i, `$1${REDACTED}@`);

	let result = base;
	if (queryIndex !== -1) {
		result += "?" + redactQueryString(beforeHash.slice(queryIndex + 1));
	}
	if (hashIndex !== -1) {
		// OAuth implicit flows put tokens in the fragment.
		const hash = url.slice(hashIndex + 1);
		result += "#" + (hash.includes("=") ? redactQueryString(hash) : hash);
	}
	return result;
}

function redactCookieHeader(value: string): string {
	return value
		.split(";")
		.map((part) => {
			const eq = part.indexOf("=");
			return eq === -1 ? part : `${part.slice(0, eq)}=${REDACTED}`;
		})
		.join(";");
}

function redactSetCookieHeader(value: string): string {
	// Some exporters join multiple Set-Cookie headers with newlines.
	return value
		.split("\n")
		.map((line) => {
			const semicolon = line.indexOf(";");
			const pair = semicolon === -1 ? line : line.slice(0, semicolon);
			const rest = semicolon === -1 ? "" : line.slice(semicolon);
			const eq = pair.indexOf("=");
			return eq === -1 ? line : `${pair.slice(0, eq)}=${REDACTED}${rest}`;
		})
		.join("\n");
}

export function redactHeaderValue(name: string, value: string): string {
	const lower = name.toLowerCase();
	if (lower === "cookie") return redactCookieHeader(value);
	if (lower === "set-cookie") return redactSetCookieHeader(value);
	if (URL_HEADERS.has(lower)) return redactUrl(value);
	if (!isSensitiveName(lower)) return value;
	if (lower === "authorization" || lower === "proxy-authorization") {
		// Keep the scheme ("Bearer", "Basic") since it documents the auth type.
		const match = /^(\S+)\s+\S/.exec(value.trim());
		if (match) return `${match[1]} ${REDACTED}`;
	}
	return REDACTED;
}

function redactHeaders(headers: HARNameValue[]): HARNameValue[] {
	return headers.map((header) => {
		const value = redactHeaderValue(header.name, header.value);
		return value === header.value ? header : { ...header, value };
	});
}

function redactJsonValue(value: unknown, depth = 0): unknown {
	if (depth > 64 || value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) {
		return value.map((item) => redactJsonValue(item, depth + 1));
	}
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		const sensitive = isSensitiveName(key);
		if (sensitive && typeof item === "string") {
			result[key] = REDACTED;
		} else if (sensitive && typeof item === "number" && SENSITIVE_EXACT_NAMES.test(key)) {
			result[key] = REDACTED;
		} else {
			result[key] = redactJsonValue(item, depth + 1);
		}
	}
	return result;
}

const MULTIPART_FIELD =
	/(content-disposition:[^\r\n]*?\bname="([^"]*)"[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n)[\s\S]*?(?=\r?\n--)/gi;

/** Redacts secrets inside JSON, url-encoded and multipart bodies; other bodies are returned as-is. */
export function redactBodyText(text: string, mimeType: string): string {
	if (!text) return text;
	if (isFormUrlEncodedMimeType(mimeType)) return redactQueryString(text);
	if (isMultipartMimeType(mimeType)) {
		return text.replace(MULTIPART_FIELD, (match, head: string, name: string) =>
			isSensitiveName(name) && !/\bfilename\*?=/i.test(head) ? head + REDACTED : match
		);
	}
	const trimmed = text.trimStart();
	if (isJsonMimeType(mimeType) || trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			const parsed: unknown = JSON.parse(text);
			const redacted = redactJsonValue(parsed);
			const compact = JSON.stringify(parsed);
			const redactedCompact = JSON.stringify(redacted);
			// Preserve the original formatting when nothing had to change.
			if (compact === redactedCompact) return text;
			return text.includes("\n") ? JSON.stringify(redacted, null, 2) : redactedCompact;
		} catch {
			return text;
		}
	}
	return text;
}

function redactPostData(postData: HARPostData): HARPostData {
	return {
		...postData,
		...(postData.text !== undefined
			? { text: redactBodyText(postData.text, postData.mimeType) }
			: {}),
		...(postData.params
			? {
					params: postData.params.map((param) =>
						!param.fileName && isSensitiveName(param.name) ? { ...param, value: REDACTED } : param
					),
				}
			: {}),
	};
}

function redactCookie(cookie: HARCookie): HARCookie {
	return { ...cookie, value: REDACTED };
}

/** A copy of the entry with credentials, cookies and token-like values replaced. */
export function redactEntry(entry: HAREntry): HAREntry {
	const { request, response } = entry;
	const content = response.content;
	return {
		...entry,
		request: {
			...request,
			url: redactUrl(request.url),
			headers: redactHeaders(request.headers),
			queryString: request.queryString.map((param) =>
				isSensitiveName(param.name) ? { ...param, value: REDACTED } : param
			),
			cookies: request.cookies.map(redactCookie),
			...(request.postData ? { postData: redactPostData(request.postData) } : {}),
		},
		response: {
			...response,
			headers: redactHeaders(response.headers),
			cookies: response.cookies.map(redactCookie),
			redirectURL: redactUrl(response.redirectURL),
			content:
				content.text && content.encoding !== "base64"
					? { ...content, text: redactBodyText(content.text, content.mimeType) }
					: content,
		},
	};
}
