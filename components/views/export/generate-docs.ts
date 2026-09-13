import {
	getEndpointHostLabel,
	isCredentialHeader,
	type ApiEndpoint,
	type SecurityUsage,
	type ValueStats,
} from "@/lib/api-docs/endpoints";
import {
	renderMarkdown,
	renderPlainText,
	type DocBlock,
	type DocCell,
	type DocField,
} from "@/lib/api-docs/document";
import {
	compareMethods,
	getStatusCategory,
	getStatusDescription,
	isValidHttpStatus,
} from "@/lib/api-docs/http";
import { isSensitiveName, redactHeaderValue, redactUrl, REDACTED } from "@/lib/api-docs/redact";
import { formatTime } from "@/lib/har-parser";
import { generateCurl } from "@/lib/codegen";
import type { ExportOptions, GroupByOption } from "./types";

export interface DocumentMeta {
	/** Whether endpoints were deduplicated into path patterns. */
	dedupe: boolean;
	sourceName?: string | null;
	/** Defaults to now. */
	generatedAt?: Date;
}

const EXAMPLE_BODY_LIMIT = 2000;
const MAX_LISTED_HOSTS = 10;

/** Request headers worth documenting; browser-managed noise is left out. */
const DOCUMENTED_HEADERS = new Set([
	"accept",
	"content-type",
	"authorization",
	"if-match",
	"if-none-match",
	"prefer",
	"idempotency-key",
]);

function describeSecurity(usage: SecurityUsage, totalCalls: number): string {
	const scheme = usage.scheme;
	let label: string;
	if (scheme.type === "http") {
		label = `HTTP ${String(scheme.scheme)}${scheme.bearerFormat ? ` (${String(scheme.bearerFormat)})` : ""}`;
	} else {
		label = `API key in ${String(scheme.in)} "${String(scheme.name)}"`;
	}
	return usage.count < totalCalls ? `${label} (${usage.count} of ${totalCalls} calls)` : label;
}

function describeValueType(stats: ValueStats): string {
	const kinds = [...stats.kinds];
	const type =
		kinds.length === 0
			? "string"
			: kinds.every((kind) => kind === "integer" || kind === "number")
				? kinds.includes("number")
					? "number"
					: "integer"
				: kinds.length === 1
					? kinds[0]
					: "string";
	return stats.repeated ? `array of ${type}` : type;
}

function exampleValues(stats: ValueStats, redact: boolean): string {
	if (redact && isSensitiveName(stats.name)) return REDACTED;
	return stats.values
		.slice(0, 3)
		.map((value) => (value === "" ? '""' : value))
		.join(", ");
}

function isRequired(stats: ValueStats, endpoint: ApiEndpoint): string {
	if (endpoint.totalCalls < 2) return "unknown";
	return stats.count >= endpoint.totalCalls ? "yes" : "no";
}

function statusSummary(endpoint: ApiEndpoint): string {
	return [...endpoint.responses.values()]
		.sort((a, b) => a.status - b.status)
		.map((response) => {
			const label = isValidHttpStatus(response.status)
				? `${response.status} ${getStatusDescription(response.status, response.statusText)}`
				: "No response";
			return endpoint.totalCalls > 1 ? `${label} (${response.count})` : label;
		})
		.join(", ");
}

function statusGroupKey(status: number): { key: string; order: number } {
	if (!isValidHttpStatus(status)) return { key: "No response", order: 1000 };
	const hundred = Math.floor(status / 100);
	return { key: `${hundred}xx ${getStatusCategory(status)}`, order: hundred };
}

