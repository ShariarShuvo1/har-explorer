import type { HAREntry, HARNameValue } from "@/lib/har-types";
import {
	formatBytes,
	formatTime,
	getBaseMimeType,
	getEntryContentSize,
	getEntryTransferSize,
	getHeaderValue,
	safeParseUrl,
} from "@/lib/har-parser";
import {
	getFormFields,
	getRequestBodyMimeType,
	getResponseBodyText,
	getStatusCategory,
	getStatusDescription,
	hasRequestBody,
	isJsonMimeType,
	isMultipartMimeType,
	isPseudoHeader,
	isTextualMimeType,
	parseJson,
	type FormField,
} from "@/lib/api-docs/http";
import { redactEntry, redactHeaderValue, REDACTED } from "@/lib/api-docs/redact";
import { getUrlParts, templatePath } from "@/lib/api-docs/path-template";
import { inferSchema } from "@/lib/api-docs/schema";
import {
	renderMarkdown,
	renderPlainText,
	type DocBlock,
	type DocCell,
} from "@/lib/api-docs/document";
import { buildOpenApiDocument } from "@/lib/api-docs/openapi";

export interface CodegenOptions {
	/** Replace credentials, cookies and token-like values with a placeholder. */
	redact?: boolean;
	/** Longer bodies are referenced from a file instead of being inlined. */
	maxBodyLength?: number;
}

export interface DocumentationOptions {
	/** Default true: generated documentation is often shared. */
	redact?: boolean;
}

type PreparedBody =
	| { kind: "text"; text: string; mimeType: string }
	| { kind: "fields"; fields: FormField[]; mimeType: string };

interface PreparedRequest {
	method: string;
	url: string;
	/** Without pseudo headers and without Cookie (see `cookie`). */
	headers: HARNameValue[];
	cookie: string | null;
	body: PreparedBody | null;
}

function prepareRequest(entry: HAREntry, redact = false): PreparedRequest {
	const { request } = redact ? redactEntry(entry) : entry;
	const headers = request.headers.filter((header) => !isPseudoHeader(header.name));
	const cookieHeaders = headers.filter((header) => header.name.toLowerCase() === "cookie");

	let cookie: string | null = null;
	if (cookieHeaders.length > 0) {
		cookie = cookieHeaders.map((header) => header.value).join("; ");
	} else if (request.cookies.length > 0) {
		cookie = request.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
	}

	let body: PreparedBody | null = null;
	if (hasRequestBody(request.postData)) {
		const mimeType = getRequestBodyMimeType({ ...entry, request });
		body = request.postData.text
			? { kind: "text", text: request.postData.text, mimeType }
			: { kind: "fields", fields: getFormFields(request.postData), mimeType };
	}

	return {
		method: request.method,
		url: request.url,
		headers: headers.filter((header) => header.name.toLowerCase() !== "cookie"),
		cookie,
		body,
	};
}

function bodyFileName(mimeType: string): string {
	if (isJsonMimeType(mimeType)) return "request-body.json";
	if (getBaseMimeType(mimeType) === "application/xml") return "request-body.xml";
	return "request-body.txt";
}

// ---------------------------------------------------------------- cURL

const CURL_SKIPPED_HEADERS = new Set([
	"host",
	"content-length",
	"connection",
	"keep-alive",
	"proxy-connection",
	"transfer-encoding",
	"te",
	"expect",
	"accept-encoding",
]);

/** POSIX shell single-quoting: the only character needing care is the quote itself. */
function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function shellWord(value: string): string {
	return /^[A-Za-z0-9_-]+$/.test(value) ? value : shellQuote(value);
}

