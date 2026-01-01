"use client";

import { useState } from "react";
import Image from "next/image";
import {
	Download,
	AlertCircle,
	ImageIcon,
	FileText,
	Code,
	HardDrive,
	Activity,
} from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { formatBytes } from "@/lib/har-parser";
import { DetailSection, CompactCard } from "./shared-components";
import { EditableField } from "../shared/editable-field";
import { EditableJsonHighlighter } from "../shared/editable-json-highlighter";
import { CopyButton } from "@/components/ui/copy-button";
import { formatResponseContent, sanitizeBase64 } from "./utils";
import { useFocusMode } from "./focus-context";
import { cn } from "@/lib/cn";

interface ResponseTabProps {
	entry: HAREntry;
	theme: string;
	onUpdateField: (path: string[], value: string | number) => void;
}

function FontPreview({ entry }: { entry: HAREntry }) {
	if (!entry.response.content.text) {
		return entry.response.content.size > 0 ? (
			<div className="bg-card/40 border border-border/30 rounded p-3 text-center">
				<p className="text-xs text-foreground mb-1">
					Font data not embedded in response
				</p>
				<p className="text-[10px] text-muted">
					Size: {formatBytes(entry.response.content.size)}
				</p>
			</div>
		) : (
			<div className="text-xs text-muted italic">No font content</div>
		);
	}

	const fontFormat = entry.response.content.mimeType.includes("woff2")
		? "woff2"
		: entry.response.content.mimeType.includes("woff")
		? "woff"
		: entry.response.content.mimeType.includes("ttf")
		? "truetype"
		: entry.response.content.mimeType.includes("otf")
		? "opentype"
		: "woff";

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2 text-xs text-muted">
				<span className="text-base">Aa</span>
				<span>Font Preview</span>
			</div>
			<div className="bg-card/40 border border-border/30 rounded p-4 space-y-3">
				<style>
					{`@font-face {
						font-family: 'preview-font-${entry.startedDateTime}';
						src: url('data:${entry.response.content.mimeType};base64,${sanitizeBase64(
						entry.response.content.text
					)}') format('${fontFormat}');
					}`}
				</style>
				<div
					style={{
						fontFamily: `'preview-font-${entry.startedDateTime}'`,
					}}
					className="text-2xl font-bold text-foreground"
				>
					The Quick Brown Fox
				</div>
				<div
					style={{
						fontFamily: `'preview-font-${entry.startedDateTime}'`,
					}}
					className="text-lg text-foreground/80"
				>
					jumps over the lazy dog 1234567890
				</div>
			</div>
		</div>
	);
}

function ImagePreview({ entry }: { entry: HAREntry }) {
	const [imageError, setImageError] = useState(false);

	if (imageError) {
		return (
			<div className="space-y-2">
				<div className="flex items-center gap-2 text-xs text-red-500">
					<AlertCircle className="w-3.5 h-3.5" />
					<span>Failed to Load Image</span>
				</div>
				<div className="bg-red-500/10 border border-red-500/30 rounded p-3">
					<p className="text-xs text-red-500 mb-1">
						The image could not be rendered.
					</p>
					<ul className="text-[10px] text-red-500/80 space-y-0.5 list-disc list-inside">
						<li>Corrupted or invalid image data</li>
						<li>Unsupported image format</li>
						<li>Malformed base64 encoding</li>
					</ul>
				</div>
			</div>
		);
	}

	const dataUrl = `data:${
		entry.response.content.mimeType
	};base64,${sanitizeBase64(entry.response.content.text || "")}`;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-xs text-muted">
					<ImageIcon className="w-3.5 h-3.5" />
					<span>Image Preview</span>
				</div>
				<CopyButton
					content={dataUrl}
					mimeType={entry.response.content.mimeType}
					size="sm"
					className="p-1"
				/>
			</div>
			<div className="relative w-full max-w-full">
				<Image
					src={dataUrl}
					alt="Response content preview"
					width={800}
					height={600}
					className="rounded border border-border/30"
					style={{
						width: "auto",
						height: "auto",
						maxWidth: "100%",
					}}
					onError={() => setImageError(true)}
					unoptimized
				/>
			</div>
		</div>
	);
}

