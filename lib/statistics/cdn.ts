import { safeParseUrl } from "@/lib/har-parser";
import type { HAREntry, HARNameValue } from "@/lib/har-types";
import { lowerCaseHeaderMap } from "./utils";

const CDN_HOST_SUFFIXES: ReadonlyArray<readonly [string, string]> = [
	["cloudflare.com", "Cloudflare"],
	["cloudflare.net", "Cloudflare"],
	["akamai.net", "Akamai"],
	["akamaihd.net", "Akamai"],
	["akamaized.net", "Akamai"],
	["akamaiedge.net", "Akamai"],
	["edgekey.net", "Akamai"],
	["edgesuite.net", "Akamai"],
	["fastly.net", "Fastly"],
	["fastlylb.net", "Fastly"],
	["cloudfront.net", "CloudFront"],
	["azureedge.net", "Azure CDN"],
	["azurefd.net", "Azure Front Door"],
	["msecnd.net", "Azure CDN"],
	["jsdelivr.net", "jsDelivr"],
	["unpkg.com", "unpkg"],
	["bootstrapcdn.com", "BootstrapCDN"],
	["gstatic.com", "Google"],
	["googleusercontent.com", "Google"],
	["ytimg.com", "Google"],
	["ggpht.com", "Google"],
	["fbcdn.net", "Meta"],
	["twimg.com", "X"],
	["stackpathcdn.com", "StackPath"],
	["stackpathdns.com", "StackPath"],
	["kxcdn.com", "KeyCDN"],
	["b-cdn.net", "BunnyCDN"],
	["cdn77.org", "CDN77"],
	["llnwd.net", "Edgio"],
	["edgecastcdn.net", "Edgio"],
	["alicdn.com", "Alibaba Cloud"],
];

/** Host labels such as "cdn", "cdn2", "cdn-images" or "example-cdn". */
const CDN_HOST_LABEL = /^cdn\d*(?:-|$)|-cdn\d*$/;

function detectCDNFromHost(host: string): string | null {
	for (const [suffix, provider] of CDN_HOST_SUFFIXES) {
		if (host === suffix || host.endsWith("." + suffix)) return provider;
	}
	return null;
}

function hasCDNHostLabel(host: string): boolean {
	return host
		.split(".")
		.slice(0, -1)
		.some((label) => CDN_HOST_LABEL.test(label));
}

function detectCDNFromHeaders(headers: HARNameValue[]): string | null {
	if (headers.length === 0) return null;
	const map = lowerCaseHeaderMap(headers);
	const server = (map.get("server") ?? "").toLowerCase();
	const via = (map.get("via") ?? "").toLowerCase();
	const xCache = (map.get("x-cache") ?? "").toLowerCase();
	const servedBy = (map.get("x-served-by") ?? "").toLowerCase();

	if (map.has("cf-ray") || server.includes("cloudflare")) return "Cloudflare";
	if (
		map.has("x-amz-cf-id") ||
		map.has("x-amz-cf-pop") ||
		via.includes("cloudfront") ||
		xCache.includes("cloudfront")
	) {
		return "CloudFront";
	}
	if (
		map.has("x-fastly-request-id") ||
		map.has("fastly-debug-digest") ||
		/\bcache-[a-z0-9-]+/.test(servedBy)
	) {
		return "Fastly";
	}
	if (
		server.includes("akamai") ||
		map.has("akamai-grn") ||
		map.has("x-akamai-transformed") ||
		map.has("x-akamai-request-id") ||
		via.includes("akamai")
	) {
		return "Akamai";
	}
	if (map.has("x-azure-ref") || map.has("x-msedge-ref")) {
		return "Azure Front Door";
	}
	if (map.has("x-vercel-cache") || map.has("x-vercel-id")) return "Vercel";
	if (map.has("x-nf-request-id")) return "Netlify";
	if (server.includes("bunnycdn") || map.has("cdn-pullzone")) {
		return "BunnyCDN";
	}
	if (server.includes("keycdn")) return "KeyCDN";
	if (server.includes("cdn77")) return "CDN77";
	if (map.has("x-sucuri-id")) return "Sucuri";
	if (map.has("x-iinfo")) return "Imperva";
	if (via.includes("google")) return "Google Cloud";

	const xCdn = map.get("x-cdn")?.trim();
	if (xCdn) return xCdn.slice(0, 32);
	if (/varnish|fastly|\bcdn\b/.test(via) || servedBy || xCache) return "CDN";
	return null;
}

/** CDN provider serving this response, detected from host or headers. */
export function detectCDNProvider(entry: HAREntry): string | null {
	const host = safeParseUrl(entry.request.url)?.hostname.toLowerCase() ?? "";
	return (
		(host ? detectCDNFromHost(host) : null) ??
		detectCDNFromHeaders(entry.response.headers) ??
		(host && hasCDNHostLabel(host) ? "CDN" : null)
	);
}
