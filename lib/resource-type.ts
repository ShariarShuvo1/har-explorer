import type { HAREntry, ResourceType } from "./har-types";
import { extractPathname, getBaseMimeType, getHeaderValue } from "./har-parser";

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
	all: "All",
	fetch: "Fetch/XHR",
	doc: "Document",
	css: "CSS",
	js: "JS",
	font: "Font",
	img: "Image",
	media: "Media",
	manifest: "Manifest",
	ws: "WebSocket",
	wasm: "Wasm",
	other: "Other",
};

/** Chrome DevTools' `_resourceType` values mapped onto our categories. */
const DEVTOOLS_RESOURCE_TYPES: Record<string, ResourceType> = {
	document: "doc",
	stylesheet: "css",
	script: "js",
	image: "img",
	media: "media",
	font: "font",
	xhr: "fetch",
	fetch: "fetch",
	eventsource: "fetch",
	websocket: "ws",
	manifest: "manifest",
	wasm: "wasm",
	preflight: "other",
	ping: "other",
	texttrack: "other",
	cspviolationreport: "other",
	signedexchange: "other",
	other: "other",
};

/**
 * Classifies an entry the way the DevTools network panel does: the browser's
 * own `_resourceType` wins when present, otherwise the MIME type and then the
 * URL extension are used.
 */
export function getResourceType(entry: HAREntry): ResourceType {
	const devtoolsType =
		typeof entry._resourceType === "string"
			? DEVTOOLS_RESOURCE_TYPES[entry._resourceType.toLowerCase()]
			: undefined;
	if (devtoolsType) return devtoolsType;

	const method = entry.request.method.toUpperCase();
	if (method === "OPTIONS") return "other";

	const url = entry.request.url.toLowerCase();
	if (url.startsWith("ws://") || url.startsWith("wss://")) return "ws";
	if (
		entry.response.status === 101 &&
		getHeaderValue(entry.response.headers, "upgrade")?.toLowerCase() === "websocket"
	) {
		return "ws";
	}

	const mimeType = getBaseMimeType(entry.response.content.mimeType);
	const path = extractPathname(url);

	if (mimeType === "text/html" || mimeType === "application/xhtml+xml") {
		return "doc";
	}
	if (mimeType === "text/css" || path.endsWith(".css")) return "css";
	if (mimeType === "application/wasm" || path.endsWith(".wasm")) {
		return "wasm";
	}
	if (
		mimeType.includes("javascript") ||
		mimeType.includes("ecmascript") ||
		/\.(m?js|cjs)$/.test(path)
	) {
		return "js";
	}
	if (
		mimeType.startsWith("font/") ||
		mimeType.includes("font") ||
		/\.(woff2?|ttf|otf|eot)$/.test(path)
	) {
		return "font";
	}
	if (mimeType.startsWith("image/") || /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp)$/.test(path)) {
		return "img";
	}
	if (
		mimeType.startsWith("video/") ||
		mimeType.startsWith("audio/") ||
		/\.(mp4|webm|ogg|mp3|wav|m4a|m3u8)$/.test(path)
	) {
		return "media";
	}
	if (
		mimeType === "application/manifest+json" ||
		path.endsWith(".webmanifest") ||
		path.endsWith("manifest.json")
	) {
		return "manifest";
	}
	if (
		mimeType.includes("json") ||
		mimeType.includes("xml") ||
		mimeType === "text/event-stream" ||
		mimeType === "application/x-protobuf" ||
		mimeType === "application/grpc-web" ||
		url.includes("/api/") ||
		url.includes("/graphql") ||
		url.includes("/xhr/")
	) {
		return "fetch";
	}

	return "other";
}