function groupEndpoints(
	endpoints: ApiEndpoint[],
	groupBy: GroupByOption
): Array<[string, ApiEndpoint[]]> {
	if (groupBy === "none") return [["", endpoints]];

	const groups = new Map<string, { order: number | string; endpoints: ApiEndpoint[] }>();
	const add = (key: string, order: number | string, endpoint: ApiEndpoint) => {
		const group = groups.get(key) ?? { order, endpoints: [] };
		if (!group.endpoints.includes(endpoint)) group.endpoints.push(endpoint);
		groups.set(key, group);
	};

	for (const endpoint of endpoints) {
		switch (groupBy) {
			case "domain": {
				const host = getEndpointHostLabel(endpoint);
				add(host, host, endpoint);
				break;
			}
			case "method":
				add(endpoint.method, endpoint.method, endpoint);
				break;
			case "status": {
				// An endpoint that returned several status classes is listed under each.
				for (const status of endpoint.responses.keys()) {
					const { key, order } = statusGroupKey(status);
					add(key, order, endpoint);
				}
				break;
			}
		}
	}

	return [...groups.entries()]
		.sort(([, a], [, b]) => {
			if (typeof a.order === "number" && typeof b.order === "number") return a.order - b.order;
			if (groupBy === "method") return compareMethods(String(a.order), String(b.order));
			return String(a.order).localeCompare(String(b.order));
		})
		.map(([key, group]) => [key, group.endpoints]);
}

function endpointBlocks(
	endpoint: ApiEndpoint,
	options: ExportOptions,
	meta: DocumentMeta,
	multipleOrigins: boolean
): DocBlock[] {
	const redact = options.redactSecrets;
	const origins = endpoint.origins.filter(Boolean);
	// Identical paths on different origins would otherwise get identical headings.
	const originSuffix = multipleOrigins && origins.length > 0 ? ` (${origins.join(", ")})` : "";
	const blocks: DocBlock[] = [
		{ kind: "heading", level: 3, text: `${endpoint.method} ${endpoint.path}${originSuffix}` },
	];

	const fields: DocField[] = [
		{
			label: origins.length > 1 ? "Base URLs" : "Base URL",
			value: origins.length > 0 ? origins.join(", ") : "(relative URL)",
			code: origins.length > 0,
		},
	];
	if (!meta.dedupe && endpoint.entries[0]) {
		const url = endpoint.entries[0].request.url;
		fields.push({ label: "URL", value: redact ? redactUrl(url) : url, code: true });
	}
	fields.push(
		{ label: "Calls", value: String(endpoint.totalCalls) },
		{
			label: endpoint.responses.size > 1 ? "Responses" : "Response",
			value: statusSummary(endpoint),
		}
	);
	if (options.includePerformanceMetrics) {
		fields.push({
			label: meta.dedupe ? "Avg response time" : "Response time",
			value: formatTime(endpoint.avgResponseTime),
		});
	}
	if (options.includeHeaders && endpoint.security.size > 0) {
		fields.push({
			label: "Authentication",
			value: [...endpoint.security.values()]
				.map((usage) => describeSecurity(usage, endpoint.totalCalls))
				.join("; "),
		});
	}
	blocks.push({ kind: "fields", items: fields });

	if (endpoint.pathParams.length > 0) {
		blocks.push(
			{ kind: "heading", level: 4, text: "Path Parameters" },
			{
				kind: "table",
				columns: ["Parameter", "Kind", "Example values"],
				rows: endpoint.pathParams.map((param) => {
					const secretLike = param.kinds.has("token") || param.kinds.has("hash");
					return [
						{ text: param.name, code: true },
						{ text: [...param.kinds].join(" | ") },
						{
							text: redact && secretLike ? REDACTED : param.values.slice(0, 3).join(", "),
							code: true,
						},
					];
				}),
			}
		);
	}

	if (options.includeQueryParams && endpoint.queryParams.size > 0) {
		blocks.push(
			{ kind: "heading", level: 4, text: "Query Parameters" },
			{
				kind: "table",
				columns: ["Parameter", "Type", "Required", "Example values"],
				rows: [...endpoint.queryParams.values()].map((stats) => [
					{ text: stats.name, code: true },
					{ text: describeValueType(stats) },
					{ text: isRequired(stats, endpoint) },
					{ text: exampleValues(stats, redact), code: true },
				]),
			}
		);
	}

	if (options.includeHeaders) {
		const rows: DocCell[][] = [];
		for (const [lower, stats] of endpoint.requestHeaders) {
			if (!DOCUMENTED_HEADERS.has(lower) && !lower.startsWith("x-") && !isCredentialHeader(lower)) {
				continue;
			}
			const sample = stats.values[0] ?? "";
			rows.push([
				{ text: lower, code: true },
				{ text: redact ? redactHeaderValue(lower, sample) : sample, code: true },
			]);
		}
		if (rows.length > 0) {
			blocks.push(
				{ kind: "heading", level: 4, text: "Request Headers" },
				{ kind: "table", columns: ["Header", "Example value"], rows }
			);
		}
	}

	if (options.includeRequestBody) {
		for (const body of endpoint.requestBodies.values()) {
			blocks.push({ kind: "heading", level: 4, text: `Request Body (${body.mimeType})` });
			blocks.push(
				body.schema
					? { kind: "schema", schema: body.schema }
					: {
							kind: "paragraph",
							text: "The body is not JSON or form data, so no schema was inferred.",
						}
			);
		}
	}

	if (options.includeResponseSchema) {
		const responses = [...endpoint.responses.values()].sort((a, b) => a.status - b.status);
		for (const response of responses) {
			for (const body of response.bodies.values()) {
				if (!body.schema) continue;
				blocks.push(
					{ kind: "heading", level: 4, text: `Response ${response.status} (${body.mimeType})` },
					{ kind: "schema", schema: body.schema }
				);
			}
		}
	}

	if (options.includeCurlExamples && endpoint.entries[0]) {
		blocks.push(
			{ kind: "heading", level: 4, text: "Example cURL" },
			{
				kind: "code",
				language: "bash",
				code: generateCurl(endpoint.entries[0], { redact, maxBodyLength: EXAMPLE_BODY_LIMIT }),
			}
		);
	}

	blocks.push({ kind: "rule" });
	return blocks;
}

