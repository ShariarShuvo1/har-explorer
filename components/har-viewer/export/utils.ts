import { HAREntry } from "@/lib/stores/har-store";
import { UniqueEndpoint, ExportOptions, GroupByOption } from "./types";

export function normalizeEndpointPattern(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathParts = urlObj.pathname.split("/").filter(Boolean);

		const normalizedParts = pathParts.map((part) => {
			if (
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					part
				)
			) {
				return "{uuid}";
			}
			if (/^[a-f0-9]{24}$/i.test(part)) {
				return "{objectId}";
			}
			if (/^\d+$/.test(part)) {
				return "{id}";
			}
			if (/\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|tiff)$/i.test(part)) {
				return "{image}";
			}
			if (/\.(pdf|doc|docx|xls|xlsx|csv|txt)$/i.test(part)) {
				return "{document}";
			}
			if (/\.(mp4|webm|ogg|mp3|wav|avi|mov)$/i.test(part)) {
				return "{media}";
			}
			if (/\.(js|css|woff|woff2|ttf|eot)$/i.test(part)) {
				return "{asset}";
			}
			if (part.length > 32 && /^[a-zA-Z0-9_-]+$/.test(part)) {
				return "{token}";
			}
			return part;
		});

		return `${urlObj.origin}/${normalizedParts.join("/")}`;
	} catch {
		return url;
	}
}

export function extractDomain(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "unknown";
	}
}

export function extractPath(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
}

function getValueType(value: unknown): string {
	if (Array.isArray(value)) return "array";
	if (value === null) return "null";
	if (typeof value === "boolean") return "boolean";
	if (typeof value === "number") {
		return Number.isInteger(value) ? "integer" : "number";
	}
	if (typeof value === "string") {
		if (value === "") return "string";
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return "datetime";
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
		if (/^https?:\/\//.test(value)) return "url";
		if (/^[a-f0-9]{24}$/i.test(value)) return "objectId";
		if (
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				value
			)
		)
			return "uuid";
		if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value))
			return "email";
		return "string";
	}
	return typeof value;
}

function deepMergeSchemas(
	schema1: Record<string, unknown> | null,
	schema2: Record<string, unknown> | null
): Record<string, unknown> | null {
	if (!schema1) return schema2;
	if (!schema2) return schema1;

	const merged: Record<string, unknown> = { ...schema1 };

	for (const [key, value] of Object.entries(schema2)) {
		if (!(key in merged)) {
			merged[key] = value;
		} else if (
			key === "properties" &&
			typeof value === "object" &&
			value !== null
		) {
			const mergedProps = { ...(merged[key] as Record<string, unknown>) };
			for (const [propKey, propValue] of Object.entries(
				value as Record<string, unknown>
			)) {
				if (!(propKey in mergedProps)) {
					mergedProps[propKey] = propValue;
				} else {
					mergedProps[propKey] = deepMergeSchemas(
						mergedProps[propKey] as Record<string, unknown>,
						propValue as Record<string, unknown>
					);
				}
			}
			merged[key] = mergedProps;
		} else if (
			key === "items" &&
			typeof value === "object" &&
			value !== null
		) {
			merged[key] = deepMergeSchemas(
				merged[key] as Record<string, unknown>,
				value as Record<string, unknown>
			);
		} else if (key === "type") {
			const existingTypes = String(merged[key]).split("|");
			const newTypes = String(value).split("|");
			const uniqueTypes = Array.from(
				new Set([...existingTypes, ...newTypes])
			);
			const sortedTypes = uniqueTypes.sort((a, b) => {
				const order = [
					"null",
					"boolean",
					"integer",
					"number",
					"string",
					"array",
					"object",
				];
				const aIndex = order.indexOf(a);
				const bIndex = order.indexOf(b);
				if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
				if (aIndex === -1) return 1;
				if (bIndex === -1) return -1;
				return aIndex - bIndex;
			});
			merged[key] = sortedTypes.join("|");
		}
	}

	return merged;
}

function extractSchema(
	text: string | undefined
): Record<string, unknown> | null {
	if (!text) return null;

	try {
		const parsed = JSON.parse(text);
		return buildSchemaFromValue(parsed);
	} catch {
		return null;
	}
}

