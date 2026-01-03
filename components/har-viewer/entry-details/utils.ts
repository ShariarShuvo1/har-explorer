import { HAREntry } from "@/lib/stores/har-store";
import { SecurityIssue, CacheInfo, PerformanceMetrics } from "./types";
import { STATUS_COLORS } from "./constants";

export function getStatusColor(status: number): string {
	const category = Math.floor(status / 100);
	return STATUS_COLORS[`${category}xx`]?.text || "text-foreground";
}

export function getStatusBgColor(status: number): string {
	const category = Math.floor(status / 100);
	return STATUS_COLORS[`${category}xx`]?.bg || "bg-card/40";
}

export function getStatusBorderColor(status: number): string {
	const category = Math.floor(status / 100);
	return STATUS_COLORS[`${category}xx`]?.border || "border-border/30";
}

export function sanitizeBase64(base64: string): string {
	return base64.replace(/[\r\n\s]/g, "");
}

export function formatResponseContent(text: string, mimeType: string): string {
	if (!text) return "";
	if (mimeType.includes("json")) {
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}
	return text;
}

export function analyzeSecurityHeaders(
	headers: Array<{ name: string; value: string }>
): SecurityIssue[] {
	const issues: SecurityIssue[] = [];
	const headerMap = new Map(
		headers.map((h) => [h.name.toLowerCase(), h.value])
	);

	if (!headerMap.has("strict-transport-security")) {
		issues.push({
			severity: "high",
			category: "HSTS",
			message: "Missing Strict-Transport-Security header",
			recommendation:
				"Add HSTS header to force HTTPS connections: Strict-Transport-Security: max-age=31536000; includeSubDomains",
		});
	}

	if (!headerMap.has("content-security-policy")) {
		issues.push({
			severity: "high",
			category: "CSP",
			message: "Missing Content-Security-Policy header",
			recommendation:
				"Add CSP header to prevent XSS attacks and other code injection",
		});
	}

	if (!headerMap.has("x-frame-options")) {
		issues.push({
			severity: "medium",
			category: "Clickjacking",
			message: "Missing X-Frame-Options header",
			recommendation:
				"Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking",
		});
	}

	if (!headerMap.has("x-content-type-options")) {
		issues.push({
			severity: "medium",
			category: "MIME Sniffing",
			message: "Missing X-Content-Type-Options header",
			recommendation:
				"Add X-Content-Type-Options: nosniff to prevent MIME type sniffing",
		});
	}

	const xssProtection = headerMap.get("x-xss-protection");
	if (!xssProtection || xssProtection === "0") {
		issues.push({
			severity: "low",
			category: "XSS Protection",
			message: "XSS Protection is disabled or missing",
			recommendation: "Add X-XSS-Protection: 1; mode=block",
		});
	}

	if (!headerMap.has("referrer-policy")) {
		issues.push({
			severity: "low",
			category: "Privacy",
			message: "Missing Referrer-Policy header",
			recommendation:
				"Add Referrer-Policy header to control referrer information",
		});
	}

	if (!headerMap.has("permissions-policy")) {
		issues.push({
			severity: "info",
			category: "Permissions",
			message: "Missing Permissions-Policy header",
			recommendation:
				"Consider adding Permissions-Policy to control browser features",
		});
	}

	return issues;
}

export function analyzeCacheHeaders(
	headers: Array<{ name: string; value: string }>
): CacheInfo {
	const headerMap = new Map(
		headers.map((h) => [h.name.toLowerCase(), h.value])
	);

	const cacheControl = headerMap.get("cache-control");
	const expires = headerMap.get("expires");
	const etag = headerMap.get("etag");
	const lastModified = headerMap.get("last-modified");
	const age = headerMap.get("age");

	let maxAge: number | undefined;
	let isStale = false;

	if (cacheControl) {
		const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
		if (maxAgeMatch) {
			maxAge = parseInt(maxAgeMatch[1]);
			if (age) {
				const ageNum = parseInt(age);
				isStale = ageNum >= maxAge;
			}
		}
	}

	const isCached =
		!!cacheControl || !!expires || !!etag || !!lastModified || !!age;

	return {
		isCached,
		cacheControl,
		expires,
		etag,
		lastModified,
		age,
		maxAge,
		isStale,
	};
}

