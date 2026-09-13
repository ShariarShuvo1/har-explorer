"use client";

import { useMemo } from "react";
import CodeMirror, { EditorView, type Extension } from "@uiw/react-codemirror";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { xml } from "@codemirror/lang-xml";
import type { CodeLanguage } from "./code-language";

// Colours come from CSS variables, so one theme follows light and dark mode.
const appTheme = createTheme({
	theme: "light",
	settings: {
		background: "transparent",
		foreground: "var(--foreground)",
		caret: "var(--primary)",
		selection: "color-mix(in oklab, var(--primary) 22%, transparent)",
		selectionMatch: "color-mix(in oklab, var(--primary) 14%, transparent)",
		lineHighlight: "color-mix(in oklab, var(--foreground) 4%, transparent)",
		gutterBackground: "transparent",
		gutterForeground: "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
		gutterBorder: "transparent",
		fontFamily: "var(--font-mono)",
	},
	styles: [
		{ tag: [t.propertyName, t.attributeName], color: "var(--chart-2)" },
		{ tag: [t.string, t.special(t.string)], color: "var(--success)" },
		{ tag: [t.number, t.bool, t.null, t.atom], color: "var(--warning)" },
		{ tag: [t.keyword, t.operatorKeyword, t.modifier], color: "var(--chart-7)" },
		{ tag: [t.tagName, t.typeName, t.className], color: "var(--primary)" },
		{ tag: [t.comment, t.meta], color: "var(--muted-foreground)", fontStyle: "italic" },
		{ tag: [t.function(t.variableName), t.definition(t.variableName)], color: "var(--info)" },
		{ tag: [t.punctuation, t.bracket, t.separator], color: "var(--muted-foreground)" },
		{ tag: t.invalid, color: "var(--destructive)" },
	],
});

function languageExtension(language: CodeLanguage): Extension[] {
	switch (language) {
		case "json":
			return [json()];
		case "html":
			return [html()];
		case "xml":
			return [xml()];
		case "javascript":
			return [javascript({ jsx: false, typescript: false })];
		case "css":
			return [css()];
		default:
			return [];
	}
}

export interface CodeEditorImplProps {
	value: string;
	onChange?: (value: string) => void;
	language: CodeLanguage;
	readOnly: boolean;
	wrap: boolean;
	lineNumbers: boolean;
	minHeight?: string;
	maxHeight?: string;
	height?: string;
	placeholder?: string;
	autoFocus?: boolean;
	ariaLabel?: string;
}

export default function CodeEditorImpl({
	value,
	onChange,
	language,
	readOnly,
	wrap,
	lineNumbers,
	minHeight,
	maxHeight,
	height,
	placeholder,
	autoFocus,
	ariaLabel,
}: CodeEditorImplProps) {
	const extensions = useMemo(() => {
		const list = [...languageExtension(language)];
		if (wrap) list.push(EditorView.lineWrapping);
		if (ariaLabel) list.push(EditorView.contentAttributes.of({ "aria-label": ariaLabel }));
		return list;
	}, [language, wrap, ariaLabel]);

	return (
		<CodeMirror
			value={value}
			onChange={onChange}
			readOnly={readOnly}
			editable={!readOnly}
			theme={appTheme}
			extensions={extensions}
			placeholder={placeholder}
			autoFocus={autoFocus}
			minHeight={minHeight}
			maxHeight={maxHeight}
			height={height}
			basicSetup={{
				lineNumbers,
				foldGutter: lineNumbers,
				highlightActiveLine: !readOnly,
				highlightActiveLineGutter: !readOnly,
				autocompletion: false,
				closeBrackets: !readOnly,
				searchKeymap: true,
			}}
		/>
	);
}