function buildSchemaFromValue(value: unknown): Record<string, unknown> {
	if (Array.isArray(value)) {
		if (value.length === 0) return { type: "array", items: {} };

		const itemSchemas = value.map(buildSchemaFromValue);
		const mergedItemSchema = itemSchemas.reduce<Record<
			string,
			unknown
		> | null>((acc, schema) => deepMergeSchemas(acc, schema), null);
		return { type: "array", items: mergedItemSchema || {} };
	}

	if (value !== null && typeof value === "object") {
		const properties: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			properties[key] = buildSchemaFromValue(val);
		}
		return { type: "object", properties };
	}

	return { type: getValueType(value) };
}

export function deduplicateAndAnalyzeEndpoints(
	entries: HAREntry[]
): UniqueEndpoint[] {
	const endpointMap = new Map<string, UniqueEndpoint>();

	for (const entry of entries) {
		const pattern = normalizeEndpointPattern(entry.request.url);
		const key = `${entry.request.method}:${pattern}`;

		if (!endpointMap.has(key)) {
			const urlObj = new URL(entry.request.url);
			endpointMap.set(key, {
				pattern,
				method: entry.request.method,
				domain: urlObj.hostname,
				path: urlObj.pathname,
				entries: [],
				requestSchema: null,
				responseSchema: null,
				queryParams: new Map(),
				requestHeaders: new Map(),
				responseHeaders: new Map(),
				statusCodes: new Set(),
				avgResponseTime: 0,
				totalCalls: 0,
			});
		}

		const endpoint = endpointMap.get(key)!;
		endpoint.entries.push(entry);
		endpoint.totalCalls++;
		endpoint.statusCodes.add(entry.response.status);

		entry.request.queryString.forEach((param) => {
			if (!endpoint.queryParams.has(param.name)) {
				endpoint.queryParams.set(param.name, new Set());
			}
			if (param.value) {
				endpoint.queryParams.get(param.name)!.add(param.value);
			}
		});

		entry.request.headers.forEach((header) => {
			const headerName = header.name.toLowerCase();
			if (!endpoint.requestHeaders.has(headerName)) {
				endpoint.requestHeaders.set(headerName, new Set());
			}
			endpoint.requestHeaders.get(headerName)!.add(header.value);
		});

		entry.response.headers.forEach((header) => {
			const headerName = header.name.toLowerCase();
			if (!endpoint.responseHeaders.has(headerName)) {
				endpoint.responseHeaders.set(headerName, new Set());
			}
			endpoint.responseHeaders.get(headerName)!.add(header.value);
		});

		if (entry.request.postData?.text) {
			const requestSchema = extractSchema(entry.request.postData.text);
			endpoint.requestSchema = deepMergeSchemas(
				endpoint.requestSchema,
				requestSchema
			);
		}

		if (
			entry.response.content.text &&
			entry.response.content.mimeType.includes("json")
		) {
			const responseSchema = extractSchema(entry.response.content.text);
			endpoint.responseSchema = deepMergeSchemas(
				endpoint.responseSchema,
				responseSchema
			);
		}
	}

	for (const endpoint of endpointMap.values()) {
		const totalTime = endpoint.entries.reduce((sum, e) => sum + e.time, 0);
		endpoint.avgResponseTime = totalTime / endpoint.entries.length;
	}

	return Array.from(endpointMap.values()).sort((a, b) => {
		if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
		return a.path.localeCompare(b.path);
	});
}

function schemaToString(schema: Record<string, unknown>, indent = 0): string {
	const spaces = "  ".repeat(indent);
	let result = "";

	if (schema.type === "array" && schema.items) {
		result += `${spaces}[\n`;
		result += schemaToString(
			schema.items as Record<string, unknown>,
			indent + 1
		);
		result += `${spaces}]\n`;
	} else if (schema.type === "object" && schema.properties) {
		result += `${spaces}{\n`;
		const props = schema.properties as Record<
			string,
			Record<string, unknown>
		>;
		for (const [key, value] of Object.entries(props)) {
			if (value.type === "object" || value.type === "array") {
				result += `${spaces}  "${key}": `;
				if (value.type === "array") {
					result += `\n`;
				} else {
					result += `\n`;
				}
				result += schemaToString(value, indent + 1);
			} else {
				result += `${spaces}  "${key}": ${value.type}\n`;
			}
		}
		result += `${spaces}}\n`;
	} else if (schema.type) {
		result += `${spaces}${schema.type}\n`;
	}

	return result;
}

