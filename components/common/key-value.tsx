"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { CopyButton } from "./copy-button";

export interface KeyValueRow {
	name: string;
	value: string;
}

/**
 * Read-only name/value list (headers, query params, cookies). Rows stack on
 * narrow widths and become a two-column grid on wider ones.
 */
export function KeyValueList({
	rows,
	emptyText = "None",
	renderValue,
	className,
	nameWidth = "12rem",
}: {
	rows: KeyValueRow[];
	emptyText?: ReactNode;
	renderValue?: (row: KeyValueRow, index: number) => ReactNode;
	className?: string;
	nameWidth?: string;
}) {
	if (rows.length === 0) {
		return <p className={cn("py-2 text-sm text-muted-foreground", className)}>{emptyText}</p>;
	}

	return (
		<div className="@container">
			<dl
				className={cn("divide-y overflow-hidden rounded-lg border", className)}
				style={{ "--kv-name": nameWidth } as React.CSSProperties}
			>
				{rows.map((row, index) => (
					<div
						key={`${row.name}-${index}`}
						className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-0.5 px-3 py-2 text-[13px] @md:grid-cols-[minmax(6rem,var(--kv-name))_minmax(0,1fr)_auto] @md:gap-x-4"
					>
						<dt className="col-start-1 row-start-1 min-w-0 font-medium break-words text-muted-foreground">
							{row.name || <span className="italic">(empty)</span>}
						</dt>
						<dd className="col-start-1 row-start-2 min-w-0 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-foreground @md:col-start-2 @md:row-start-1">
							{renderValue
								? renderValue(row, index)
								: row.value || (
										<span className="font-sans text-muted-foreground italic">empty</span>
									)}
						</dd>
						{/* Always visible on narrow widths (no hover on touch); hover-to-reveal on wide ones. */}
						<div className="col-start-2 row-span-2 row-start-1 -my-1 flex justify-end transition-opacity @md:col-start-3 @md:row-span-1 @md:opacity-0 @md:group-focus-within:opacity-100 @md:group-hover:opacity-100">
							<CopyButton
								value={`${row.name}: ${row.value}`}
								label={`Copy ${row.name || "row"}`}
								className="size-7"
							/>
						</div>
					</div>
				))}
			</dl>
		</div>
	);
}

function sameRows(a: KeyValueRow[], b: KeyValueRow[]) {
	return (
		a.length === b.length && a.every((row, i) => row.name === b[i].name && row.value === b[i].value)
	);
}

/**
 * Editable list of name/value pairs with add and remove. Calls `onSave` with
 * the cleaned rows (rows with an empty name are dropped), or `onCancel` when
 * nothing changed. The root carries `data-editing` (global shortcuts pause)
 * and `data-dirty` while there are unsaved edits.
 */
export function KeyValueEditor({
	rows: initialRows,
	onSave,
	onCancel,
	namePlaceholder = "Name",
	valuePlaceholder = "Value",
	addLabel = "Add row",
}: {
	rows: KeyValueRow[];
	onSave: (rows: KeyValueRow[]) => void;
	onCancel: () => void;
	namePlaceholder?: string;
	valuePlaceholder?: string;
	addLabel?: string;
}) {
	const [seed] = useState<KeyValueRow[]>(() =>
		initialRows.length > 0
			? initialRows.map((r) => ({ name: r.name, value: r.value }))
			: [{ name: "", value: "" }]
	);
	const [rows, setRows] = useState<KeyValueRow[]>(seed);
	const dirty = !sameRows(rows, seed);

	const update = (index: number, patch: Partial<KeyValueRow>) =>
		setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

	const save = () => {
		const cleaned = rows.filter((row) => row.name.trim() !== "");
		if (sameRows(cleaned, initialRows)) onCancel();
		else onSave(cleaned);
	};

	return (
		<div className="space-y-3" data-editing="true" data-dirty={dirty || undefined}>
			<div className="space-y-2">
				{rows.map((row, index) => (
					<div
						key={index}
						className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[minmax(8rem,14rem)_1fr_auto]"
					>
						<Input
							value={row.name}
							onChange={(e) => update(index, { name: e.target.value })}
							placeholder={namePlaceholder}
							aria-label={`${namePlaceholder} ${index + 1}`}
							className="col-span-1 h-8 font-mono text-xs"
							autoFocus={index === rows.length - 1 && row.name === "" && rows.length > 1}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
							aria-label={`Remove ${row.name || "row"}`}
							className="text-muted-foreground hover:text-destructive sm:order-3"
						>
							<Trash2 />
						</Button>
						<Input
							value={row.value}
							onChange={(e) => update(index, { value: e.target.value })}
							placeholder={valuePlaceholder}
							aria-label={`${valuePlaceholder} ${index + 1}`}
							className="col-span-2 h-8 font-mono text-xs sm:order-2 sm:col-span-1"
						/>
					</div>
				))}
			</div>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setRows((current) => [...current, { name: "", value: "" }])}
				>
					<Plus />
					{addLabel}
				</Button>
				<div className="flex gap-2">
					<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="button" size="sm" onClick={save}>
						Save changes
					</Button>
				</div>
			</div>
		</div>
	);
}