export function generateCurl(entry: HAREntry, options: CodegenOptions = {}): string {
	const request = prepareRequest(entry, options.redact);
	const { method, body } = request;
	const comments: string[] = [];
	const args: string[] = [];

	if (/[[\]{}]/.test(request.url)) args.push("--globoff");

	if (method === "HEAD") {
		args.push("--head");
	} else if (!(method === "GET" && !body) && !(method === "POST" && body)) {
		args.push(`-X ${shellWord(method)}`);
	}

	const usesFormFields = body?.kind === "fields" && isMultipartMimeType(body.mimeType);
	let compressed = false;
	for (const header of request.headers) {
		const lower = header.name.toLowerCase();
		if (lower === "accept-encoding") compressed = true;
		if (CURL_SKIPPED_HEADERS.has(lower)) continue;
		// curl generates the multipart boundary itself for -F.
		if (usesFormFields && lower === "content-type") continue;
		const line = header.value === "" ? `${header.name};` : `${header.name}: ${header.value}`;
		args.push(`-H ${shellQuote(line)}`);
	}

	if (request.cookie) args.push(`-b ${shellQuote(request.cookie)}`);

	if (body?.kind === "text") {
		if (options.maxBodyLength !== undefined && body.text.length > options.maxBodyLength) {
			const file = bodyFileName(body.mimeType);
			comments.push(
				`# The request body (${formatBytes(body.text.length)}) is not inlined; save it as ${file} first.`
			);
			args.push(`--data-binary ${shellQuote(`@${file}`)}`);
		} else {
			args.push(`--data-raw ${shellQuote(body.text)}`);
		}
	} else if (body?.kind === "fields") {
		for (const field of body.fields) {
			if (usesFormFields) {
				args.push(
					field.fileName
						? `-F ${shellQuote(`${field.name}=@${field.fileName}`)}`
						: `--form-string ${shellQuote(`${field.name}=${field.value}`)}`
				);
			} else {
				args.push(`--data-urlencode ${shellQuote(`${field.name}=${field.value}`)}`);
			}
		}
	}

	if (compressed) args.push("--compressed");

	const command = [`curl ${shellQuote(request.url)}`, ...args].join(" \\\n  ");
	return [...comments, command].join("\n");
}

// ---------------------------------------------------------------- fetch

function isBrowserControlledHeader(lower: string): boolean {
	return (
		FETCH_FORBIDDEN_HEADERS.has(lower) || lower.startsWith("proxy-") || lower.startsWith("sec-")
	);
}

const FETCH_FORBIDDEN_HEADERS = new Set([
	"accept-charset",
	"accept-encoding",
	"access-control-request-headers",
	"access-control-request-method",
	"connection",
	"content-length",
	"cookie",
	"cookie2",
	"date",
	"dnt",
	"expect",
	"host",
	"keep-alive",
	"origin",
	"referer",
	"set-cookie",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"user-agent",
	"via",
]);

function indentContinuation(text: string, indent: string): string {
	return text.replace(/\n/g, `\n${indent}`);
}

function fetchBodyExpression(body: PreparedBody): { prelude: string[]; expression: string } {
	if (body.kind === "fields") {
		if (isMultipartMimeType(body.mimeType)) {
			const prelude = ["const body = new FormData();"];
			for (const field of body.fields) {
				prelude.push(
					field.fileName
						? `body.append(${JSON.stringify(field.name)}, new Blob([/* file contents */]), ${JSON.stringify(field.fileName)});`
						: `body.append(${JSON.stringify(field.name)}, ${JSON.stringify(field.value)});`
				);
			}
			return { prelude, expression: "body" };
		}
		const pairs = body.fields.map((field) => [field.name, field.value]);
		return {
			prelude: [],
			expression: `new URLSearchParams(${JSON.stringify(pairs)}).toString()`,
		};
	}

	if (isJsonMimeType(body.mimeType) && !body.text.includes('"__proto__"')) {
		const parsed = parseJson(body.text);
		if (parsed.ok && parsed.value !== null && typeof parsed.value === "object") {
			const literal = indentContinuation(JSON.stringify(parsed.value, null, 2), "  ");
			return { prelude: [], expression: `JSON.stringify(${literal})` };
		}
	}
	return { prelude: [], expression: JSON.stringify(body.text) };
}

function responseReader(entry: HAREntry): string {
	const mimeType = entry.response.content.mimeType;
	if (isJsonMimeType(mimeType)) return "response.json()";
	if (!mimeType || isTextualMimeType(mimeType)) return "response.text()";
	return "response.blob()";
}

function isWebSocketUrl(url: string): boolean {
	return /^wss?:\/\//i.test(url);
}