function schemaToMarkdown(schema: Record<string, unknown>, indent = 0): string {
	const spaces = "  ".repeat(indent);
	let result = "";

	if (schema.type === "array" && schema.items) {
		const items = schema.items as Record<string, unknown>;
		result += `${spaces}- **array** of:\n`;
		result += schemaToMarkdown(items, indent + 1);
	} else if (schema.type === "object" && schema.properties) {
		const props = schema.properties as Record<
			string,
			Record<string, unknown>
		>;
		for (const [key, value] of Object.entries(props)) {
			if (value.type === "object" || value.type === "array") {
				result += `${spaces}- \`${key}\`: **${value.type}**\n`;
				result += schemaToMarkdown(value, indent + 1);
			} else {
				result += `${spaces}- \`${key}\`: **${value.type}**\n`;
			}
		}
	}

	return result;
}

export function generateMarkdown(
	endpoints: UniqueEndpoint[],
	options: ExportOptions
): string {
	let md = `# API Documentation\n\n`;
	md += `> Generated on ${new Date().toLocaleString()}\n\n`;
	md += `---\n\n`;

	md += `## Summary\n\n`;
	md += `- **Total Unique Endpoints**: ${endpoints.length}\n`;
	md += `- **Total API Calls**: ${endpoints.reduce(
		(sum, e) => sum + e.totalCalls,
		0
	)}\n`;
	const domains = new Set(endpoints.map((e) => e.domain));
	md += `- **Domains**: ${domains.size}\n\n`;

	const grouped = groupEndpoints(endpoints, options.groupBy);

	for (const [groupName, groupEndpoints] of Object.entries(grouped)) {
		if (options.groupBy !== "none") {
			md += `## ${groupName}\n\n`;
		}

		for (const endpoint of groupEndpoints) {
			md += `### ${endpoint.method} ${endpoint.path}\n\n`;
			md += `**Base URL**: \`${endpoint.domain}\`\n\n`;
			md += `**Calls**: ${
				endpoint.totalCalls
			} | **Status Codes**: ${Array.from(endpoint.statusCodes).join(
				", "
			)}\n\n`;

			if (options.includePerformanceMetrics) {
				md += `**Avg Response Time**: ${endpoint.avgResponseTime.toFixed(
					2
				)}ms\n\n`;
			}

			if (options.includeQueryParams && endpoint.queryParams.size > 0) {
				md += `#### Query Parameters\n\n`;
				md += `| Parameter | Example Values |\n`;
				md += `|-----------|---------------|\n`;
				endpoint.queryParams.forEach((values, paramName) => {
					const exampleValues = Array.from(values)
						.slice(0, 3)
						.join(", ");
					const displayValues = exampleValues || "(no value)";
					md += `| \`${paramName}\` | \`${displayValues}\` |\n`;
				});
				md += `\n`;
			}

			if (options.includeHeaders) {
				const importantHeaders = [
					"content-type",
					"authorization",
					"accept",
					"x-api-key",
					"x-requested-with",
				];
				const relevantRequestHeaders = Array.from(
					endpoint.requestHeaders.entries()
				).filter(([name]) => importantHeaders.includes(name));

				if (relevantRequestHeaders.length > 0) {
					md += `#### Request Headers\n\n`;
					md += `| Header | Sample Value |\n`;
					md += `|--------|-------------|\n`;
					relevantRequestHeaders.forEach(([name, values]) => {
						const sampleValue = Array.from(values)[0] || "";
						const truncated =
							sampleValue.length > 50
								? sampleValue.slice(0, 47) + "..."
								: sampleValue;
						md += `| \`${name}\` | \`${truncated}\` |\n`;
					});
					md += `\n`;
				}
			}

			if (options.includeRequestBody && endpoint.requestSchema) {
				md += `#### Request Body Schema\n\n`;
				md += `\`\`\`\n`;
				md += schemaToMarkdown(endpoint.requestSchema);
				md += `\`\`\`\n\n`;
			}

			if (options.includeResponseSchema && endpoint.responseSchema) {
				md += `#### Response Schema\n\n`;
				md += schemaToMarkdown(endpoint.responseSchema);
				md += `\n`;
			}

			if (options.includeCurlExamples && endpoint.entries.length > 0) {
				const sampleEntry = endpoint.entries[0];
				md += `#### Example cURL\n\n`;
				md += `\`\`\`bash\n`;
				md += generateSimpleCurl(sampleEntry);
				md += `\n\`\`\`\n\n`;
			}

			md += `---\n\n`;
		}
	}

	return md;
}

