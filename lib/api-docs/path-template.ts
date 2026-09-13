import { extractPathname, safeParseUrl } from "@/lib/har-parser";

export type PathParamKind =
	"integer" | "numeric" | "uuid" | "object-id" | "hash" | "date" | "email" | "token";

export interface PathParam {
	name: string;
	kind: PathParamKind;
	/** Decoded segment value that was replaced. */
	value: string;
	/** Position of the segment within the path (0-based). */
	position: number;
}

export interface PathTemplate {
	/** e.g. "/v1/users/{userId}/orders" */
	template: string;
	params: PathParam[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
const EMAIL = /^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i;
const VERSION_SEGMENT = /^v\d+(?:\.\d+)*$/i;

function safeDecode(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

function isTokenLike(segment: string): boolean {
	if (segment.length < 20) return false;
	if (JWT.test(segment)) return true;
	if (!/^[A-Za-z0-9_-]+$/.test(segment)) return false;
	if (!/\d/.test(segment) || !/[A-Za-z]/.test(segment)) return false;
	// Slugs such as "release-notes-2024-edition" are made of whole words.
	const words = segment.split(/[-_]/);
	return !words.every((word) => /^[A-Za-z]*$/.test(word) || /^\d+$/.test(word));
}

/**
 * Returns the kind of dynamic value a path segment holds, or null when it
 * looks like a literal (e.g. "v1", "api", "graphql", "users", "main.css").
 */
function classifyPathSegment(rawSegment: string): PathParamKind | null {
	const segment = safeDecode(rawSegment);
	if (UUID.test(segment)) return "uuid";
	if (/^\d+$/.test(segment)) {
		return segment.length <= 15 && !/^0\d/.test(segment) ? "integer" : "numeric";
	}
	if (/^[0-9a-f]{24}$/i.test(segment) && /[a-f]/i.test(segment)) {
		return "object-id";
	}
	if (/^[0-9a-f]{16,}$/i.test(segment) && /[a-f]/i.test(segment)) {
		return "hash";
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(segment)) return "date";
	if (EMAIL.test(segment)) return "email";
	if (isTokenLike(segment)) return "token";
	return null;
}

function singularize(word: string): string {
	if (/ies$/i.test(word) && word.length > 4) return word.slice(0, -3) + "y";
	if (/(?:ss|us|is)$/i.test(word)) return word;
	if (/(?:sses|uses|xes|ches|shes|zes)$/i.test(word)) return word.slice(0, -2);
	if (/s$/i.test(word) && word.length > 1) return word.slice(0, -1);
	return word;
}

const KIND_SUFFIX: Record<PathParamKind, string> = {
	integer: "Id",
	numeric: "Id",
	uuid: "Id",
	"object-id": "Id",
	hash: "Hash",
	date: "Date",
	email: "Email",
	token: "Token",
};

function baseNameFromSegment(segment: string | undefined): string {
	if (!segment || VERSION_SEGMENT.test(segment) || /^api$/i.test(segment)) {
		return "";
	}
	const words = safeDecode(segment)
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean);
	if (words.length === 0 || /^\d/.test(words[0])) return "";
	words[words.length - 1] = singularize(words[words.length - 1]);
	return words
		.map((word, i) =>
			i === 0
				? word.charAt(0).toLowerCase() + word.slice(1)
				: word.charAt(0).toUpperCase() + word.slice(1)
		)
		.join("");
}

function splitSegments(pathname: string): string[] {
	// Empty segments (double or trailing slashes) do not identify resources.
	return pathname.split("/").filter(Boolean);
}

function escapeTemplateLiteral(segment: string): string {
	return segment.replace(/\{/g, "%7B").replace(/\}/g, "%7D");
}

/**
 * Replaces ids, UUIDs, hashes, tokens, dates and emails in a path with named
 * parameters. Names come from the preceding segment ("/users/42" becomes
 * "/users/{userId}") and are unique within the path.
 */
export function templatePath(pathname: string): PathTemplate {
	const segments = splitSegments(pathname);
	const params: PathParam[] = [];
	const usedNames = new Set<string>();

	const parts = segments.map((segment, position) => {
		const kind = classifyPathSegment(segment);
		if (!kind) return escapeTemplateLiteral(segment);

		const previous =
			position > 0 && !classifyPathSegment(segments[position - 1])
				? segments[position - 1]
				: undefined;
		const base = baseNameFromSegment(previous);
		const suffix = KIND_SUFFIX[kind];
		const preferred = base ? base + suffix : suffix.toLowerCase();

		let name = preferred;
		for (let n = 2; usedNames.has(name); n++) name = `${preferred}${n}`;
		usedNames.add(name);

		params.push({ name, kind, value: safeDecode(segment), position });
		return `{${name}}`;
	});

	return { template: "/" + parts.join("/"), params };
}

/** The path of a literal (non-templated) request, without trailing slashes. */
export function literalPath(pathname: string): string {
	return "/" + splitSegments(pathname).map(escapeTemplateLiteral).join("/");
}

export interface UrlParts {
	/** "https://api.example.com", or "" when the URL is not absolute. */
	origin: string;
	host: string;
	pathname: string;
}

export function getUrlParts(url: string): UrlParts {
	const parsed = safeParseUrl(url);
	if (parsed && parsed.host) {
		// Non-special schemes report an opaque "null" origin.
		const origin = parsed.origin === "null" ? `${parsed.protocol}//${parsed.host}` : parsed.origin;
		return { origin, host: parsed.host, pathname: parsed.pathname };
	}
	const pathname = extractPathname(url);
	return {
		origin: "",
		host: "",
		pathname: pathname.startsWith("/") ? pathname : `/${pathname}`,
	};
}