export function generateFetch(entry: HAREntry, options: CodegenOptions = {}): string {
	const request = prepareRequest(entry, options.redact);
	const { method, body } = request;

	if (isWebSocketUrl(request.url)) {
		return [
			"// WebSocket endpoints are opened with WebSocket rather than fetch().",
			`const socket = new WebSocket(${JSON.stringify(request.url)});`,
			'socket.addEventListener("message", (event) => console.log(event.data));',
		].join("\n");
	}

	const lines: string[] = [];
	const omitted: string[] = [];
	const init: string[] = [];

	if (method !== "GET") init.push(`method: ${JSON.stringify(method)}`);

	const usesFormData = body?.kind === "fields" && isMultipartMimeType(body.mimeType);
	const headerLines: string[] = [];
	let referrer: string | undefined;
	for (const header of request.headers) {
		const lower = header.name.toLowerCase();
		if (lower === "referer") referrer = header.value;
		if (isBrowserControlledHeader(lower)) {
			if (!omitted.includes(lower)) omitted.push(lower);
			continue;
		}
		if (usesFormData && lower === "content-type") continue;
		headerLines.push(`    ${JSON.stringify(header.name)}: ${JSON.stringify(header.value)}`);
	}
	if (request.cookie && !omitted.includes("cookie")) omitted.push("cookie");
	if (headerLines.length > 0) init.push(`headers: {\n${headerLines.join(",\n")}\n  }`);

	if (body) {
		if (method === "GET" || method === "HEAD") {
			lines.push(`// The captured ${method} request had a body, which fetch() does not allow.`);
		} else if (
			body.kind === "text" &&
			options.maxBodyLength !== undefined &&
			body.text.length > options.maxBodyLength
		) {
			lines.push(
				`const requestBody = ""; // Paste the ${formatBytes(body.text.length)} request body here.`
			);
			init.push("body: requestBody");
		} else {
			const { prelude, expression } = fetchBodyExpression(body);
			lines.push(...prelude);
			init.push(`body: ${expression}`);
		}
	}

	if (referrer) init.push(`referrer: ${JSON.stringify(referrer)}`);
	// Cookies cannot be set from script; send the browser's own instead.
	if (request.cookie) init.push(`credentials: "include"`);

	if (omitted.length > 0) {
		lines.unshift(`// Headers controlled by the browser were omitted: ${omitted.join(", ")}`);
	}

	const initText = init.length > 0 ? `, {\n  ${init.join(",\n  ")}\n}` : "";
	lines.push(`const response = await fetch(${JSON.stringify(request.url)}${initText});`);
	lines.push(`const data = await ${responseReader(entry)};`);
	lines.push("console.log(response.status, data);");
	return lines.join("\n");
}

// ---------------------------------------------------------------- PowerShell

const POWERSHELL_METHODS = new Set([
	"GET",
	"HEAD",
	"POST",
	"PUT",
	"DELETE",
	"TRACE",
	"OPTIONS",
	"MERGE",
	"PATCH",
]);

const POWERSHELL_SKIPPED_HEADERS = new Set([
	"host",
	"content-length",
	"connection",
	"keep-alive",
	"proxy-connection",
	"transfer-encoding",
	"te",
	"expect",
	"accept-encoding",
	"content-type",
	"user-agent",
]);

// PowerShell also treats typographic single quotes as string delimiters.
const POWERSHELL_QUOTES = new RegExp(
	`['${String.fromCharCode(0x2018, 0x2019, 0x201a, 0x201b)}]`,
	"g"
);

function psQuote(value: string): string {
	return `'${value.replace(POWERSHELL_QUOTES, "$&$&")}'`;
}

function psCookieValue(value: string): string {
	return /[,;]/.test(value) && !/^".*"$/.test(value) ? `"${value.replace(/"/g, "")}"` : value;
}

