"use client";

import { useId, useState } from "react";
import { Info, Pencil, Search } from "lucide-react";
import type { HAREntry, HARNameValue } from "@/lib/har-types";
import { formatBytes, getHeaderValue } from "@/lib/har-parser";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CodeEditor } from "@/components/common/code-editor";
import { KeyValueEditor, KeyValueList } from "@/components/common/key-value";
import { MethodBadge, StatusBadge } from "@/components/common/badges";
import { CollapsibleSection, TabBody, useEntryUpdate } from "./shared";

type HeaderSide = "request" | "response";

function matches(header: HARNameValue, query: string): boolean {
	return header.name.toLowerCase().includes(query) || header.value.toLowerCase().includes(query);
}

function rawHeaders(entry: HAREntry, side: HeaderSide): string {
	const { request, response } = entry;
	let firstLine: string;
	if (side === "request") {
		let target = request.url;
		try {
			const url = new URL(request.url);
			target = `${url.pathname}${url.search}`;
		} catch {
			// keep the full URL
		}
		firstLine = `${request.method} ${target} ${request.httpVersion}`.trim();
	} else {
		firstLine = `${response.httpVersion} ${response.status} ${response.statusText}`.trim();
	}
	const headers = side === "request" ? request.headers : response.headers;
	return [firstLine, ...headers.map((h) => `${h.name}: ${h.value}`)].join("\n");
}

function HeaderSection({
	entry,
	index,
	side,
	query,
	raw,
}: {
	entry: HAREntry;
	index: number;
	side: HeaderSide;
	query: string;
	raw: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const update = useEntryUpdate(index);
	const message = side === "request" ? entry.request : entry.response;
	const headers = message.headers;
	const shown = query ? headers.filter((h) => matches(h, query)) : headers;
	const title = side === "request" ? "Request headers" : "Response headers";
	const hasPseudo = headers.some((h) => h.name.startsWith(":"));

	const save = (rows: HARNameValue[]) => {
		setEditing(false);
		update(
			(current) =>
				side === "request"
					? { ...current, request: { ...current.request, headers: rows } }
					: { ...current, response: { ...current.response, headers: rows } },
			`Edit ${title.toLowerCase()}`,
			`${title} updated`
		);
	};

	return (
		<CollapsibleSection
			title={
				<>
					{title}
					{message.headersSize > 0 && (
						<span className="ml-1 text-xs font-normal text-muted-foreground">
							· {formatBytes(message.headersSize)}
						</span>
					)}
				</>
			}
			count={query ? shown.length : headers.length}
			actions={
				!editing && (
					<Button type="button" variant="ghost" size="xs" onClick={() => setEditing(true)}>
						<Pencil />
						Edit
					</Button>
				)
			}
		>
			{editing ? (
				<KeyValueEditor
					rows={headers}
					onSave={save}
					onCancel={() => setEditing(false)}
					namePlaceholder="Header name"
					valuePlaceholder="Value"
					addLabel="Add header"
				/>
			) : raw ? (
				<CodeEditor
					value={rawHeaders(entry, side)}
					title={`${title} (raw)`}
					ariaLabel={`${title} (raw)`}
					lineNumbers={false}
					maxHeight="24rem"
				/>
			) : (
				<div className="space-y-2">
					<KeyValueList
						rows={shown}
						nameWidth="11rem"
						emptyText={
							query ? `No ${title.toLowerCase()} match "${query}"` : `No ${title.toLowerCase()}`
						}
					/>
					{hasPseudo && (
						<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
							<Info className="mt-0.5 size-3.5 shrink-0" />
							Names starting with a colon (such as :authority or :path) are HTTP/2 and HTTP/3
							pseudo-headers that carry the request line and status.
						</p>
					)}
				</div>
			)}
		</CollapsibleSection>
	);
}

function GeneralSection({ entry, query }: { entry: HAREntry; query: string }) {
	const { request, response } = entry;
	const referrerPolicy = getHeaderValue(response.headers, "referrer-policy");
	const rows = [
		{ name: "Request URL", value: request.url },
		{ name: "Request method", value: request.method },
		{
			name: "Status code",
			value: response.status > 0 ? `${response.status} ${response.statusText}`.trim() : "(failed)",
		},
		{ name: "Remote address", value: entry.serverIPAddress || "" },
		{ name: "Referrer policy", value: referrerPolicy || "" },
	].filter((row) => row.value);
	const shown = query ? rows.filter((row) => matches(row, query)) : rows;

	return (
		<CollapsibleSection title="General">
			<KeyValueList
				rows={shown}
				nameWidth="11rem"
				emptyText={`Nothing matches "${query}"`}
				renderValue={(row) =>
					row.name === "Request method" ? (
						<MethodBadge method={row.value} />
					) : row.name === "Status code" ? (
						<StatusBadge status={response.status} statusText={response.statusText} showText />
					) : (
						row.value
					)
				}
			/>
		</CollapsibleSection>
	);
}

export function HeadersTab({ entry, index }: { entry: HAREntry; index: number }) {
	const [filter, setFilter] = useState("");
	const [raw, setRaw] = useState(false);
	const rawId = useId();
	const query = filter.trim().toLowerCase();

	return (
		<TabBody className="space-y-5">
			<div className="flex flex-wrap items-center gap-3">
				<InputGroup className="h-8 min-w-0 flex-1 basis-48">
					<InputGroupAddon>
						<Search />
					</InputGroupAddon>
					<InputGroupInput
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						placeholder="Filter headers"
						aria-label="Filter headers"
						className="h-8 text-sm"
					/>
				</InputGroup>
				<div className="flex items-center gap-2">
					<Switch id={rawId} checked={raw} onCheckedChange={setRaw} />
					<Label htmlFor={rawId} className="font-normal">
						Raw
					</Label>
				</div>
			</div>

			<GeneralSection entry={entry} query={query} />
			<HeaderSection entry={entry} index={index} side="response" query={query} raw={raw} />
			<HeaderSection entry={entry} index={index} side="request" query={query} raw={raw} />
		</TabBody>
	);
}