export function calculatePerformanceMetrics(
	entry: HAREntry
): PerformanceMetrics {
	const timings = entry.timings;
	const totalTime = entry.time;

	const dnsLookup = Math.max(0, timings.dns);
	const tcpConnection = Math.max(0, timings.connect - (timings.ssl || 0));
	const tlsHandshake = Math.max(0, timings.ssl || 0);
	const requestSent = Math.max(0, timings.send);
	const serverProcessing = Math.max(0, timings.wait);
	const contentDownload = Math.max(0, timings.receive);

	const ttfb =
		dnsLookup +
		tcpConnection +
		tlsHandshake +
		requestSent +
		serverProcessing;
	const downloadTime = contentDownload;

	const efficiency = totalTime > 0 ? (contentDownload / totalTime) * 100 : 0;

	return {
		totalTime,
		ttfb,
		downloadTime,
		dnsLookup,
		tcpConnection,
		tlsHandshake,
		requestSent,
		contentDownload,
		serverProcessing,
		efficiency,
	};
}

export function generateCurl(entry: HAREntry): string {
	const lines: string[] = [];
	lines.push(`curl '${entry.request.url}'`);

	lines.push(`  -X ${entry.request.method}`);

	entry.request.headers.forEach((header) => {
		if (
			![
				"host",
				"content-length",
				"connection",
				"accept-encoding",
			].includes(header.name.toLowerCase())
		) {
			lines.push(`  -H '${header.name}: ${header.value}'`);
		}
	});

	if (entry.request.postData && entry.request.postData.text) {
		const data = entry.request.postData.text.replace(/'/g, "'\\''");
		lines.push(`  --data-raw '${data}'`);
	}

	lines.push("  --compressed");

	return lines.join(" \\\n");
}

export function generateFetch(entry: HAREntry): string {
	const url = entry.request.url;
	const method = entry.request.method;
	const headers: Record<string, string> = {};

	entry.request.headers.forEach((header) => {
		headers[header.name] = header.value;
	});

	const options: Record<string, unknown> = {
		method,
		headers,
	};

	if (entry.request.postData && entry.request.postData.text) {
		options.body = entry.request.postData.text;
	}

	return `fetch("${url}", ${JSON.stringify(options, null, 2)})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`;
}

export function generatePowershell(entry: HAREntry): string {
	const lines: string[] = [];
	lines.push(`Invoke-RestMethod -Uri '${entry.request.url}'`);
	lines.push(`  -Method ${entry.request.method}`);

	const headers: Record<string, string> = {};
	entry.request.headers.forEach((header) => {
		headers[header.name] = header.value;
	});

	lines.push(`  -Headers @{`);
	Object.entries(headers).forEach(([key, value]) => {
		lines.push(`    '${key}' = '${value}'`);
	});
	lines.push(`  }`);

	if (entry.request.postData && entry.request.postData.text) {
		lines.push(`  -Body '${entry.request.postData.text}'`);
	}

	return lines.join("\n");
}

export function generateApiDocumentation(entry: HAREntry): string {
	const url = new URL(entry.request.url);
	const method = entry.request.method;
	const status = entry.response.status;
	const contentType = entry.response.content.mimeType;
	const isJson = contentType.includes("json");
	const isHtml = contentType.includes("html");
	const pathname = url.pathname;
	const endpoint = pathname.split("/").filter(Boolean).pop() || "root";

	let md = `# API Documentation: ${method} ${endpoint}\n\n`;
	md += `> Generated from HAR file analysis\n\n`;
	md += `---\n\n`;

	md += `## Overview\n\n`;
	md += `- **Endpoint**: \`${pathname}\`\n`;
	md += `- **Method**: \`${method}\`\n`;
	md += `- **Base URL**: \`${url.origin}\`\n`;
	md += `- **Full URL**: \`${entry.request.url}\`\n\n`;

	if (url.search) {
		md += `## Query Parameters\n\n`;
		md += `| Parameter | Value |\n`;
		md += `|-----------|-------|\n`;
		entry.request.queryString.forEach((param) => {
			md += `| \`${param.name}\` | \`${param.value}\` |\n`;
		});
		md += `\n`;
	}

	md += `## Request\n\n`;
	md += `### Headers\n\n`;
	md += `| Header | Value |\n`;
	md += `|--------|-------|\n`;
	entry.request.headers.forEach((header) => {
		md += `| \`${header.name}\` | \`${header.value}\` |\n`;
	});
	md += `\n`;

	if (entry.request.postData && entry.request.postData.text) {
		md += `### Request Body\n\n`;
		md += `**Content-Type**: \`${entry.request.postData.mimeType}\`\n\n`;

		if (entry.request.postData.mimeType.includes("json")) {
			try {
				const parsed = JSON.parse(entry.request.postData.text);
				md += `**Body Schema**:\n\n`;
				md += analyzeJsonStructure(parsed);
			} catch {
				md += `\`\`\`\n${entry.request.postData.text}\n\`\`\`\n\n`;
			}
		} else {
			md += `\`\`\`\n${entry.request.postData.text}\n\`\`\`\n\n`;
		}
	}

	md += `## Response\n\n`;
	md += `### Status\n\n`;
	md += `- **Code**: \`${status}\`\n`;
	md += `- **Text**: \`${entry.response.statusText}\`\n`;
	md += `- **Category**: ${getStatusDescription(status)}\n\n`;

	md += `### Response Headers\n\n`;
	md += `| Header | Value |\n`;
	md += `|--------|-------|\n`;
	entry.response.headers.forEach((header) => {
		md += `| \`${header.name}\` | \`${header.value}\` |\n`;
	});
	md += `\n`;

	md += `### Content Type\n\n`;
	if (isJson) {
		md += `**Type**: JSON (REST API)\n\n`;
		md += `This endpoint returns JSON data, indicating it's a RESTful API endpoint.\n\n`;
	} else if (isHtml) {
		md += `**Type**: HTML\n\n`;
		md += `This endpoint returns HTML content, likely a web page.\n\n`;
	} else {
		md += `**Type**: \`${contentType}\`\n\n`;
	}

	if (entry.response.content.text && isJson) {
		md += `### Response Body\n\n`;
		try {
			const parsed = JSON.parse(entry.response.content.text);

			md += `### Response Schema\n\n`;
			md += `The response object structure:\n\n`;
			md += analyzeJsonStructure(parsed);
			md += `\n`;
		} catch {
			md += `\`\`\`\n${entry.response.content.text}\n\`\`\`\n\n`;
		}
	}

	md += `## Performance Metrics\n\n`;
	md += `| Metric | Value |\n`;
	md += `|--------|-------|\n`;
	md += `| Total Time | \`${entry.time.toFixed(2)}ms\` |\n`;
	md += `| DNS Lookup | \`${entry.timings.dns.toFixed(2)}ms\` |\n`;
	md += `| Connect | \`${entry.timings.connect.toFixed(2)}ms\` |\n`;
	md += `| Send | \`${entry.timings.send.toFixed(2)}ms\` |\n`;
	md += `| Wait | \`${entry.timings.wait.toFixed(2)}ms\` |\n`;
	md += `| Receive | \`${entry.timings.receive.toFixed(2)}ms\` |\n`;
	md += `| Response Size | \`${formatBytes(
		entry.response.content.size
	)}\` |\n\n`;

	md += `## Usage Examples\n\n`;
	md += `### cURL\n\n`;
	md += `\`\`\`bash\n${generateCurl(entry)}\n\`\`\`\n\n`;

	md += `### JavaScript (Fetch API)\n\n`;
	md += `\`\`\`javascript\n${generateFetch(entry)}\n\`\`\`\n\n`;

	md += `### PowerShell\n\n`;
	md += `\`\`\`powershell\n${generatePowershell(entry)}\n\`\`\`\n\n`;

	md += `---\n\n`;
	md += `*Documentation generated from HAR file - ${new Date(
		entry.startedDateTime
	).toLocaleString()}*\n`;

	return md;
}

function analyzeJsonStructure(obj: unknown, indent = 0): string {
	const spaces = "  ".repeat(indent);
	let md = "";

	if (Array.isArray(obj)) {
		if (obj.length > 0) {
			const firstItem = obj[0];
			const itemType = getValueType(firstItem);
			if (itemType === "object" && firstItem !== null) {
				md += `${spaces}- **array** of **object**:\n`;
				const mergedSchema = mergeArraySchemas(obj);
				md += analyzeJsonStructure(mergedSchema, indent + 1);
			} else {
				md += `${spaces}- **array** of **${itemType}**\n`;
			}
		} else {
			md += `${spaces}- **array** (empty)\n`;
		}
	} else if (obj !== null && typeof obj === "object") {
		const entries = Object.entries(obj);
		const sortedEntries = entries.sort(([a], [b]) => a.localeCompare(b));

		for (const [key, value] of sortedEntries) {
			const type = getValueType(value);

			if (type === "object" && value !== null) {
				const nestedKeys = Object.keys(value as object);
				if (nestedKeys.length === 0) {
					md += `${spaces}- \`${key}\`: **object** (empty)\n`;
				} else {
					md += `${spaces}- \`${key}\`: **object**\n`;
					md += analyzeJsonStructure(value, indent + 1);
				}
			} else if (type === "array") {
				if (Array.isArray(value) && value.length > 0) {
					const firstItem = value[0];
					const itemType = getValueType(firstItem);
					if (itemType === "object" && firstItem !== null) {
						md += `${spaces}- \`${key}\`: **array** of **object**\n`;
						const mergedSchema = mergeArraySchemas(value);
						md += analyzeJsonStructure(mergedSchema, indent + 1);
					} else {
						md += `${spaces}- \`${key}\`: **array** of **${itemType}**\n`;
					}
				} else {
					md += `${spaces}- \`${key}\`: **array** (empty)\n`;
				}
			} else {
				md += `${spaces}- \`${key}\`: **${type}**\n`;
			}
		}
	}

	return md;
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
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
			return "string (datetime)";
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "string (date)";
		if (/^https?:\/\//.test(value)) return "string (url)";
		if (/^[a-f0-9]{24}$/i.test(value)) return "string (objectId)";
		if (
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				value
			)
		)
			return "string (uuid)";
		if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value))
			return "string (email)";
		if (/^\+?[0-9\s-()]{7,}$/.test(value)) return "string (phone)";
		if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value))
			return "string (color)";
		if (/^(true|false)$/i.test(value)) return "string (boolean)";
		if (/^-?\d+\.?\d*$/.test(value) && value.length < 20)
			return "string (numeric)";
		if (/^\/.+\/[gimsuvy]*$/.test(value)) return "string (regex)";
		return "string";
	}
	return typeof value;
}

