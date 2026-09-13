import type { HAREntry } from "@/lib/har-types";
import { getHeaderValue } from "@/lib/har-parser";
import {
	analyzeEndpoints,
	API_KEY_QUERY_PARAMS,
	isCredentialHeader,
	type ApiEndpoint,
	type BodyStats,
	type ScalarKind,
	type ValueStats,
} from "./endpoints";
import { getStatusDescription, isJsonMimeType, isTextualMimeType, isValidHttpStatus } from "./http";
import type { PathParamKind } from "./path-template";
import { isSensitiveName } from "./redact";
import { toOpenApiSchema, type OpenApiSchema } from "./schema";

const OPENAPI_VERSION = "3.0.3";

export interface OpenApiOptions {
	title?: string;
	description?: string;
	/** Omit example values for parameters that look like secrets. Default true. */
	redact?: boolean;
}

type Operation = Record<string, unknown>;
type PathItem = Record<string, unknown>;

export interface OpenApiDocument {
	openapi: string;
	info: { title: string; version: string; description?: string };
	servers?: Array<{ url: string }>;
	paths: Record<string, PathItem>;
	components?: {
		schemas?: Record<string, OpenApiSchema>;
		securitySchemes?: Record<string, Record<string, unknown>>;
	};
}

const OPERATION_METHODS = new Set([
	"get",
	"put",
	"post",
	"delete",
	"options",
	"head",
	"patch",
	"trace",
]);

const VERSION_SEGMENT = /^v\d+(?:\.\d+)*$/i;

function toPascalCase(text: string): string {
	return text
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}

function buildOperationId(method: string, path: string): string {
	const parts = path
		.split("/")
		.filter(Boolean)
		.map((segment) => {
			const param = /^\{(.+)\}$/.exec(segment);
			return param ? `By${toPascalCase(param[1])}` : toPascalCase(segment);
		});
	return method.toLowerCase() + (parts.join("") || "Root");
}

function uniqueName(preferred: string, used: Set<string>): string {
	let name = preferred;
	for (let n = 2; used.has(name); n++) name = `${preferred}${n}`;
	used.add(name);
	return name;
}

/** Entries that cannot be described as HTTP operations. */
function isDocumentableEntry(entry: HAREntry): boolean {
	const { request, response } = entry;
	if (/^wss?:/i.test(request.url) || response.status === 101) return false;
	// CORS preflights are sent by the browser, not part of the API surface.
	if (
		request.method === "OPTIONS" &&
		getHeaderValue(request.headers, "access-control-request-method")
	) {
		return false;
	}
	return OPERATION_METHODS.has(request.method.toLowerCase());
}

function pathParamSchema(kinds: Set<PathParamKind>): OpenApiSchema {
	const list = [...kinds];
	if (list.length === 1) {
		switch (list[0]) {
			case "integer":
				return { type: "integer" };
			case "uuid":
				return { type: "string", format: "uuid" };
			case "date":
				return { type: "string", format: "date" };
			case "email":
				return { type: "string", format: "email" };
			case "object-id":
				return { type: "string", pattern: "^[0-9a-fA-F]{24}$" };
			case "numeric":
				return { type: "string", pattern: "^[0-9]+$" };
		}
	}
	if (list.length > 0 && list.every((kind) => kind === "integer" || kind === "numeric")) {
		return { type: "string", pattern: "^[0-9]+$" };
	}
	return { type: "string" };
}

function scalarSchema(kinds: Set<ScalarKind>): OpenApiSchema {
	const list = [...kinds];
	if (list.length === 1) return { type: list[0] };
	if (list.length > 0 && list.every((kind) => kind === "integer" || kind === "number")) {
		return { type: "number" };
	}
	return { type: "string" };
}

function typedExample(value: string, type: unknown): unknown {
	if (type === "integer" || type === "number") {
		const num = Number(value);
		return value !== "" && Number.isFinite(num) ? num : undefined;
	}
	if (type === "boolean") {
		return value === "true" ? true : value === "false" ? false : undefined;
	}
	return value;
}

function withExample(parameter: Record<string, unknown>, example: unknown) {
	if (example !== undefined) parameter.example = example;
	return parameter;
}

function isRequired(stats: ValueStats, endpoint: ApiEndpoint): boolean {
	// One observation cannot tell whether a parameter is optional.
	return endpoint.totalCalls >= 2 && stats.count >= endpoint.totalCalls;
}

