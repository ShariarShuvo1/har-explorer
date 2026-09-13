"use client";

import { useState } from "react";
import { AlertCircle, CornerDownRight, Pencil } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import {
	formatBytes,
	formatTime,
	getEntryContentSize,
	getEntryTransferSize,
	getHeaderValue,
} from "@/lib/har-parser";
import { getEntryHttpVersion } from "@/lib/filter-entries";
import { RESOURCE_TYPE_LABELS, getResourceType } from "@/lib/resource-type";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import { CopyButton } from "@/components/common/copy-button";
import { EditRequestDialog } from "./edit-request-dialog";
import { Field, FieldGrid, Section, TabBody, formatStartedDateTime } from "./shared";

function describeError(error: unknown): string | null {
	if (typeof error === "string") return error || null;
	if (error && typeof error === "object") return JSON.stringify(error);
	return null;
}

function describeInitiator(initiator: unknown): string | null {
	if (!initiator) return null;
	if (typeof initiator === "string") return initiator;
	if (typeof initiator !== "object") return String(initiator);
	const record = initiator as {
		type?: unknown;
		url?: unknown;
		lineNumber?: unknown;
		stack?: { callFrames?: Array<{ url?: string; lineNumber?: number; functionName?: string }> };
	};
	const frame = record.stack?.callFrames?.find((f) => f.url);
	const url = typeof record.url === "string" && record.url ? record.url : frame?.url;
	const line = typeof record.lineNumber === "number" ? record.lineNumber : frame?.lineNumber;
	const type = typeof record.type === "string" ? record.type : "";
	const location = url ? `${url}${typeof line === "number" ? `:${line + 1}` : ""}` : "";
	return [type, location].filter(Boolean).join(" · ") || null;
}

function describeCache(entry: HAREntry): string {
	const parts: string[] = [];
	if (entry._fromCache === "memory") parts.push("Memory cache");
	else if (entry._fromCache === "disk") parts.push("Disk cache");
	else if (entry._fromCache) parts.push(`Cache (${entry._fromCache})`);
	if (entry.response._fetchedViaServiceWorker) parts.push("Service worker");
	return parts.length > 0 ? parts.join(", ") : "No (network)";
}

export function OverviewTab({ entry, index }: { entry: HAREntry; index: number }) {
	const [editing, setEditing] = useState(false);
	const { request, response } = entry;
	const error = describeError(response._error);
	const initiator = describeInitiator(entry._initiator);
	const httpVersion = getEntryHttpVersion(entry);
	const encoding = getHeaderValue(response.headers, "content-encoding");
	const connectionId = entry.connection || entry._connectionId;

	return (
		<TabBody>
			{error && (
				<Alert variant="destructive">
					<AlertCircle />
					<AlertTitle>Request failed</AlertTitle>
					<AlertDescription className="break-all">{error}</AlertDescription>
				</Alert>
			)}

			<Section
				title="Summary"
				actions={
					<Button type="button" size="sm" onClick={() => setEditing(true)}>
						<Pencil />
						Edit request
					</Button>
				}
			>
				<FieldGrid>
					<Field
						label="URL"
						mono
						className="@xs:col-span-2 @2xl:col-span-3"
						action={<CopyButton value={request.url} label="Copy URL" className="-my-1.5 size-7" />}
					>
						{request.url}
					</Field>
					{response.redirectURL && (
						<Field
							label={
								<span className="inline-flex items-center gap-1">
									<CornerDownRight className="size-3" />
									Redirects to
								</span>
							}
							mono
							className="@xs:col-span-2 @2xl:col-span-3"
						>
							{response.redirectURL}
						</Field>
					)}
					<Field label="Method">
						<MethodBadge method={request.method} />
					</Field>
					<Field label="Status">
						<StatusBadge status={response.status} statusText={response.statusText} showText />
					</Field>
					<Field label="HTTP version">{httpVersion === "unknown" ? "—" : httpVersion}</Field>
					<Field label="Remote address" mono>
						{entry.serverIPAddress || "—"}
					</Field>
					<Field label="Resource type">
						{entry._resourceType || RESOURCE_TYPE_LABELS[getResourceType(entry)]}
					</Field>
					<Field label="Priority">{entry._priority || "—"}</Field>
					{initiator && (
						<Field label="Initiator" mono className="@xs:col-span-2 @2xl:col-span-3">
							{initiator}
						</Field>
					)}
					<Field label="Connection ID" mono>
						{connectionId || "—"}
					</Field>
					<Field label="Page" mono>
						{entry.pageref || "—"}
					</Field>
					<Field label="Started">{formatStartedDateTime(entry.startedDateTime)}</Field>
					<Field label="Duration">
						<span className="tabular-nums">{formatTime(entry.time)}</span>
					</Field>
					<Field label="Transferred">
						<span className="tabular-nums">{formatBytes(getEntryTransferSize(entry))}</span>
					</Field>
					<Field label="Resource size">
						<span className="tabular-nums">{formatBytes(getEntryContentSize(entry))}</span>
					</Field>
					<Field label="Content-Encoding" mono>
						{encoding || "none"}
					</Field>
					<Field label="MIME type" mono>
						{response.content.mimeType || "unknown"}
					</Field>
					<Field label="From cache / service worker">{describeCache(entry)}</Field>
				</FieldGrid>
			</Section>

			{entry.comment && (
				<Section title="Comment">
					<p className="rounded-lg border p-3 text-sm break-words whitespace-pre-wrap">
						{entry.comment}
					</p>
				</Section>
			)}

			<EditRequestDialog open={editing} onOpenChange={setEditing} entry={entry} index={index} />
		</TabBody>
	);
}
