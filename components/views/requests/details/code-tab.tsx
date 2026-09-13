"use client";

import { useId, useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import { useHarStore } from "@/lib/stores/har-store";
import { formatBytes, formatTime, getEntryContentSize } from "@/lib/har-parser";
import { getUrlParts, templatePath } from "@/lib/api-docs/path-template";
import { buildHarExport, serializeHar } from "@/lib/api-docs/har-export";
import { downloadTextFile, getEntryFileStem } from "@/lib/api-docs/download";
import {
	generateApiDocumentation,
	generateApiDocumentationAsText,
	generateCurl,
	generateFetch,
	generateOpenAPIForEntry,
	generatePowershell,
} from "@/lib/codegen";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CodeEditor } from "@/components/common/code-editor";
import { CopyButton } from "@/components/common/copy-button";
import type { CodeLanguage } from "@/components/common/code-language";
import { MarkdownPreview } from "@/components/common/markdown-preview";
import { Field, FieldGrid, TabBody } from "./shared";

type Format = "curl" | "fetch" | "powershell" | "docs" | "txt" | "openapi" | "har";

const FORMATS: Record<
	Format,
	{
		label: string;
		hint: string;
		language: CodeLanguage;
		suffix: string;
		mimeType: string;
		redactable: boolean;
	}
> = {
	curl: {
		label: "cURL (bash)",
		hint: "bash",
		language: "text",
		suffix: ".sh",
		mimeType: "text/x-shellscript",
		redactable: false,
	},
	fetch: {
		label: "fetch (JavaScript)",
		hint: "JavaScript",
		language: "javascript",
		suffix: ".js",
		mimeType: "text/javascript",
		redactable: false,
	},
	powershell: {
		label: "PowerShell",
		hint: "PowerShell",
		language: "text",
		suffix: ".ps1",
		mimeType: "text/plain",
		redactable: false,
	},
	docs: {
		label: "API docs (Markdown)",
		hint: "Markdown",
		language: "text",
		suffix: "-docs.md",
		mimeType: "text/markdown",
		redactable: true,
	},
	txt: {
		label: "Plain text docs",
		hint: "Plain text",
		language: "text",
		suffix: "-docs.txt",
		mimeType: "text/plain",
		redactable: true,
	},
	openapi: {
		label: "OpenAPI (JSON)",
		hint: "OpenAPI 3.0.3",
		language: "json",
		suffix: "-openapi.json",
		mimeType: "application/json",
		redactable: true,
	},
	har: {
		label: "HAR file",
		hint: "HAR 1.2",
		language: "json",
		suffix: ".har",
		mimeType: "application/json",
		redactable: true,
	},
};

const SNIPPETS: Format[] = ["curl", "fetch", "powershell"];
const DOCUMENTS: Format[] = ["docs", "txt", "openapi", "har"];