function mergeArraySchemas(arr: unknown[]): Record<string, unknown> {
	if (arr.length === 0) return {};

	const merged: Record<string, unknown> = {};
	const fieldTypes: Record<string, Set<string>> = {};

	for (const item of arr) {
		if (item !== null && typeof item === "object" && !Array.isArray(item)) {
			for (const [key, value] of Object.entries(item)) {
				if (!fieldTypes[key]) {
					fieldTypes[key] = new Set();
				}
				fieldTypes[key].add(getValueType(value));

				if (!merged[key]) {
					merged[key] = value;
				} else if (Array.isArray(value) && Array.isArray(merged[key])) {
					const existingArray = merged[key] as unknown[];
					const mergedArrayItems = [...existingArray, ...value];
					merged[key] = mergedArrayItems;
				} else if (
					typeof value === "object" &&
					value !== null &&
					typeof merged[key] === "object" &&
					merged[key] !== null &&
					!Array.isArray(value) &&
					!Array.isArray(merged[key])
				) {
					merged[key] = mergeObjects(
						merged[key] as Record<string, unknown>,
						value as Record<string, unknown>
					);
				}
			}
		}
	}

	return merged;
}

function mergeObjects(
	obj1: Record<string, unknown>,
	obj2: Record<string, unknown>
): Record<string, unknown> {
	const merged = { ...obj1 };

	for (const [key, value] of Object.entries(obj2)) {
		if (!merged[key]) {
			merged[key] = value;
		} else if (
			typeof value === "object" &&
			value !== null &&
			typeof merged[key] === "object" &&
			merged[key] !== null &&
			!Array.isArray(value) &&
			!Array.isArray(merged[key])
		) {
			merged[key] = mergeObjects(
				merged[key] as Record<string, unknown>,
				value as Record<string, unknown>
			);
		}
	}

	return merged;
}

