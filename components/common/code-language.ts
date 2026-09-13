import { getBaseMimeType } from "@/lib/har-parser";

export type CodeLanguage = "json" | "html" | "xml" | "javascript" | "css" | "text";

/** Picks a syntax highlighter from a MIME type, sniffing JSON when unlabeled. */
export function languageForMime(mimeType: string | undefined, text = ""): CodeLanguage {
	const mime = getBaseMimeType(mimeType);
	if (mime.includes("json")) return "json";
	if (mime === "text/html" || mime === "application/xhtml+xml") return "html";
	if (mime.includes("xml") || mime === "image/svg+xml") return "xml";
	if (mime.includes("javascript") || mime.includes("ecmascript")) return "javascript";
	if (mime === "text/css") return "css";
	const trimmed = text.trimStart();
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			JSON.parse(text);
			return "json";
		} catch {
			// not JSON
		}
	}
	return "text";
}

/** Pretty-prints JSON; returns the input unchanged when it is not valid JSON. */
export function formatJson(text: string): string {
	try {
		return JSON.stringify(JSON.parse(text), null, 2);
	} catch {
		return text;
	}
}