export function CodeTab({ entry }: { entry: HAREntry }) {
	const harData = useHarStore((s) => s.harData);
	const [format, setFormat] = useState<Format>("curl");
	const [redact, setRedact] = useState(true);
	const [docsView, setDocsView] = useState<"rendered" | "source">("rendered");
	const redactId = useId();
	const config = FORMATS[format];

	// Derived from `entry`, so edits to the entry are reflected immediately.
	const content = useMemo(() => {
		switch (format) {
			case "curl":
				return generateCurl(entry);
			case "fetch":
				return generateFetch(entry);
			case "powershell":
				return generatePowershell(entry);
			case "docs":
				return generateApiDocumentation(entry, { redact });
			case "txt":
				return generateApiDocumentationAsText(entry, { redact });
			case "openapi":
				return generateOpenAPIForEntry(entry, { redact });
			case "har":
				return serializeHar(buildHarExport(harData, [entry], { redact }));
		}
	}, [format, entry, redact, harData]);

	const fileName = `${getEntryFileStem(entry)}${config.suffix}`;
	const { pathname } = getUrlParts(entry.request.url);
	const isSnippet = SNIPPETS.includes(format);

	return (
		<TabBody className="space-y-4">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<Select value={format} onValueChange={(value) => setFormat(value as Format)}>
					<SelectTrigger size="sm" className="w-full @sm:w-56" aria-label="Output format">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectLabel>Code snippets</SelectLabel>
							{SNIPPETS.map((id) => (
								<SelectItem key={id} value={id}>
									{FORMATS[id].label}
								</SelectItem>
							))}
						</SelectGroup>
						<SelectSeparator />
						<SelectGroup>
							<SelectLabel>Documents</SelectLabel>
							{DOCUMENTS.map((id) => (
								<SelectItem key={id} value={id}>
									{FORMATS[id].label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				{config.redactable && (
					<div
						className="flex items-center gap-2"
						title="Replace credentials, cookies and token-like values with REDACTED"
					>
						<Switch id={redactId} checked={redact} onCheckedChange={setRedact} />
						<Label htmlFor={redactId} className="font-normal">
							Redact secrets
						</Label>
					</div>
				)}
				{format === "docs" && (
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						value={docsView}
						onValueChange={(value) => {
							if (value) setDocsView(value as "rendered" | "source");
						}}
						aria-label="Documentation view"
					>
						<ToggleGroupItem value="rendered">Rendered</ToggleGroupItem>
						<ToggleGroupItem value="source">Source</ToggleGroupItem>
					</ToggleGroup>
				)}
				<div className="flex items-center gap-1 @sm:ml-auto">
					<CopyButton value={content} successMessage="Copied to clipboard" variant="outline">
						Copy
					</CopyButton>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => downloadTextFile(content, fileName, config.mimeType)}
					>
						<Download />
						Download
					</Button>
				</div>
			</div>

			{format === "openapi" && (
				<FieldGrid className="@2xl:grid-cols-4">
					<Field label="Method">{entry.request.method}</Field>
					<Field label="Path" mono>
						{templatePath(pathname).template}
					</Field>
					<Field label="Status">{entry.response.status || "no response"}</Field>
					<Field label="Format">OpenAPI 3.0.3</Field>
				</FieldGrid>
			)}

			{format === "har" && (
				<div className="space-y-2">
					<p className="text-sm text-muted-foreground">
						This request is exported as a HAR file with its full request and response, keeping the
						original creator and page information.
					</p>
					<FieldGrid className="@2xl:grid-cols-5">
						<Field label="Method">{entry.request.method}</Field>
						<Field label="Status">{entry.response.status || "no response"}</Field>
						<Field label="Time">{formatTime(entry.time)}</Field>
						<Field label="Body size">{formatBytes(getEntryContentSize(entry))}</Field>
						<Field label="File size">{formatBytes(content.length)}</Field>
					</FieldGrid>
				</div>
			)}

			{format === "docs" && docsView === "rendered" ? (
				<div className="rounded-lg border p-4">
					<MarkdownPreview compact content={content} />
				</div>
			) : (
				<CodeEditor
					value={content}
					language={config.language}
					title={
						<span className="truncate">
							{config.hint} · <span className="font-mono">{fileName}</span>
						</span>
					}
					ariaLabel={`${config.label} output`}
					defaultWrap={!isSnippet}
					maxHeight="36rem"
				/>
			)}

			{isSnippet && (
				<div className="flex gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
					<Info className="mt-0.5 size-3.5 shrink-0" />
					<ul className="min-w-0 space-y-0.5">
						<li>
							<span className="font-medium text-foreground">cURL:</span> paste into a POSIX shell
							(bash, zsh, Git Bash).
						</li>
						<li>
							<span className="font-medium text-foreground">fetch:</span> run in a browser console
							or an ES module.
						</li>
						<li>
							<span className="font-medium text-foreground">PowerShell:</span> works in Windows
							PowerShell 5.1 and PowerShell 7.
						</li>
						<li>These snippets contain the captured credentials and cookies as-is.</li>
					</ul>
				</div>
			)}
		</TabBody>
	);
}