function getStatusDescription(status: number): string {
	if (status >= 200 && status < 300) return "Success";
	if (status >= 300 && status < 400) return "Redirect";
	if (status >= 400 && status < 500) return "Client Error";
	if (status >= 500) return "Server Error";
	return "Informational";
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function generateApiDocumentationAsText(entry: HAREntry): string {
	const url = new URL(entry.request.url);
	const method = entry.request.method;
	const status = entry.response.status;
	const contentType = entry.response.content.mimeType;
	const isJson = contentType.includes("json");
	const isHtml = contentType.includes("html");
	const pathname = url.pathname;
	const endpoint = pathname.split("/").filter(Boolean).pop() || "root";

	let txt = `API DOCUMENTATION: ${method} ${endpoint}\n`;
	txt += `${"=".repeat(70)}\n\n`;
	txt += `Generated from HAR file analysis\n\n`;
	txt += `${"=".repeat(70)}\n\n`;

	txt += `OVERVIEW\n`;
	txt += `${"-".repeat(70)}\n`;
	txt += `Endpoint:  ${pathname}\n`;
	txt += `Method:    ${method}\n`;
	txt += `Base URL:  ${url.origin}\n`;
	txt += `Full URL:  ${entry.request.url}\n\n`;

	if (url.search) {
		txt += `QUERY PARAMETERS\n`;
		txt += `${"-".repeat(70)}\n`;
		entry.request.queryString.forEach((param) => {
			txt += `${param.name}: ${param.value}\n`;
		});
		txt += `\n`;
	}

	txt += `REQUEST\n`;
	txt += `${"-".repeat(70)}\n\n`;
	txt += `Headers:\n`;
	entry.request.headers.forEach((header) => {
		txt += `  ${header.name}: ${header.value}\n`;
	});
	txt += `\n`;

	if (entry.request.postData && entry.request.postData.text) {
		txt += `Request Body:\n`;
		txt += `Content-Type: ${entry.request.postData.mimeType}\n\n`;

		if (entry.request.postData.mimeType.includes("json")) {
			try {
				const parsed = JSON.parse(entry.request.postData.text);
				txt += `Body Schema:\n`;
				txt += analyzeJsonStructureAsText(parsed);
			} catch {
				txt += `${entry.request.postData.text}\n\n`;
			}
		} else {
			txt += `${entry.request.postData.text}\n\n`;
		}
	}

	txt += `RESPONSE\n`;
	txt += `${"-".repeat(70)}\n\n`;
	txt += `Status:\n`;
	txt += `  Code:     ${status}\n`;
	txt += `  Text:     ${entry.response.statusText}\n`;
	txt += `  Category: ${getStatusDescription(status)}\n\n`;

	txt += `Response Headers:\n`;
	entry.response.headers.forEach((header) => {
		txt += `  ${header.name}: ${header.value}\n`;
	});
	txt += `\n`;

	txt += `Content Type:\n`;
	if (isJson) {
		txt += `  Type: JSON (REST API)\n`;
		txt += `  This endpoint returns JSON data, indicating it's a RESTful API endpoint.\n\n`;
	} else if (isHtml) {
		txt += `  Type: HTML\n`;
		txt += `  This endpoint returns HTML content, likely a web page.\n\n`;
	} else {
		txt += `  Type: ${contentType}\n\n`;
	}

	if (entry.response.content.text && isJson) {
		txt += `Response Body:\n\n`;
		try {
			const parsed = JSON.parse(entry.response.content.text);

			txt += `Response Schema:\n`;
			txt += `The response object structure:\n\n`;
			txt += analyzeJsonStructureAsText(parsed);
			txt += `\n`;
		} catch {
			txt += `${entry.response.content.text}\n\n`;
		}
	}

	txt += `PERFORMANCE METRICS\n`;
	txt += `${"-".repeat(70)}\n`;
	txt += `Total Time:    ${entry.time.toFixed(2)}ms\n`;
	txt += `DNS Lookup:    ${entry.timings.dns.toFixed(2)}ms\n`;
	txt += `Connect:       ${entry.timings.connect.toFixed(2)}ms\n`;
	txt += `Send:          ${entry.timings.send.toFixed(2)}ms\n`;
	txt += `Wait:          ${entry.timings.wait.toFixed(2)}ms\n`;
	txt += `Receive:       ${entry.timings.receive.toFixed(2)}ms\n`;
	txt += `Response Size: ${formatBytes(entry.response.content.size)}\n\n`;

	txt += `USAGE EXAMPLES\n`;
	txt += `${"-".repeat(70)}\n\n`;
	txt += `cURL:\n`;
	txt += `------\n`;
	txt += `${generateCurl(entry)}\n\n`;

	txt += `JavaScript (Fetch API):\n`;
	txt += `------------------------\n`;
	txt += `${generateFetch(entry)}\n\n`;

	txt += `PowerShell:\n`;
	txt += `-----------\n`;
	txt += `${generatePowershell(entry)}\n\n`;

	txt += `${"=".repeat(70)}\n`;
	txt += `Documentation generated from HAR file - ${new Date(
		entry.startedDateTime
	).toLocaleString()}\n`;

	return txt;
}

function analyzeJsonStructureAsText(obj: unknown, indent = 0): string {
	const spaces = "  ".repeat(indent);
	let txt = "";

	if (Array.isArray(obj)) {
		if (obj.length > 0) {
			const firstItem = obj[0];
			const itemType = getValueType(firstItem);
			if (itemType === "object" && firstItem !== null) {
				txt += `${spaces}- array of object:\n`;
				const mergedSchema = mergeArraySchemas(obj);
				txt += analyzeJsonStructureAsText(mergedSchema, indent + 1);
			} else {
				txt += `${spaces}- array of ${itemType}\n`;
			}
		} else {
			txt += `${spaces}- array (empty)\n`;
		}
	} else if (obj !== null && typeof obj === "object") {
		const entries = Object.entries(obj);
		const sortedEntries = entries.sort(([a], [b]) => a.localeCompare(b));

		for (const [key, value] of sortedEntries) {
			const type = getValueType(value);

			if (type === "object" && value !== null) {
				const nestedKeys = Object.keys(value as object);
				if (nestedKeys.length === 0) {
					txt += `${spaces}- ${key}: object (empty)\n`;
				} else {
					txt += `${spaces}- ${key}: object\n`;
					txt += analyzeJsonStructureAsText(value, indent + 1);
				}
			} else if (type === "array") {
				if (Array.isArray(value) && value.length > 0) {
					const firstItem = value[0];
					const itemType = getValueType(firstItem);
					if (itemType === "object" && firstItem !== null) {
						txt += `${spaces}- ${key}: array of object\n`;
						const mergedSchema = mergeArraySchemas(value);
						txt += analyzeJsonStructureAsText(
							mergedSchema,
							indent + 1
						);
					} else {
						txt += `${spaces}- ${key}: array of ${itemType}\n`;
					}
				} else {
					txt += `${spaces}- ${key}: array (empty)\n`;
				}
			} else {
				txt += `${spaces}- ${key}: ${type}\n`;
			}
		}
	}

	return txt;
}

function extractSchemaFromEntry(
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
		> | null>((acc, schema) => {
			if (!acc) return schema;
			return deepMergeSchemas(acc, schema);
		}, null);
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
		}
	}

	return merged;
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
		if (typeStr === "datetime" || typeStr === "date") {
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

export function generateOpenAPIForEntry(entry: HAREntry): string {
	try {
		const urlObj = new URL(entry.request.url);
		const path = urlObj.pathname || "/";
		const method = entry.request.method.toLowerCase();

		const requestSchema = extractSchemaFromEntry(
			entry.request.postData?.text
		);
		const responseSchema = extractSchemaFromEntry(
			entry.response.content.text
		);

		const operation: Record<string, unknown> = {
			summary: `${entry.request.method} ${path}`,
			description: `API endpoint with ${entry.response.status} response`,
			operationId: `${method}${path.replace(/[^a-zA-Z0-9]/g, "")}`,
			tags: [urlObj.hostname],
		};

		const parameters: Array<Record<string, unknown>> = [];

		if (entry.request.queryString.length > 0) {
			entry.request.queryString.forEach((param) => {
				const schema: Record<string, unknown> = { type: "string" };
				if (param.value) {
					schema.default = param.value;
					schema.example = param.value;
				}

				parameters.push({
					name: param.name,
					in: "query",
					required: false,
					schema,
					example: param.value,
				});
			});
		}

		if (parameters.length > 0) {
			operation.parameters = parameters;
		}

		const schemas: Record<string, unknown> = {};

		if (requestSchema && ["post", "put", "patch"].includes(method)) {
			const schemaName = `${entry.request.method}${path.replace(
				/[^a-zA-Z0-9]/g,
				""
			)}Request`;
			const convertedSchema = convertSchemaToOpenAPI(requestSchema);

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
		const statusStr = String(entry.response.status);
		const description =
			entry.response.status >= 200 && entry.response.status < 300
				? "Successful response"
				: entry.response.status >= 400 && entry.response.status < 500
				? "Client error"
				: entry.response.status >= 500
				? "Server error"
				: "Response";

		if (
			responseSchema &&
			entry.response.status >= 200 &&
			entry.response.status < 300
		) {
			const schemaName = `${entry.request.method}${path.replace(
				/[^a-zA-Z0-9]/g,
				""
			)}Response`;
			const convertedSchema = convertSchemaToOpenAPI(responseSchema);

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

		operation.responses = responses;

		const openApiSpec = {
			openapi: "3.0.3",
			info: {
				title: "API Documentation",
				description: `Generated from HAR entry: ${entry.request.method} ${path}`,
				version: "1.0.0",
				contact: {
					name: "HAR Explorer",
				},
			},
			servers: [
				{
					url: `${urlObj.protocol}//${urlObj.host}`,
					description: "API Server",
				},
			],
			paths: {
				[path]: {
					[method]: operation,
				},
			},
			components: {
				schemas,
			},
		};

		return JSON.stringify(openApiSpec, null, 2);
	} catch (error) {
		console.error("Error generating OpenAPI:", error);
		return JSON.stringify(
			{
				error: "Failed to generate OpenAPI specification",
				message: String(error),
			},
			null,
			2
		);
	}
}
