"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { useThemeStore } from "@/lib/stores/theme-store";
import { CopyButton } from "@/components/ui/copy-button";

interface EditableJsonHighlighterProps {
	content: string;
	onSave: (value: string) => void;
	className?: string;
	isFocusMode?: boolean;
}

interface Token {
	type: string;
	value: string;
}

export function EditableJsonHighlighter({
	content,
	onSave,
	className,
	isFocusMode = false,
}: EditableJsonHighlighterProps) {
	const { theme } = useThemeStore();
	const isDark = theme === "dark";
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(content);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isEditing]);

	const handleDoubleClick = () => {
		setIsEditing(true);
		setEditValue(content);
	};

	const handleSave = () => {
		if (editValue !== content) {
			onSave(editValue);
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Escape") {
			setEditValue(content);
			setIsEditing(false);
		} else if (e.key === "Enter" && e.ctrlKey) {
			e.preventDefault();
			handleSave();
		}
	};

	const handleBlur = () => {
		handleSave();
	};

	if (isEditing) {
		return (
			<textarea
				ref={inputRef}
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
				aria-label="Edit JSON content"
				className={cn(
					"w-full px-2 py-1 border-2 border-primary rounded bg-control-bg text-foreground focus:outline-none resize-none h-[50vh] overflow-auto font-mono text-sm",
					className
				)}
			/>
		);
	}

	const tokenize = (text: string): Token[] => {
		const tokens: Token[] = [];
		let i = 0;

		while (i < text.length) {
			// Skip whitespace
			if (/\s/.test(text[i])) {
				let ws = "";
				while (i < text.length && /\s/.test(text[i])) {
					ws += text[i];
					i += 1;
				}
				tokens.push({ type: "whitespace", value: ws });
				continue;
			}

			// String (key or value)
			if (text[i] === '"') {
				let str = "";
				i += 1;
				while (i < text.length && text[i] !== '"') {
					if (text[i] === "\\") {
						str += text[i];
						i += 1;
						if (i < text.length) {
							str += text[i];
							i += 1;
						}
					} else {
						str += text[i];
						i += 1;
					}
				}
				if (i < text.length) i += 1;
				tokens.push({
					type: "string",
					value: `"${str}"`,
				});
				continue;
			}

			// Number
			if (/\d|^-/.test(text[i])) {
				let num = "";
				while (i < text.length && /[\d.eE\-+]/.test(text[i])) {
					num += text[i];
					i += 1;
				}
				tokens.push({ type: "number", value: num });
				continue;
			}

			// Keywords
			if (text.slice(i, i + 4) === "true") {
				tokens.push({ type: "boolean", value: "true" });
				i += 4;
				continue;
			}
			if (text.slice(i, i + 5) === "false") {
				tokens.push({ type: "boolean", value: "false" });
				i += 5;
				continue;
			}
			if (text.slice(i, i + 4) === "null") {
				tokens.push({ type: "null", value: "null" });
				i += 4;
				continue;
			}

			// Punctuation
			if (/[{}[\]:,]/.test(text[i])) {
				tokens.push({ type: "punctuation", value: text[i] });
				i += 1;
				continue;
			}

			i += 1;
		}

		return tokens;
	};

	const getTokenColor = (
		type: string
	): { className?: string; style?: React.CSSProperties } => {
		switch (type) {
			case "string":
				return {
					style: {
						color: isDark ? "hsl(39 100% 71%)" : "hsl(142 71% 30%)",
					},
				};
			case "number":
				return {
					style: {
						color: isDark
							? "hsl(224 100% 63%)"
							: "hsl(224 71% 20%)",
					},
				};
			case "boolean":
				return {
					style: {
						color: isDark ? "hsl(0 100% 63%)" : "hsl(0 71% 20%)",
					},
				};
			case "null":
				return {
					style: {
						color: isDark ? "hsl(217 33% 61%)" : "hsl(217 14% 28%)",
					},
				};
			case "punctuation":
				return {
					style: {
						color: isDark
							? "hsl(180 100% 63%)"
							: "hsl(180 60% 20%)",
					},
				};
			default:
				return {};
		}
	};

	const tokens = tokenize(content);

	return (
		<div className="space-y-2">
			<div className="flex justify-end">
				<CopyButton content={content} size="sm" className="p-2" />
			</div>
			<pre
				onDoubleClick={handleDoubleClick}
				className={cn(
					"font-mono text-sm bg-control-bg p-4 rounded-lg overflow-auto whitespace-pre-wrap text-foreground cursor-text hover:bg-control-bg/80 transition-colors",
					!isFocusMode && "max-h-[50vh]",
					className
				)}
				title="Double-click to edit"
			>
				<code>
					{tokens.map((token, idx) => {
						const style = getTokenColor(token.type);
						return (
							<span
								key={idx}
								className={style.className}
								style={style.style}
							>
								{token.value}
							</span>
						);
					})}
				</code>
			</pre>
		</div>
	);
}
