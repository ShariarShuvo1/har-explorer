"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Braces, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/common/code-editor";
import { formatJson, type CodeLanguage } from "@/components/common/code-language";
import { cn } from "@/lib/cn";

/** Skip live validation of huge documents while typing. */
const MAX_VALIDATED_LENGTH = 1_000_000;

/**
 * Read-only code view with an "Edit" mode (Format JSON, Save, Cancel).
 * `value` is what is shown; `editValue` (defaults to `value`) seeds the editor.
 * Saving an unchanged draft just closes the editor. While editing, the root
 * carries `data-editing` (global shortcuts pause) and `data-dirty` when changed.
 */
export function BodyEditor({
	value,
	editValue = value,
	language,
	title,
	onSave,
	toolbar,
	ariaLabel,
	maxHeight = "32rem",
}: {
	value: string;
	editValue?: string;
	language: CodeLanguage;
	title?: ReactNode;
	onSave?: (value: string) => void;
	toolbar?: ReactNode;
	ariaLabel: string;
	maxHeight?: string;
}) {
	const [draft, setDraft] = useState<string | null>(null);
	const editing = draft !== null;
	const isJson = language === "json";

	const parseError = useMemo(() => {
		if (!editing || !isJson || draft.length > MAX_VALIDATED_LENGTH || !draft.trim()) {
			return null;
		}
		try {
			JSON.parse(draft);
			return null;
		} catch (err) {
			return err instanceof Error ? err.message : "Invalid JSON";
		}
	}, [editing, isJson, draft]);

	if (editing) {
		return (
			<div className="space-y-2" data-editing="true" data-dirty={draft !== editValue || undefined}>
				<CodeEditor
					value={draft}
					onChange={setDraft}
					readOnly={false}
					language={language}
					title={<span className="font-medium text-foreground">Editing</span>}
					ariaLabel={`Edit ${ariaLabel}`}
					autoFocus
					minHeight="12rem"
					maxHeight={maxHeight}
					toolbar={
						isJson ? (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								onClick={() => setDraft(formatJson(draft))}
							>
								<Braces />
								Format
							</Button>
						) : undefined
					}
				/>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className={cn("min-w-0 text-xs text-muted-foreground", parseError && "text-warning")}>
						{isJson &&
							(parseError
								? `Invalid JSON: ${parseError}`
								: draft.length <= MAX_VALIDATED_LENGTH && draft.trim()
									? "Valid JSON"
									: null)}
					</p>
					<div className="flex gap-2">
						<Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
							Cancel
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={() => {
								if (draft !== editValue) onSave?.(draft);
								setDraft(null);
							}}
						>
							Save
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<CodeEditor
			value={value}
			language={language}
			title={title}
			ariaLabel={ariaLabel}
			maxHeight={maxHeight}
			toolbar={
				<>
					{toolbar}
					{onSave && (
						<Button type="button" variant="ghost" size="xs" onClick={() => setDraft(editValue)}>
							<Pencil />
							Edit
						</Button>
					)}
				</>
			}
		/>
	);
}
