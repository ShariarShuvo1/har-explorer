import type { HAREntry, HARNameValue } from "@/lib/har-types";
import { getHeaderValue, safeParseUrl } from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import type { SecurityIssue, SecuritySeverity } from "./types";
import { getHeaderValues, getResponseCookies } from "./entry-utils";

/**
 * Response headers worth checking. Most of them only have an effect on
 * documents (framing, script execution, feature access), so they are not
 * expected on images, scripts or API responses.
 */
export const SECURITY_HEADERS: ReadonlyArray<{
	name: string;
	appliesTo: "all" | "document";
	secureOnly?: boolean;
}> = [
	{
		name: "strict-transport-security",
		appliesTo: "all",
		secureOnly: true,
	},
	{ name: "content-security-policy", appliesTo: "document" },
	{ name: "x-frame-options", appliesTo: "document" },
	{ name: "x-content-type-options", appliesTo: "all" },
	{ name: "referrer-policy", appliesTo: "document" },
	{ name: "permissions-policy", appliesTo: "document" },
	{ name: "cross-origin-opener-policy", appliesTo: "document" },
	{ name: "cross-origin-embedder-policy", appliesTo: "document" },
	{ name: "cross-origin-resource-policy", appliesTo: "all" },
];

export const SEVERITY_RANK: Record<SecuritySeverity, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
};

/** 180 days, the minimum HSTS max-age commonly recommended. */
const HSTS_MIN_MAX_AGE = 15552000;

const SENSITIVE_QUERY_PARAM =
	/^(access[_-]?token|id[_-]?token|refresh[_-]?token|token|auth|authorization|api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|pwd|session[_-]?id|sessionid|sid|jwt)$/i;

const SENSITIVE_COOKIE_NAME = /sess|sid|auth|token|jwt|remember|login/i;

const EXTRA_SECURITY_HEADERS = [
	"content-security-policy-report-only",
	"x-xss-protection",
	"access-control-allow-origin",
	"access-control-allow-credentials",
];

export type TransportSecurity = "secure" | "insecure" | "local" | "unknown";

export function getTransportSecurity(url: string): {
	scheme: string;
	security: TransportSecurity;
} {
	const parsed = safeParseUrl(url);
	if (!parsed) return { scheme: "", security: "unknown" };
	const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
	if (scheme === "https" || scheme === "wss") {
		return { scheme, security: "secure" };
	}
	if (scheme === "http" || scheme === "ws") {
		const host = parsed.hostname;
		const isLocal =
			host === "localhost" ||
			host.endsWith(".localhost") ||
			host === "[::1]" ||
			/^127\./.test(host);
		return { scheme, security: isLocal ? "local" : "insecure" };
	}
	return { scheme, security: "unknown" };
}

function isDocumentResponse(entry: HAREntry): boolean {
	const status = entry.response.status;
	return getResourceType(entry) === "doc" && status >= 200 && !(status >= 300 && status < 400);
}

function parseCsp(policy: string): Map<string, string[]> {
	const directives = new Map<string, string[]>();
	for (const part of policy.split(";")) {
		const [name, ...values] = part.trim().split(/\s+/);
		if (name && !directives.has(name.toLowerCase())) {
			directives.set(
				name.toLowerCase(),
				values.map((v) => v.toLowerCase())
			);
		}
	}
	return directives;
}

function maxSeverity(a: SecuritySeverity, b: SecuritySeverity): SecuritySeverity {
	return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b;
}

function checkTransport(entry: HAREntry, issues: SecurityIssue[]) {
	const { request, response } = entry;
	const { scheme, security } = getTransportSecurity(request.url);
	const parsed = safeParseUrl(request.url);

	if (parsed && (parsed.username || parsed.password)) {
		issues.push({
			severity: "high",
			category: "Credentials in URL",
			message: "The URL contains a username or password",
			recommendation:
				"Send credentials in an Authorization header instead; URLs are stored in logs and browser history.",
		});
	}

	if (security === "local") {
		issues.push({
			severity: "info",
			category: "Transport",
			message: `Unencrypted ${scheme.toUpperCase()} to a local address`,
			recommendation: "Fine for local development; make sure production uses HTTPS.",
		});
		return;
	}
	if (security !== "insecure") return;

	const location = response.redirectURL || getHeaderValue(response.headers, "location") || "";
	const redirectsToHttps =
		response.status >= 300 && response.status < 400 && /^https:\/\//i.test(location);

	if (redirectsToHttps) {
		issues.push({
			severity: "medium",
			category: "Transport",
			message: "Plain HTTP request redirected to HTTPS",
			recommendation:
				"The first request is still sent in cleartext. Serve Strict-Transport-Security (and consider HSTS preload) on the HTTPS origin so browsers upgrade before connecting.",
		});
		return;
	}

	const exposed: string[] = [];
	if (getHeaderValue(request.headers, "authorization")) {
		exposed.push("Authorization header");
	}
	if (request.cookies.length > 0 || getHeaderValue(request.headers, "cookie")) {
		exposed.push("cookies");
	}
	if (request.postData?.text || request.postData?.params?.length) {
		exposed.push("request body");
	}
	if (getHeaderValues(response.headers, "set-cookie").length > 0) {
		exposed.push("Set-Cookie");
	}

	issues.push(
		exposed.length > 0
			? {
					severity: "critical",
					category: "Transport",
					message: `Sensitive data sent over unencrypted ${scheme.toUpperCase()}: ${exposed.join(", ")}`,
					recommendation:
						"Anyone on the network path can read or modify this traffic. Serve the endpoint over HTTPS only.",
				}
			: {
					severity: "high",
					category: "Transport",
					message: `Request made over unencrypted ${scheme.toUpperCase()}`,
					recommendation:
						"Serve the resource over HTTPS; cleartext responses can be read and tampered with in transit.",
				}
	);
}

