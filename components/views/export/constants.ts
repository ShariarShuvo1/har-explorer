import {
	Bookmark,
	Braces,
	SquareCheck,
	FileArchive,
	FileText,
	Filter,
	Layers,
	NotebookText,
	type LucideIcon,
} from "lucide-react";
import type {
	DocToggleKey,
	ExportFormat,
	ExportOptions,
	ExportScope,
	GroupByOption,
} from "./types";

export const SCOPE_OPTIONS: Record<
	ExportScope,
	{ label: string; icon: LucideIcon; description: string }
> = {
	filtered: {
		label: "Filtered",
		icon: Filter,
		description: "Requests matching the current filters",
	},
	selected: { label: "Selected", icon: SquareCheck, description: "Only the requests you selected" },
	all: { label: "All requests", icon: Layers, description: "Every request in the file" },
	bookmarked: { label: "Bookmarked", icon: Bookmark, description: "Only bookmarked requests" },
};

export interface FormatOption {
	id: ExportFormat;
	label: string;
	description: string;
	icon: LucideIcon;
	extension: string;
	mimeType: string;
	fileSuffix: string;
}

export const FORMAT_OPTIONS: FormatOption[] = [
	{
		id: "markdown",
		label: "Markdown",
		description: "Readable API docs for READMEs and wikis",
		icon: NotebookText,
		extension: ".md",
		mimeType: "text/markdown",
		fileSuffix: "api-docs",
	},
	{
		id: "txt",
		label: "Plain text",
		description: "The same docs without formatting",
		icon: FileText,
		extension: ".txt",
		mimeType: "text/plain",
		fileSuffix: "api-docs",
	},
	{
		id: "openapi",
		label: "OpenAPI JSON",
		description: "OpenAPI 3.0.3 spec for Swagger, Postman or SDK generators",
		icon: Braces,
		extension: ".json",
		mimeType: "application/json",
		fileSuffix: "openapi",
	},
	{
		id: "har",
		label: "HAR",
		description: "A new HAR file with just these requests",
		icon: FileArchive,
		extension: ".har",
		mimeType: "application/json",
		fileSuffix: "export",
	},
];

export const FORMAT_BY_ID = Object.fromEntries(
	FORMAT_OPTIONS.map((option) => [option.id, option])
) as Record<ExportFormat, FormatOption>;

export const GROUP_OPTIONS: Array<{ id: GroupByOption; label: string }> = [
	{ id: "none", label: "No grouping" },
	{ id: "domain", label: "Domain" },
	{ id: "method", label: "Method" },
	{ id: "status", label: "Status" },
];

export const DOC_TOGGLES: Array<{ key: DocToggleKey; label: string; description: string }> = [
	{
		key: "includeHeaders",
		label: "Headers & auth",
		description: "Documented request headers and auth schemes",
	},
	{
		key: "includeQueryParams",
		label: "Query parameters",
		description: "Names, types and example values",
	},
	{
		key: "includeRequestBody",
		label: "Request body",
		description: "Schemas inferred from JSON and form bodies",
	},
	{
		key: "includeResponseSchema",
		label: "Response schemas",
		description: "Schemas inferred from JSON responses",
	},
	{
		key: "includePerformanceMetrics",
		label: "Performance",
		description: "Average response time per endpoint",
	},
	{
		key: "includeCurlExamples",
		label: "cURL examples",
		description: "A ready-to-run command for each endpoint",
	},
];

export const DEFAULT_OPTIONS: Omit<ExportOptions, "scope"> = {
	format: "markdown",
	groupBy: "none",
	includeHeaders: true,
	includeQueryParams: true,
	includeRequestBody: true,
	includeResponseSchema: true,
	includePerformanceMetrics: true,
	includeCurlExamples: true,
	redactSecrets: true,
};

/** Rendering very large Markdown with react-markdown is slow. */
export const MAX_RICH_PREVIEW = 200_000;
/** Text previews beyond this are truncated until the user asks for everything. */
export const MAX_TEXT_PREVIEW = 500_000;
/** HAR previews are built from as many entries as fit in roughly this many bytes. */
export const MAX_HAR_PREVIEW = 500_000;
/** Beyond this, a full HAR preview (or copying it) would freeze the tab. */
export const MAX_HAR_FULL_PREVIEW = 20 * 1024 * 1024;
export const MAX_HAR_COPY = 10 * 1024 * 1024;
