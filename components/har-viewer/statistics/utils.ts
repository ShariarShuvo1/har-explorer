import type { HAREntry } from "@/lib/stores/har-store";

export function getInitiatorType(entry: HAREntry): string {
	if (!entry._initiator) return "unknown";
	if (typeof entry._initiator === "string") return entry._initiator;
	if (
		typeof entry._initiator === "object" &&
		entry._initiator &&
		"type" in entry._initiator
	) {
		return String(entry._initiator.type);
	}
	return "unknown";
}

export function getPriority(entry: HAREntry): string {
	if (!entry._priority) return "unknown";
	if (typeof entry._priority === "string") return entry._priority;
	return "unknown";
}

export function getResourceType(entry: HAREntry): string {
	if (entry._resourceType) return entry._resourceType;

	const mime = entry.response.content.mimeType.toLowerCase();
	if (mime.includes("javascript")) return "script";
	if (mime.includes("css")) return "stylesheet";
	if (mime.includes("image")) return "image";
	if (mime.includes("font")) return "font";
	if (mime.includes("html")) return "document";
	if (mime.includes("json") || mime.includes("xml")) return "xhr";
	if (mime.includes("video")) return "media";

	return "other";
}

export function getTransferSize(entry: HAREntry): number | null {
	if (entry.response._transferSize !== undefined) {
		return entry.response._transferSize;
	}
	if (entry.response.bodySize > 0 && entry.response.headersSize > 0) {
		return entry.response.bodySize + entry.response.headersSize;
	}
	return null;
}

export function detectCDN(domain: string): boolean {
	const cdnPatterns = [
		"cdn",
		"cloudflare",
		"akamai",
		"fastly",
		"cloudfront",
		"azureedge",
		"jsdelivr",
		"unpkg",
		"googleusercontent",
		"fbcdn",
		"twimg",
	];
	return cdnPatterns.some((pattern) =>
		domain.toLowerCase().includes(pattern)
	);
}

export function getPriorityColor(priority: string): string {
	switch (priority.toLowerCase()) {
		case "veryhigh":
		case "high":
			return "bg-red-500/20 text-red-500";
		case "medium":
			return "bg-yellow-500/20 text-yellow-500";
		case "low":
		case "verylow":
			return "bg-blue-500/20 text-blue-500";
		default:
			return "bg-gray-500/20 text-gray-500";
	}
}

export function getInitiatorColor(type: string): string {
	switch (type.toLowerCase()) {
		case "parser":
			return "bg-purple-500/20 text-purple-500";
		case "script":
			return "bg-orange-500/20 text-orange-500";
		case "prefetch":
		case "preload":
			return "bg-green-500/20 text-green-500";
		case "redirect":
			return "bg-red-500/20 text-red-500";
		case "xhr":
		case "fetch":
			return "bg-blue-500/20 text-blue-500";
		default:
			return "bg-gray-500/20 text-gray-500";
	}
}

export function getResourceTypeColor(type: string): string {
	switch (type.toLowerCase()) {
		case "document":
			return "bg-purple-500/20 text-purple-500";
		case "script":
			return "bg-yellow-500/20 text-yellow-500";
		case "stylesheet":
			return "bg-blue-500/20 text-blue-500";
		case "image":
			return "bg-green-500/20 text-green-500";
		case "font":
			return "bg-pink-500/20 text-pink-500";
		case "xhr":
		case "fetch":
			return "bg-orange-500/20 text-orange-500";
		case "media":
			return "bg-red-500/20 text-red-500";
		default:
			return "bg-gray-500/20 text-gray-500";
	}
}
