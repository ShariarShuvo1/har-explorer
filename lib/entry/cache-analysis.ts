import type { HAREntry } from "@/lib/har-types";
import { getHeaderValue } from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import type {
	CacheDirective,
	CacheInfo,
	CacheRecommendation,
	CacheSource,
	CacheStatus,
} from "./types";
import { formatDuration, getHeaderValues } from "./entry-utils";

export const CACHE_HEADERS = [
	"cache-control",
	"expires",
	"etag",
	"last-modified",
	"age",
	"date",
	"pragma",
	"vary",
];

/** Status codes that are heuristically cacheable (RFC 9110 §15.1). */
const CACHEABLE_BY_DEFAULT = new Set([200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414, 501]);

const STATIC_RESOURCE_TYPES = new Set(["css", "js", "font", "img", "media", "wasm"]);

/** Heuristic freshness is 10% of the time since Last-Modified (RFC 9111 §4.2.2). */
const HEURISTIC_FRACTION = 0.1;

function parseDirectives(value: string): CacheDirective[] {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const eq = part.indexOf("=");
			if (eq === -1) return { name: part.toLowerCase() };
			return {
				name: part.slice(0, eq).trim().toLowerCase(),
				value: part
					.slice(eq + 1)
					.trim()
					.replace(/^"(.*)"$/, "$1"),
			};
		});
}

