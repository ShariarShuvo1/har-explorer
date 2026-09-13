import type { HAREntry, HARPostData } from "@/lib/har-types";
import { getBaseMimeType, getHeaderValue } from "@/lib/har-parser";

const STATUS_REASONS: Record<number, string> = {
	100: "Continue",
	101: "Switching Protocols",
	103: "Early Hints",
	200: "OK",
	201: "Created",
	202: "Accepted",
	203: "Non-Authoritative Information",
	204: "No Content",
	205: "Reset Content",
	206: "Partial Content",
	207: "Multi-Status",
	300: "Multiple Choices",
	301: "Moved Permanently",
	302: "Found",
	303: "See Other",
	304: "Not Modified",
	307: "Temporary Redirect",
	308: "Permanent Redirect",
	400: "Bad Request",
	401: "Unauthorized",
	402: "Payment Required",
	403: "Forbidden",
	404: "Not Found",
	405: "Method Not Allowed",
	406: "Not Acceptable",
	408: "Request Timeout",
	409: "Conflict",
	410: "Gone",
	411: "Length Required",
	412: "Precondition Failed",
	413: "Content Too Large",
	414: "URI Too Long",
	415: "Unsupported Media Type",
	416: "Range Not Satisfiable",
	422: "Unprocessable Content",
	425: "Too Early",
	428: "Precondition Required",
	429: "Too Many Requests",
	431: "Request Header Fields Too Large",
	451: "Unavailable For Legal Reasons",
	500: "Internal Server Error",
	501: "Not Implemented",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
	505: "HTTP Version Not Supported",
};

/** Whether `status` is a real HTTP status (HAR uses 0 for failed/blocked requests). */
export function isValidHttpStatus(status: number): boolean {
	return Number.isInteger(status) && status >= 100 && status <= 599;
}

export function getStatusCategory(status: number): string {
	if (!isValidHttpStatus(status)) return "No response";
	if (status < 200) return "Informational";
	if (status < 300) return "Success";
	if (status < 400) return "Redirection";
	if (status < 500) return "Client Error";
	return "Server Error";
}

/** The captured status text, falling back to the standard reason phrase. */
export function getStatusDescription(status: number, statusText?: string): string {
	const text = statusText?.trim();
	if (text) return text;
	return STATUS_REASONS[status] ?? getStatusCategory(status);
}

const METHOD_ORDER = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

export function compareMethods(a: string, b: string): number {
	const ai = METHOD_ORDER.indexOf(a);
	const bi = METHOD_ORDER.indexOf(b);
	if (ai === -1 && bi === -1) return a.localeCompare(b);
	if (ai === -1) return 1;
	if (bi === -1) return -1;
	return ai - bi;
}

export function isPseudoHeader(name: string): boolean {
	return name.startsWith(":");
}

export function isJsonMimeType(mimeType: string): boolean {
	const base = getBaseMimeType(mimeType);
	return base.endsWith("/json") || base.endsWith("+json");
}

export function isFormUrlEncodedMimeType(mimeType: string): boolean {
	return getBaseMimeType(mimeType) === "application/x-www-form-urlencoded";
}

export function isMultipartMimeType(mimeType: string): boolean {
	return getBaseMimeType(mimeType).startsWith("multipart/");
}

export function isTextualMimeType(mimeType: string): boolean {
	const base = getBaseMimeType(mimeType);
	return (
		base.startsWith("text/") ||
		isJsonMimeType(base) ||
		base.endsWith("+xml") ||
		base === "application/xml" ||
		base === "application/javascript" ||
		base === "application/x-www-form-urlencoded" ||
		base === "application/graphql"
	);
}

function decodeBase64Utf8(text: string): string | null {
	try {
		const binary = atob(text.replace(/\s+/g, ""));
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

/**
 * The decoded response body when it is textual, or undefined for empty,
 * binary or undecodable bodies.
 */
export function getResponseBodyText(entry: HAREntry): string | undefined {
	const { text, encoding, mimeType } = entry.response.content;
	if (!text) return undefined;
	if (encoding === "base64") {
		if (!isTextualMimeType(mimeType)) return undefined;
		return decodeBase64Utf8(text) ?? undefined;
	}
	return text;
}

type JsonParseResult = { ok: true; value: unknown } | { ok: false };

export function parseJson(text: string | undefined): JsonParseResult {
	if (text === undefined || text.trim() === "") return { ok: false };
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false };
	}
}

/** The request body mime type from postData, falling back to the Content-Type header. */
export function getRequestBodyMimeType(entry: HAREntry): string {
	return (
		getBaseMimeType(entry.request.postData?.mimeType) ||
		getBaseMimeType(getHeaderValue(entry.request.headers, "content-type")) ||
		""
	);
}

export function hasRequestBody(postData: HARPostData | undefined): postData is HARPostData {
	return Boolean(postData && (postData.text || postData.params?.length));
}

export interface FormField {
	name: string;
	value: string;
	fileName?: string;
	contentType?: string;
}

/** Form fields from `postData.params`, or parsed from a url-encoded body text. */
export function getFormFields(postData: HARPostData): FormField[] {
	if (postData.params?.length) {
		return postData.params.map((param) => ({
			name: param.name,
			value: param.value ?? "",
			...(param.fileName ? { fileName: param.fileName } : {}),
			...(param.contentType ? { contentType: param.contentType } : {}),
		}));
	}
	if (postData.text && isFormUrlEncodedMimeType(postData.mimeType)) {
		return Array.from(new URLSearchParams(postData.text), ([name, value]) => ({
			name,
			value,
		}));
	}
	return [];
}
