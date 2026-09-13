"use client";

import { useMemo } from "react";
import {
	AlertTriangle,
	CheckCircle2,
	Info,
	Lightbulb,
	Lock,
	LockOpen,
	XCircle,
} from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import {
	analyzeSecurity,
	getSecurityHeaderStatus,
	getTransportSecurity,
} from "@/lib/entry/security-analysis";
import type { SecurityIssue, SecuritySeverity } from "@/lib/entry/types";
import { Badge } from "@/components/ui/badge";
import { KeyValueList } from "@/components/common/key-value";
import type { Tone } from "@/components/common/stat-card";
import { cn } from "@/lib/cn";
import { EmptyNote, Section, StatChip, TONE_BADGE, TabBody } from "./shared";

const SEVERITY: Record<SecuritySeverity, { label: string; tone: Tone; icon: typeof Info }> = {
	critical: { label: "Critical", tone: "destructive", icon: XCircle },
	high: { label: "High", tone: "destructive", icon: AlertTriangle },
	medium: { label: "Medium", tone: "warning", icon: AlertTriangle },
	low: { label: "Low", tone: "info", icon: Info },
	info: { label: "Info", tone: "default", icon: Info },
};

const SEVERITY_ORDER: SecuritySeverity[] = ["critical", "high", "medium", "low", "info"];

const ICON_TONE: Record<Tone, string> = {
	default: "text-muted-foreground",
	primary: "text-primary",
	success: "text-success",
	warning: "text-warning",
	destructive: "text-destructive",
	info: "text-info",
};

function Finding({ issue }: { issue: SecurityIssue }) {
	const config = SEVERITY[issue.severity];
	const Icon = config.icon;
	return (
		<li className="flex min-w-0 gap-3 px-3 py-3">
			<Icon className={cn("mt-0.5 size-4 shrink-0", ICON_TONE[config.tone])} />
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<Badge
						variant="outline"
						className={cn(
							"text-[11px] uppercase",
							TONE_BADGE[config.tone],
							issue.severity === "critical" && "bg-destructive text-white dark:bg-destructive/70"
						)}
					>
						{config.label}
					</Badge>
					<span className="text-xs text-muted-foreground">{issue.category}</span>
				</div>
				<p className="text-sm font-medium break-words">{issue.message}</p>
				{issue.recommendation && (
					<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
						<Lightbulb className="mt-0.5 size-3.5 shrink-0" />
						<span className="min-w-0 break-words">{issue.recommendation}</span>
					</p>
				)}
			</div>
		</li>
	);
}

export function SecurityTab({ entry }: { entry: HAREntry }) {
	const issues = useMemo(() => analyzeSecurity(entry), [entry]);
	const headerStatus = useMemo(() => getSecurityHeaderStatus(entry), [entry]);
	const { scheme, security } = getTransportSecurity(entry.request.url);

	const counts = issues.reduce<Record<SecuritySeverity, number>>(
		(acc, issue) => {
			acc[issue.severity] += 1;
			return acc;
		},
		{ critical: 0, high: 0, medium: 0, low: 0, info: 0 }
	);
	const problemCount = issues.length - counts.info;
	const protocolTone: Tone =
		security === "secure" ? "success" : security === "local" ? "info" : "destructive";
	const cookieIssues = issues.filter((issue) => issue.category === "Cookies");
	const otherIssues = issues.filter((issue) => issue.category !== "Cookies");

	return (
		<TabBody>
			<div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:grid-cols-6">
				<StatChip
					label="Protocol"
					value={scheme ? scheme.toUpperCase() : "Unknown"}
					tone={protocolTone}
					icon={security === "secure" ? Lock : LockOpen}
					className="col-span-2 @md:col-span-1"
				/>
				{SEVERITY_ORDER.map((severity) => (
					<StatChip
						key={severity}
						label={SEVERITY[severity].label}
						value={counts[severity]}
						tone={counts[severity] > 0 ? SEVERITY[severity].tone : "default"}
					/>
				))}
			</div>

			{problemCount === 0 && (
				<div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
					<CheckCircle2 className="size-5 shrink-0 text-success" />
					<div className="min-w-0">
						<p className="text-sm font-medium">No security issues detected</p>
						<p className="text-xs text-muted-foreground">
							Based on the checks that apply to this response
						</p>
					</div>
				</div>
			)}

			{otherIssues.length > 0 && (
				<Section title="Findings" count={otherIssues.length}>
					<ul className="divide-y rounded-lg border">
						{otherIssues.map((issue, i) => (
							<Finding key={`${issue.category}-${i}`} issue={issue} />
						))}
					</ul>
				</Section>
			)}

			{cookieIssues.length > 0 && (
				<Section title="Cookie flags" count={cookieIssues.length}>
					<ul className="divide-y rounded-lg border">
						{cookieIssues.map((issue, i) => (
							<Finding key={`cookie-${i}`} issue={issue} />
						))}
					</ul>
				</Section>
			)}

			<Section title="Security headers">
				{headerStatus.present.length === 0 && headerStatus.missing.length === 0 ? (
					<EmptyNote>No security headers apply to this response.</EmptyNote>
				) : (
					<div className="space-y-4">
						{headerStatus.present.length > 0 && (
							<div className="space-y-2">
								<h4 className="flex items-center gap-1.5 text-xs font-medium text-success">
									<CheckCircle2 className="size-3.5" />
									Present ({headerStatus.present.length})
								</h4>
								<KeyValueList rows={headerStatus.present} nameWidth="13rem" />
							</div>
						)}
						{headerStatus.missing.length > 0 && (
							<div className="space-y-2">
								<h4 className="flex items-center gap-1.5 text-xs font-medium text-warning">
									<XCircle className="size-3.5" />
									Missing ({headerStatus.missing.length})
								</h4>
								<div className="flex flex-wrap gap-1.5">
									{headerStatus.missing.map((name) => (
										<Badge
											key={name}
											variant="outline"
											className={cn(
												"max-w-full font-mono text-[11px] font-normal",
												TONE_BADGE.warning
											)}
										>
											<span className="truncate">{name}</span>
										</Badge>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</Section>
		</TabBody>
	);
}