export function generatePlainText(
	endpoints: UniqueEndpoint[],
	options: ExportOptions
): string {
	let txt = `API DOCUMENTATION\n`;
	txt += `${"=".repeat(50)}\n`;
	txt += `Generated: ${new Date().toLocaleString()}\n\n`;

	txt += `SUMMARY\n`;
	txt += `${"-".repeat(30)}\n`;
	txt += `Total Unique Endpoints: ${endpoints.length}\n`;
	txt += `Total API Calls: ${endpoints.reduce(
		(sum, e) => sum + e.totalCalls,
		0
	)}\n`;
	const domains = new Set(endpoints.map((e) => e.domain));
	txt += `Domains: ${domains.size}\n\n`;

	const grouped = groupEndpoints(endpoints, options.groupBy);

	for (const [groupName, groupEndpoints] of Object.entries(grouped)) {
		if (options.groupBy !== "none") {
			txt += `\n${"=".repeat(50)}\n`;
			txt += `${groupName.toUpperCase()}\n`;
			txt += `${"=".repeat(50)}\n\n`;
		}

		for (const endpoint of groupEndpoints) {
			txt += `${"-".repeat(40)}\n`;
			txt += `${endpoint.method} ${endpoint.path}\n`;
			txt += `${"-".repeat(40)}\n`;
			txt += `Base URL: ${endpoint.domain}\n`;
			txt += `Calls: ${endpoint.totalCalls}\n`;
			txt += `Status Codes: ${Array.from(endpoint.statusCodes).join(
				", "
			)}\n`;

			if (options.includePerformanceMetrics) {
				txt += `Avg Response Time: ${endpoint.avgResponseTime.toFixed(
					2
				)}ms\n`;
			}

			if (options.includeQueryParams && endpoint.queryParams.size > 0) {
				txt += `\nQuery Parameters:\n`;
				endpoint.queryParams.forEach((values, paramName) => {
					const exampleValues = Array.from(values)
						.slice(0, 3)
						.join(", ");
					const displayValues = exampleValues || "(no value)";
					txt += `  - ${paramName}: ${displayValues}\n`;
				});
			}

			if (options.includeHeaders) {
				const importantHeaders = [
					"content-type",
					"authorization",
					"accept",
					"x-api-key",
				];
				const relevantRequestHeaders = Array.from(
					endpoint.requestHeaders.entries()
				).filter(([name]) => importantHeaders.includes(name));

				if (relevantRequestHeaders.length > 0) {
					txt += `\nRequest Headers:\n`;
					relevantRequestHeaders.forEach(([name, values]) => {
						const sampleValue = Array.from(values)[0] || "";
						txt += `  ${name}: ${sampleValue.slice(0, 50)}${
							sampleValue.length > 50 ? "..." : ""
						}\n`;
					});
				}
			}

			if (options.includeRequestBody && endpoint.requestSchema) {
				txt += `\nRequest Body Schema:\n`;
				txt += schemaToString(endpoint.requestSchema, 1);
			}

			if (options.includeResponseSchema && endpoint.responseSchema) {
				txt += `\nResponse Schema:\n`;
				txt += schemaToString(endpoint.responseSchema, 1);
			}

			if (options.includeCurlExamples && endpoint.entries.length > 0) {
				const sampleEntry = endpoint.entries[0];
				txt += `\nExample cURL:\n`;
				txt += `  ${generateSimpleCurl(sampleEntry)}\n`;
			}

			txt += `\n`;
		}
	}

	return txt;
}

function groupEndpoints(
	endpoints: UniqueEndpoint[],
	groupBy: GroupByOption
): Record<string, UniqueEndpoint[]> {
	if (groupBy === "none") {
		return { "All Endpoints": endpoints };
	}

	const grouped: Record<string, UniqueEndpoint[]> = {};

	for (const endpoint of endpoints) {
		let key: string;
		switch (groupBy) {
			case "domain":
				key = endpoint.domain;
				break;
			case "method":
				key = endpoint.method;
				break;
			case "status":
				const primaryStatus = Array.from(endpoint.statusCodes)[0] || 0;
				key = `${Math.floor(primaryStatus / 100)}xx`;
				break;
			default:
				key = "Other";
		}

		if (!grouped[key]) {
			grouped[key] = [];
		}
		grouped[key].push(endpoint);
	}

	return grouped;
}

