"use client";

import { useState, useMemo, startTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	Download,
	FileText,
	FileCode,
	FileJson,
	Filter,
	CheckSquare,
	Square,
	Bookmark,
	Layers,
	Settings2,
	Globe,
	Code,
	Activity,
	Copy,
	Check,
	ChevronDown,
	ChevronUp,
	Loader2,
	Package,
} from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";
import { cn } from "@/lib/cn";
import {
	ExportScope,
	ExportFormat,
	ExportOptions,
	GroupByOption,
} from "./types";
import {
	deduplicateAndAnalyzeEndpoints,
	generateMarkdown,
	generatePlainText,
	generateHAR,
	generateHARPreviewStats,
} from "./utils";

const SCOPE_OPTIONS: Array<{
	id: ExportScope;
	label: string;
	icon: typeof Filter;
	description: string;
}> = [
	{
		id: "all",
		label: "All Entries",
		icon: Layers,
		description: "Export all API requests",
	},
	{
		id: "selected",
		label: "Selected",
		icon: CheckSquare,
		description: "Only selected entries",
	},
	{
		id: "filtered",
		label: "Filtered",
		icon: Filter,
		description: "Currently visible entries",
	},
	{
		id: "bookmarked",
		label: "Bookmarked",
		icon: Bookmark,
		description: "Only bookmarked entries",
	},
];

const FORMAT_OPTIONS: Array<{
	id: ExportFormat;
	label: string;
	icon: typeof FileText;
	extension: string;
}> = [
	{ id: "markdown", label: "Markdown", icon: FileCode, extension: ".md" },
	{ id: "txt", label: "Plain Text", icon: FileText, extension: ".txt" },
	{ id: "har", label: "HAR File", icon: FileJson, extension: ".har" },
];

const GROUP_OPTIONS: Array<{ id: GroupByOption; label: string }> = [
	{ id: "none", label: "No Grouping" },
	{ id: "domain", label: "By Domain" },
	{ id: "method", label: "By Method" },
	{ id: "status", label: "By Status" },
];