function parseSeconds(value: string | undefined): number | undefined {
	if (value === undefined || !/^\d+$/.test(value.trim())) return undefined;
	const seconds = Number(value.trim());
	return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * Parses an HTTP-date. Every valid format contains a time of day, which also
 * stops Date.parse from accepting values such as "0" or "-1" that mean
 * "already expired".
 */
export function parseHttpDate(value: string | undefined): number | undefined {
	if (!value || !/\d{1,2}:\d{2}/.test(value)) return undefined;
	const time = Date.parse(value);
	return Number.isFinite(time) ? time : undefined;
}

function getCacheSource(entry: HAREntry): CacheSource {
	const fromCache = (entry as { _fromCache?: unknown })._fromCache;
	if (fromCache === "memory") return "memory-cache";
	if (fromCache === "disk") return "disk-cache";
	if (entry.response.status === 304) return "revalidated";
	if (entry.response._fetchedViaServiceWorker === true) return "service-worker";
	return "network";
}

/** Interprets the response's caching headers the way a browser (private) cache would. */
export function analyzeCacheHeaders(entry: HAREntry): CacheInfo {
	const { request, response } = entry;
	const headers = response.headers;

	const cacheControlValues = getHeaderValues(headers, "cache-control");
	const cacheControl = cacheControlValues.length > 0 ? cacheControlValues.join(", ") : undefined;
	const directives = cacheControl ? parseDirectives(cacheControl) : [];
	const has = (name: string) => directives.some((d) => d.name === name);
	const valueOf = (name: string) => directives.find((d) => d.name === name)?.value;

	const expires = getHeaderValue(headers, "expires");
	const etag = getHeaderValue(headers, "etag");
	const lastModified = getHeaderValue(headers, "last-modified");
	const pragma = getHeaderValue(headers, "pragma");
	const age = parseSeconds(getHeaderValue(headers, "age"));
	const maxAge = parseSeconds(valueOf("max-age"));
	const sMaxAge = parseSeconds(valueOf("s-maxage"));

	const noStore = has("no-store");
	const noCache = has("no-cache") || (!cacheControl && /no-cache/i.test(pragma ?? ""));
	const isPublic = has("public");
	const isPrivate = has("private");

	const responseTime =
		parseHttpDate(getHeaderValue(headers, "date")) ??
		(Date.parse(entry.startedDateTime) || undefined);

	let freshnessLifetime: number | undefined;
	let isHeuristic = false;
	if (maxAge !== undefined) {
		freshnessLifetime = maxAge;
	} else if (expires !== undefined) {
		const expiresAt = parseHttpDate(expires);
		// An invalid Expires value such as "0" means "already expired".
		freshnessLifetime =
			expiresAt !== undefined && responseTime !== undefined
				? Math.max(0, (expiresAt - responseTime) / 1000)
				: 0;
	} else {
		const modifiedAt = parseHttpDate(lastModified);
		if (
			modifiedAt !== undefined &&
			responseTime !== undefined &&
			responseTime > modifiedAt &&
			(CACHEABLE_BY_DEFAULT.has(response.status) || isPublic)
		) {
			freshnessLifetime = ((responseTime - modifiedAt) / 1000) * HEURISTIC_FRACTION;
			isHeuristic = true;
		}
	}

	const method = request.method.toUpperCase();
	const hasExplicitFreshness = maxAge !== undefined || expires !== undefined || isPublic;
	const isStorable =
		!noStore &&
		(method === "GET" || method === "HEAD") &&
		(CACHEABLE_BY_DEFAULT.has(response.status) ||
			response.status === 304 ||
			(response.status >= 200 && hasExplicitFreshness));

	let status: CacheStatus;
	if (!isStorable) status = "not-storable";
	else if (noCache) status = "revalidate";
	else if (freshnessLifetime === undefined) status = "none";
	else if (freshnessLifetime <= 0) status = "revalidate";
	else if ((age ?? 0) >= freshnessLifetime) status = "stale";
	else status = isHeuristic ? "heuristic" : "fresh";

	const cacheHeaderNames = new Set(CACHE_HEADERS);

	return {
		status,
		source: getCacheSource(entry),
		directives,
		headers: headers.filter((h) => cacheHeaderNames.has(h.name.toLowerCase())),
		cacheControl,
		expires,
		etag,
		lastModified,
		age,
		maxAge,
		sMaxAge,
		freshnessLifetime,
		isHeuristic,
		noStore,
		noCache,
		isPrivate,
		isPublic,
		immutable: has("immutable"),
		hasValidator: Boolean(etag || lastModified),
		expiresIgnored: expires !== undefined && (maxAge !== undefined || noStore),
	};
}

export function getCacheRecommendations(entry: HAREntry, info: CacheInfo): CacheRecommendation[] {
	const { request, response } = entry;
	const method = request.method.toUpperCase();
	const recommendations: CacheRecommendation[] = [];

	if (method !== "GET" && method !== "HEAD") {
		return [
			{
				type: "info",
				text: `Browsers do not reuse responses to ${method} requests from their cache.`,
			},
		];
	}
	if (response.status === 0 || response.status >= 500) return [];
	if (info.status === "not-storable" && !info.noStore) {
		return [
			{
				type: "info",
				text: `Responses with status ${response.status} are not stored by browser caches unless they carry explicit freshness headers.`,
			},
		];
	}

	const isStatic = STATIC_RESOURCE_TYPES.has(getResourceType(entry));
	const headers = response.headers;

	if (info.noStore) {
		recommendations.push(
			isStatic
				? {
						type: "warning",
						text: "no-store on a static asset forces a full download on every visit. Use a long max-age with fingerprinted file names instead.",
					}
				: {
						type: "info",
						text: "no-store: the response is never written to a cache, which is appropriate for sensitive data.",
					}
		);
	}

	if (info.status === "none") {
		recommendations.push({
			type: isStatic ? "warning" : "info",
			text: "No freshness information (Cache-Control max-age or Expires), so the browser has to re-request it every time.",
		});
	} else if (info.status === "heuristic" && info.freshnessLifetime !== undefined) {
		recommendations.push({
			type: "warning",
			text: `Freshness is guessed heuristically from Last-Modified (about ${formatDuration(info.freshnessLifetime)}). Set Cache-Control explicitly.`,
		});
	} else if (info.status === "stale") {
		recommendations.push({
			type: "warning",
			text: "The response was already stale when it was received (Age is not below its freshness lifetime).",
		});
	}

	if (!info.noStore && !info.hasValidator && response.status !== 304) {
		recommendations.push({
			type: "info",
			text: "Add an ETag or Last-Modified header so expired copies can be revalidated with a cheap 304 response.",
		});
	}

	if (
		isStatic &&
		!info.noStore &&
		!info.noCache &&
		info.maxAge !== undefined &&
		info.maxAge < 300
	) {
		recommendations.push({
			type: "info",
			text: `Short max-age (${formatDuration(info.maxAge)}) for a static asset. Fingerprinted files can use max-age=31536000, immutable.`,
		});
	}

	if (info.immutable && info.maxAge === undefined) {
		recommendations.push({
			type: "info",
			text: "immutable has no effect without max-age.",
		});
	}

	if (info.isPrivate && info.sMaxAge !== undefined) {
		recommendations.push({
			type: "info",
			text: "s-maxage is ignored because the response is private.",
		});
	}

	if (info.expiresIgnored) {
		recommendations.push({
			type: "info",
			text: "Expires is ignored because Cache-Control takes precedence.",
		});
	}

	if (!info.cacheControl && getHeaderValue(headers, "pragma")) {
		recommendations.push({
			type: "info",
			text: "Pragma is an HTTP/1.0 header; use Cache-Control instead.",
		});
	}

	const sharedCacheable =
		!info.isPrivate && !info.noStore && (info.isPublic || info.sMaxAge !== undefined);
	if (sharedCacheable && getHeaderValues(headers, "set-cookie").length > 0) {
		recommendations.push({
			type: "warning",
			text: "The response sets a cookie but may be stored by shared caches (CDNs, proxies). Add Cache-Control: private.",
		});
	}
	if (info.isPublic && getHeaderValue(request.headers, "authorization")) {
		recommendations.push({
			type: "warning",
			text: "public on a response to an authenticated request lets shared caches serve it to other users.",
		});
	}

	if (getHeaderValue(headers, "vary")?.trim() === "*") {
		recommendations.push({
			type: "warning",
			text: "Vary: * prevents the cached response from ever being reused.",
		});
	}

	return recommendations;
}
