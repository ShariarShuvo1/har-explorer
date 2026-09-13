"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

const REMARK_PLUGINS = [remarkGfm];

const COMPONENTS: Components = {
	h1: ({ children }) => (
		<h1 className="mt-2 mb-4 border-b pb-2 text-2xl font-semibold tracking-tight text-foreground first:mt-0">
			{children}
		</h1>
	),
	h2: ({ children }) => (
		<h2 className="mt-8 mb-3 text-xl font-semibold tracking-tight text-foreground">{children}</h2>
	),
	h3: ({ children }) => (
		<h3 className="mt-6 mb-2 text-base font-semibold break-words text-foreground">{children}</h3>
	),
	h4: ({ children }) => (
		<h4 className="mt-4 mb-2 text-sm font-semibold text-foreground">{children}</h4>
	),
	p: ({ children }) => <p className="mb-3 leading-relaxed text-foreground/90">{children}</p>,
	ul: ({ children }) => (
		<ul className="mb-3 list-disc space-y-1 pl-5 text-foreground/90 marker:text-muted-foreground [&_ul]:mt-1 [&_ul]:mb-0">
			{children}
		</ul>
	),
	ol: ({ children }) => (
		<ol className="mb-3 list-decimal space-y-1 pl-5 text-foreground/90 marker:text-muted-foreground">
			{children}
		</ol>
	),
	// Block code is restyled by the surrounding <pre>, so this only has to look right inline.
	code: ({ children, className }) => (
		<code
			className={cn(
				"rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] [overflow-wrap:anywhere] text-foreground",
				className
			)}
		>
			{children}
		</code>
	),
	pre: ({ children }) => (
		<pre className="mb-4 overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-xs [&_code]:[overflow-wrap:normal]">
			{children}
		</pre>
	),
	blockquote: ({ children }) => (
		<blockquote className="mb-3 border-l-2 border-primary/60 py-0.5 pl-3 text-muted-foreground [&_p]:mb-0 [&_p]:text-muted-foreground">
			{children}
		</blockquote>
	),
	hr: () => <hr className="my-6 border-border" />,
	table: ({ children }) => (
		<div className="mb-4 overflow-x-auto rounded-lg border">
			<table className="w-full border-collapse text-left text-xs">{children}</table>
		</div>
	),
	thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
	tbody: ({ children }) => <tbody className="divide-y">{children}</tbody>,
	th: ({ children }) => (
		<th className="border-b px-3 py-2 font-medium whitespace-nowrap text-foreground">{children}</th>
	),
	td: ({ children }) => (
		<td className="max-w-[28rem] min-w-[6rem] px-3 py-2 align-top [overflow-wrap:anywhere] text-foreground/90">
			{children}
		</td>
	),
	a: ({ children, href }) => (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="break-all text-primary underline underline-offset-4"
		>
			{children}
		</a>
	),
	strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
	em: ({ children }) => <em className="text-muted-foreground italic">{children}</em>,
};

export function MarkdownPreview({
	content,
	className,
	compact = false,
}: {
	content: string;
	className?: string;
	/** Smaller headings for narrow containers such as the details pane. */
	compact?: boolean;
}) {
	return (
		<div
			className={cn(
				"max-w-none min-w-0 text-sm",
				compact && "[&_h1]:text-lg [&_h2]:mt-5 [&_h2]:text-base [&_h3]:text-sm",
				className
			)}
		>
			<ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
				{content}
			</ReactMarkdown>
		</div>
	);
}