export function ExportView() {
	const { entries, selectedEntries, visibleEntryIndices, bookmarks } =
		useHarStore();

	const getScopeOrder = (): ExportScope[] => {
		const hasSelectedItems = selectedEntries.size > 0;
		return hasSelectedItems
			? ["selected", "filtered", "all", "bookmarked"]
			: ["filtered", "selected", "all", "bookmarked"];
	};

	const [options, setOptions] = useState<ExportOptions>(() => {
		const scopeOrder = getScopeOrder();
		const firstScope = (scopeOrder.find((id) =>
			SCOPE_OPTIONS.some((opt) => opt.id === id)
		) || "all") as ExportScope;

		return {
			scope: firstScope,
			format: "markdown",
			groupBy: "none",
			includeHeaders: true,
			includeQueryParams: true,
			includeRequestBody: true,
			includeResponseSchema: true,
			includePerformanceMetrics: true,
			includeCurlExamples: true,
		};
	});

	const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
	const [copied, setCopied] = useState(false);
	const [hiddenEndpoints, setHiddenEndpoints] = useState<Set<string>>(
		new Set()
	);
	const [isAnalyzing, setIsAnalyzing] = useState(false);

	const scopedEntries = useMemo(() => {
		switch (options.scope) {
			case "selected":
				return entries.filter((_, i) => selectedEntries.has(i));
			case "filtered":
				return visibleEntryIndices.map((i) => entries[i]);
			case "bookmarked":
				return entries.filter((_, i) => bookmarks.has(i));
			case "all":
			default:
				return entries;
		}
	}, [
		entries,
		selectedEntries,
		visibleEntryIndices,
		bookmarks,
		options.scope,
	]);

	const uniqueEndpoints = useMemo(() => {
		if (options.format === "har") return [];
		if (scopedEntries.length === 0) return [];

		if (scopedEntries.length > 50) {
			startTransition(() => {
				setIsAnalyzing(true);
			});
		}

		const result = deduplicateAndAnalyzeEndpoints(scopedEntries);

		if (scopedEntries.length > 50) {
			setTimeout(() => setIsAnalyzing(false), 100);
		}

		return result;
	}, [scopedEntries, options.format]);

	const visibleEndpoints = useMemo(() => {
		return uniqueEndpoints.filter((endpoint) => {
			const key = `${endpoint.method}:${endpoint.pattern}`;
			return !hiddenEndpoints.has(key);
		});
	}, [uniqueEndpoints, hiddenEndpoints]);

	const generatedContent = useMemo(() => {
		if (options.format === "har") {
			return generateHAR(scopedEntries);
		}

		if (visibleEndpoints.length === 0) return "";

		return options.format === "markdown"
			? generateMarkdown(visibleEndpoints, options)
			: generatePlainText(visibleEndpoints, options);
	}, [visibleEndpoints, options, scopedEntries]);

	const handleDownload = () => {
		const extension =
			options.format === "markdown"
				? ".md"
				: options.format === "txt"
				? ".txt"
				: ".har";
		const mimeType =
			options.format === "markdown"
				? "text/markdown"
				: options.format === "txt"
				? "text/plain"
				: "application/json";
		const filename =
			options.format === "har"
				? `har-export-${new Date()
						.toISOString()
						.slice(0, 10)}${extension}`
				: `api-documentation-${new Date()
						.toISOString()
						.slice(0, 10)}${extension}`;

		const blob = new Blob([generatedContent], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleCopy = () => {
		navigator.clipboard.writeText(generatedContent);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const updateOption = <K extends keyof ExportOptions>(
		key: K,
		value: ExportOptions[K]
	) => {
		setOptions((prev) => ({ ...prev, [key]: value }));
	};

	const toggleEndpointVisibility = (
		endpoint: (typeof uniqueEndpoints)[0]
	) => {
		const key = `${endpoint.method}:${endpoint.pattern}`;
		setHiddenEndpoints((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(key)) {
				newSet.delete(key);
			} else {
				newSet.add(key);
			}
			return newSet;
		});
	};

	const getScopeCount = (scope: ExportScope): number => {
		switch (scope) {
			case "selected":
				return selectedEntries.size;
			case "filtered":
				return visibleEntryIndices.length;
			case "bookmarked":
				return bookmarks.size;
			case "all":
			default:
				return entries.length;
		}
	};

	const orderedScopeOptions = useMemo(() => {
		const hasSelectedItems = selectedEntries.size > 0;
		const scopeOrder = hasSelectedItems
			? ["selected", "filtered", "all", "bookmarked"]
			: ["filtered", "selected", "all", "bookmarked"];

		return scopeOrder
			.map((id) => SCOPE_OPTIONS.find((opt) => opt.id === id))
			.filter(Boolean) as typeof SCOPE_OPTIONS;
	}, [selectedEntries.size]);

	return (
		<div className="flex-1 flex flex-col overflow-hidden bg-background">
			<div className="border-b border-border bg-card/30 p-4">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h2 className="text-lg font-semibold text-foreground">
							Export API Documentation
						</h2>
						<p className="text-sm text-muted">
							Generate documentation from your HAR file with
							automatic deduplication and schema analysis
						</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={handleCopy}
							disabled={!generatedContent}
							className={cn(
								"flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
								"border border-border",
								copied
									? "bg-green-500/20 text-green-400 border-green-500/30"
									: "bg-card/60 text-foreground hover:bg-primary/10 hover:border-primary/30",
								!generatedContent &&
									"opacity-50 cursor-not-allowed"
							)}
						>
							{copied ? (
								<>
									<Check className="w-4 h-4" />
									Copied
								</>
							) : (
								<>
									<Copy className="w-4 h-4" />
									Copy
								</>
							)}
						</button>
						<button
							onClick={handleDownload}
							disabled={!generatedContent}
							className={cn(
								"flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
								"bg-foreground text-background hover:bg-foreground/90 border border-foreground/20",
								!generatedContent &&
									"opacity-50 cursor-not-allowed"
							)}
						>
							<Download className="w-4 h-4" />
							Download{" "}
							{options.format === "markdown"
								? ".md"
								: options.format === "txt"
								? ".txt"
								: ".har"}
						</button>
					</div>
				</div>

				<div className="flex flex-wrap items-start gap-6">
					<div className="space-y-2">
						<label className="text-xs font-medium text-muted uppercase tracking-wide">
							Scope
						</label>
						<div className="flex items-center gap-1 p-1 bg-card/40 rounded-lg border border-border">
							{orderedScopeOptions.map((scope) => {
								const Icon = scope.icon;
								const count = getScopeCount(scope.id);
								const isActive = options.scope === scope.id;
								const isDisabled = count === 0;

								return (
									<button
										key={scope.id}
										onClick={() =>
											!isDisabled &&
											updateOption("scope", scope.id)
										}
										disabled={isDisabled}
										className={cn(
											"flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all",
											isActive &&
												"bg-primary/20 text-primary",
											!isActive &&
												!isDisabled &&
												"hover:bg-primary/10 hover:text-primary text-muted",
											isDisabled &&
												"opacity-40 cursor-not-allowed"
										)}
										title={scope.description}
									>
										<Icon className="w-3.5 h-3.5" />
										<span>{scope.label}</span>
										<span
											className={cn(
												"text-[10px] px-1.5 py-0.5 rounded-full",
												isActive
													? "bg-primary/30"
													: "bg-card"
											)}
										>
											{count}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					<div className="space-y-2">
						<label className="text-xs font-medium text-muted uppercase tracking-wide">
							Format
						</label>
						<div className="flex items-center gap-1 p-1 bg-card/40 rounded-lg border border-border">
							{FORMAT_OPTIONS.map((format) => {
								const Icon = format.icon;
								const isActive = options.format === format.id;

								return (
									<button
										key={format.id}
										onClick={() =>
											updateOption("format", format.id)
										}
										className={cn(
											"flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all",
											isActive &&
												"bg-primary/20 text-primary",
											!isActive &&
												"hover:bg-primary/10 hover:text-primary text-muted"
										)}
									>
										<Icon className="w-3.5 h-3.5" />
										<span>{format.label}</span>
									</button>
								);
							})}
						</div>
					</div>

					{options.format !== "har" && (
						<>
							<div className="space-y-2">
								<label className="text-xs font-medium text-muted uppercase tracking-wide">
									Group By
								</label>
								<div className="flex items-center">
									<select
										value={options.groupBy}
										onChange={(e) =>
											updateOption(
												"groupBy",
												e.target.value as GroupByOption
											)
										}
										aria-label="Group endpoints by"
										className="h-9.5 px-3 rounded-lg text-sm bg-card/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
									>
										{GROUP_OPTIONS.map((opt) => (
											<option key={opt.id} value={opt.id}>
												{opt.label}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className="space-y-2">
								<div className="h-4" />
								<button
									onClick={() =>
										setShowAdvancedOptions(
											!showAdvancedOptions
										)
									}
									className="h-9.5 flex items-center gap-2 px-3 rounded-lg text-sm text-muted hover:text-foreground hover:bg-card/40 transition-all"
								>
									<Settings2 className="w-4 h-4" />
									Advanced Options
									{showAdvancedOptions ? (
										<ChevronUp className="w-3.5 h-3.5" />
									) : (
										<ChevronDown className="w-3.5 h-3.5" />
									)}
								</button>
							</div>
						</>
					)}
				</div>

				{showAdvancedOptions && options.format !== "har" && (
					<div className="mt-4 pt-4 border-t border-border/50">
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
							<ToggleOption
								icon={Globe}
								label="Headers"
								checked={options.includeHeaders}
								onChange={(v) =>
									updateOption("includeHeaders", v)
								}
							/>
							<ToggleOption
								icon={Filter}
								label="Query Params"
								checked={options.includeQueryParams}
								onChange={(v) =>
									updateOption("includeQueryParams", v)
								}
							/>
							<ToggleOption
								icon={Code}
								label="Request Body"
								checked={options.includeRequestBody}
								onChange={(v) =>
									updateOption("includeRequestBody", v)
								}
							/>
							<ToggleOption
								icon={FileCode}
								label="Response Schema"
								checked={options.includeResponseSchema}
								onChange={(v) =>
									updateOption("includeResponseSchema", v)
								}
							/>
							<ToggleOption
								icon={Activity}
								label="Performance"
								checked={options.includePerformanceMetrics}
								onChange={(v) =>
									updateOption("includePerformanceMetrics", v)
								}
							/>
							<ToggleOption
								icon={Code}
								label="cURL Examples"
								checked={options.includeCurlExamples}
								onChange={(v) =>
									updateOption("includeCurlExamples", v)
								}
							/>
						</div>
					</div>
				)}
			</div>

			<div className="flex-1 flex overflow-hidden">
				{options.format !== "har" && (
					<div className="w-72 border-r border-border bg-card/20 overflow-auto p-4">
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-semibold text-foreground">
									Endpoints
								</h3>
								<span className="text-xs text-muted bg-card px-2 py-0.5 rounded-full flex items-center gap-1">
									{isAnalyzing && (
										<Loader2 className="w-3 h-3 animate-spin" />
									)}
									{visibleEndpoints.length}/
									{uniqueEndpoints.length}
								</span>
							</div>

							{isAnalyzing ? (
								<div className="text-center py-12">
									<Loader2 className="w-8 h-8 text-primary mx-auto mb-3 animate-spin" />
									<p className="text-sm font-medium text-foreground mb-1">
										Analyzing API Endpoints
									</p>
									<p className="text-xs text-muted">
										Merging schemas from all responses...
									</p>
								</div>
							) : uniqueEndpoints.length === 0 ? (
								<div className="text-center py-8">
									<Filter className="w-8 h-8 text-muted mx-auto mb-2" />
									<p className="text-sm text-muted">
										No entries match the current scope
									</p>
								</div>
							) : (
								<div className="space-y-1">
									{uniqueEndpoints.map((endpoint, i) => {
										const key = `${endpoint.method}:${endpoint.pattern}`;
										const isHidden =
											hiddenEndpoints.has(key);

										return (
											<button
												key={i}
												onClick={() =>
													toggleEndpointVisibility(
														endpoint
													)
												}
												className={cn(
													"w-full p-2 rounded-lg border transition-all text-left",
													isHidden
														? "bg-card/20 border-border/30 opacity-50 hover:opacity-70"
														: "bg-card/40 border-border/50 hover:border-primary/30 hover:bg-card/60"
												)}
												title={
													isHidden
														? "Click to show in export"
														: "Click to hide from export"
												}
											>
												<div className="flex items-center gap-2 mb-1">
													<span
														className={cn(
															"text-[10px] font-bold px-1.5 py-0.5 rounded",
															endpoint.method ===
																"GET" &&
																"bg-green-500/20 text-green-400",
															endpoint.method ===
																"POST" &&
																"bg-blue-500/20 text-blue-400",
															endpoint.method ===
																"PUT" &&
																"bg-yellow-500/20 text-yellow-400",
															endpoint.method ===
																"DELETE" &&
																"bg-red-500/20 text-red-400",
															endpoint.method ===
																"PATCH" &&
																"bg-purple-500/20 text-purple-400",
															![
																"GET",
																"POST",
																"PUT",
																"DELETE",
																"PATCH",
															].includes(
																endpoint.method
															) &&
																"bg-gray-500/20 text-gray-400"
														)}
													>
														{endpoint.method}
													</span>
													<span className="text-[10px] text-muted">
														{endpoint.totalCalls}{" "}
														calls
													</span>
												</div>
												<p
													className={cn(
														"text-xs truncate font-mono",
														isHidden
															? "text-muted line-through"
															: "text-foreground"
													)}
												>
													{endpoint.path}
												</p>
												<p className="text-[10px] text-muted truncate">
													{endpoint.domain}
												</p>
											</button>
										);
									})}
								</div>
							)}
						</div>
					</div>
				)}

				<div
					className={cn(
						"overflow-auto p-4 bg-card/10",
						options.format === "har" ? "flex-1" : "flex-1"
					)}
				>
					<div className="h-full rounded-lg border border-border bg-card/30 overflow-auto">
						{!generatedContent ? (
							<div className="flex flex-col items-center justify-center h-full py-12">
								<FileText className="w-12 h-12 text-muted mb-4" />
								<p className="text-lg font-medium text-foreground mb-2">
									No Content to Preview
								</p>
								<p className="text-sm text-muted">
									Select a scope with entries to generate
									documentation
								</p>
							</div>
						) : options.format === "markdown" ? (
							<div className="p-6 prose prose-sm prose-invert max-w-none">
								<ReactMarkdown
									remarkPlugins={[remarkGfm]}
									components={{
										h1: ({ children }) => (
											<h1 className="text-2xl font-bold text-foreground mb-4 mt-6 border-b border-border pb-2">
												{children}
											</h1>
										),
										h2: ({ children }) => (
											<h2 className="text-xl font-semibold text-foreground mb-3 mt-5">
												{children}
											</h2>
										),
										h3: ({ children }) => (
											<h3 className="text-lg font-semibold text-foreground mb-2 mt-4">
												{children}
											</h3>
										),
										h4: ({ children }) => (
											<h4 className="text-base font-semibold text-foreground mb-2 mt-3">
												{children}
											</h4>
										),
										p: ({ children }) => (
											<p className="text-sm text-foreground/80 mb-3">
												{children}
											</p>
										),
										ul: ({ children }) => (
											<ul className="list-disc list-inside space-y-1 text-sm text-foreground/80 ml-4 mb-4">
												{children}
											</ul>
										),
										ol: ({ children }) => (
											<ol className="list-decimal list-inside space-y-1 text-sm text-foreground/80 ml-4 mb-4">
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
													className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs font-mono"
													{...props}
												/>
											) : (
												<code
													className="text-xs font-mono text-foreground/90"
													{...props}
												/>
											);
										},
										pre: ({ children }) => (
											<pre className="bg-card/60 border border-border/30 rounded-lg p-4 overflow-x-auto mb-4 text-xs">
												{children}
											</pre>
										),
										blockquote: ({ children }) => (
											<blockquote className="border-l-4 border-primary/50 pl-4 py-2 text-sm text-muted italic mb-4 bg-card/20 rounded-r">
												{children}
											</blockquote>
										),
										hr: () => (
											<hr className="border-border/50 my-6" />
										),
										table: ({ children }) => (
											<div className="overflow-x-auto mb-4">
												<table className="min-w-full text-sm border border-border/30 rounded-lg overflow-hidden">
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
											<tbody className="divide-y divide-border/20">
												{children}
											</tbody>
										),
										th: ({ children }) => (
											<th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border/30">
												{children}
											</th>
										),
										td: ({ children }) => (
											<td className="px-4 py-2 text-foreground/80">
												{children}
											</td>
										),
										tr: ({ children }) => (
											<tr className="hover:bg-card/20">
												{children}
											</tr>
										),
										strong: ({ children }) => (
											<strong className="font-semibold text-foreground">
												{children}
											</strong>
										),
									}}
								>
									{generatedContent}
								</ReactMarkdown>
							</div>
						) : options.format === "har" ? (
							<div className="flex flex-col items-center justify-center h-full py-12 px-6">
								<Package className="w-12 h-12 text-primary mb-4" />
								<h3 className="text-lg font-semibold text-foreground mb-2">
									HAR File Ready for Export
								</h3>
								<p className="text-sm text-muted text-center mb-6 max-w-sm">
									HAR files can be quite large. Preview is
									disabled to prevent performance issues.
									Click download to export your file.
								</p>

								{scopedEntries.length > 0 && (
									<div className="bg-card/40 border border-border rounded-lg p-6 w-full max-w-sm space-y-4">
										<div className="space-y-3">
											<div className="flex justify-between items-center">
												<span className="text-sm text-muted">
													Total Entries:
												</span>
												<span className="font-semibold text-foreground">
													{scopedEntries.length}
												</span>
											</div>
											<div className="flex justify-between items-center">
												<span className="text-sm text-muted">
													Estimated Size:
												</span>
												<span className="font-semibold text-foreground">
													{(() => {
														const stats =
															generateHARPreviewStats(
																scopedEntries
															);
														return stats.totalSize;
													})()}
												</span>
											</div>
										</div>

										{generateHARPreviewStats(scopedEntries)
											.domains.length > 0 && (
											<div className="pt-3 border-t border-border/30">
												<p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">
													Domains
												</p>
												<div className="flex flex-wrap gap-2">
													{generateHARPreviewStats(
														scopedEntries
													)
														.domains.slice(0, 5)
														.map((domain) => (
															<span
																key={domain}
																className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20"
															>
																{domain}
															</span>
														))}
													{generateHARPreviewStats(
														scopedEntries
													).domains.length > 5 && (
														<span className="text-xs px-2 py-1 rounded bg-muted/10 text-muted">
															+
															{generateHARPreviewStats(
																scopedEntries
															).domains.length -
																5}{" "}
															more
														</span>
													)}
												</div>
											</div>
										)}

										{generateHARPreviewStats(scopedEntries)
											.methods.length > 0 && (
											<div className="pt-3 border-t border-border/30">
												<p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">
													HTTP Methods
												</p>
												<div className="flex gap-2">
													{generateHARPreviewStats(
														scopedEntries
													).methods.map((method) => (
														<span
															key={method}
															className={cn(
																"text-xs font-bold px-2 py-1 rounded",
																method ===
																	"GET" &&
																	"bg-green-500/20 text-green-400",
																method ===
																	"POST" &&
																	"bg-blue-500/20 text-blue-400",
																method ===
																	"PUT" &&
																	"bg-yellow-500/20 text-yellow-400",
																method ===
																	"DELETE" &&
																	"bg-red-500/20 text-red-400",
																method ===
																	"PATCH" &&
																	"bg-purple-500/20 text-purple-400",
																![
																	"GET",
																	"POST",
																	"PUT",
																	"DELETE",
																	"PATCH",
																].includes(
																	method
																) &&
																	"bg-gray-500/20 text-gray-400"
															)}
														>
															{method}
														</span>
													))}
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						) : (
							<pre className="p-6 font-mono text-sm text-foreground/90 whitespace-pre-wrap">
								{generatedContent}
							</pre>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function ToggleOption({
	icon: Icon,
	label,
	checked,
	onChange,
}: {
	icon: typeof Filter;
	label: string;
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<button
			onClick={() => onChange(!checked)}
			className={cn(
				"flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all border",
				checked
					? "bg-primary/10 border-primary/30 text-primary"
					: "bg-card/40 border-border text-muted hover:text-foreground hover:border-border/80"
			)}
		>
			{checked ? (
				<CheckSquare className="w-3.5 h-3.5" />
			) : (
				<Square className="w-3.5 h-3.5" />
			)}
			<Icon className="w-3.5 h-3.5" />
			<span>{label}</span>
		</button>
	);
}
