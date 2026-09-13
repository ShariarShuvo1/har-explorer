"use client";

import { useMemo } from "react";
import { CheckCircle2, Lightbulb, TriangleAlert } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import {
	analyzeCacheHeaders,
	getCacheRecommendations,
	parseHttpDate,
} from "@/lib/entry/cache-analysis";
import { formatDuration } from "@/lib/entry/entry-utils";
import type { CacheSource, CacheStatus } from "@/lib/entry/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { KeyValueList } from "@/components/common/key-value";
import type { Tone } from "@/components/common/stat-card";
import { cn } from "@/lib/cn";
import { Field, FieldGrid, Section, StatChip, TabBody } from "./shared";

const STATUS_DISPLAY: Record<CacheStatus, { label: string; description: string; tone: Tone }> = {
	fresh: {
		label: "Cacheable",
		description:
			"The browser can reuse this response without contacting the server until it expires.",
		tone: "success",
	},
	heuristic: {
		label: "Heuristic",
		description: "No explicit lifetime; the browser estimates one from Last-Modified.",
		tone: "warning",
	},
	revalidate: {
		label: "Revalidate",
		description:
			"Stored, but the browser must check with the server (no-cache or max-age=0) before reusing it.",
		tone: "info",
	},
	stale: {
		label: "Stale",
		description: "The response was already past its freshness lifetime when received.",
		tone: "warning",
	},
	"not-storable": {
		label: "Not cached",
		description:
			"This response is not stored by the browser cache (no-store, non-GET request or uncacheable status).",
		tone: "info",
	},
	none: {
		label: "No policy",
		description: "No caching headers; the response is effectively re-downloaded on every use.",
		tone: "destructive",
	},
};

const SOURCE_LABELS: Record<CacheSource, string> = {
	network: "Network",
	"memory-cache": "Memory cache",
	"disk-cache": "Disk cache",
	revalidated: "Revalidated (304)",
	"service-worker": "Service worker",
};

function DateValue({
	value,
	invalidLabel = "invalid date",
}: {
	value: string;
	invalidLabel?: string;
}) {
	const time = parseHttpDate(value);
	return (
		<>
			{value}
			{time !== undefined ? (
				<span className="font-sans text-muted-foreground">
					{" "}
					({new Date(time).toLocaleString()})
				</span>
			) : (
				<span className="font-sans text-warning"> ({invalidLabel})</span>
			)}
		</>
	);
}

export function CacheTab({ entry }: { entry: HAREntry }) {
	const info = useMemo(() => analyzeCacheHeaders(entry), [entry]);
	const recommendations = useMemo(() => getCacheRecommendations(entry, info), [entry, info]);
	const status = STATUS_DISPLAY[info.status];
	const hasWarnings = recommendations.some((r) => r.type === "warning");
	const hasValidators = Boolean(info.etag || info.lastModified || info.expires);

	return (
		<TabBody>
			<div className="space-y-2">
				<div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
					<StatChip label="Status" value={status.label} tone={status.tone} />
					<StatChip label="Served from" value={SOURCE_LABELS[info.source]} />
					<StatChip
						label="Freshness lifetime"
						value={
							info.freshnessLifetime !== undefined
								? `${formatDuration(info.freshnessLifetime)}${info.isHeuristic ? " (est.)" : ""}`
								: "—"
						}
					/>
					<StatChip
						label="Age"
						value={info.age !== undefined ? formatDuration(info.age) : "—"}
						tone={info.status === "stale" ? "warning" : "default"}
					/>
				</div>
				<p className="text-xs text-muted-foreground">{status.description}</p>
			</div>

			{info.directives.length > 0 && (
				<Section title="Cache-Control">
					<div className="space-y-2 rounded-lg border p-3">
						<p className="font-mono text-xs break-all">{info.cacheControl}</p>
						<div className="flex flex-wrap gap-1.5">
							{info.directives.map((directive, i) => (
								<Badge
									key={`${directive.name}-${i}`}
									variant="outline"
									className="max-w-full font-mono text-[11px] font-normal"
									title={
										directive.name === "max-age" || directive.name === "s-maxage"
											? formatDuration(Number(directive.value))
											: undefined
									}
								>
									<span className="truncate">
										{directive.value !== undefined
											? `${directive.name}=${directive.value}`
											: directive.name}
									</span>
								</Badge>
							))}
						</div>
					</div>
				</Section>
			)}

			{hasValidators && (
				<Section title="Validators and expiry">
					<FieldGrid className="@xs:grid-cols-1 @2xl:grid-cols-1">
						{info.etag && (
							<Field label="ETag" mono>
								{info.etag}
								{/^W\//.test(info.etag) && (
									<span className="font-sans text-muted-foreground"> (weak)</span>
								)}
							</Field>
						)}
						{info.lastModified && (
							<Field label="Last-Modified" mono>
								<DateValue value={info.lastModified} />
							</Field>
						)}
						{info.expires && (
							<Field label={info.expiresIgnored ? "Expires (ignored)" : "Expires"} mono>
								<DateValue
									value={info.expires}
									invalidLabel="invalid date, treated as already expired"
								/>
							</Field>
						)}
					</FieldGrid>
				</Section>
			)}

			<Section title="Cache headers" count={info.headers.length}>
				<KeyValueList
					rows={info.headers}
					nameWidth="9rem"
					emptyText="The response has no cache-related headers."
				/>
			</Section>

			<Section title="Recommendations">
				<div className="space-y-2">
					{recommendations.map((rec, i) => (
						<Alert
							key={i}
							className={cn(
								rec.type === "warning"
									? "border-warning/30 bg-warning/5 text-warning"
									: "border-info/30 bg-info/5 text-info"
							)}
						>
							{rec.type === "warning" ? <TriangleAlert /> : <Lightbulb />}
							<AlertDescription className="text-foreground">{rec.text}</AlertDescription>
						</Alert>
					))}
					{!hasWarnings && status.tone !== "destructive" && (
						<Alert className="border-success/30 bg-success/5 text-success">
							<CheckCircle2 />
							<AlertDescription className="text-foreground">
								No caching problems detected
							</AlertDescription>
						</Alert>
					)}
				</div>
			</Section>
		</TabBody>
	);
}
