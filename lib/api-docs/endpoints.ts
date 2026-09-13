import type { HAREntry } from "@/lib/har-types";
import { getBaseMimeType, nonNegative } from "@/lib/har-parser";
import {
	getFormFields,
	getRequestBodyMimeType,
	getResponseBodyText,
	hasRequestBody,
	isFormUrlEncodedMimeType,
	isJsonMimeType,
	isMultipartMimeType,
	isPseudoHeader,
	parseJson,
	compareMethods,
} from "./http";
import { addFormSample, addSample, createSchema, type InferredSchema } from "./schema";
import { getUrlParts, literalPath, templatePath, type PathParamKind } from "./path-template";

export type ScalarKind = "integer" | "number" | "boolean" | "string";

export interface ValueStats {
	/** Name as first seen (headers keep their original casing here). */
	name: string;
	/** Number of calls that included this value. */
	count: number;
	/** Distinct observed values, capped. */
	values: string[];
	kinds: Set<ScalarKind>;
	/** True when the name appeared more than once within a single call. */
	repeated: boolean;
}

export interface PathParamStats {
	name: string;
	kinds: Set<PathParamKind>;
	values: string[];
}

export interface BodyStats {
	mimeType: string;
	count: number;
	/** Inferred from JSON / form bodies; null for other or unparseable content. */
	schema: InferredSchema | null;
	/** Bodies that were merged into `schema`. */
	sampled: number;
}

export interface ResponseStats {
	status: number;
	statusText: string;
	count: number;
	bodies: Map<string, BodyStats>;
}

export interface SecurityUsage {
	id: string;
	/** OpenAPI Security Scheme Object. Never contains credential values. */
	scheme: Record<string, unknown>;
	count: number;
}

export interface ApiEndpoint {
	/** Unique within one analysis result. */
	key: string;
	method: string;
	/** Distinct origins ("" for non-absolute URLs), sorted. */
	origins: string[];
	hosts: string[];
	/** Templated path when deduplicating, otherwise the literal path. */
	path: string;
	pathParams: PathParamStats[];
	entries: HAREntry[];
	queryParams: Map<string, ValueStats>;
	/** Keyed by lowercased header name; pseudo headers are skipped. */
	requestHeaders: Map<string, ValueStats>;
	requestBodies: Map<string, BodyStats>;
	requestsWithBody: number;
	responses: Map<number, ResponseStats>;
	security: Map<string, SecurityUsage>;
	totalCalls: number;
	avgResponseTime: number;
}

export interface AnalyzeOptions {
	/** Group calls that share a method and path pattern. Default true. */
	dedupe?: boolean;
	/** Ignore the origin when grouping (used for OpenAPI paths). Default false. */
	mergeOrigins?: boolean;
}

const MAX_VALUES = 5;
const MAX_BODY_SAMPLES = 25;

const API_KEY_HEADERS = new Set([
	"x-api-key",
	"api-key",
	"apikey",
	"x-auth-token",
	"x-access-token",
	"x-goog-api-key",
	"ocp-apim-subscription-key",
]);

/** Query parameters that carry API credentials and are described as security schemes. */
export const API_KEY_QUERY_PARAMS = new Set([
	"api_key",
	"apikey",
	"api-key",
	"access_token",
	"auth_token",
]);

const HTTP_AUTH_SCHEMES = new Set([
	"basic",
	"bearer",
	"digest",
	"dpop",
	"hoba",
	"mutual",
	"negotiate",
	"ntlm",
]);

/** Header names that are handled by security schemes rather than parameters. */
export function isCredentialHeader(name: string): boolean {
	const lower = name.toLowerCase();
	return lower === "authorization" || API_KEY_HEADERS.has(lower);
}

function toIdentifier(name: string): string {
	const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
	return words
		.map((word, i) =>
			i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
		)
		.join("");
}