function HtmlPreview({
	entry,
	theme,
	onUpdateField,
	isFocusMode,
}: {
	entry: HAREntry;
	theme: string;
	onUpdateField: (path: string[], value: string | number) => void;
	isFocusMode: boolean;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-xs text-muted">
					<FileText className="w-3.5 h-3.5" />
					<span>HTML Preview</span>
				</div>
				<CopyButton
					content={entry.response.content.text || ""}
					size="sm"
					className="p-1"
				/>
			</div>
			<iframe
				srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{background:${
					theme === "dark" ? "#0a0e1a" : "#ffffff"
				};color:${
					theme === "dark" ? "#e0e7ff" : "#1e293b"
				}}</style></head><body>${
					entry.response.content.text
				}</body></html>`}
				title="HTML response preview"
				className={cn(
					"w-full rounded border border-border/30",
					isFocusMode ? "h-96" : "h-64"
				)}
				sandbox="allow-scripts allow-popups allow-forms allow-modals"
			/>
			<details className="mt-2">
				<summary className="cursor-pointer text-xs text-muted hover:text-foreground flex items-center gap-1.5">
					<Code className="w-3 h-3" />
					View Source
				</summary>
				<EditableField
					value={entry.response.content.text || ""}
					onSave={(value) =>
						onUpdateField(["response", "content", "text"], value)
					}
					multiline
					className={cn(
						"mt-2 font-mono text-xs bg-card/60 p-3 rounded border border-border/30 whitespace-pre-wrap break-all overflow-auto",
						!isFocusMode && "max-h-[30vh]"
					)}
				/>
			</details>
		</div>
	);
}

export function ResponseTab({ entry, theme, onUpdateField }: ResponseTabProps) {
	const { isFocusMode } = useFocusMode();
	const isImage =
		entry.response.content.mimeType.startsWith("image/") ||
		entry.response.content.mimeType.includes("svg");
	const isFont =
		entry.response.content.mimeType === "font/woff" ||
		entry.response.content.mimeType === "font/woff2" ||
		entry.response.content.mimeType === "font/ttf" ||
		entry.response.content.mimeType === "font/otf";
	const isHTML =
		entry.response.content.mimeType === "text/html" ||
		entry.response.content.mimeType === "application/xhtml+xml";

	return (
		<div className="space-y-3">
			<DetailSection
				title="Response Content"
				icon={<Download className="w-3.5 h-3.5 text-purple-500" />}
			>
				{isFont ? (
					<FontPreview entry={entry} />
				) : isImage && entry.response.content.text ? (
					<ImagePreview entry={entry} />
				) : isHTML && entry.response.content.text ? (
					<HtmlPreview
						entry={entry}
						theme={theme}
						onUpdateField={onUpdateField}
						isFocusMode={isFocusMode}
					/>
				) : entry.response.content.text ? (
					entry.response.content.mimeType.includes("json") ? (
						<EditableJsonHighlighter
							content={formatResponseContent(
								entry.response.content.text,
								entry.response.content.mimeType
							)}
							onSave={(value) =>
								onUpdateField(
									["response", "content", "text"],
									value
								)
							}
							isFocusMode={isFocusMode}
						/>
					) : (
						<div className="space-y-2">
							<div className="flex justify-end">
								<CopyButton
									content={formatResponseContent(
										entry.response.content.text,
										entry.response.content.mimeType
									)}
									size="sm"
									className="p-1"
								/>
							</div>
							<EditableField
								value={formatResponseContent(
									entry.response.content.text,
									entry.response.content.mimeType
								)}
								onSave={(value) =>
									onUpdateField(
										["response", "content", "text"],
										value
									)
								}
								multiline
								className={cn(
									"font-mono text-xs bg-card/60 p-3 rounded border border-border/30 whitespace-pre-wrap break-all overflow-auto",
									!isFocusMode && "max-h-[40vh]"
								)}
							/>
						</div>
					)
				) : (
					<div className="text-xs text-muted italic py-2">
						No response content
					</div>
				)}
			</DetailSection>

			<div className="grid grid-cols-2 gap-2">
				<CompactCard
					label="Content Size"
					value={formatBytes(entry.response.content.size)}
					icon={<HardDrive className="w-3 h-3 text-purple-500" />}
				/>
				{entry.response.content.compression !== undefined && (
					<CompactCard
						label="Compression"
						value={formatBytes(entry.response.content.compression)}
						icon={<Activity className="w-3 h-3 text-green-500" />}
					/>
				)}
			</div>
		</div>
	);
}