function valueParameter(
	stats: ValueStats,
	location: "query" | "header",
	endpoint: ApiEndpoint,
	redact: boolean
): Record<string, unknown> {
	const scalar = scalarSchema(stats.kinds);
	const schema = stats.repeated ? { type: "array", items: scalar } : scalar;
	const parameter: Record<string, unknown> = {
		name: stats.name,
		in: location,
		required: isRequired(stats, endpoint),
		schema,
	};
	if (redact && isSensitiveName(stats.name)) return parameter;

	const values = stats.values
		.map((value) => typedExample(value, scalar.type))
		.filter((value) => value !== undefined && value !== "");
	if (values.length === 0) return parameter;
	return withExample(parameter, stats.repeated ? values : values[0]);
}

function buildParameters(endpoint: ApiEndpoint, redact: boolean): Array<Record<string, unknown>> {
	const parameters: Array<Record<string, unknown>> = [];

	for (const param of endpoint.pathParams) {
		const schema = pathParamSchema(param.kinds);
		const parameter: Record<string, unknown> = {
			name: param.name,
			in: "path",
			required: true,
			schema,
		};
		const secretLike = param.kinds.has("token") || param.kinds.has("hash");
		parameters.push(
			redact && secretLike
				? parameter
				: withExample(parameter, param.values[0] && typedExample(param.values[0], schema.type))
		);
	}

	for (const stats of endpoint.queryParams.values()) {
		if (API_KEY_QUERY_PARAMS.has(stats.name.toLowerCase())) continue;
		parameters.push(valueParameter(stats, "query", endpoint, redact));
	}

	for (const [lower, stats] of endpoint.requestHeaders) {
		if (!lower.startsWith("x-") || isCredentialHeader(lower)) continue;
		parameters.push(valueParameter(stats, "header", endpoint, redact));
	}

	return parameters;
}

function isComplexSchema(schema: OpenApiSchema): boolean {
	return schema.type === "object" || schema.type === "array" || "oneOf" in schema;
}

function bodySchema(stats: BodyStats): OpenApiSchema {
	if (stats.schema) return toOpenApiSchema(stats.schema);
	if (isJsonMimeType(stats.mimeType)) return {};
	if (isTextualMimeType(stats.mimeType)) return { type: "string" };
	return { type: "string", format: "binary" };
}

interface BuildContext {
	schemas: Record<string, OpenApiSchema>;
	schemaNames: Set<string>;
}

function buildContent(
	bodies: Map<string, BodyStats>,
	baseName: string,
	context: BuildContext
): Record<string, unknown> {
	const content: Record<string, unknown> = {};
	const multiple = bodies.size > 1;
	for (const stats of bodies.values()) {
		const schema = bodySchema(stats);
		if (isComplexSchema(schema)) {
			const suffix = multiple ? toPascalCase(stats.mimeType.split("/").pop() ?? "") : "";
			const name = uniqueName(`${baseName}${suffix}`, context.schemaNames);
			context.schemas[name] = schema;
			content[stats.mimeType] = { schema: { $ref: `#/components/schemas/${name}` } };
		} else {
			content[stats.mimeType] = { schema };
		}
	}
	return content;
}

function resourceTag(path: string): string | undefined {
	return path
		.split("/")
		.find(
			(segment) =>
				segment &&
				!segment.startsWith("{") &&
				!VERSION_SEGMENT.test(segment) &&
				segment.toLowerCase() !== "api"
		);
}