function detectSecurity(entry: HAREntry): Array<Omit<SecurityUsage, "count">> {
	const found: Array<Omit<SecurityUsage, "count">> = [];

	for (const header of entry.request.headers) {
		const lower = header.name.toLowerCase();
		const value = header.value.trim();
		if (lower === "authorization" && value) {
			const scheme = value.split(/\s+/)[0].toLowerCase();
			if (value.includes(" ") && HTTP_AUTH_SCHEMES.has(scheme)) {
				const token = value.slice(value.indexOf(" ")).trim();
				found.push({
					id: `${scheme}Auth`,
					scheme: {
						type: "http",
						scheme,
						...(scheme === "bearer" && token.split(".").length === 3
							? { bearerFormat: "JWT" }
							: {}),
					},
				});
			} else {
				found.push({
					id: "authorizationHeader",
					scheme: { type: "apiKey", in: "header", name: "Authorization" },
				});
			}
		} else if (API_KEY_HEADERS.has(lower) && value) {
			found.push({
				id: toIdentifier(lower),
				scheme: { type: "apiKey", in: "header", name: header.name },
			});
		}
	}

	for (const param of entry.request.queryString) {
		const lower = param.name.toLowerCase();
		if (API_KEY_QUERY_PARAMS.has(lower) && param.value) {
			found.push({
				id: `${toIdentifier(lower)}Query`,
				scheme: { type: "apiKey", in: "query", name: param.name },
			});
		}
	}

	return found;
}

function scalarKind(value: string): ScalarKind | null {
	if (value === "") return null;
	if (/^-?\d{1,15}$/.test(value)) return "integer";
	if (/^-?\d*\.\d+$/.test(value)) return "number";
	if (value === "true" || value === "false") return "boolean";
	return "string";
}

function recordValue(stats: ValueStats, value: string) {
	const kind = scalarKind(value);
	if (kind) stats.kinds.add(kind);
	if (stats.values.length < MAX_VALUES && !stats.values.includes(value)) {
		stats.values.push(value);
	}
}

function collectValues(
	target: Map<string, ValueStats>,
	items: Array<{ name: string; value: string }>,
	normalizeKey: (name: string) => string
) {
	const seenInCall = new Set<string>();
	for (const item of items) {
		const key = normalizeKey(item.name);
		let stats = target.get(key);
		if (!stats) {
			stats = { name: item.name, count: 0, values: [], kinds: new Set(), repeated: false };
			target.set(key, stats);
		}
		if (seenInCall.has(key)) {
			stats.repeated = true;
		} else {
			seenInCall.add(key);
			stats.count++;
		}
		recordValue(stats, item.value);
	}
}

function getBodyStats(map: Map<string, BodyStats>, mimeType: string): BodyStats {
	let stats = map.get(mimeType);
	if (!stats) {
		stats = { mimeType, count: 0, schema: null, sampled: 0 };
		map.set(mimeType, stats);
	}
	stats.count++;
	return stats;
}

function sampleJson(stats: BodyStats, text: string | undefined) {
	if (stats.sampled >= MAX_BODY_SAMPLES) return;
	const parsed = parseJson(text);
	if (!parsed.ok) return;
	stats.schema ??= createSchema();
	addSample(stats.schema, parsed.value);
	stats.sampled++;
}

function responseHasBody(entry: HAREntry): boolean {
	const { status } = entry.response;
	if (entry.request.method === "HEAD" || status === 204 || status === 304) {
		return false;
	}
	const { content, bodySize } = entry.response;
	return Boolean(content.text) || content.size > 0 || bodySize > 0;
}

/** URLs that do not correspond to a network API (inline data, blobs). */
function isDocumentableUrl(url: string): boolean {
	return !/^(?:data|blob|about|javascript):/i.test(url);
}

interface EndpointBuilder extends Omit<ApiEndpoint, "origins" | "hosts"> {
	originSet: Set<string>;
	hostSet: Set<string>;
	totalTime: number;
}

function createBuilder(key: string, method: string, path: string): EndpointBuilder {
	return {
		key,
		method,
		path,
		originSet: new Set(),
		hostSet: new Set(),
		pathParams: [],
		entries: [],
		queryParams: new Map(),
		requestHeaders: new Map(),
		requestBodies: new Map(),
		requestsWithBody: 0,
		responses: new Map(),
		security: new Map(),
		totalCalls: 0,
		avgResponseTime: 0,
		totalTime: 0,
	};
}

