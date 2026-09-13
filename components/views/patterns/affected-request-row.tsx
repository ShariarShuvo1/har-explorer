"use client";

import { memo } from "react";
import type { HAREntry } from "@/lib/har-types";
import {
	formatBytes,
	formatTime,
	getBaseMimeType,
	getEntryContentSize,
	getEntryTransferSize,
	nonNegative,
} from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import { MethodBadge, ResourceTypeBadge, StatusBadge } from "@/components/common/badges";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="font-mono tabular-nums">{value}</dd>
		</div>
	);
}

function RequestHoverDetails({ entry, details }: { entry: HAREntry; details?: string }) {
	const { timings } = entry;
	const tcp = nonNegative(timings.connect) - nonNegative(timings.ssl);
	const mimeType = getBaseMimeType(entry.response.content.mimeType);
	const phases: [string, number][] = [
		["Blocked", timings.blocked],
		["DNS", timings.dns],
		["TCP", tcp],
		["TLS", timings.ssl],
		["Waiting", timings.wait],
		["Download", timings.receive],
	];

	return (
		<div className="space-y-3 text-xs">
			<div className="space-y-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<MethodBadge method={entry.request.method} />
					<StatusBadge
						status={entry.response.status}
						statusText={entry.response.statusText}
						showText
					/>
					<ResourceTypeBadge type={getResourceType(entry)} />
				</div>
				<p className="line-clamp-4 font-mono break-all">{entry.request.url}</p>
			</div>

			{details && <p className="rounded-md bg-muted px-2 py-1.5 text-foreground">{details}</p>}

			<dl className="grid grid-cols-2 gap-x-4 gap-y-1">
				<DetailRow label="Total" value={formatTime(entry.time)} />
				{phases
					.filter(([, value]) => value > 0)
					.map(([label, value]) => (
						<DetailRow key={label} label={label} value={formatTime(value)} />
					))}
			</dl>

			<dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2">
				<DetailRow label="Transferred" value={formatBytes(getEntryTransferSize(entry))} />
				<DetailRow label="Size" value={formatBytes(getEntryContentSize(entry))} />
				{mimeType && (
					<div className="col-span-2 flex min-w-0 items-center justify-between gap-3">
						<dt className="text-muted-foreground">Type</dt>
						<dd className="truncate font-mono">{mimeType}</dd>
					</div>
				)}
			</dl>
		</div>
	);
}

interface AffectedRequestRowProps {
	entry: HAREntry;
	index: number;
	details?: string;
	onOpen: (index: number) => void;
}

export const AffectedRequestRow = memo(function AffectedRequestRow({
	entry,
	index,
	details,
	onOpen,
}: AffectedRequestRowProps) {
	return (
		<li>
			<HoverCard openDelay={400} closeDelay={100}>
				<HoverCardTrigger asChild>
					<button
						type="button"
						onClick={() => onOpen(index)}
						className="flex w-full min-w-0 flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<span className="flex w-full min-w-0 items-center gap-2">
							<MethodBadge method={entry.request.method} />
							<StatusBadge status={entry.response.status} className="w-14 shrink-0" />
							<span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.request.url}</span>
							<span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
								{formatTime(entry.time)}
							</span>
						</span>
						{details && (
							<span className="line-clamp-2 text-xs break-words text-muted-foreground">
								{details}
							</span>
						)}
					</button>
				</HoverCardTrigger>
				<HoverCardContent
					side="left"
					align="start"
					collisionPadding={8}
					className="w-80 max-w-[calc(100vw-1rem)] p-3"
				>
					<RequestHoverDetails entry={entry} details={details} />
				</HoverCardContent>
			</HoverCard>
		</li>
	);
});
