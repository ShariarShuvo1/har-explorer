"use client";

import { useState } from "react";
import { FileText, Pencil } from "lucide-react";
import type { HAREntry, HARNameValue } from "@/lib/har-types";
import { formatBytes } from "@/lib/har-parser";
import {
	formatResponseContent,
	isJsonMimeType,
	withPostDataText,
	withQueryString,
} from "@/lib/entry/entry-utils";
import { Button } from "@/components/ui/button";
import { KeyValueEditor, KeyValueList } from "@/components/common/key-value";
import { languageForMime } from "@/components/common/code-language";
import { BodyEditor } from "./body-editor";
import { CookieList, EmptyNote, Section, TabBody, useEntryUpdate } from "./shared";

/** Number shown next to the Payload tab; `true` means "has a body" without a count. */
export function getPayloadIndicator(entry: HAREntry): number | boolean {
	const { queryString, postData } = entry.request;
	const count = queryString.length + (postData?.params?.length ?? 0);
	if (count > 0) return count;
	return Boolean(postData?.text);
}

function QueryParameters({ entry, index }: { entry: HAREntry; index: number }) {
	const [editing, setEditing] = useState(false);
	const update = useEntryUpdate(index);
	const params = entry.request.queryString;

	const save = (rows: HARNameValue[]) => {
		setEditing(false);
		update(
			(current) => withQueryString(current, rows),
			"Edit query parameters",
			"Query parameters updated"
		);
	};

	return (
		<Section
			title="Query string parameters"
			count={params.length}
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
				<>
					<KeyValueEditor
						rows={params}
						onSave={save}
						onCancel={() => setEditing(false)}
						namePlaceholder="Parameter"
						valuePlaceholder="Value"
						addLabel="Add parameter"
					/>
					<p className="text-xs text-muted-foreground">
						The request URL is rewritten to match these parameters.
					</p>
				</>
			) : params.length > 0 ? (
				<KeyValueList rows={params} nameWidth="11rem" />
			) : (
				<EmptyNote>This request has no query string parameters.</EmptyNote>
			)}
		</Section>
	);
}

function FormParams({
	params,
}: {
	params: NonNullable<HAREntry["request"]["postData"]>["params"];
}) {
	if (!params || params.length === 0) return null;
	return (
		<div className="space-y-2">
			<h4 className="text-xs font-medium text-muted-foreground">Form data ({params.length})</h4>
			<KeyValueList
				rows={params.map((param) => ({ name: param.name, value: param.value ?? "" }))}
				nameWidth="11rem"
				renderValue={(row, i) => {
					const param = params[i];
					if (!param.fileName) {
						return (
							row.value || <span className="font-sans text-muted-foreground italic">empty</span>
						);
					}
					return (
						<span className="inline-flex flex-wrap items-center gap-1">
							<FileText className="size-3.5 text-muted-foreground" />
							{param.fileName}
							{param.contentType && (
								<span className="text-muted-foreground">({param.contentType})</span>
							)}
						</span>
					);
				}}
			/>
		</div>
	);
}

function RequestBody({ entry, index }: { entry: HAREntry; index: number }) {
	const update = useEntryUpdate(index);
	const postData = entry.request.postData;
	const text = postData?.text ?? "";
	const params = postData?.params ?? [];
	const bodySize = entry.request.bodySize;
	const mimeType = postData?.mimeType ?? "";

	const meta = [mimeType, bodySize > 0 ? formatBytes(bodySize) : ""].filter(Boolean);

	return (
		<Section
			title="Request body"
			actions={
				meta.length > 0 && (
					<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
						{meta.join(" · ")}
					</span>
				)
			}
		>
			{!postData || (!text && params.length === 0) ? (
				<EmptyNote>
					{entry.request.method === "GET" || entry.request.method === "HEAD"
						? `${entry.request.method} requests usually have no body.`
						: "This request was sent without a body."}
				</EmptyNote>
			) : (
				<div className="space-y-3">
					<FormParams params={params} />
					{text && (
						<BodyEditor
							value={isJsonMimeType(mimeType) ? formatResponseContent(text, mimeType) : text}
							language={languageForMime(mimeType, text)}
							title={<span className="font-mono">{mimeType || "text"}</span>}
							ariaLabel="Request body"
							onSave={(value) =>
								update(
									(current) => withPostDataText(current, value),
									"Edit request body",
									"Request body updated"
								)
							}
						/>
					)}
				</div>
			)}
		</Section>
	);
}

export function PayloadTab({ entry, index }: { entry: HAREntry; index: number }) {
	return (
		<TabBody>
			<QueryParameters entry={entry} index={index} />
			<RequestBody entry={entry} index={index} />
			<Section title="Request cookies" count={entry.request.cookies.length}>
				<CookieList cookies={entry.request.cookies} emptyText="No cookies were sent." />
			</Section>
		</TabBody>
	);
}
