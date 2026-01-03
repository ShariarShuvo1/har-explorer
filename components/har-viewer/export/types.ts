import { HAREntry } from "@/lib/stores/har-store";

export type ExportScope = "all" | "selected" | "filtered" | "bookmarked";

export type ExportFormat = "markdown" | "txt" | "har" | "openapi";

export type GroupByOption = "none" | "domain" | "method" | "status";

export interface UniqueEndpoint {
	pattern: string;
	method: string;
	domain: string;
	path: string;
	entries: HAREntry[];
	requestSchema: Record<string, unknown> | null;
	responseSchema: Record<string, unknown> | null;
	queryParams: Map<string, Set<string>>;
	requestHeaders: Map<string, Set<string>>;
	responseHeaders: Map<string, Set<string>>;
	statusCodes: Set<number>;
	avgResponseTime: number;
	totalCalls: number;
}

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
}