export function generatePowershell(entry: HAREntry, options: CodegenOptions = {}): string {
	const request = prepareRequest(entry, options.redact);
	const { method, body } = request;

	if (isWebSocketUrl(request.url)) {
		return [
			"# Invoke-WebRequest cannot open WebSocket connections.",
			"$socket = [System.Net.WebSockets.ClientWebSocket]::new()",
			`$socket.ConnectAsync([Uri]${psQuote(request.url)}, [Threading.CancellationToken]::None).Wait()`,
		].join("\n");
	}

	const lines: string[] = [];
	const args: string[] = [`-Uri ${psQuote(request.url)} -UseBasicParsing`];

	if (method !== "GET") {
		if (POWERSHELL_METHODS.has(method)) {
			args.push(`-Method ${psQuote(method)}`);
		} else {
			lines.push("# -CustomMethod requires PowerShell 6 or later.");
			args.push(`-CustomMethod ${psQuote(method)}`);
		}
	}

	const host = getUrlParts(request.url).host.replace(/:\d+$/, "");
	const headers = request.headers.filter(
		(header) => !POWERSHELL_SKIPPED_HEADERS.has(header.name.toLowerCase())
	);
	if (request.cookie) {
		const parts = request.cookie
			.split(";")
			.map((part) => part.trim())
			.filter(Boolean);
		const pairs = parts.map((part) => {
			const eq = part.indexOf("=");
			return { name: eq === -1 ? "" : part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
		});
		// A WebSession cookie jar works on both Windows PowerShell and PowerShell 7.
		if (host && pairs.every((pair) => pair.name)) {
			lines.push("$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession");
			for (const { name, value } of pairs) {
				lines.push(
					`$session.Cookies.Add((New-Object System.Net.Cookie(${psQuote(name)}, ${psQuote(psCookieValue(value))}, '/', ${psQuote(host)})))`
				);
			}
			args.push("-WebSession $session");
		} else {
			headers.push({ name: "Cookie", value: request.cookie });
		}
	}

	const headerLines = headers.map(
		(header) => `    ${psQuote(header.name)} = ${psQuote(header.value)}`
	);
	if (headerLines.length > 0) args.push(`-Headers @{\n${headerLines.join("\n")}\n  }`);

	const userAgent = getHeaderValue(request.headers, "user-agent");
	if (userAgent) args.push(`-UserAgent ${psQuote(userAgent)}`);

	const contentType = getHeaderValue(request.headers, "content-type") || body?.mimeType;
	if (body && method !== "GET" && method !== "HEAD") {
		if (body.kind === "fields" && isMultipartMimeType(body.mimeType)) {
			lines.push("# -Form requires PowerShell 7 or later.");
			const formLines = body.fields.map(
				(field) =>
					`    ${psQuote(field.name)} = ${field.fileName ? `Get-Item ${psQuote(field.fileName)}` : psQuote(field.value)}`
			);
			args.push(`-Form @{\n${formLines.join("\n")}\n  }`);
		} else {
			if (contentType) args.push(`-ContentType ${psQuote(contentType)}`);
			if (body.kind === "fields") {
				const formLines = body.fields.map(
					(field) => `    ${psQuote(field.name)} = ${psQuote(field.value)}`
				);
				args.push(`-Body @{\n${formLines.join("\n")}\n  }`);
			} else if (options.maxBodyLength !== undefined && body.text.length > options.maxBodyLength) {
				const file = bodyFileName(body.mimeType);
				lines.push(
					`# The request body (${formatBytes(body.text.length)}) is not inlined; save it as ${file} first.`
				);
				args.push(`-InFile ${psQuote(file)}`);
			} else {
				args.push(`-Body ${psQuote(body.text)}`);
			}
		}
	} else if (body) {
		lines.push(`# The captured ${method} request had a body, which is not sent here.`);
	}

	lines.push(`$response = Invoke-WebRequest ${args.join(" `\n  ")}`);
	lines.push("$response.Content");
	return lines.join("\n");
}

// ---------------------------------------------------------------- Documentation

const MAX_INLINE_BODY = 5000;
const EXAMPLE_BODY_LIMIT = 10_000;

function formatCapturedAt(startedDateTime: string): string {
	const time = Date.parse(startedDateTime);
	return Number.isFinite(time) ? new Date(time).toLocaleString() : "at an unknown time";
}

function headerRows(headers: HARNameValue[], redact: boolean): DocCell[][] {
	return headers
		.filter((header) => !isPseudoHeader(header.name))
		.map((header) => [
			{ text: header.name, code: true },
			{ text: redact ? redactHeaderValue(header.name, header.value) : header.value, code: true },
		]);
}

function truncateBody(text: string): string {
	return text.length > MAX_INLINE_BODY
		? `${text.slice(0, MAX_INLINE_BODY)}\n… (${formatBytes(text.length - MAX_INLINE_BODY)} more)`
		: text;
}

function codeLanguage(mimeType: string): string {
	if (isJsonMimeType(mimeType)) return "json";
	const base = getBaseMimeType(mimeType);
	if (base.endsWith("xml")) return "xml";
	if (base === "text/html") return "html";
	return "text";
}

function timingRows(entry: HAREntry): DocCell[][] {
	const { timings } = entry;
	const phases: Array<[string, number]> = [
		["Blocked", timings.blocked],
		["DNS lookup", timings.dns],
		[timings.ssl >= 0 ? "Connect (incl. TLS)" : "Connect", timings.connect],
		["TLS handshake", timings.ssl],
		["Send", timings.send],
		["Wait (TTFB)", timings.wait],
		["Receive", timings.receive],
	];
	return [
		...phases
			.filter(([, value]) => Number.isFinite(value) && value >= 0)
			.map(([label, value]) => [{ text: label }, { text: formatTime(value) }]),
		[{ text: "Total" }, { text: formatTime(entry.time) }],
	];
}

function buildEntryDocument(entry: HAREntry, redact: boolean): DocBlock[] {
	const source = redact ? redactEntry(entry) : entry;
	const { request, response } = source;
	const { origin, pathname } = getUrlParts(entry.request.url);
	const { template, params } = templatePath(pathname);
	const status = response.status;
	const responseMime = getBaseMimeType(response.content.mimeType);

	const blocks: DocBlock[] = [
		{ kind: "heading", level: 1, text: `${request.method} ${pathname}` },
		{
			kind: "note",
			text: `Generated by HAR Explorer from a request captured ${formatCapturedAt(entry.startedDateTime)}.`,
		},
		{ kind: "heading", level: 2, text: "Overview" },
		{
			kind: "fields",
			items: [
				{ label: "Method", value: request.method, code: true },
				{ label: "URL", value: request.url, code: true },
				...(origin ? [{ label: "Base URL", value: origin, code: true }] : []),
				{ label: "Path", value: pathname, code: true },
				...(params.length > 0 ? [{ label: "Endpoint pattern", value: template, code: true }] : []),
				{
					label: "Status",
					value: `${status} ${getStatusDescription(status, response.statusText)}`,
				},
				{ label: "Category", value: getStatusCategory(status) },
				{ label: "Response type", value: responseMime || "none", code: Boolean(responseMime) },
			],
		},
	];

	if (params.length > 0) {
		blocks.push(
			{ kind: "heading", level: 2, text: "Path Parameters" },
			{
				kind: "table",
				columns: ["Parameter", "Value", "Kind"],
				rows: params.map((param) => [
					{ text: param.name, code: true },
					{
						text:
							redact && (param.kind === "token" || param.kind === "hash") ? REDACTED : param.value,
						code: true,
					},
					{ text: param.kind },
				]),
			}
		);
	}

	// Some exporters leave queryString empty; fall back to the URL itself.
	const queryParams =
		request.queryString.length > 0
			? request.queryString
			: Array.from(safeParseUrl(request.url)?.searchParams ?? [], ([name, value]) => ({
					name,
					value,
				}));
	if (queryParams.length > 0) {
		blocks.push(
			{ kind: "heading", level: 2, text: "Query Parameters" },
			{
				kind: "table",
				columns: ["Parameter", "Value"],
				rows: queryParams.map((param) => [
					{ text: param.name, code: true },
					{ text: param.value, code: true },
				]),
			}
		);
	}

	blocks.push(
		{ kind: "heading", level: 2, text: "Request" },
		{ kind: "heading", level: 3, text: "Headers" }
	);
	const requestHeaderRows = headerRows(request.headers, redact);
	blocks.push(
		requestHeaderRows.length > 0
			? { kind: "table", columns: ["Header", "Value"], rows: requestHeaderRows }
			: { kind: "paragraph", text: "No request headers were captured." }
	);

	if (request.cookies.length > 0 && !getHeaderValue(request.headers, "cookie")) {
		blocks.push(
			{ kind: "heading", level: 3, text: "Cookies" },
			{
				kind: "table",
				columns: ["Cookie", "Value"],
				rows: request.cookies.map((cookie) => [
					{ text: cookie.name, code: true },
					{ text: cookie.value, code: true },
				]),
			}
		);
	}

	if (hasRequestBody(request.postData)) {
		const postData = request.postData;
		const mimeType = getRequestBodyMimeType(source);
		blocks.push(
			{ kind: "heading", level: 3, text: "Request Body" },
			{
				kind: "fields",
				items: [
					{ label: "Content-Type", value: mimeType || "unknown", code: Boolean(mimeType) },
					...(entry.request.postData?.text
						? [{ label: "Size", value: formatBytes(entry.request.postData.text.length) }]
						: []),
				],
			}
		);
		const fields = getFormFields(postData);
		// Schema is inferred from the original body: types only, no values.
		const parsed = isJsonMimeType(mimeType)
			? parseJson(entry.request.postData?.text)
			: { ok: false as const };
		if (parsed.ok) {
			blocks.push(
				{ kind: "paragraph", text: "Schema:" },
				{ kind: "schema", schema: inferSchema(parsed.value) }
			);
		} else if (fields.length > 0) {
			blocks.push({
				kind: "table",
				columns: ["Field", "Value"],
				rows: fields.map((field) => [
					{ text: field.name, code: true },
					field.fileName
						? { text: `(file: ${field.fileName})` }
						: { text: field.value, code: true },
				]),
			});
		} else if (postData.text) {
			blocks.push({
				kind: "code",
				language: codeLanguage(mimeType),
				code: truncateBody(postData.text),
			});
		}
	}

	blocks.push(
		{ kind: "heading", level: 2, text: "Response" },
		{
			kind: "fields",
			items: [
				{
					label: "Status",
					value: `${status} ${getStatusDescription(status, response.statusText)}`,
				},
				{ label: "Content-Type", value: responseMime || "none", code: Boolean(responseMime) },
				{ label: "Body size", value: formatBytes(getEntryContentSize(entry)) },
				{ label: "Transferred", value: formatBytes(getEntryTransferSize(entry)) },
			],
		},
		{ kind: "heading", level: 3, text: "Headers" }
	);
	const responseHeaderRows = headerRows(response.headers, redact);
	blocks.push(
		responseHeaderRows.length > 0
			? { kind: "table", columns: ["Header", "Value"], rows: responseHeaderRows }
			: { kind: "paragraph", text: "No response headers were captured." }
	);

	if (isJsonMimeType(responseMime)) {
		const parsed = parseJson(getResponseBodyText(entry));
		blocks.push({ kind: "heading", level: 3, text: "Response Body" });
		blocks.push(
			parsed.ok
				? { kind: "schema", schema: inferSchema(parsed.value) }
				: { kind: "paragraph", text: "The response body was not captured or is not valid JSON." }
		);
	}

	blocks.push(
		{ kind: "heading", level: 2, text: "Timing" },
		{ kind: "table", columns: ["Phase", "Duration"], rows: timingRows(entry) },
		{ kind: "heading", level: 2, text: "Usage Examples" }
	);
	const codegenOptions: CodegenOptions = { redact, maxBodyLength: EXAMPLE_BODY_LIMIT };
	blocks.push(
		{ kind: "heading", level: 3, text: "cURL" },
		{ kind: "code", language: "bash", code: generateCurl(entry, codegenOptions) },
		{ kind: "heading", level: 3, text: "JavaScript (fetch)" },
		{ kind: "code", language: "javascript", code: generateFetch(entry, codegenOptions) },
		{ kind: "heading", level: 3, text: "PowerShell" },
		{ kind: "code", language: "powershell", code: generatePowershell(entry, codegenOptions) }
	);

	return blocks;
}

export function generateApiDocumentation(
	entry: HAREntry,
	{ redact = true }: DocumentationOptions = {}
): string {
	return renderMarkdown(buildEntryDocument(entry, redact));
}

export function generateApiDocumentationAsText(
	entry: HAREntry,
	{ redact = true }: DocumentationOptions = {}
): string {
	return renderPlainText(buildEntryDocument(entry, redact));
}

export function generateOpenAPIForEntry(
	entry: HAREntry,
	{ redact = true }: DocumentationOptions = {}
): string {
	const { pathname } = getUrlParts(entry.request.url);
	const document = buildOpenApiDocument([entry], {
		redact,
		description: `Generated by HAR Explorer from ${entry.request.method} ${pathname}.`,
	});
	return JSON.stringify(document, null, 2);
}
