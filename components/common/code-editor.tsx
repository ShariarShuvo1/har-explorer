"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { WrapText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { CopyButton } from "./copy-button";
import type { CodeLanguage } from "./code-language";

const CodeEditorImpl = dynamic(() => import("./code-editor-impl"), {
	ssr: false,
	loading: () => (
		<div className="space-y-2 p-3">
			<Skeleton className="h-3 w-3/4" />
			<Skeleton className="h-3 w-1/2" />
			<Skeleton className="h-3 w-2/3" />
		</div>
	),
});

/** Above this size syntax highlighting is skipped to keep the page responsive. */
const HIGHLIGHT_LIMIT = 2 * 1024 * 1024;

export interface CodeEditorProps {
	value: string;
	onChange?: (value: string) => void;
	language?: CodeLanguage;
	readOnly?: boolean;
	/** Starts with soft wrapping on (users can toggle it). */
	defaultWrap?: boolean;
	lineNumbers?: boolean;
	minHeight?: string;
	maxHeight?: string;
	height?: string;
	placeholder?: string;
	autoFocus?: boolean;
	ariaLabel?: string;
	/** Hide the built-in toolbar (wrap toggle and copy button). */
	hideToolbar?: boolean;
	/** Extra toolbar content rendered before wrap/copy. */
	toolbar?: React.ReactNode;
	/** Label shown on the left of the toolbar, e.g. the MIME type. */
	title?: React.ReactNode;
	className?: string;
}

/**
 * CodeMirror-based viewer/editor with folding, search (Ctrl/Cmd+F inside the
 * editor), soft-wrap toggle and copy. Loaded lazily on first use.
 */
export function CodeEditor({
	value,
	onChange,
	language = "text",
	readOnly = true,
	defaultWrap = true,
	lineNumbers = true,
	minHeight,
	maxHeight = "28rem",
	height,
	placeholder,
	autoFocus,
	ariaLabel,
	hideToolbar,
	toolbar,
	title,
	className,
}: CodeEditorProps) {
	const [wrap, setWrap] = useState(defaultWrap);
	const tooLarge = value.length > HIGHLIGHT_LIMIT;

	return (
		<div
			className={cn(
				"flex min-w-0 flex-col overflow-hidden rounded-lg border bg-muted/30",
				className
			)}
		>
			{!hideToolbar && (
				<div className="flex h-9 items-center gap-1 border-b bg-muted/40 pr-1 pl-3">
					<div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{title}</div>
					{toolbar}
					<Tooltip>
						<TooltipTrigger asChild>
							<Toggle
								size="sm"
								pressed={wrap}
								onPressedChange={setWrap}
								aria-label="Wrap long lines"
								className="size-7 min-w-7 p-0"
							>
								<WrapText className="size-3.5" />
							</Toggle>
						</TooltipTrigger>
						<TooltipContent>Wrap long lines</TooltipContent>
					</Tooltip>
					<CopyButton value={value} label="Copy" className="size-7" />
				</div>
			)}
			<div className="min-h-0 flex-1 overflow-hidden">
				{tooLarge && readOnly ? (
					<pre
						className={cn(
							"overflow-auto p-3 font-mono text-xs",
							wrap && "break-all whitespace-pre-wrap"
						)}
						style={{ maxHeight, minHeight, height }}
					>
						{value}
					</pre>
				) : (
					<CodeEditorImpl
						value={value}
						onChange={onChange}
						language={tooLarge ? "text" : language}
						readOnly={readOnly}
						wrap={wrap}
						lineNumbers={lineNumbers}
						minHeight={minHeight}
						maxHeight={maxHeight}
						height={height}
						placeholder={placeholder}
						autoFocus={autoFocus}
						ariaLabel={ariaLabel}
					/>
				)}
			</div>
		</div>
	);
}
