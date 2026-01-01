"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	Terminal,
	Copy,
	Check,
	Download,
	FileText,
	Loader2,
} from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { DetailSection } from "./shared-components";
import {
	generateCurl,
	generateFetch,
	generatePowershell,
	generateApiDocumentation,
} from "./utils";
import { cn } from "@/lib/cn";
import { useFocusMode } from "./focus-context";

interface ExportTabProps {
	entry: HAREntry;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="relative">
			<div className="flex items-center justify-between bg-card/60 border border-border/30 rounded-t px-3 py-1.5">
				<span className="text-[10px] font-mono text-muted uppercase">
					{language}
				</span>
				<button
					onClick={handleCopy}
					className={cn(
						"flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
						copied
							? "bg-green-500/20 text-green-400"
							: "bg-card/60 text-muted hover:text-foreground hover:bg-primary/10"
					)}
				>
					{copied ? (
						<>
							<Check className="w-3 h-3" />
							Copied
						</>
					) : (
						<>
							<Copy className="w-3 h-3" />
							Copy
						</>
					)}
				</button>
			</div>
			<pre className="font-mono text-[10px] bg-card/40 border border-t-0 border-border/30 rounded-b p-3 overflow-x-auto">
				{code}
			</pre>
		</div>
	);
}

export function ExportTab({ entry }: ExportTabProps) {
	const { isFocusMode } = useFocusMode();
	const [activeFormat, setActiveFormat] = useState<
		"curl" | "fetch" | "powershell" | "docs"
	>("curl");
	const [docsContent, setDocsContent] = useState<string>("");
	const [isGenerating, setIsGenerating] = useState(false);

	useEffect(() => {
		let mounted = true;

		if (activeFormat === "docs" && !docsContent) {
			const generateDocs = async () => {
				if (!mounted) return;
				setIsGenerating(true);

				await new Promise((resolve) => setTimeout(resolve, 100));

				if (!mounted) return;
				const markdown = generateApiDocumentation(entry);
				setDocsContent(markdown);
				setIsGenerating(false);
			};

			generateDocs();
		}

		return () => {
			mounted = false;
		};
	}, [activeFormat, docsContent, entry]);

	const generateFilename = (): string => {
		const url = new URL(entry.request.url);
		const pathname = url.pathname
			.split("/")
			.filter(Boolean)
			.join("-")
			.replace(/[^a-zA-Z0-9-_]/g, "");
		const method = entry.request.method.toLowerCase();
		return `${method}-${pathname || "api"}-docs.md`;
	};

	const handleDownloadDocs = () => {
		const markdown = docsContent || generateApiDocumentation(entry);
		const blob = new Blob([markdown], { type: "text/markdown" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = generateFilename();
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const formats = [
		{ id: "curl" as const, label: "cURL", code: generateCurl(entry) },
		{
			id: "fetch" as const,
			label: "Fetch API",
			code: generateFetch(entry),
		},
		{
			id: "powershell" as const,
			label: "PowerShell",
			code: generatePowershell(entry),
		},
		{
			id: "docs" as const,
			label: "Docs",
			code: "",
		},
	];

	const activeCode = formats.find((f) => f.id === activeFormat)?.code || "";

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2 border-b border-border/30 pb-2">
				{formats.map((format) => (
					<button
						key={format.id}
						onClick={() => setActiveFormat(format.id)}
						className={cn(
							"px-3 py-1.5 text-xs font-medium rounded transition-all border",
							activeFormat === format.id
								? "bg-primary/10 text-primary border border-primary/30"
								: "text-muted hover:text-foreground hover:bg-card/40"
						)}
					>
						{format.label}
					</button>
				))}
			</div>

			<DetailSection
				title="Export as Code"
				icon={<Terminal className="w-3.5 h-3.5 text-green-500" />}
			>
				{activeFormat === "docs" ? (
					<div className="space-y-2 border border-border/90 rounded">
						<div className="flex items-center  justify-between bg-card/60 border border-border/30 rounded-t px-3 py-2">
							<div className="flex items-center gap-2">
								<FileText className="w-3.5 h-3.5 text-blue-500" />
								<span className="text-xs font-medium text-foreground">
									API Documentation
								</span>
								<span className="text-[10px] text-muted">
									({generateFilename()})
								</span>
							</div>
							<button
								onClick={handleDownloadDocs}
								disabled={isGenerating}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<Download className="w-3.5 h-3.5" />
								Download .md
							</button>
						</div>
						<div
							className={cn(
								"bg-card/40 border border-t-0 border-border/30 rounded-b p-4 overflow-auto",
								!isFocusMode && "max-h-[48vh]"
							)}
						>
							{isGenerating ? (
								<div className="flex flex-col items-center justify-center py-12 space-y-3">
									<Loader2 className="w-8 h-8 text-primary animate-spin" />
									<p className="text-sm text-muted">
										Analyzing response structure...
									</p>
									<p className="text-xs text-muted/60">
										Comparing all items to build complete
										schema
									</p>
								</div>
							) : (
								<div className="prose prose-sm prose-invert max-w-none">
									<ReactMarkdown
										remarkPlugins={[remarkGfm]}
										components={{
											h1: ({ children }) => (
												<h1 className="text-xl font-bold text-foreground mb-3 mt-4">
													{children}
												</h1>
											),
											h2: ({ children }) => (
												<h2 className="text-lg font-semibold text-foreground mb-2 mt-3">
													{children}
												</h2>
											),
											h3: ({ children }) => (
												<h3 className="text-base font-semibold text-foreground mb-2 mt-2">
													{children}
												</h3>
											),
											p: ({ children }) => (
												<p className="text-xs text-foreground/80 mb-2">
													{children}
												</p>
											),
											ul: ({ children }) => (
												<ul className="list-disc list-inside space-y-1 text-xs text-foreground/80 ml-4 mb-3">
													{children}
												</ul>
											),
											ol: ({ children }) => (
												<ol className="list-decimal list-inside space-y-1 text-xs text-foreground/80 ml-4 mb-3">
													{children}
												</ol>
											),
											code: ({ node, ...props }) => {
												const isInline =
													!node?.position ||
													node.position.start.line ===
														node.position.end.line;
												return isInline ? (
													<code
														className="bg-primary/20 text-primary px-1 py-0.5 rounded text-[10px] font-mono"
														{...props}
													/>
												) : (
													<code
														className="text-[10px] font-mono text-foreground/90"
														{...props}
													/>
												);
											},
											pre: ({ children }) => (
												<pre className="bg-card/60 border border-border/30 rounded p-3 overflow-x-auto mb-3">
													{children}
												</pre>
											),
											blockquote: ({ children }) => (
												<blockquote className="border-l-4 border-primary/50 pl-3 py-1 text-xs text-muted italic mb-2">
													{children}
												</blockquote>
											),
											hr: () => (
												<hr className="border-border/30 my-3" />
											),
											table: ({ children }) => (
												<div className="overflow-x-auto mb-3">
													<table className="min-w-full text-xs border border-border/30 rounded">
														{children}
													</table>
												</div>
											),
											thead: ({ children }) => (
												<thead className="bg-card/60">
													{children}
												</thead>
											),
											tbody: ({ children }) => (
												<tbody>{children}</tbody>
											),
											th: ({ children }) => (
												<th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/30">
													{children}
												</th>
											),
											td: ({ children }) => (
												<td className="px-3 py-2 text-foreground/80 font-mono text-[10px]">
													{children}
												</td>
											),
											tr: ({ children }) => (
												<tr className="border-b border-border/20 hover:bg-card/20">
													{children}
												</tr>
											),
											strong: ({ children }) => (
												<strong className="font-semibold text-foreground">
													{children}
												</strong>
											),
											em: ({ children }) => (
												<em className="text-[10px] text-muted italic">
													{children}
												</em>
											),
										}}
									>
										{docsContent}
									</ReactMarkdown>
								</div>
							)}
						</div>
					</div>
				) : (
					<CodeBlock code={activeCode} language={activeFormat} />
				)}
			</DetailSection>

			{activeFormat !== "docs" && (
				<>
					<DetailSection
						title="Request Details"
						icon={
							<Terminal className="w-3.5 h-3.5 text-blue-500" />
						}
					>
						<div className="space-y-2">
							<div className="bg-card/40 border border-border/30 rounded p-3">
								<div className="text-[10px] font-bold text-foreground/70 uppercase mb-1">
									Method & URL
								</div>
								<div className="font-mono text-xs text-foreground break-all">
									{entry.request.method} {entry.request.url}
								</div>
							</div>

							<div className="bg-card/40 border border-border/30 rounded p-3">
								<div className="text-[10px] font-bold text-foreground/70 uppercase mb-2">
									Headers ({entry.request.headers.length})
								</div>
								<div
									className={cn(
										"space-y-1 overflow-auto",
										!isFocusMode && "max-h-[20vh]"
									)}
								>
									{entry.request.headers.map((header, i) => (
										<div
											key={i}
											className="flex items-start gap-2 text-[10px]"
										>
											<span className="font-mono font-medium text-primary min-w-30">
												{header.name}:
											</span>
											<span className="font-mono text-foreground/80 break-all">
												{header.value}
											</span>
										</div>
									))}
								</div>
							</div>

							{entry.request.postData &&
								entry.request.postData.text && (
									<div className="bg-card/40 border border-border/30 rounded p-3">
										<div className="text-[10px] font-bold text-foreground/70 uppercase mb-2">
											Request Body
										</div>
										<pre
											className={cn(
												"font-mono text-[10px] text-foreground/80 whitespace-pre-wrap break-all overflow-auto",
												!isFocusMode && "max-h-[20vh]"
											)}
										>
											{entry.request.postData.text}
										</pre>
									</div>
								)}
						</div>
					</DetailSection>

					<div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
						<div className="flex items-start gap-2">
							<Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
							<div className="space-y-1">
								<p className="text-xs text-blue-400 font-medium">
									How to use these exports
								</p>
								<ul className="text-[10px] text-blue-400/80 space-y-0.5 list-disc list-inside">
									<li>
										<strong>cURL:</strong> Copy and paste
										into your terminal
									</li>
									<li>
										<strong>Fetch API:</strong> Use in
										JavaScript/TypeScript code
									</li>
									<li>
										<strong>PowerShell:</strong> Run in
										Windows PowerShell
									</li>
								</ul>
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
