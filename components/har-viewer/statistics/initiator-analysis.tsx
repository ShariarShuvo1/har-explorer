"use client";

import { useMemo } from "react";
import { formatBytes, formatTime, extractDomain } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { GitBranch, Code2 } from "lucide-react";
import type { HAREntry } from "@/lib/stores/har-store";
import { getInitiatorType, getInitiatorColor } from "./utils";
import type { InitiatorStats } from "./types";

interface InitiatorAnalysisProps {
	entries: HAREntry[];
}

export function InitiatorAnalysis({ entries }: InitiatorAnalysisProps) {
	const analysis = useMemo(() => {
		const initiatorMap = new Map<string, InitiatorStats>();
		const scriptInitiatorMap = new Map<string, number>();

		entries.forEach((entry) => {
			const type = getInitiatorType(entry);

			const existing = initiatorMap.get(type) || {
				type,
				count: 0,
				totalSize: 0,
				avgTime: 0,
				domains: new Set<string>(),
			};

			existing.count++;
			existing.totalSize += entry.response.content.size;
			existing.avgTime += entry.time;
			existing.domains.add(extractDomain(entry.request.url));

			initiatorMap.set(type, existing);

			const initiator = entry._initiator as
				| Record<string, unknown>
				| undefined;
			if (
				initiator &&
				typeof initiator === "object" &&
				"url" in initiator &&
				typeof initiator.url === "string"
			) {
				const initiatorUrl = initiator.url;
				scriptInitiatorMap.set(
					initiatorUrl,
					(scriptInitiatorMap.get(initiatorUrl) || 0) + 1
				);
			}
		});

		const initiatorStats = Array.from(initiatorMap.values())
			.map((stat) => ({
				...stat,
				avgTime: stat.avgTime / stat.count,
			}))
			.sort((a, b) => b.count - a.count);

		const topScriptInitiators = Array.from(scriptInitiatorMap.entries())
			.map(([url, count]) => ({ url, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 15);

		const cascadeDepth = entries.reduce((maxDepth, entry) => {
			const initiator = entry._initiator as
				| Record<string, unknown>
				| undefined;
			if (
				initiator &&
				typeof initiator === "object" &&
				"stack" in initiator
			) {
				const stack = initiator.stack as
					| Record<string, unknown>
					| undefined;
				if (
					stack &&
					typeof stack === "object" &&
					"callFrames" in stack &&
					Array.isArray(stack.callFrames)
				) {
					const depth = stack.callFrames.length;
					return Math.max(maxDepth, depth);
				}
			}
			return maxDepth;
		}, 0);

		return {
			initiatorStats,
			topScriptInitiators,
			cascadeDepth,
			hasInitiatorData: entries.some((e) => e._initiator),
		};
	}, [entries]);

	if (!analysis.hasInitiatorData) {
		return (
			<div className="p-4 bg-card/40 border border-border rounded-lg">
				<h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
					<GitBranch className="w-5 h-5" />
					Request Initiator Analysis
				</h3>
				<p className="text-sm text-muted">
					Initiator data not available in this HAR file
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
				<GitBranch className="w-5 h-5" />
				Request Initiator Analysis
			</h3>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="space-y-2">
					<h4 className="text-lg font-semibold text-foreground">
						Initiator Type Distribution
					</h4>
					{analysis.initiatorStats.map((stat) => (
						<div
							key={stat.type}
							className="p-3 bg-card/40 rounded border border-border"
						>
							<div className="flex items-center justify-between mb-2">
								<span
									className={cn(
										"px-3 py-1 rounded text-xs font-bold uppercase",
										getInitiatorColor(stat.type)
									)}
								>
									{stat.type}
								</span>
								<span className="text-sm font-mono font-bold text-foreground">
									{stat.count} requests
								</span>
							</div>
							<div className="grid grid-cols-3 gap-2 text-xs">
								<div>
									<span className="text-muted">Size: </span>
									<span className="text-foreground font-medium">
										{formatBytes(stat.totalSize)}
									</span>
								</div>
								<div>
									<span className="text-muted">
										Avg Time:{" "}
									</span>
									<span className="text-foreground font-medium">
										{formatTime(stat.avgTime)}
									</span>
								</div>
								<div>
									<span className="text-muted">
										Domains:{" "}
									</span>
									<span className="text-foreground font-medium">
										{stat.domains.size}
									</span>
								</div>
							</div>
							<div className="mt-2 w-full bg-card rounded-full h-2 overflow-hidden">
								<div
									className="bg-primary h-full"
									style={{
										width: `${
											(stat.count / entries.length) * 100
										}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>

				<div className="space-y-2">
					<h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
						<Code2 className="w-4 h-4" />
						Top Script Initiators
					</h4>
					{analysis.topScriptInitiators.length > 0 ? (
						<div className="space-y-2">
							{analysis.topScriptInitiators.map(
								(script, index) => (
									<div
										key={index}
										className={cn(
											"p-3 bg-card/40 rounded border border-border hover:bg-card-hover transition-colors"
										)}
									>
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1 min-w-0">
												<p className="text-xs text-foreground font-mono truncate">
													{script.url}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<span className="px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-500">
													{script.count} reqs
												</span>
											</div>
										</div>
									</div>
								)
							)}
						</div>
					) : (
						<p className="text-sm text-muted p-3 bg-card/40 rounded border border-border">
							No script initiator details available
						</p>
					)}

					{analysis.cascadeDepth > 0 && (
						<div className="p-4 bg-card/40 border border-border rounded-lg mt-4">
							<p className="text-sm text-muted mb-1">
								Max Cascade Depth
							</p>
							<p className="text-2xl font-bold text-foreground">
								{analysis.cascadeDepth} levels
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