function checkQueryString(entry: HAREntry, issues: SecurityIssue[]) {
	const params =
		entry.request.queryString.length > 0
			? entry.request.queryString
			: Array.from(safeParseUrl(entry.request.url)?.searchParams ?? [], ([name, value]) => ({
					name,
					value,
				}));
	const sensitive = [
		...new Set(
			params.filter((p) => p.value && SENSITIVE_QUERY_PARAM.test(p.name)).map((p) => p.name)
		),
	];
	if (sensitive.length > 0) {
		issues.push({
			severity: "medium",
			category: "Secrets in URL",
			message: `Possible secret in the query string: ${sensitive.join(", ")}`,
			recommendation:
				"Send tokens in headers or the request body; URLs leak through logs, browser history and the Referer header.",
		});
	}
}

function checkHsts(entry: HAREntry, issues: SecurityIssue[]) {
	const { security } = getTransportSecurity(entry.request.url);
	const hsts = getHeaderValue(entry.response.headers, "strict-transport-security");

	if (security !== "secure") {
		if (hsts && security === "insecure") {
			issues.push({
				severity: "info",
				category: "HSTS",
				message: "Strict-Transport-Security is ignored over plain HTTP",
				recommendation: "Send it from the HTTPS origin instead.",
			});
		}
		return;
	}

	if (!hsts) {
		const isDocument = isDocumentResponse(entry);
		issues.push({
			severity: isDocument ? "medium" : "low",
			category: "HSTS",
			message: "Missing Strict-Transport-Security header",
			recommendation: "Strict-Transport-Security: max-age=31536000; includeSubDomains",
		});
		return;
	}

	const maxAgeMatch = /max-age\s*=\s*"?(\d+)"?/i.exec(hsts);
	if (!maxAgeMatch) {
		issues.push({
			severity: "medium",
			category: "HSTS",
			message: "Strict-Transport-Security has no valid max-age and is ignored",
			recommendation: "Strict-Transport-Security: max-age=31536000; includeSubDomains",
		});
		return;
	}
	const maxAge = Number(maxAgeMatch[1]);
	if (maxAge === 0) {
		issues.push({
			severity: "medium",
			category: "HSTS",
			message: "Strict-Transport-Security is disabled (max-age=0)",
			recommendation: "Use a max-age of at least one year.",
		});
	} else if (maxAge < HSTS_MIN_MAX_AGE) {
		issues.push({
			severity: "low",
			category: "HSTS",
			message: `Short HSTS max-age (${maxAge}s)`,
			recommendation: "Use a max-age of at least 6 months (ideally one year).",
		});
	}
}

