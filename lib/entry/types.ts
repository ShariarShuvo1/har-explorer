import type { HARNameValue } from "@/lib/har-types";

/** Keys (object properties or array indices) leading to a field of an entry. */
export type FieldPath = ReadonlyArray<string | number>;

export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "info";

export interface SecurityIssue {
	severity: SecuritySeverity;
	category: string;
	message: string;
	recommendation?: string;
}

export type CacheStatus = "fresh" | "stale" | "revalidate" | "heuristic" | "not-storable" | "none";

export type CacheSource =
	"network" | "memory-cache" | "disk-cache" | "revalidated" | "service-worker";

export interface CacheDirective {
	name: string;
	value?: string;
}

export interface CacheInfo {
	status: CacheStatus;
	source: CacheSource;
	directives: CacheDirective[];
	/** Every cache-related response header that is present. */
	headers: HARNameValue[];
	cacheControl?: string;
	expires?: string;
	etag?: string;
	lastModified?: string;
	/** Seconds, from the Age header. */
	age?: number;
	/** Seconds. */
	maxAge?: number;
	/** Seconds; applies to shared caches only. */
	sMaxAge?: number;
	/** Seconds the response may be reused by the browser without revalidation. */
	freshnessLifetime?: number;
	isHeuristic: boolean;
	noStore: boolean;
	noCache: boolean;
	isPrivate: boolean;
	isPublic: boolean;
	immutable: boolean;
	hasValidator: boolean;
	/** Expires is ignored because max-age (or no-store) takes precedence. */
	expiresIgnored: boolean;
}

export interface CacheRecommendation {
	type: "warning" | "info";
	text: string;
}

export interface PerformanceMetrics {
	totalTime: number;
	/** Denominator for phase percentages: the larger of the entry time and the phase sum. */
	breakdownTotal: number;
	ttfb: number;
	blocked: number;
	dnsLookup: number;
	tcpConnection: number;
	tlsHandshake: number;
	requestSent: number;
	serverProcessing: number;
	contentDownload: number;
	/** Share of the total time spent downloading the body, 0-100. */
	efficiency: number;
	hasTimingData: boolean;
}
