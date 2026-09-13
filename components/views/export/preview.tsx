"use client";

import { useCallback, useState } from "react";
import { FileArchive, FileSearch, ListX, TriangleAlert } from "lucide-react";
import { MethodBadge } from "@/components/common/badges";
import { CodeEditor } from "@/components/common/code-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/har-parser";
import { MAX_RICH_PREVIEW, MAX_TEXT_PREVIEW, SCOPE_OPTIONS } from "./constants";
import { MarkdownPreview } from "@/components/common/markdown-preview";
import type { ExportModel } from "./use-export-model";

type MarkdownMode = "rendered" | "source";

const MAX_LISTED_HOSTS = 5;

/** Cuts at a line break so truncated previews don't end mid-line. */
function truncate(text: string, limit: number): string {
	if (text.length <= limit) return text;
	const cut = text.lastIndexOf("\n", limit);
	return text.slice(0, cut > limit * 0.8 ? cut : limit);
}

function useElementHeight() {
	const [height, setHeight] = useState(0);
	const ref = useCallback((node: HTMLDivElement | null) => {
		if (!node) return;
		const observer = new ResizeObserver(([entry]) =>
			setHeight(Math.floor(entry.contentRect.height))
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	return [ref, height] as const;
}

function StatBadge({ children }: { children: React.ReactNode }) {
	return (
		<Badge variant="outline" className="font-normal text-muted-foreground tabular-nums">
			{children}
		</Badge>
	);
}

function plural(count: number, noun: string) {
	return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

export function PreviewCard({ model, className }: { model: ExportModel; className?: string }) {
	const [markdownMode, setMarkdownMode] = useState<MarkdownMode>("rendered");
	const [bodyRef, bodyHeight] = useElementHeight();
	const {
		options,
		format,
		isPending,
		scopedEntries,
		endpoints,
		visibleEndpoints,
		generatedContent,
		contentSize,
		docStats,
		openApiStats,
		harStats,
		harPreview,
		showFullPreview,
		requestFullPreview,
		activeFormat,
		dedupe,
	} = model;
	const Icon = activeFormat.icon;
	const noun = dedupe ? "endpoint" : "request";

	const sizeLabel =
		format === "har"
			? harStats && `~${formatBytes(harStats.size)}`
			: generatedContent && formatBytes(contentSize);

	const stats: string[] = [];
	if (docStats && docStats.items > 0) {
		stats.push(
			plural(docStats.items, noun),
			plural(docStats.calls, "call"),
			plural(docStats.hosts, "host")
		);
	} else if (format === "openapi" && openApiStats) {
		stats.push(
			plural(openApiStats.paths, "path"),
			plural(openApiStats.operations, "operation"),
			plural(openApiStats.schemas, "schema"),
			plural(openApiStats.servers, "server")
		);
		if (openApiStats.securitySchemes > 0)
			stats.push(plural(openApiStats.securitySchemes, "security scheme"));
	} else if (harStats) {
		stats.push(plural(harStats.entries, "request"), plural(harStats.hosts.length, "domain"));
	}

	const fullText = format === "har" ? (harPreview?.text ?? "") : generatedContent;
	const rendered = format === "markdown" && markdownMode === "rendered";
	const limit = rendered ? MAX_RICH_PREVIEW : MAX_TEXT_PREVIEW;
	const textTruncated = !showFullPreview && fullText.length > limit;
	const previewText = textTruncated ? truncate(fullText, limit) : fullText;
	const harSampled = !!harPreview && !!harStats && harPreview.shownEntries < harStats.entries;
	const truncated = textTruncated || harSampled;
	const canShowFull = format !== "har" || (harPreview?.canShowFull ?? false);

	let body: React.ReactNode;
	if (scopedEntries.length === 0) {
		body = <NoEntries model={model} />;
	} else if (format !== "har" && visibleEndpoints.length === 0 && endpoints.length > 0) {
		body = (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<ListX />
					</EmptyMedia>
					<EmptyTitle>All {noun}s are excluded</EmptyTitle>
					<EmptyDescription>
						Tick {noun}s in the Endpoints list to include them in the export.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button variant="outline" size="sm" onClick={model.includeAllEndpoints}>
						Include all
					</Button>
				</EmptyContent>
			</Empty>
		);
	} else if (!fullText) {
		body =
			isPending || format === "har" ? (
				<PreviewSkeleton />
			) : (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FileSearch />
						</EmptyMedia>
						<EmptyTitle>Nothing to document</EmptyTitle>
						<EmptyDescription>
							None of the requests in this scope have an HTTP URL that can be documented. You can
							still export them as a HAR file.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button variant="outline" size="sm" onClick={() => model.updateOption("format", "har")}>
							<FileArchive />
							Export as HAR
						</Button>
					</EmptyContent>
				</Empty>
			);
	} else if (rendered) {
		body = (
			<div className="absolute inset-0 overflow-auto px-4 py-5 sm:px-6">
				<MarkdownPreview content={previewText} />
			</div>
		);
	} else {
		body =
			bodyHeight > 0 ? (
				<CodeEditor
					value={previewText}
					language={format === "openapi" || format === "har" ? "json" : "text"}
					readOnly
					defaultWrap={format !== "openapi" && format !== "har"}
					// The copy button would copy only the truncated preview.
					hideToolbar={truncated}
					title={activeFormat.mimeType}
					height={`${Math.max(bodyHeight - (truncated ? 0 : 37), 120)}px`}
					maxHeight="none"
					className="absolute inset-0 rounded-none border-0 bg-transparent"
				/>
			) : null;
	}

	const showContent = scopedEntries.length > 0 && !!fullText;

	return (
		<Card className={cn("gap-0 overflow-hidden py-0 shadow-xs", className)} aria-busy={isPending}>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
				<div className="flex min-w-0 items-center gap-2">
					<Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
					<h2 className="text-sm font-semibold">Preview</h2>
					<span className="text-sm text-muted-foreground">{activeFormat.label}</span>
				</div>
				{showContent && sizeLabel && (
					<Badge variant="secondary" className="tabular-nums">
						{sizeLabel}
					</Badge>
				)}
				<div className="ml-auto flex items-center gap-2">
					{isPending && (
						<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Spinner className="size-3.5" />
							Updating…
						</span>
					)}
					{options.format === "markdown" && (
						<ToggleGroup
							type="single"
							variant="outline"
							size="sm"
							value={markdownMode}
							onValueChange={(value) => value && setMarkdownMode(value as MarkdownMode)}
							aria-label="Preview mode"
						>
							<ToggleGroupItem value="rendered">Rendered</ToggleGroupItem>
							<ToggleGroupItem value="source">Source</ToggleGroupItem>
						</ToggleGroup>
					)}
				</div>
				{showContent && (stats.length > 0 || (harStats && harStats.methods.length > 0)) && (
					<div className="flex w-full flex-wrap items-center gap-1.5">
						{stats.map((stat) => (
							<StatBadge key={stat}>{stat}</StatBadge>
						))}
						{format === "har" &&
							harStats?.methods.map((method) => <MethodBadge key={method} method={method} />)}
					</div>
				)}
				{showContent && format === "har" && harStats && harStats.hosts.length > 0 && (
					<p
						className="w-full min-w-0 truncate text-xs text-muted-foreground"
						title={harStats.hosts.join(", ")}
					>
						{harStats.hosts.slice(0, MAX_LISTED_HOSTS).join(", ")}
						{harStats.hosts.length > MAX_LISTED_HOSTS &&
							` +${(harStats.hosts.length - MAX_LISTED_HOSTS).toLocaleString()} more`}
					</p>
				)}
			</div>

			{showContent && truncated && (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
					<TriangleAlert className="size-3.5 shrink-0 text-warning" aria-hidden />
					<span className="min-w-0 flex-1">
						{harSampled && !textTruncated && harStats && harPreview
							? `Large file (~${formatBytes(harStats.size)}). Preview shows the first ${plural(harPreview.shownEntries, "request")} of ${harStats.entries.toLocaleString()}.`
							: `Large output (${sizeLabel}). Preview shows the first ${formatBytes(limit)}.`}{" "}
						{canShowFull ? "" : "Download the file to see everything."}
					</span>
					{canShowFull && (
						<Button variant="outline" size="xs" onClick={requestFullPreview}>
							Show full preview
						</Button>
					)}
				</div>
			)}

			<div
				ref={bodyRef}
				className={cn(
					"relative min-h-0 flex-1 transition-opacity",
					isPending && showContent && "opacity-60"
				)}
			>
				{showContent ? body : <div className="absolute inset-0 flex overflow-auto">{body}</div>}
			</div>
		</Card>
	);
}

function PreviewSkeleton() {
	return (
		<div className="flex w-full flex-col gap-3 p-6" aria-label="Generating preview">
			<Skeleton className="h-6 w-1/3" />
			<Skeleton className="h-4 w-2/3" />
			<Skeleton className="h-4 w-1/2" />
			<Skeleton className="mt-4 h-5 w-1/4" />
			<Skeleton className="h-24 w-full" />
			<Skeleton className="h-4 w-3/5" />
		</div>
	);
}

function NoEntries({ model }: { model: ExportModel }) {
	const { options, scopeCounts, scopeOrder, updateOption } = model;
	const alternatives = scopeOrder.filter(
		(scope) => scope !== options.scope && scopeCounts[scope] > 0
	);
	const label = SCOPE_OPTIONS[options.scope].label;
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FileSearch />
				</EmptyMedia>
				<EmptyTitle>Nothing to export</EmptyTitle>
				<EmptyDescription>
					There are no requests in “{label}”. Choose another scope to export.
				</EmptyDescription>
			</EmptyHeader>
			{alternatives.length > 0 && (
				<EmptyContent className="flex-row flex-wrap justify-center gap-2">
					{alternatives.map((scope) => (
						<Button
							key={scope}
							variant="outline"
							size="sm"
							onClick={() => updateOption("scope", scope)}
						>
							{SCOPE_OPTIONS[scope].label}
							<span className="text-muted-foreground tabular-nums">
								{scopeCounts[scope].toLocaleString()}
							</span>
						</Button>
					))}
				</EmptyContent>
			)}
		</Empty>
	);
}
