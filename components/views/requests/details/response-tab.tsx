"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import {
	extractPathname,
	formatBytes,
	getBaseMimeType,
	getEntryContentSize,
	getEntryTransferSize,
	getHeaderValue,
} from "@/lib/har-parser";
import {
	formatResponseContent,
	getResponseBody,
	getResponseCookies,
	isJsonMimeType,
	withResponseText,
	type ResponseBody,
} from "@/lib/entry/entry-utils";
import { downloadTextFile } from "@/lib/api-docs/download";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CodeEditor } from "@/components/common/code-editor";
import { languageForMime, type CodeLanguage } from "@/components/common/code-language";
import { BodyEditor } from "./body-editor";
import {
	BinaryCard,
	FontPreview,
	HtmlPreview,
	ImagePreview,
	MediaPreview,
} from "./response-previews";
import { CookieList, EmptyNote, Section, TabBody, useEntryUpdate } from "./shared";

/** Only well-formed MIME types are interpolated into data: URLs. */
function safeMimeType(mimeType: string, fallback: string): string {
	const base = getBaseMimeType(mimeType);
	return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(base) ? base : fallback;
}

function isFontMimeType(base: string): boolean {
	return (
		base.startsWith("font/") || base.includes("font") || /woff|truetype|opentype|sfnt/.test(base)
	);
}

function getDownloadName(entry: HAREntry, fallbackExtension: string): string {
	const name = extractPathname(entry.request.url).split("/").filter(Boolean).pop();
	return name && /\.[a-z0-9]+$/i.test(name) ? name : `response.${fallbackExtension}`;
}

const TEXT_EXTENSIONS: Record<CodeLanguage, string> = {
	json: "json",
	html: "html",
	xml: "xml",
	javascript: "js",
	css: "css",
	text: "txt",
};

type PreviewKind = "json" | "image" | "svg" | "html" | "font" | "media" | null;

function getPreviewKind(body: ResponseBody, base: string, mimeType: string): PreviewKind {
	if (body.kind === "binary") {
		if (base.startsWith("image/")) return "image";
		if (isFontMimeType(base)) return "font";
		if (base.startsWith("video/") || base.startsWith("audio/")) return "media";
		return null;
	}
	if (body.kind !== "text") return null;
	if (base === "image/svg+xml") return "svg";
	if (base === "text/html" || base === "application/xhtml+xml") return "html";
	if (isJsonMimeType(mimeType) || languageForMime(mimeType, body.text) === "json") return "json";
	return null;
}

