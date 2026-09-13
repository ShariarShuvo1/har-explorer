"use client";

import { useMemo } from "react";
import { Cable, Link2, Network, Repeat, TriangleAlert } from "lucide-react";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { analyzeConnections } from "@/lib/statistics/connections";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import {
	Caption,
	DomainList,
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

const MAX_CONNECTION_ROWS = 20;

export function ConnectionsSection({ entries }: SectionProps) {
	const analysis = useMemo(() => analyzeConnections(entries), [entries]);
	const truncation = useTruncation(analysis.connectionStats.length, MAX_CONNECTION_ROWS);

	if (analysis.requestsWithConnection === 0) {
		return (
			<StatSection id="stats-connections" title="Connections">
				<Unavailable icon={Network} title="Connection IDs not available">
					<p>Connection IDs are not available for these requests.</p>
					{analysis.newConnectionRequests > 0 && (
						<p>
							{analysis.newConnectionRequests.toLocaleString()} of {entries.length.toLocaleString()}{" "}
							requests opened a new connection (based on connect timings).
						</p>
					)}
				</Unavailable>
			</StatSection>
		);
	}

	const missing = entries.length - analysis.requestsWithConnection;

	return (
		<StatSection
			id="stats-connections"
			title="Connections"
			description="Connection pooling and reuse across requests."
		>
			{missing > 0 && (
				<Caption>
					<p>
						{missing.toLocaleString()} of {entries.length.toLocaleString()} requests have no
						connection ID and are excluded.
					</p>
				</Caption>
			)}
			{analysis.usesConnectionField && (
				<Alert role="note" className="border-warning/30 bg-warning/5 [&>svg]:text-warning">
					<TriangleAlert />
					<AlertTitle>Reuse may be overstated</AlertTitle>
					<AlertDescription>
						<p>
							Some connection IDs come from the HAR{" "}
							<code className="font-mono text-xs">connection</code> field, which some tools use for
							the server port.
						</p>
					</AlertDescription>
				</Alert>
			)}

			<StatGrid>
				<StatCard
					label="Total connections"
					value={analysis.totalConnections.toLocaleString()}
					icon={Cable}
				/>
				<StatCard
					label="Reused connections"
					value={analysis.reusedConnections.toLocaleString()}
					icon={Repeat}
					tone="success"
				/>
				<StatCard
					label="Reuse rate"
					value={`${analysis.reuseRate.toFixed(1)}%`}
					hint={`${analysis.requestsOnReusedRate.toFixed(1)}% of requests used a shared connection`}
					icon={Link2}
					tone="primary"
				/>
				<StatCard
					label="Avg requests / connection"
					value={analysis.avgRequestsPerConnection.toFixed(1)}
					icon={Network}
					tone="info"
				/>
			</StatGrid>

			<SectionCard title="Protocol connection efficiency" contentClassName="p-0 sm:p-0">
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>Protocol</TableHead>
							<TableHead className="text-right">Requests</TableHead>
							<TableHead className="text-right">Connections</TableHead>
							<TableHead className="text-right">Avg requests / conn</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{analysis.protocolStats.map((stat) => (
							<TableRow key={stat.protocol}>
								<TableCell className="font-medium">{stat.protocol}</TableCell>
								<TableCell className="text-right tabular-nums">
									{stat.requestCount.toLocaleString()}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{stat.connectionCount.toLocaleString()}
								</TableCell>
								<TableCell className="text-right font-medium tabular-nums">
									{stat.avgRequestsPerConnection.toFixed(1)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</StatTable>
			</SectionCard>

			<SectionCard
				title="Top connections by request count"
				contentClassName="p-0 sm:p-0"
				footer={<TruncationFooter state={truncation} noun="connections" />}
			>
				<StatTable>
					<StatTableHeader>
						<TableRow>
							<TableHead>Connection ID</TableHead>
							<TableHead>Protocol</TableHead>
							<TableHead className="text-right">Requests</TableHead>
							<TableHead className="text-right">Domains</TableHead>
							<TableHead className="text-right">Transferred</TableHead>
							<TableHead className="text-right">Avg time</TableHead>
							<TableHead className="text-center">Reused</TableHead>
						</TableRow>
					</StatTableHeader>
					<TableBody>
						{analysis.connectionStats.slice(0, truncation.shown).map((stat) => (
							<TableRow key={stat.connection}>
								<TableCell
									className="max-w-[12rem] truncate font-mono text-xs"
									title={stat.connection}
								>
									{stat.connection}
								</TableCell>
								<TableCell className="text-muted-foreground">{stat.protocols.join(", ")}</TableCell>
								<TableCell className="text-right font-medium tabular-nums">
									{stat.requestCount.toLocaleString()}
								</TableCell>
								<TableCell className="text-right text-muted-foreground">
									<DomainList domains={stat.domains}>
										{stat.domains.length.toLocaleString()}
									</DomainList>
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatBytes(stat.totalSize)}
								</TableCell>
								<TableCell className="text-right text-muted-foreground tabular-nums">
									{formatTime(stat.totalTime / stat.requestCount)}
								</TableCell>
								<TableCell className="text-center">
									{stat.requestCount > 1 ? (
										<ToneBadge tone="success">Yes</ToneBadge>
									) : (
										<ToneBadge>No</ToneBadge>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</StatTable>
			</SectionCard>
		</StatSection>
	);
}
