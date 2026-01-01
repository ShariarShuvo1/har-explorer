"use client";

import {
	Shield,
	AlertTriangle,
	Info,
	CheckCircle,
	XCircle,
	Lightbulb,
} from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { DetailSection, CompactCard } from "./shared-components";
import { analyzeSecurityHeaders } from "./utils";
import { cn } from "@/lib/cn";
import { SecurityIssue } from "./types";

interface SecurityTabProps {
	entry: HAREntry;
}

function SecurityIssueCard({ issue }: { issue: SecurityIssue }) {
	const severityConfig = {
		critical: {
			icon: XCircle,
			color: "text-red-500",
			bg: "bg-red-500/10",
			border: "border-red-500/30",
		},
		high: {
			icon: AlertTriangle,
			color: "text-orange-500",
			bg: "bg-orange-500/10",
			border: "border-orange-500/30",
		},
		medium: {
			icon: AlertTriangle,
			color: "text-yellow-500",
			bg: "bg-yellow-500/10",
			border: "border-yellow-500/30",
		},
		low: {
			icon: Info,
			color: "text-blue-500",
			bg: "bg-blue-500/10",
			border: "border-blue-500/30",
		},
		info: {
			icon: Info,
			color: "text-gray-500",
			bg: "bg-gray-500/10",
			border: "border-gray-500/30",
		},
	};

	const config = severityConfig[issue.severity];
	const Icon = config.icon;

	return (
		<div
			className={cn(
				"rounded p-3 border space-y-2",
				config.bg,
				config.border
			)}
		>
			<div className="flex items-start gap-2">
				<Icon className={cn("w-4 h-4 shrink-0 mt-0.5", config.color)} />
				<div className="flex-1 space-y-1">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
								config.color,
								config.bg,
								config.border,
								"border"
							)}
						>
							{issue.severity}
						</span>
						<span className="text-xs font-medium text-foreground">
							{issue.category}
						</span>
					</div>
					<p className={cn("text-xs", config.color)}>
						{issue.message}
					</p>
					{issue.recommendation && (
						<p className="text-[10px] text-muted italic mt-1 flex items-start gap-1">
							<Lightbulb className="w-3 h-3 shrink-0" />
							<span>{issue.recommendation}</span>
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function SecurityHeadersList({
	headers,
}: {
	headers: Array<{ name: string; value: string }>;
}) {
	const securityHeaders = [
		"strict-transport-security",
		"content-security-policy",
		"x-frame-options",
		"x-content-type-options",
		"x-xss-protection",
		"referrer-policy",
		"permissions-policy",
		"cross-origin-embedder-policy",
		"cross-origin-opener-policy",
		"cross-origin-resource-policy",
	];

	const found = headers.filter((h) =>
		securityHeaders.includes(h.name.toLowerCase())
	);
	const missing = securityHeaders.filter(
		(sh) => !headers.some((h) => h.name.toLowerCase() === sh)
	);

	return (
		<div className="space-y-2">
			{found.length > 0 && (
				<div className="space-y-1">
					<div className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-1">
						<CheckCircle className="w-3 h-3" />
						Present ({found.length})
					</div>
					{found.map((header, i) => (
						<div
							key={i}
							className="bg-green-500/10 border border-green-500/30 rounded p-2"
						>
							<div className="font-mono text-xs font-medium text-green-400 mb-0.5">
								{header.name}
							</div>
							<div className="font-mono text-[10px] text-foreground/70 break-all">
								{header.value}
							</div>
						</div>
					))}
				</div>
			)}

			{missing.length > 0 && (
				<div className="space-y-1">
					<div className="text-[10px] font-bold text-orange-500 uppercase flex items-center gap-1">
						<XCircle className="w-3 h-3" />
						Missing ({missing.length})
					</div>
					<div className="flex flex-wrap gap-1">
						{missing.map((header, i) => (
							<span
								key={i}
								className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 font-mono"
							>
								{header}
							</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export function SecurityTab({ entry }: SecurityTabProps) {
	const issues = analyzeSecurityHeaders(entry.response.headers);
	const criticalCount = issues.filter(
		(i) => i.severity === "critical"
	).length;
	const highCount = issues.filter((i) => i.severity === "high").length;
	const mediumCount = issues.filter((i) => i.severity === "medium").length;

	const isHttps = entry.request.url.startsWith("https://");

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-4 gap-2">
				<CompactCard
					label="Protocol"
					value={isHttps ? "HTTPS" : "HTTP"}
					icon={
						isHttps ? (
							<CheckCircle className="w-3 h-3 text-green-500" />
						) : (
							<XCircle className="w-3 h-3 text-red-500" />
						)
					}
					className={
						isHttps
							? "bg-green-500/10 text-green-400 border-green-500/30"
							: "bg-red-500/10 text-red-400 border-red-500/30"
					}
				/>
				<CompactCard
					label="Critical"
					value={criticalCount.toString()}
					icon={<XCircle className="w-3 h-3 text-red-500" />}
					className={
						criticalCount > 0
							? "bg-red-500/10 border-red-500/30"
							: ""
					}
				/>
				<CompactCard
					label="High"
					value={highCount.toString()}
					icon={<AlertTriangle className="w-3 h-3 text-orange-500" />}
					className={
						highCount > 0
							? "bg-orange-500/10 border-orange-500/30"
							: ""
					}
				/>
				<CompactCard
					label="Medium"
					value={mediumCount.toString()}
					icon={<AlertTriangle className="w-3 h-3 text-yellow-500" />}
					className={
						mediumCount > 0
							? "bg-yellow-500/10 border-yellow-500/30"
							: ""
					}
				/>
			</div>

			{issues.length > 0 && (
				<DetailSection
					title="Security Issues"
					icon={
						<AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
					}
				>
					<div className="space-y-2">
						{issues.map((issue, i) => (
							<SecurityIssueCard key={i} issue={issue} />
						))}
					</div>
				</DetailSection>
			)}

			<DetailSection
				title="Security Headers"
				icon={<Shield className="w-3.5 h-3.5 text-green-500" />}
			>
				<SecurityHeadersList headers={entry.response.headers} />
			</DetailSection>

			{issues.length === 0 && (
				<div className="text-center py-4 text-green-500 bg-green-500/10 border border-green-500/30 rounded">
					<CheckCircle className="w-8 h-8 mx-auto mb-2" />
					<p className="text-sm font-medium">
						No security issues detected
					</p>
					<p className="text-xs text-muted mt-1">
						All recommended security headers are present
					</p>
				</div>
			)}
		</div>
	);
}
