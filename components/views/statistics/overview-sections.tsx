"use client";

import type { ReactNode } from "react";
import {
	Activity,
	ArrowDownUp,
	CircleAlert,
	Globe,
	Minus,
	Timer,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { formatBytes, formatTime } from "@/lib/har-parser";
import type { OverviewStatistics } from "@/lib/statistics/overview";
import { percentOf } from "@/lib/statistics/utils";
import { cn } from "@/lib/cn";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import { Progress } from "@/components/ui/progress";
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { scrollToSection } from "./sections";
import {
	SectionCard,
	ShareBar,
	StatSection,
	StatTable,
	StatTableHeader,
	ToneBadge,
	TruncationFooter,
	useTruncation,
} from "./shared";

const MAX_MIME_ROWS = 15;
const MAX_DOMAIN_ROWS = 50;

export function OverviewSection({ overview }: { overview: OverviewStatistics }) {
	const { requestCount, failedCount } = overview;
	return (
		<StatSection
			id="stats-overview"
			title="Overview"
			description="Headline numbers for the requests in view."
		>
			<StatGrid>
				<StatCard
					label="Requests"
					value={requestCount.toLocaleString()}
					hint={`${overview.domainStats.length.toLocaleString()} domains`}
					icon={Activity}
					tone="primary"
					onClick={() => scrollToSection("stats-domains")}
				/>
				<StatCard
					label="Transferred"
					value={formatBytes(overview.totalTransferSize)}
					hint={`${formatBytes(overview.totalContentSize)} decoded`}
					icon={ArrowDownUp}
					tone="info"
					onClick={() => scrollToSection("stats-transfer")}
				/>
				<StatCard
					label="Failed requests"
					value={failedCount.toLocaleString()}
					hint={`${percentOf(failedCount, requestCount).toFixed(1)}% · 4xx, 5xx or no response`}
					icon={CircleAlert}
					tone={failedCount > 0 ? "destructive" : "success"}
					onClick={() => scrollToSection("stats-methods-status")}
				/>
				<StatCard
					label="Avg duration"
					value={formatTime(requestCount > 0 ? overview.totalTime / requestCount : 0)}
					hint="Per request"
					icon={Timer}
					onClick={() => scrollToSection("stats-sequence")}
				/>
			</StatGrid>
		</StatSection>
	);
}

export function ContentTypesSection({ overview }: { overview: OverviewStatistics }) {
	const rows = overview.mimeTypeStats;
	const truncation = useTruncation(rows.length, MAX_MIME_ROWS);
	return (
		<StatSection
			id="stats-content-types"
			title="Content types"
			description="Grouped by base MIME type, largest total size first."
		>
			<SectionCard
				title="Content types"
				description={`${formatBytes(overview.totalContentSize)} of decoded content`}
				contentClassName="p-0 sm:p-0"
				footer={<TruncationFooter state={truncation} noun="content types" />}
			>
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>MIME type</TableHead>
							<TableHead className="text-right">Count</TableHead>
							<TableHead className="text-right">Total size</TableHead>
							<TableHead className="text-right">Avg size</TableHead>
							<TableHead className="text-right">% of total</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{rows.slice(0, truncation.shown).map((stat) => (
							<TableRow key={stat.mimeType}>
								<TableCell
									className="max-w-[14rem] truncate font-mono text-xs sm:max-w-sm"
									title={stat.mimeType}
								>
									{stat.mimeType}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{stat.count.toLocaleString()}
								</TableCell>
								<TableCell className="text-right font-medium tabular-nums">
									{formatBytes(stat.size)}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatBytes(stat.size / stat.count)}
								</TableCell>
								<TableCell>
									<ShareBar
										value={percentOf(stat.size, overview.totalContentSize)}
										label={`${stat.mimeType} share of total size`}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</StatTable>
			</SectionCard>
		</StatSection>
	);
}

function DistributionRow({
	label,
	count,
	total,
	ariaLabel,
}: {
	label: ReactNode;
	count: number;
	total: number;
	ariaLabel: string;
}) {
	const share = percentOf(count, total);
	return (
		<li className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
			<div className="flex w-24 shrink-0 items-center gap-2">{label}</div>
			<Progress value={share} aria-label={ariaLabel} className="h-1.5 flex-1 bg-muted" />
			<span className="w-24 shrink-0 text-right text-sm tabular-nums">
				<span className="font-medium">{count.toLocaleString()}</span>{" "}
				<span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span>
			</span>
		</li>
	);
}

export function MethodsStatusSection({ overview }: { overview: OverviewStatistics }) {
	const total = overview.requestCount;
	return (
		<StatSection id="stats-methods-status" title="Methods & status codes">
			<div className="grid gap-4 md:grid-cols-2">
				<SectionCard
					title="HTTP methods"
					description={`${overview.methodStats.length} distinct`}
					contentClassName="p-0 sm:p-0"
				>
					<ul className="divide-y py-1">
						{overview.methodStats.map((stat) => (
							<DistributionRow
								key={stat.method}
								label={<MethodBadge method={stat.method} />}
								count={stat.count}
								total={total}
								ariaLabel={`${stat.method} share of requests`}
							/>
						))}
					</ul>
				</SectionCard>
				<SectionCard
					title="Status codes"
					description={`${overview.statusStats.length} distinct`}
					contentClassName="p-0 sm:p-0"
				>
					<ul className="divide-y py-1">
						{overview.statusStats.map((stat) => (
							<DistributionRow
								key={stat.status}
								label={
									stat.status > 0 ? (
										<StatusBadge status={stat.status} />
									) : (
										<span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
											<span className="size-1.5 shrink-0 rounded-full bg-destructive" />
											No response
										</span>
									)
								}
								count={stat.count}
								total={total}
								ariaLabel={`Status ${stat.status > 0 ? stat.status : "no response"} share of requests`}
							/>
						))}
					</ul>
				</SectionCard>
			</div>
		</StatSection>
	);
}

function ErrorRate({ rate }: { rate: number }) {
	const Icon = rate > 10 ? TrendingUp : rate > 0 ? Minus : TrendingDown;
	const tone = rate > 10 ? "text-destructive" : rate > 0 ? "text-warning" : "text-success";
	return (
		<span
			className={cn("inline-flex items-center justify-end gap-1 font-medium tabular-nums", tone)}
		>
			<Icon className="size-3" aria-hidden="true" />
			{rate.toFixed(1)}%
		</span>
	);
}

export function DomainsSection({ overview }: { overview: OverviewStatistics }) {
	const rows = overview.domainStats;
	const truncation = useTruncation(rows.length, MAX_DOMAIN_ROWS);
	return (
		<StatSection
			id="stats-domains"
			title="Domains"
			description="Requests, sizes and errors per host, most requests first."
		>
			<SectionCard
				title="Domain statistics"
				description={`${rows.length.toLocaleString()} domains`}
				action={<Globe className="size-4 text-muted-foreground" aria-hidden="true" />}
				contentClassName="p-0 sm:p-0"
				footer={<TruncationFooter state={truncation} noun="domains" />}
			>
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>Domain</TableHead>
							<TableHead className="text-right">Requests</TableHead>
							<TableHead className="text-right">Transferred</TableHead>
							<TableHead className="text-right">Content size</TableHead>
							<TableHead className="text-right">Avg time</TableHead>
							<TableHead
								className="text-right"
								title="4xx/5xx responses and requests without a response"
							>
								Errors
							</TableHead>
							<TableHead className="text-right">Error rate</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{rows.slice(0, truncation.shown).map((stat) => (
							<TableRow key={stat.domain}>
								<TableCell
									className="max-w-[14rem] truncate font-mono text-xs sm:max-w-xs"
									title={stat.domain}
								>
									{stat.domain}
								</TableCell>
								<TableCell className="text-right font-medium tabular-nums">
									{stat.count.toLocaleString()}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatBytes(stat.transferSize)}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatBytes(stat.contentSize)}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatTime(stat.totalTime / stat.count)}
								</TableCell>
								<TableCell className="text-right">
									<ToneBadge tone={stat.errors > 0 ? "destructive" : "default"}>
										{stat.errors.toLocaleString()}
									</ToneBadge>
								</TableCell>
								<TableCell className="text-right">
									<ErrorRate rate={percentOf(stat.errors, stat.count)} />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</StatTable>
			</SectionCard>
		</StatSection>
	);
}