function checkDocumentHeaders(entry: HAREntry, issues: SecurityIssue[]) {
	const headers = entry.response.headers;
	const csp = getHeaderValues(headers, "content-security-policy").join("; ");
	const cspReportOnly = getHeaderValue(headers, "content-security-policy-report-only");
	const directives = parseCsp(csp);

	if (!csp) {
		issues.push(
			cspReportOnly
				? {
						severity: "low",
						category: "CSP",
						message: "Content-Security-Policy is only in report-only mode",
						recommendation:
							"Once violations are resolved, enforce the policy with the Content-Security-Policy header.",
					}
				: {
						severity: "high",
						category: "CSP",
						message: "Missing Content-Security-Policy header",
						recommendation:
							"Add a Content-Security-Policy (e.g. script-src 'self' with nonces or hashes) to limit the impact of XSS.",
					}
		);
	} else {
		const scriptSources = directives.get("script-src") ?? directives.get("default-src");
		if (!scriptSources) {
			issues.push({
				severity: "medium",
				category: "CSP",
				message: "CSP does not restrict scripts (no script-src or default-src)",
				recommendation: "Add script-src or default-src to the policy.",
			});
		} else {
			const hasNonceOrHash = scriptSources.some((s) =>
				/^'(nonce-|sha256-|sha384-|sha512-)/.test(s)
			);
			const strictDynamic = scriptSources.includes("'strict-dynamic'");
			if (scriptSources.includes("'unsafe-inline'") && !hasNonceOrHash && !strictDynamic) {
				issues.push({
					severity: "medium",
					category: "CSP",
					message: "CSP allows inline scripts ('unsafe-inline')",
					recommendation:
						"Replace 'unsafe-inline' with nonces or hashes so injected scripts cannot run.",
				});
			}
			if (
				!strictDynamic &&
				scriptSources.some((s) => s === "*" || s === "https:" || s === "http:" || s === "data:")
			) {
				issues.push({
					severity: "medium",
					category: "CSP",
					message: "CSP allows scripts from any host",
					recommendation: "List specific trusted origins instead of *, https: or data:.",
				});
			}
			if (scriptSources.includes("'unsafe-eval'")) {
				issues.push({
					severity: "low",
					category: "CSP",
					message: "CSP allows eval() ('unsafe-eval')",
					recommendation: "Remove 'unsafe-eval' if the application does not need it.",
				});
			}
		}
	}

	const frameAncestors = directives.get("frame-ancestors");
	const xFrameOptions = getHeaderValue(headers, "x-frame-options")?.trim().toLowerCase();
	if (!frameAncestors) {
		if (!xFrameOptions) {
			issues.push({
				severity: "medium",
				category: "Clickjacking",
				message: "The page can be embedded in frames on any site",
				recommendation:
					"Add frame-ancestors 'self' (or 'none') to the CSP. X-Frame-Options: DENY is only needed as a fallback for very old browsers.",
			});
		} else if (xFrameOptions.startsWith("allow-from")) {
			issues.push({
				severity: "medium",
				category: "Clickjacking",
				message: "X-Frame-Options ALLOW-FROM is not supported by modern browsers",
				recommendation: "Use the CSP frame-ancestors directive instead.",
			});
		}
	}

	const referrerPolicy = getHeaderValue(headers, "referrer-policy")?.toLowerCase();
	if (!referrerPolicy) {
		issues.push({
			severity: "info",
			category: "Privacy",
			message: "Missing Referrer-Policy header",
			recommendation:
				"Browsers default to strict-origin-when-cross-origin; set it explicitly to make the policy intentional.",
		});
	} else if (/unsafe-url|no-referrer-when-downgrade/.test(referrerPolicy)) {
		issues.push({
			severity: "low",
			category: "Privacy",
			message: `Referrer-Policy "${referrerPolicy}" leaks full URLs to other origins`,
			recommendation: "Use strict-origin-when-cross-origin or stricter.",
		});
	}

	if (!getHeaderValue(headers, "permissions-policy")) {
		issues.push({
			severity: "info",
			category: "Permissions",
			message: "Missing Permissions-Policy header",
			recommendation:
				"Consider disabling browser features the page does not use (camera, geolocation, ...).",
		});
	}
}

function checkCommonHeaders(entry: HAREntry, issues: SecurityIssue[]) {
	const { request, response } = entry;
	const headers = response.headers;
	const type = getResourceType(entry);
	const hasBody =
		response.status >= 200 &&
		response.status !== 204 &&
		!(response.status >= 300 && response.status < 400) &&
		request.method !== "HEAD" &&
		request.method !== "OPTIONS" &&
		type !== "ws";

	const nosniff = getHeaderValue(headers, "x-content-type-options");
	if (hasBody && !nosniff) {
		const sniffable = ["doc", "js", "css", "fetch", "other"].includes(type);
		issues.push({
			severity: sniffable ? "medium" : "low",
			category: "MIME Sniffing",
			message: "Missing X-Content-Type-Options header",
			recommendation:
				"Add X-Content-Type-Options: nosniff so browsers honour the declared Content-Type.",
		});
	} else if (nosniff && nosniff.trim().toLowerCase() !== "nosniff") {
		issues.push({
			severity: "low",
			category: "MIME Sniffing",
			message: `Invalid X-Content-Type-Options value "${nosniff}"`,
			recommendation: "The only valid value is nosniff.",
		});
	}

	const xssProtection = getHeaderValue(headers, "x-xss-protection");
	if (xssProtection && xssProtection.trim() !== "0") {
		issues.push({
			severity: "low",
			category: "XSS Protection",
			message: "Deprecated X-XSS-Protection filter is enabled",
			recommendation:
				"Remove the header or set X-XSS-Protection: 0 and rely on Content-Security-Policy; the legacy filter can introduce cross-site leaks.",
		});
	}

	const allowOrigin = getHeaderValue(headers, "access-control-allow-origin")?.trim();
	const allowCredentials =
		getHeaderValue(headers, "access-control-allow-credentials")?.trim().toLowerCase() === "true";
	if (allowOrigin === "*" && allowCredentials) {
		issues.push({
			severity: "high",
			category: "CORS",
			message: "Wildcard Access-Control-Allow-Origin combined with credentials",
			recommendation:
				'Browsers reject this combination, and servers often "fix" it by reflecting any Origin, which exposes authenticated data to every site. Allow-list trusted origins explicitly.',
		});
	} else if (allowOrigin?.toLowerCase() === "null") {
		issues.push({
			severity: allowCredentials ? "critical" : "medium",
			category: "CORS",
			message: `Access-Control-Allow-Origin: null${allowCredentials ? " with credentials" : ""}`,
			recommendation:
				"Sandboxed iframes and local files send Origin: null, so any site can obtain it. Allow-list specific origins instead.",
		});
	}

	const disclosed = [
		{ name: "server", versioned: true },
		{ name: "x-powered-by", versioned: false },
		{ name: "x-aspnet-version", versioned: false },
		{ name: "x-aspnetmvc-version", versioned: false },
	]
		.filter(({ name, versioned }) => {
			const value = getHeaderValue(headers, name);
			return value && (!versioned || /\d/.test(value));
		})
		.map(({ name }) => name);
	if (disclosed.length > 0) {
		issues.push({
			severity: "low",
			category: "Information Disclosure",
			message: `Server software details exposed: ${disclosed.join(", ")}`,
			recommendation: "Remove version details from these headers to make targeted attacks harder.",
		});
	}
}