function generateSimpleCurl(entry: HAREntry): string {
	let curl = `curl -X ${entry.request.method} '${entry.request.url}'`;

	const importantHeaders = ["content-type", "authorization", "accept"];
	entry.request.headers
		.filter((h) => importantHeaders.includes(h.name.toLowerCase()))
		.forEach((header) => {
			curl += ` -H '${header.name}: ${header.value}'`;
		});

	if (entry.request.postData?.text) {
		const body = entry.request.postData.text.slice(0, 100);
		curl += ` -d '${body}${
			entry.request.postData.text.length > 100 ? "..." : ""
		}'`;
	}

	return curl;
}
export function generateHAR(entries: HAREntry[]): string {
	const harData = {
		log: {
			version: "1.2",
			creator: {
				name: "HAR Explorer",
				version: "1.0.0",
			},
			entries: entries,
		},
	};

	return JSON.stringify(harData, null, 2);
}

export function generateHARPreviewStats(entries: HAREntry[]): {
	totalSize: string;
	entryCount: number;
	domains: string[];
	methods: string[];
} {
	const harContent = generateHAR(entries);
	const sizeInBytes = new Blob([harContent]).size;

	const domains = new Set<string>();
	const methods = new Set<string>();

	entries.forEach((entry) => {
		try {
			const url = new URL(entry.request.url);
			domains.add(url.hostname);
			methods.add(entry.request.method);
		} catch {
			// Ignore invalid URLs
		}
	});

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return (
			Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
		);
	};

	return {
		totalSize: formatBytes(sizeInBytes),
		entryCount: entries.length,
		domains: Array.from(domains).sort(),
		methods: Array.from(methods).sort(),
	};
}

function convertSchemaToOpenAPI(
	schema: Record<string, unknown> | null
): Record<string, unknown> | null {
	if (!schema) return null;

	const openApiSchema: Record<string, unknown> = {};

	if (schema.type === "array" && schema.items) {
		openApiSchema.type = "array";
		openApiSchema.items = convertSchemaToOpenAPI(
			schema.items as Record<string, unknown>
		);
	} else if (schema.type === "object" && schema.properties) {
		openApiSchema.type = "object";
		const properties: Record<string, unknown> = {};
		const props = schema.properties as Record<
			string,
			Record<string, unknown>
		>;

		for (const [key, value] of Object.entries(props)) {
			properties[key] = convertSchemaToOpenAPI(value) || {
				type: "string",
			};
		}
		openApiSchema.properties = properties;
	} else if (schema.type) {
		const typeStr = String(schema.type);
		if (typeStr.includes("|")) {
			const types = typeStr.split("|").map((t) => t.trim());
			const nonNullTypes = types.filter((t) => t !== "null");

			if (nonNullTypes.length === 1) {
				openApiSchema.type = nonNullTypes[0];
				if (types.includes("null")) {
					openApiSchema.nullable = true;
				}
			} else {
				openApiSchema.anyOf = nonNullTypes.map((t) => ({ type: t }));
				if (types.includes("null")) {
					openApiSchema.nullable = true;
				}
			}
		} else if (typeStr === "datetime" || typeStr === "date") {
			openApiSchema.type = "string";
			openApiSchema.format =
				typeStr === "datetime" ? "date-time" : "date";
		} else if (typeStr === "email") {
			openApiSchema.type = "string";
			openApiSchema.format = "email";
		} else if (typeStr === "url") {
			openApiSchema.type = "string";
			openApiSchema.format = "uri";
		} else if (typeStr === "uuid") {
			openApiSchema.type = "string";
			openApiSchema.format = "uuid";
		} else if (typeStr === "objectId") {
			openApiSchema.type = "string";
			openApiSchema.pattern = "^[a-f0-9]{24}$";
		} else {
			openApiSchema.type = typeStr;
		}
	}

	return openApiSchema;
}

