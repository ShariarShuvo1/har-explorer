"use client";

import { useMemo } from "react";
import { Cloud, Globe, Server, Split } from "lucide-react";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { analyzeServers, type ServerGroupSummary } from "@/lib/statistics/servers";
import { percentOf } from "@/lib/statistics/utils";
import { cn } from "@/lib/cn";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { CDN_COLOR, ORIGIN_COLOR } from "./colors";
import {
	Caption,
	DomainList,
	Metric,
	SectionCard,
	StatSection,
	StatTable,
	StatTableHeader,
	ToneBadge,
	TruncationFooter,
	Unavailable,
	useTruncation,
	type SectionProps,
} from "./shared";

const MAX_SERVER_ROWS = 20;

function formatOptionalTime(ms: number | null): string {
	return ms === null ? "—" : formatTime(ms);
}

function ComparisonRow({
	label,
	cdn,
	origin,
}: {
	label: string;
	cdn: number | null;
	origin: number | null;
}) {
	if (cdn === null || origin === null || origin <= 0) return null;
	const change = ((cdn - origin) / origin) * 100;
	const faster = change <= 0;
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
			<span className="text-sm text-muted-foreground">
				{label}: CDN{" "}
				<span className="font-medium text-foreground tabular-nums">{formatTime(cdn)}</span> vs
				origin{" "}
				<span className="font-medium text-foreground tabular-nums">{formatTime(origin)}</span>
			</span>
			<span
				className={cn(
					"text-base font-semibold tabular-nums",
					faster ? "text-success" : "text-destructive"
				)}
			>
				{Math.abs(change).toFixed(1)}% {faster ? "faster" : "slower"}
			</span>
		</div>
	);
}

function GroupCard({
	title,
	icon: Icon,
	iconClass,
	noun,
	summary,
}: {
	title: string;
	icon: typeof Cloud;
	iconClass: string;
	noun: string;
	summary: ServerGroupSummary;
}) {
	return (
		<SectionCard
			title={
				<span className="flex items-center gap-2">
					<Icon className={cn("size-4", iconClass)} aria-hidden="true" />
					{title}
				</span>
			}
		>
			<div className="grid grid-cols-2 gap-4">
				<Metric label={`${noun} servers`} value={summary.serverCount.toLocaleString()} />
				<Metric label={`Total ${noun} requests`} value={summary.requestCount.toLocaleString()} />
				<Metric label="Avg connection setup" value={formatOptionalTime(summary.avgSetup)} />
				<Metric label="Avg TTFB" value={formatOptionalTime(summary.avgWait)} />
			</div>
		</SectionCard>
	);
}