function buildDocument(
	endpoints: ApiEndpoint[],
	options: ExportOptions,
	meta: DocumentMeta
): DocBlock[] {
	const totalCalls = endpoints.reduce((sum, endpoint) => sum + endpoint.totalCalls, 0);
	const hosts = [...new Set(endpoints.map(getEndpointHostLabel))].sort();
	const multipleOrigins =
		new Set(endpoints.flatMap((endpoint) => endpoint.origins.filter(Boolean))).size > 1;
	const listedHosts = hosts.slice(0, MAX_LISTED_HOSTS).join(", ");
	const source = meta.sourceName ? ` from ${meta.sourceName}` : "";

	const blocks: DocBlock[] = [
		{ kind: "heading", level: 1, text: "API Documentation" },
		{
			kind: "note",
			text: `Generated by HAR Explorer${source} on ${(meta.generatedAt ?? new Date()).toLocaleString()}.`,
		},
		{ kind: "heading", level: 2, text: "Summary" },
		{
			kind: "fields",
			items: [
				{ label: meta.dedupe ? "Unique endpoints" : "Requests", value: String(endpoints.length) },
				{ label: "API calls", value: String(totalCalls) },
				{
					label: hosts.length === 1 ? "Host" : `Hosts (${hosts.length})`,
					value: hosts.length > MAX_LISTED_HOSTS ? `${listedHosts}, …` : listedHosts,
				},
			],
		},
	];

	for (const [groupName, members] of groupEndpoints(endpoints, options.groupBy)) {
		if (groupName) blocks.push({ kind: "heading", level: 2, text: groupName });
		for (const endpoint of members) {
			blocks.push(...endpointBlocks(endpoint, options, meta, multipleOrigins));
		}
	}

	return blocks;
}

export function generateMarkdown(
	endpoints: ApiEndpoint[],
	options: ExportOptions,
	meta: DocumentMeta
): string {
	return renderMarkdown(buildDocument(endpoints, options, meta));
}

export function generatePlainText(
	endpoints: ApiEndpoint[],
	options: ExportOptions,
	meta: DocumentMeta
): string {
	return renderPlainText(buildDocument(endpoints, options, meta));
}
