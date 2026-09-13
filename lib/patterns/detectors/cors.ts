import type { HAREntry } from "@/lib/har-types";
import { getHeaderValue, safeParseUrl } from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import type { AffectedRequest, PatternDetector } from "../types";
import { plural } from "../utils";

/** Fetch modes the CORS protocol does not apply to. */
const NON_CORS_MODES = new Set(["navigate", "no-cors", "same-origin", "websocket"]);
const SAFELISTED_METHODS = new Set(["GET", "HEAD", "POST"]);

function splitList(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

function checkPreflight(entry: HAREntry): string | null {
	const { headers } = entry.request;
	const responseHeaders = entry.response.headers;

	const method = (getHeaderValue(headers, "access-control-request-method") ?? "")
		.trim()
		.toUpperCase();
	const allowedMethods = splitList(getHeaderValue(responseHeaders, "access-control-allow-methods"));
	if (
		method &&
		!SAFELISTED_METHODS.has(method) &&
		!allowedMethods.includes("*") &&
		!allowedMethods.includes(method.toLowerCase())
	) {
		return `Preflight does not allow the ${method} method`;
	}

	const allowedHeaders = splitList(getHeaderValue(responseHeaders, "access-control-allow-headers"));
	const missing = splitList(getHeaderValue(headers, "access-control-request-headers")).filter(
		(header) =>
			!allowedHeaders.includes(header) &&
			// The wildcard never covers Authorization.
			!(allowedHeaders.includes("*") && header !== "authorization")
	);
	if (missing.length > 0) {
		return `Preflight does not allow the ${missing.join(", ")} header${missing.length === 1 ? "" : "s"}`;
	}
	return null;
}

function getCorsProblem(entry: HAREntry): string | null {
	const { headers, method, url } = entry.request;
	const origin = getHeaderValue(headers, "origin")?.trim();
	if (!origin) return null;

	const type = getResourceType(entry);
	if (type === "ws" || type === "doc") return null;
	const mode = getHeaderValue(headers, "sec-fetch-mode")?.trim().toLowerCase();
	if (mode && NON_CORS_MODES.has(mode)) return null;

	const target = safeParseUrl(url);
	if (!target || (target.protocol !== "http:" && target.protocol !== "https:")) {
		return null;
	}
	if (origin.toLowerCase() === target.origin.toLowerCase()) return null;

	const { status, _error } = entry.response;
	const isPreflight =
		method === "OPTIONS" && getHeaderValue(headers, "access-control-request-method") !== undefined;
	const label = isPreflight ? "Preflight response" : "Response";

	if (status <= 0) {
		const error = typeof _error === "string" ? _error.toLowerCase() : "";
		if (error.includes("blocked_by_client") || error.includes("aborted")) {
			return null;
		}
		return `No response from ${target.origin}; likely blocked by CORS`;
	}
	if (isPreflight && (status < 200 || status >= 300)) {
		return `Preflight failed with status ${status}`;
	}

	const allowOrigin = getHeaderValue(entry.response.headers, "access-control-allow-origin")?.trim();
	if (!allowOrigin) {
		return `${label} is missing Access-Control-Allow-Origin`;
	}
	if (allowOrigin !== "*" && allowOrigin.toLowerCase() !== origin.toLowerCase()) {
		return `Access-Control-Allow-Origin "${allowOrigin}" does not match ${origin}`;
	}

	return isPreflight ? checkPreflight(entry) : null;
}

export const detectCorsIssues: PatternDetector = ({ entries }) => {
	const affected: AffectedRequest[] = [];
	entries.forEach((entry, index) => {
		const problem = getCorsProblem(entry);
		if (problem) affected.push({ index, details: problem });
	});
	if (affected.length === 0) return null;

	return {
		type: "cors",
		severity: "high",
		title: "CORS Issues",
		description: `${plural(affected.length, "cross-origin request")} failing the browser's CORS checks`,
		recommendation:
			"Return an Access-Control-Allow-Origin header that matches the requesting origin (and allow the needed methods and headers in preflight responses), or serve the API from the same origin",
		impact: "The browser blocks scripts from reading these responses, so the calling code fails",
		affected,
	};
};
