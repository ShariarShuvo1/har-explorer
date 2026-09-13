import {
	AlertCircle,
	AlertTriangle,
	Clock,
	Cookie,
	Database,
	GitMerge,
	Layers,
	ListOrdered,
	Lock,
	RefreshCw,
	Shield,
	Timer,
	type LucideIcon,
} from "lucide-react";
import type { PatternSeverity, PatternType } from "@/lib/patterns";
import type { DetailTab } from "@/lib/stores/har-store";
import type { Tone } from "@/components/common/stat-card";
import { cn } from "@/lib/cn";

/** How many affected requests the details sheet renders per "Show more". */
export const AFFECTED_PAGE_SIZE = 50;

export const PATTERN_ICONS: Record<PatternType, LucideIcon> = {
	duplicate: RefreshCw,
	failed: AlertTriangle,
	redirect: GitMerge,
	cors: Shield,
	uncached: Database,
	sequential: ListOrdered,
	"waterfall-gaps": Clock,
	"mixed-content": Lock,
	"large-cookies": Cookie,
	"api-batching": Layers,
	"priority-mismatch": AlertCircle,
	"timing-anomalies": Timer,
};

export const PATTERN_CATEGORY: Record<PatternType, string> = {
	duplicate: "Performance",
	failed: "Reliability",
	redirect: "Performance",
	cors: "Security",
	uncached: "Caching",
	sequential: "Performance",
	"waterfall-gaps": "Performance",
	"mixed-content": "Security",
	"large-cookies": "Performance",
	"api-batching": "Performance",
	"priority-mismatch": "Performance",
	"timing-anomalies": "Network",
};

/** Details-pane section that best explains why a request was flagged. */
export const PATTERN_DETAIL_TAB: Record<PatternType, DetailTab> = {
	duplicate: "payload",
	failed: "response",
	redirect: "headers",
	cors: "headers",
	uncached: "cache",
	sequential: "timing",
	"waterfall-gaps": "timing",
	"mixed-content": "security",
	"large-cookies": "payload",
	"api-batching": "payload",
	"priority-mismatch": "overview",
	"timing-anomalies": "timing",
};

export const SEVERITY_LABELS: Record<PatternSeverity, string> = {
	high: "High",
	medium: "Medium",
	low: "Low",
};

export const SEVERITY_TONE: Record<PatternSeverity, Tone> = {
	high: "destructive",
	medium: "warning",
	low: "info",
};

const SEVERITY_BADGE: Record<PatternSeverity, string> = {
	high: "bg-destructive/10 text-destructive",
	medium: "bg-warning/15 text-warning",
	low: "bg-info/12 text-info",
};

export const SEVERITY_ICON_SURFACE: Record<PatternSeverity, string> = SEVERITY_BADGE;

export function SeverityBadge({
	severity,
	className,
}: {
	severity: PatternSeverity;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium",
				SEVERITY_BADGE[severity],
				className
			)}
		>
			{SEVERITY_LABELS[severity]}
		</span>
	);
}
