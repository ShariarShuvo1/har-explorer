import type { HAREntry } from "@/lib/har-types";
import { getUrlParts } from "./path-template";

const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/i;

function stripControlCharacters(text: string): string {
	let result = "";
	for (const char of text) {
		const code = char.charCodeAt(0);
		result += code < 32 || code === 127 ? "-" : char;
	}
	return result;
}

/** Makes a string safe to use as a download file name on every platform. */
export function sanitizeFilename(name: string, fallback = "export"): string {
	const cleaned = stripControlCharacters(name)
		.replace(/[<>:"/\\|?*\s]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "")
		.slice(0, 120);
	if (!cleaned) return fallback;
	return WINDOWS_RESERVED.test(cleaned) ? `_${cleaned}` : cleaned;
}

/** e.g. "patch-v1-users-123" for PATCH https://api.example.com/v1/users/123 */
export function getEntryFileStem(entry: HAREntry): string {
	const { pathname } = getUrlParts(entry.request.url);
	const path = pathname
		.split("/")
		.map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ""))
		.filter(Boolean)
		.join("-")
		.slice(0, 80);
	return sanitizeFilename(`${entry.request.method.toLowerCase()}-${path || "root"}`, "request");
}

/** The loaded HAR file name without its extension, or a generic stem. */
export function getHarFileStem(fileName: string | null | undefined): string {
	const stem = (fileName ?? "").replace(/\.[^.]*$/, "");
	return sanitizeFilename(stem, "har");
}

export function todayStamp(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Starts a client-side download of `content` and releases the object URL afterwards. */
export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
	const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.rel = "noopener";
	anchor.style.display = "none";
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	// Some browsers read the blob asynchronously after click().
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
