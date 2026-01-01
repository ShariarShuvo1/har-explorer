import { HARData } from "./stores/har-store";

export async function parseHARFile(file: File): Promise<HARData> {
	const text = await file.text();
	const data = JSON.parse(text);

	if (!data.log || !data.log.entries) {
		throw new Error("Invalid HAR file format");
	}

	return data as HARData;
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function formatTime(ms: number): string {
	if (ms < 1000) return Math.round(ms) + " ms";
	return (ms / 1000).toFixed(2) + " s";
}

export function getMethodColor(method: string): string {
	const colors: Record<string, string> = {
		GET: "bg-blue-500",
		POST: "bg-green-500",
		PUT: "bg-orange-500",
		DELETE: "bg-red-500",
		PATCH: "bg-purple-500",
		HEAD: "bg-gray-500",
		OPTIONS: "bg-yellow-500",
	};
	return colors[method] || "bg-gray-500";
}

export function getStatusColor(status: number): string {
	if (status >= 200 && status < 300) return "text-green-500";
	if (status >= 300 && status < 400) return "text-blue-500";
	if (status >= 400 && status < 500) return "text-orange-500";
	if (status >= 500) return "text-red-500";
	return "text-gray-500";
}

export function getStatusBgColor(status: number): string {
	if (status >= 200 && status < 300)
		return "bg-green-500/10 border-green-500/30";
	if (status >= 300 && status < 400)
		return "bg-blue-500/10 border-blue-500/30";
	if (status >= 400 && status < 500)
		return "bg-orange-500/10 border-orange-500/30";
	if (status >= 500) return "bg-red-500/10 border-red-500/30";
	return "bg-gray-500/10 border-gray-500/30";
}

export function extractDomain(url: string): string {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname;
	} catch {
		return url;
	}
}

export function extractPath(url: string): string {
	try {
		const urlObj = new URL(url);
		return urlObj.pathname + urlObj.search;
	} catch {
		return url;
	}
}
