import { HAREntry } from "@/lib/stores/har-store";

export interface EntryDetailsProps {
	entry: HAREntry;
	index: number;
}

export interface TabConfig {
	id: TabId;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

export type TabId =
	| "general"
	| "headers"
	| "request"
	| "response"
	| "timings"
	| "security"
	| "cache"
	| "performance"
	| "export";

export interface DetailSectionProps {
	title: string;
	icon?: React.ReactNode;
	children: React.ReactNode;
}

export interface CompactCardProps {
	label: string;
	value: string;
	icon?: React.ReactNode;
	className?: string;
	editable?: boolean;
	onSave?: (value: string) => void;
}

export interface TimingCardProps {
	label: string;
	value: number;
	color: string;
	isTotal?: boolean;
}

export interface HeadersSectionProps {
	title: string;
	headers: Array<{ name: string; value: string }>;
	onUpdateHeader: (i: number, field: string, value: string) => void;
}

export interface PreviewProps {
	entry: HAREntry;
	sanitizeBase64: (base64: string) => string;
}

export interface ImagePreviewProps extends PreviewProps {
	imageError: boolean;
	setImageError: (error: boolean) => void;
}

export interface HtmlPreviewProps {
	entry: HAREntry;
	theme: string;
	handleUpdateField: (path: string[], value: string | number) => void;
}

export interface SecurityIssue {
	severity: "critical" | "high" | "medium" | "low" | "info";
	category: string;
	message: string;
	recommendation?: string;
}

export interface CacheInfo {
	isCached: boolean;
	cacheControl?: string;
	expires?: string;
	etag?: string;
	lastModified?: string;
	age?: string;
	maxAge?: number;
	isStale: boolean;
}

export interface PerformanceMetrics {
	totalTime: number;
	ttfb: number;
	downloadTime: number;
	dnsLookup: number;
	tcpConnection: number;
	tlsHandshake: number;
	requestSent: number;
	contentDownload: number;
	serverProcessing: number;
	efficiency: number;
}
