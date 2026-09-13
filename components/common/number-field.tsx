"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface NumberFieldProps {
	value: number | null;
	onChange: (value: number | null) => void;
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	placeholder?: string;
	id?: string;
	"aria-label"?: string;
	"aria-describedby"?: string;
	className?: string;
	invalid?: boolean;
	/** Called when the typed text starts or stops being a valid number. */
	onValidityChange?: (valid: boolean) => void;
}

function isUnparsable(raw: string) {
	const trimmed = raw.trim();
	return trimmed !== "" && !Number.isFinite(Number(trimmed));
}

/**
 * Numeric input with a unit suffix and stepper buttons. Empty input means
 * `null`; the value is committed as the user types when it parses. Text that
 * does not parse is kept visible, marked invalid and reported through
 * `onValidityChange` (the last valid value stays committed).
 */
export function NumberField({
	value,
	onChange,
	min,
	max,
	step = 1,
	unit,
	placeholder,
	id,
	className,
	invalid,
	onValidityChange,
	...props
}: NumberFieldProps) {
	const [draft, setDraft] = useState<string | null>(null);
	const text = draft ?? (value === null ? "" : String(value));
	const unparsable = draft !== null && isUnparsable(draft);
	const showInvalid = invalid || unparsable;

	const changeDraft = (next: string | null) => {
		const wasValid = !(draft !== null && isUnparsable(draft));
		const nowValid = !(next !== null && isUnparsable(next));
		setDraft(next);
		if (wasValid !== nowValid) onValidityChange?.(nowValid);
	};

	const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

	const commit = (raw: string) => {
		const trimmed = raw.trim();
		if (trimmed === "") return onChange(null);
		const parsed = Number(trimmed);
		if (Number.isFinite(parsed)) onChange(clamp(parsed));
	};

	const stepBy = (direction: 1 | -1) => {
		const base = value ?? min ?? 0;
		const next = clamp(Number((base + direction * step).toFixed(6)));
		changeDraft(null);
		onChange(next);
	};

	return (
		<div
			className={cn(
				"flex h-9 w-full min-w-0 items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] dark:bg-input/30",
				"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
				showInvalid && "border-destructive ring-destructive/20",
				className
			)}
		>
			<button
				type="button"
				tabIndex={-1}
				onClick={() => stepBy(-1)}
				disabled={value !== null && min !== undefined && value <= min}
				aria-label="Decrease"
				className="flex h-full w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
			>
				<Minus className="size-3.5" />
			</button>
			<input
				id={id}
				type="text"
				inputMode="decimal"
				value={text}
				placeholder={placeholder}
				aria-invalid={showInvalid || undefined}
				data-unparsable={unparsable || undefined}
				onChange={(e) => {
					changeDraft(e.target.value);
					commit(e.target.value);
				}}
				// Unparsable text stays visible so the error is not silently dropped.
				onBlur={() => {
					if (!unparsable) setDraft(null);
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowUp") {
						e.preventDefault();
						stepBy(1);
					} else if (e.key === "ArrowDown") {
						e.preventDefault();
						stepBy(-1);
					}
				}}
				className="h-full w-full min-w-0 bg-transparent text-center text-sm tabular-nums outline-none placeholder:text-muted-foreground"
				{...props}
			/>
			{unit && <span className="pr-1 text-xs text-muted-foreground select-none">{unit}</span>}
			<button
				type="button"
				tabIndex={-1}
				onClick={() => stepBy(1)}
				disabled={value !== null && max !== undefined && value >= max}
				aria-label="Increase"
				className="flex h-full w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
			>
				<Plus className="size-3.5" />
			</button>
		</div>
	);
}