function ResponseContent({ entry, index }: { entry: HAREntry; index: number }) {
	const update = useEntryUpdate(index);
	const content = entry.response.content;
	const body = useMemo(() => getResponseBody(content), [content]);
	const base = getBaseMimeType(content.mimeType);
	const previewKind = useMemo(
		() => getPreviewKind(body, base, content.mimeType),
		[body, base, content.mimeType]
	);
	const formattedJson = useMemo(
		() =>
			previewKind === "json" && body.kind === "text"
				? formatResponseContent(body.text, "application/json")
				: "",
		[previewKind, body]
	);
	const [view, setView] = useState<"preview" | "raw">("preview");
	const showPreview = previewKind !== null && view === "preview";

	if (body.kind === "none") {
		const size = getEntryContentSize(entry);
		const { status } = entry.response;
		const bodyless =
			status === 204 || status === 304
				? String(status)
				: entry.request.method === "HEAD"
					? "HEAD"
					: null;
		return (
			<EmptyNote>
				{bodyless
					? `No body (${bodyless} responses have none).`
					: size > 0
						? `The response body (${formatBytes(size)}) was not captured in this HAR file.`
						: "This response has no content."}
			</EmptyNote>
		);
	}

	const saveText = (value: string) =>
		update(
			(current) => withResponseText(current, value),
			"Edit response body",
			"Response body updated"
		);

	let preview: React.ReactNode = null;
	let raw: React.ReactNode;

	if (body.kind === "binary") {
		const mime = safeMimeType(content.mimeType, "application/octet-stream");
		const src = `data:${mime};base64,${body.base64}`;
		const extension = mime.split("/")[1].split("+")[0];
		const downloadName = getDownloadName(entry, previewKind ? extension : "bin");
		if (previewKind === "image") preview = <ImagePreview src={src} downloadName={downloadName} />;
		else if (previewKind === "font") preview = <FontPreview base64={body.base64} />;
		else if (previewKind === "media") {
			preview = <MediaPreview src={src} isVideo={base.startsWith("video/")} />;
		}
		raw = (
			<BinaryCard
				src={src}
				mimeType={mime}
				base64Length={body.base64.length}
				downloadName={downloadName}
			/>
		);
	} else {
		const language = previewKind === "json" ? "json" : languageForMime(content.mimeType, body.text);
		if (previewKind === "svg") {
			preview = (
				<ImagePreview
					src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(body.text)}`}
					downloadName={getDownloadName(entry, "svg")}
				/>
			);
		} else if (previewKind === "html") {
			preview = <HtmlPreview html={body.text} baseUrl={entry.request.url} />;
		} else if (previewKind === "json") {
			preview = (
				<CodeEditor
					value={formattedJson}
					language="json"
					title="Formatted JSON"
					ariaLabel="Formatted response JSON"
					maxHeight="36rem"
				/>
			);
		}
		const text = body.text;
		raw = (
			<div className="space-y-2">
				{body.wasBase64 && (
					<p className="text-xs text-muted-foreground">
						Decoded from base64. Saving an edit stores the body as plain text.
					</p>
				)}
				<BodyEditor
					value={text}
					language={language}
					title={<span className="font-mono">{content.mimeType || "text"}</span>}
					ariaLabel="Response body"
					maxHeight="36rem"
					onSave={saveText}
					toolbar={
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label="Download body"
							title="Download body"
							onClick={() =>
								downloadTextFile(
									text,
									getDownloadName(entry, TEXT_EXTENSIONS[language]),
									base || "text/plain"
								)
							}
						>
							<Download />
						</Button>
					}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{previewKind !== null && (
				<ToggleGroup
					type="single"
					variant="outline"
					size="sm"
					value={view}
					onValueChange={(value) => {
						if (value) setView(value as "preview" | "raw");
					}}
					aria-label="Response view"
				>
					<ToggleGroupItem value="preview">Preview</ToggleGroupItem>
					<ToggleGroupItem value="raw">
						{body.kind === "binary" ? "Download" : "Raw"}
					</ToggleGroupItem>
				</ToggleGroup>
			)}
			{showPreview ? preview : raw}
		</div>
	);
}

export function ResponseTab({ entry, index }: { entry: HAREntry; index: number }) {
	const { response } = entry;
	const contentEncoding = getHeaderValue(response.headers, "content-encoding");
	const cookies = getResponseCookies(entry);

	const info = [
		`${formatBytes(getEntryContentSize(entry))} resource`,
		`${formatBytes(getEntryTransferSize(entry))} transferred`,
		`encoding: ${contentEncoding || "none"}`,
		response.content.compression !== undefined
			? `${formatBytes(response.content.compression)} saved by compression`
			: null,
	].filter(Boolean);

	return (
		<TabBody>
			<Section
				title="Response body"
				actions={
					response.content.mimeType && (
						<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
							{response.content.mimeType}
						</span>
					)
				}
			>
				<p className="text-xs text-muted-foreground tabular-nums">{info.join(" · ")}</p>
				<ResponseContent entry={entry} index={index} />
			</Section>

			<Section title="Response cookies" count={cookies.length}>
				<CookieList cookies={cookies} emptyText="The response sets no cookies." />
			</Section>
		</TabBody>
	);
}