function addEntry(builder: EndpointBuilder, entry: HAREntry, origin: string, host: string) {
	const { request, response } = entry;
	builder.entries.push(entry);
	builder.totalCalls++;
	builder.totalTime += nonNegative(entry.time);
	builder.originSet.add(origin);
	if (host) builder.hostSet.add(host);

	collectValues(builder.queryParams, request.queryString, (name) => name);
	collectValues(
		builder.requestHeaders,
		request.headers.filter((header) => !isPseudoHeader(header.name)),
		(name) => name.toLowerCase()
	);

	for (const { id, scheme } of detectSecurity(entry)) {
		const usage = builder.security.get(id);
		if (usage) usage.count++;
		else builder.security.set(id, { id, scheme, count: 1 });
	}

	if (hasRequestBody(request.postData)) {
		builder.requestsWithBody++;
		const mimeType = getRequestBodyMimeType(entry) || "application/octet-stream";
		const stats = getBodyStats(builder.requestBodies, mimeType);
		if (isJsonMimeType(mimeType)) {
			sampleJson(stats, request.postData.text);
		} else if (
			(isFormUrlEncodedMimeType(mimeType) || isMultipartMimeType(mimeType)) &&
			stats.sampled < MAX_BODY_SAMPLES
		) {
			const fields = getFormFields(request.postData);
			if (fields.length > 0) {
				stats.schema ??= createSchema();
				addFormSample(
					stats.schema,
					fields.map((field) => ({
						name: field.name,
						value: field.value,
						isFile: Boolean(field.fileName),
					}))
				);
				stats.sampled++;
			}
		}
	}

	let responseStats = builder.responses.get(response.status);
	if (!responseStats) {
		responseStats = {
			status: response.status,
			statusText: response.statusText,
			count: 0,
			bodies: new Map(),
		};
		builder.responses.set(response.status, responseStats);
	}
	responseStats.count++;
	if (!responseStats.statusText && response.statusText) {
		responseStats.statusText = response.statusText;
	}
	if (responseHasBody(entry)) {
		const mimeType = getBaseMimeType(response.content.mimeType) || "application/octet-stream";
		const stats = getBodyStats(responseStats.bodies, mimeType);
		if (isJsonMimeType(mimeType)) sampleJson(stats, getResponseBodyText(entry));
	}
}

function finalize(builder: EndpointBuilder): ApiEndpoint {
	const { originSet, hostSet, totalTime, ...rest } = builder;
	return {
		...rest,
		origins: [...originSet].sort(),
		hosts: [...hostSet].sort(),
		avgResponseTime: builder.totalCalls > 0 ? totalTime / builder.totalCalls : 0,
	};
}

/**
 * Groups entries into endpoints and aggregates parameters, headers, body
 * schemas, responses and auth usage for documentation and OpenAPI output.
 */
export function analyzeEndpoints(
	entries: HAREntry[],
	{ dedupe = true, mergeOrigins = false }: AnalyzeOptions = {}
): ApiEndpoint[] {
	const builders = new Map<string, EndpointBuilder>();
	const occurrences = new Map<string, number>();

	for (const entry of entries) {
		const url = entry.request.url;
		if (!isDocumentableUrl(url)) continue;
		const method = entry.request.method;
		const { origin, host, pathname } = getUrlParts(url);

		let builder: EndpointBuilder | undefined;
		if (dedupe) {
			const { template, params } = templatePath(pathname);
			const key = `${method} ${mergeOrigins ? "" : origin}${template}`;
			builder = builders.get(key);
			if (!builder) {
				builder = createBuilder(key, method, template);
				builder.pathParams = params.map((param) => ({
					name: param.name,
					kinds: new Set(),
					values: [],
				}));
				builders.set(key, builder);
			}
			params.forEach((param, i) => {
				const stats = builder!.pathParams[i];
				if (!stats) return;
				stats.kinds.add(param.kind);
				if (stats.values.length < MAX_VALUES && !stats.values.includes(param.value)) {
					stats.values.push(param.value);
				}
			});
		} else {
			const base = `${method} ${url}`;
			const occurrence = (occurrences.get(base) ?? 0) + 1;
			occurrences.set(base, occurrence);
			const key = `${base}#${occurrence}`;
			builder = createBuilder(key, method, literalPath(pathname));
			builders.set(key, builder);
		}

		addEntry(builder, entry, origin, host);
	}

	const result = [...builders.values()].map(finalize);
	if (!dedupe) return result;

	return result.sort(
		(a, b) =>
			(a.hosts[0] ?? "").localeCompare(b.hosts[0] ?? "") ||
			a.path.localeCompare(b.path) ||
			compareMethods(a.method, b.method)
	);
}

export function getEndpointHostLabel(endpoint: ApiEndpoint): string {
	if (endpoint.hosts.length === 0) return "(relative URL)";
	return endpoint.hosts.join(", ");
}