function checkCookies(entry: HAREntry, issues: SecurityIssue[]) {
	const { security } = getTransportSecurity(entry.request.url);

	for (const cookie of getResponseCookies(entry)) {
		const name = cookie.name || "(unnamed)";
		const sensitive = SENSITIVE_COOKIE_NAME.test(cookie.name) && !/csrf|xsrf/i.test(cookie.name);
		const problems: string[] = [];
		let severity: SecuritySeverity = "info";
		const add = (problem: string, level: SecuritySeverity) => {
			problems.push(problem);
			severity = maxSeverity(severity, level);
		};

		const sameSite =
			typeof cookie.sameSite === "string" ? cookie.sameSite.toLowerCase() : undefined;
		if (!cookie.secure) {
			if (/^__(secure|host)-/i.test(cookie.name)) {
				add("the __Secure-/__Host- prefix requires Secure (browsers reject it)", "high");
			} else if (sameSite === "none") {
				add("SameSite=None requires Secure (browsers reject it)", "high");
			} else if (security === "secure") {
				add("missing Secure", sensitive ? "high" : "medium");
			}
		}
		if (!cookie.httpOnly && sensitive) {
			add("missing HttpOnly (readable by scripts)", "medium");
		}
		if (!sameSite) {
			add("no SameSite attribute (browsers default to Lax)", "low");
		}

		if (problems.length > 0) {
			issues.push({
				severity,
				category: "Cookies",
				message: `Cookie "${name}": ${problems.join("; ")}`,
				recommendation: "Session cookies should be Secure; HttpOnly; SameSite=Lax (or Strict).",
			});
		}
	}
}

/** Security findings for a single request/response, most severe first. */
export function analyzeSecurity(entry: HAREntry): SecurityIssue[] {
	const issues: SecurityIssue[] = [];

	checkTransport(entry, issues);
	checkQueryString(entry, issues);

	if (entry.response.status > 0) {
		checkHsts(entry, issues);
		if (isDocumentResponse(entry)) checkDocumentHeaders(entry, issues);
		checkCommonHeaders(entry, issues);
		checkCookies(entry, issues);
	} else {
		issues.push({
			severity: "info",
			category: "Response",
			message: "No response was received, so response headers could not be checked",
		});
	}

	return issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Security headers present on the response and the applicable ones that are missing. */
export function getSecurityHeaderStatus(entry: HAREntry): {
	present: HARNameValue[];
	missing: string[];
} {
	const headers = entry.response.headers;
	const known = new Set([...SECURITY_HEADERS.map((h) => h.name), ...EXTRA_SECURITY_HEADERS]);
	const present = headers.filter((h) => known.has(h.name.toLowerCase()));
	const presentNames = new Set(present.map((h) => h.name.toLowerCase()));

	const isDocument = isDocumentResponse(entry);
	const isSecure = getTransportSecurity(entry.request.url).security === "secure";
	const missing =
		entry.response.status > 0
			? SECURITY_HEADERS.filter(
					(h) =>
						(h.appliesTo === "all" || isDocument) &&
						(!h.secureOnly || isSecure) &&
						!presentNames.has(h.name)
				).map((h) => h.name)
			: [];

	return { present, missing };
}