function buildOperation(
	endpoint: ApiEndpoint,
	operationId: string,
	multipleOrigins: boolean,
	redact: boolean,
	context: BuildContext,
	securitySchemes: Record<string, Record<string, unknown>>
): Operation {
	const avg = Math.round(endpoint.avgResponseTime);
	const tags = multipleOrigins ? endpoint.hosts : [resourceTag(endpoint.path)].filter(Boolean);
	const operation: Operation = {
		summary: `${endpoint.method} ${endpoint.path}`,
		description: `Observed ${endpoint.totalCalls} call${endpoint.totalCalls === 1 ? "" : "s"} (average response time ${avg} ms).`,
		operationId,
		...(tags.length > 0 ? { tags } : {}),
	};

	const parameters = buildParameters(endpoint, redact);
	if (parameters.length > 0) operation.parameters = parameters;

	const schemaBase = toPascalCase(operationId);
	const method = endpoint.method;
	if (endpoint.requestBodies.size > 0 && method !== "GET" && method !== "HEAD") {
		operation.requestBody = {
			required: endpoint.requestsWithBody >= endpoint.totalCalls,
			content: buildContent(endpoint.requestBodies, `${schemaBase}Request`, context),
		};
	}

	const responses: Record<string, unknown> = {};
	const captured = [...endpoint.responses.values()]
		.filter((response) => isValidHttpStatus(response.status))
		.sort((a, b) => a.status - b.status);
	for (const response of captured) {
		const result: Record<string, unknown> = {
			description: getStatusDescription(response.status, response.statusText),
		};
		if (response.bodies.size > 0) {
			result.content = buildContent(
				response.bodies,
				`${schemaBase}Response${response.status}`,
				context
			);
		}
		responses[String(response.status)] = result;
	}
	if (captured.length === 0) {
		responses.default = {
			description: "No response was captured (the request failed or was blocked).",
		};
	}
	operation.responses = responses;

	const usages = [...endpoint.security.values()];
	if (usages.length > 0) {
		for (const usage of usages) securitySchemes[usage.id] ??= usage.scheme;
		const alwaysUsed = usages.every((usage) => usage.count >= endpoint.totalCalls);
		operation.security = alwaysUsed
			? [Object.fromEntries(usages.map((usage) => [usage.id, []]))]
			: [...usages.map((usage) => ({ [usage.id]: [] })), {}];
	}

	return operation;
}

/** Builds an OpenAPI 3.0.3 document describing the given HAR entries. */
export function buildOpenApiDocument(
	entries: HAREntry[],
	{ title, description, redact = true }: OpenApiOptions = {}
): OpenApiDocument {
	const endpoints = analyzeEndpoints(entries.filter(isDocumentableEntry), {
		dedupe: true,
		mergeOrigins: true,
	});

	const allOrigins = [
		...new Set(endpoints.flatMap((endpoint) => endpoint.origins).filter(Boolean)),
	].sort();
	const allHosts = [...new Set(endpoints.flatMap((endpoint) => endpoint.hosts))];
	const multipleOrigins = allOrigins.length > 1;

	const context: BuildContext = { schemas: {}, schemaNames: new Set() };
	const securitySchemes: Record<string, Record<string, unknown>> = {};
	const operationIds = new Set<string>();
	const paths: Record<string, PathItem> = {};

	for (const endpoint of endpoints) {
		const method = endpoint.method.toLowerCase();
		const pathItem = (paths[endpoint.path] ??= {});
		const operationId = uniqueName(buildOperationId(method, endpoint.path), operationIds);
		pathItem[method] = buildOperation(
			endpoint,
			operationId,
			multipleOrigins,
			redact,
			context,
			securitySchemes
		);

		if (multipleOrigins) {
			const origins = endpoint.origins.filter(Boolean);
			const existing = (pathItem.servers as Array<{ url: string }> | undefined) ?? [];
			const merged = [...new Set([...existing.map((server) => server.url), ...origins])].sort();
			if (merged.length > 0 && merged.length < allOrigins.length) {
				pathItem.servers = merged.map((url) => ({ url }));
			} else {
				delete pathItem.servers;
			}
		}
	}

	const components: NonNullable<OpenApiDocument["components"]> = {};
	if (Object.keys(context.schemas).length > 0) components.schemas = context.schemas;
	if (Object.keys(securitySchemes).length > 0) components.securitySchemes = securitySchemes;

	const callCount = endpoints.reduce((sum, endpoint) => sum + endpoint.totalCalls, 0);
	return {
		openapi: OPENAPI_VERSION,
		info: {
			title: title ?? (allHosts.length === 1 ? `${allHosts[0]} API` : "API Documentation"),
			version: "1.0.0",
			description:
				description ??
				`Generated by HAR Explorer from ${callCount} captured request${callCount === 1 ? "" : "s"}.`,
		},
		...(allOrigins.length > 0 ? { servers: allOrigins.map((url) => ({ url })) } : {}),
		paths,
		...(Object.keys(components).length > 0 ? { components } : {}),
	};
}

export interface OpenApiStats {
	paths: number;
	operations: number;
	schemas: number;
	servers: number;
	securitySchemes: number;
}

export function getOpenApiStats(document: OpenApiDocument): OpenApiStats {
	const pathItems = Object.values(document.paths);
	return {
		paths: pathItems.length,
		operations: pathItems.reduce(
			(sum, item) => sum + Object.keys(item).filter((key) => OPERATION_METHODS.has(key)).length,
			0
		),
		schemas: Object.keys(document.components?.schemas ?? {}).length,
		servers: document.servers?.length ?? 0,
		securitySchemes: Object.keys(document.components?.securitySchemes ?? {}).length,
	};
}
