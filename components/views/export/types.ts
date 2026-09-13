import type { ExportScope } from "@/lib/stores/har-store";

export type { ExportScope };

export type ExportFormat = "markdown" | "txt" | "har" | "openapi";

export type GroupByOption = "none" | "domain" | "method" | "status";

export interface ExportOptions {
	scope: ExportScope;
	format: ExportFormat;
	groupBy: GroupByOption;
	includeHeaders: boolean;
	includeQueryParams: boolean;
	includeRequestBody: boolean;
	includeResponseSchema: boolean;
	includePerformanceMetrics: boolean;
	includeCurlExamples: boolean;
	/** Replace credentials, cookies and token-like values in every format. */
	redactSecrets: boolean;
}

/** Boolean document options shown as switches for Markdown and plain text. */
export type DocToggleKey = Extract<
	keyof ExportOptions,
	| "includeHeaders"
	| "includeQueryParams"
	| "includeRequestBody"
	| "includeResponseSchema"
	| "includePerformanceMetrics"
	| "includeCurlExamples"
>;
