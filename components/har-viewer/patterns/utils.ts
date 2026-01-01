import { HAREntry } from "@/lib/stores/har-store";

export function extractDomain(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

export function getResourceType(entry: HAREntry): string {
	const mimeType = entry.response.content.mimeType?.toLowerCase() || "";
	const url = entry.request.url.toLowerCase();

	if (mimeType.includes("javascript") || url.endsWith(".js")) return "script";
	if (mimeType.includes("css") || url.endsWith(".css")) return "stylesheet";
	if (mimeType.includes("image")) return "image";
	if (mimeType.includes("font") || /\.(woff|woff2|ttf|otf)$/.test(url))
		return "font";
	if (mimeType.includes("video")) return "video";
	if (mimeType.includes("html")) return "document";

	return "other";
}

export function isStaticResource(entry: HAREntry): boolean {
	return /\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf|ico)$/i.test(
		entry.request.url
	);
}

export function getCookieSize(entry: HAREntry): number {
	return entry.request.cookies.reduce(
		(sum: number, cookie: Record<string, unknown>) =>
			sum +
			((cookie.name as string)?.length || 0) +
			((cookie.value as string)?.length || 0),
		0
	);
}

export function isApiRequest(url: string): boolean {
	return /\/(api|graphql|rest|v\d+)\//i.test(url) || /\.json$/i.test(url);
}

export function getTimingPhase(
	entry: HAREntry,
	phase: "blocked" | "dns" | "ssl" | "connect" | "send" | "wait" | "receive"
): number {
	const value = entry.timings[phase];
	return typeof value === "number" && value >= 0 ? value : 0;
}

export function calculatePotentialSavings(
	count: number,
	avgSize: number,
	savingsPercent: number
): string {
	const totalBytes = count * avgSize;
	const savedBytes = (totalBytes * savingsPercent) / 100;

	if (savedBytes < 1024) return `${Math.round(savedBytes)} B`;
	if (savedBytes < 1024 * 1024) return `${Math.round(savedBytes / 1024)} KB`;
	return `${(savedBytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(2)}s`;
}