export function ServersSection({ entries }: SectionProps) {
	const analysis = useMemo(() => analyzeServers(entries), [entries]);
	const truncation = useTruncation(analysis.serverStats.length, MAX_SERVER_ROWS);

	if (analysis.uniqueServers === 0) {
		return (
			<StatSection id="stats-servers" title="Servers & CDNs">
				<Unavailable icon={Globe} title="Server IPs not available">
					<p>Server IP addresses are not available for these requests.</p>
				</Unavailable>
			</StatSection>
		);
	}

	const { cdn, origin } = analysis;
	const totalRequests = cdn.requestCount + origin.requestCount;
	const cdnShare = percentOf(cdn.requestCount, totalRequests);
	const originShare = percentOf(origin.requestCount, totalRequests);

	return (
		<StatSection
			id="stats-servers"
			title="Servers & CDNs"
			description="Where responses came from and how fast each server answered."
		>
			<Caption>
				<p>
					Connection setup is DNS + TCP/TLS connect, averaged over requests that opened a new
					connection. CDNs are detected from known hostnames and response headers.
				</p>
				{analysis.requestsWithoutIP > 0 && (
					<p>
						{analysis.requestsWithoutIP.toLocaleString()} requests without a server IP (e.g. cached
						or failed) are excluded.
					</p>
				)}
			</Caption>

			<StatGrid>
				<StatCard
					label="Unique servers"
					value={analysis.uniqueServers.toLocaleString()}
					icon={Server}
				/>
				<StatCard
					label="CDN requests"
					value={cdn.requestCount.toLocaleString()}
					icon={Cloud}
					tone="success"
				/>
				<StatCard
					label="Origin requests"
					value={origin.requestCount.toLocaleString()}
					icon={Server}
					tone="info"
				/>
				<StatCard
					label="IPs per domain"
					value={analysis.ipsPerDomain.toFixed(1)}
					icon={Split}
					tone="primary"
				/>
			</StatGrid>

			<div className="grid gap-4 md:grid-cols-2">
				<GroupCard
					title="CDN performance"
					icon={Cloud}
					iconClass="text-success"
					noun="CDN"
					summary={cdn}
				/>
				<GroupCard
					title="Origin performance"
					icon={Server}
					iconClass="text-info"
					noun="Origin"
					summary={origin}
				/>
			</div>

			{cdn.requestCount > 0 && origin.requestCount > 0 && (
				<SectionCard title="CDN effectiveness">
					<div className="space-y-3">
						<ComparisonRow label="Connection setup" cdn={cdn.avgSetup} origin={origin.avgSetup} />
						<ComparisonRow label="TTFB" cdn={cdn.avgWait} origin={origin.avgWait} />
						<div
							className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
							role="img"
							aria-label={`${cdnShare.toFixed(0)}% of requests served by a CDN`}
						>
							<div className={CDN_COLOR.fill} style={{ width: `${cdnShare}%` }} />
							<div className={ORIGIN_COLOR.fill} style={{ width: `${originShare}%` }} />
						</div>
						<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
							<span className="flex items-center gap-1.5">
								<span className={cn("size-2 rounded-full", CDN_COLOR.fill)} />
								CDN {cdnShare.toFixed(1)}%
							</span>
							<span className="flex items-center gap-1.5">
								<span className={cn("size-2 rounded-full", ORIGIN_COLOR.fill)} />
								Origin {originShare.toFixed(1)}%
							</span>
						</div>
					</div>
				</SectionCard>
			)}

			<SectionCard
				title="Server distribution"
				contentClassName="p-0 sm:p-0"
				footer={<TruncationFooter state={truncation} noun="servers" />}
			>
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>Server IP</TableHead>
							<TableHead>Domains</TableHead>
							<TableHead className="text-right">Requests</TableHead>
							<TableHead className="text-right">Avg setup</TableHead>
							<TableHead className="text-right">Avg TTFB</TableHead>
							<TableHead className="text-right">Transferred</TableHead>
							<TableHead className="text-center">Type</TableHead>
							<TableHead className="text-right">Errors</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{analysis.serverStats.slice(0, truncation.shown).map((stat) => {
							const providers = stat.cdnProviders;
							return (
								<TableRow key={stat.serverIP}>
									<TableCell className="font-mono text-xs">{stat.serverIP}</TableCell>
									<TableCell className="max-w-[14rem] sm:max-w-xs">
										<div className="flex min-w-0 items-center gap-2">
											<span
												className="truncate font-mono text-xs text-muted-foreground"
												title={stat.domains[0]}
											>
												{stat.domains[0]}
											</span>
											{stat.domains.length > 1 && (
												<DomainList domains={stat.domains} className="no-underline">
													<ToneBadge>+{stat.domains.length - 1}</ToneBadge>
												</DomainList>
											)}
										</div>
									</TableCell>
									<TableCell className="text-right font-medium tabular-nums">
										{stat.requestCount.toLocaleString()}
									</TableCell>
									<TableCell className="text-right">
										{stat.avgSetup === null ? (
											<span className="text-muted-foreground">—</span>
										) : (
											<ToneBadge
												tone={
													stat.avgSetup < 100
														? "success"
														: stat.avgSetup < 300
															? "warning"
															: "destructive"
												}
											>
												{formatTime(stat.avgSetup)}
											</ToneBadge>
										)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{formatTime(stat.avgWait)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{formatBytes(stat.totalSize)}
									</TableCell>
									<TableCell className="text-center">
										{providers.length > 0 ? (
											<ToneBadge tone="success" title={providers.join(", ")}>
												<Cloud aria-hidden="true" />
												{providers.length === 1 && providers[0] !== "CDN" ? providers[0] : "CDN"}
											</ToneBadge>
										) : (
											<ToneBadge tone="info">
												<Server aria-hidden="true" />
												Origin
											</ToneBadge>
										)}
									</TableCell>
									<TableCell className="text-right">
										{stat.errorCount > 0 ? (
											<ToneBadge tone="destructive">{stat.errorCount.toLocaleString()}</ToneBadge>
										) : (
											<span className="text-muted-foreground tabular-nums">0</span>
										)}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</StatTable>
			</SectionCard>
		</StatSection>
	);
}