export function generateOpenAPI(endpoints: UniqueEndpoint[]): string {
	const paths: Record<string, Record<string, unknown>> = {};
	const schemas: Record<string, unknown> = {};
	const servers = new Set<string>();

	for (const endpoint of endpoints) {
		try {
			const urlObj = new URL(endpoint.pattern);
			const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
			servers.add(baseUrl);

			const path = urlObj.pathname || "/";
			const method = endpoint.method.toLowerCase();

			if (!paths[path]) {
				paths[path] = {};
			}

			const operation: Record<string, unknown> = {
				summary: `${endpoint.method} ${path}`,
				description: `API endpoint called ${
					endpoint.totalCalls
				} time(s) with average response time of ${endpoint.avgResponseTime.toFixed(
					2
				)}ms`,
				operationId: `${method}${path.replace(/[^a-zA-Z0-9]/g, "")}`,
				tags: [endpoint.domain],
			};

			const parameters: Array<Record<string, unknown>> = [];

			if (endpoint.queryParams.size > 0) {
				endpoint.queryParams.forEach((values, paramName) => {
					const schema: Record<string, unknown> = { type: "string" };

					if (values.size > 0) {
						const exampleValue = Array.from(values)[0];
						schema.default = exampleValue;
						schema.example = exampleValue;
					}

					const paramDef: Record<string, unknown> = {
						name: paramName,
						in: "query",
						required: false,
						schema,
					};

					if (values.size > 0) {
						const exampleValue = Array.from(values)[0];
						paramDef.example = exampleValue;
						if (values.size > 1) {
							paramDef.examples = Array.from(values)
								.slice(0, 3)
								.map((val, idx) => ({
									[`example${idx + 1}`]: { value: val },
								}))
								.reduce(
									(acc, curr) => ({ ...acc, ...curr }),
									{}
								);
						}
					}

					parameters.push(paramDef);
				});
			}

			const pathParams = path.match(/\{[^}]+\}/g);
			if (pathParams) {
				pathParams.forEach((param) => {
					const paramName = param.slice(1, -1);
					let paramType = "string";

					if (paramName === "id" || paramName === "objectId") {
						paramType = "string";
					} else if (paramName === "uuid") {
						paramType = "string";
					}

					parameters.push({
						name: paramName,
						in: "path",
						required: true,
						schema: { type: paramType },
					});
				});
			}

			if (parameters.length > 0) {
				operation.parameters = parameters;
			}

			if (
				endpoint.requestSchema &&
				["POST", "PUT", "PATCH"].includes(endpoint.method)
			) {
				const schemaName = `${endpoint.method}${path.replace(
					/[^a-zA-Z0-9]/g,
					""
				)}Request`;
				const convertedSchema = convertSchemaToOpenAPI(
					endpoint.requestSchema
				);

				if (convertedSchema) {
					schemas[schemaName] = convertedSchema;

					operation.requestBody = {
						required: true,
						content: {
							"application/json": {
								schema: {
									$ref: `#/components/schemas/${schemaName}`,
								},
							},
						},
					};
				}
			}

			const responses: Record<string, unknown> = {};

			endpoint.statusCodes.forEach((status) => {
				const statusStr = String(status);
				const description =
					status >= 200 && status < 300
						? "Successful response"
						: status >= 400 && status < 500
						? "Client error"
						: status >= 500
						? "Server error"
						: "Response";

				if (endpoint.responseSchema && status >= 200 && status < 300) {
					const schemaName = `${endpoint.method}${path.replace(
						/[^a-zA-Z0-9]/g,
						""
					)}Response`;
					const convertedSchema = convertSchemaToOpenAPI(
						endpoint.responseSchema
					);

					if (convertedSchema) {
						schemas[schemaName] = convertedSchema;

						responses[statusStr] = {
							description,
							content: {
								"application/json": {
									schema: {
										$ref: `#/components/schemas/${schemaName}`,
									},
								},
							},
						};
					} else {
						responses[statusStr] = { description };
					}
				} else {
					responses[statusStr] = { description };
				}
			});

			operation.responses = responses;
			paths[path][method] = operation;
		} catch (error) {
			console.error("Error processing endpoint:", endpoint, error);
		}
	}

	const openApiSpec = {
		openapi: "3.0.3",
		info: {
			title: "API Documentation",
			description: "Generated from HAR file analysis",
			version: "1.0.0",
			contact: {
				name: "HAR Explorer",
			},
		},
		servers: Array.from(servers).map((url) => ({ url })),
		paths,
		components: {
			schemas,
		},
	};

	return JSON.stringify(openApiSpec, null, 2);
}

export function generateOpenAPIPreviewStats(endpoints: UniqueEndpoint[]): {
	totalSize: string;
	endpointCount: number;
	operations: number;
	schemas: number;
	servers: number;
} {
	const openApiContent = generateOpenAPI(endpoints);
	const sizeInBytes = new Blob([openApiContent]).size;

	const servers = new Set<string>();
	let schemasCount = 0;

	endpoints.forEach((endpoint) => {
		try {
			const urlObj = new URL(endpoint.pattern);
			servers.add(`${urlObj.protocol}//${urlObj.host}`);

			if (endpoint.requestSchema) schemasCount++;
			if (endpoint.responseSchema) schemasCount++;
		} catch {
			// Ignore invalid URLs
		}
	});

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return (
			Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
		);
	};

	return {
		totalSize: formatBytes(sizeInBytes),
		endpointCount: endpoints.length,
		operations: endpoints.length,
		schemas: schemasCount,
		servers: servers.size,
	};
}
