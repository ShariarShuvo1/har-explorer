"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function formatDateTime(date: Date): string {
	return `${date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	})}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

interface TimePart {
	key: "h" | "m" | "s" | "ms";
	label: string;
	max: number;
	width: number;
}

const PARTS: TimePart[] = [
	{ key: "h", label: "Hours", max: 23, width: 2 },
	{ key: "m", label: "Minutes", max: 59, width: 2 },
	{ key: "s", label: "Seconds", max: 59, width: 2 },
	{ key: "ms", label: "Milliseconds", max: 999, width: 3 },
];

/**
 * Date and time (to the millisecond) in the viewer's local time zone. The
 * value is an ISO 8601 string, which is what HAR files store.
 */
export function DateTimePicker({
	value,
	onChange,
	className,
	id,
}: {
	value: string;
	onChange: (iso: string) => void;
	className?: string;
	id?: string;
}) {
	const parsed = new Date(value);
	const valid = Number.isFinite(parsed.getTime());
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<Date>(valid ? parsed : new Date());

	const partValue = (key: TimePart["key"]) =>
		key === "h"
			? draft.getHours()
			: key === "m"
				? draft.getMinutes()
				: key === "s"
					? draft.getSeconds()
					: draft.getMilliseconds();

	const setPart = (key: TimePart["key"], raw: string) => {
		const n = Number(raw.replace(/\D/g, ""));
		if (!Number.isFinite(n)) return;
		const next = new Date(draft);
		const part = PARTS.find((p) => p.key === key)!;
		const clamped = Math.min(part.max, Math.max(0, n));
		if (key === "h") next.setHours(clamped);
		else if (key === "m") next.setMinutes(clamped);
		else if (key === "s") next.setSeconds(clamped);
		else next.setMilliseconds(clamped);
		setDraft(next);
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				if (next) setDraft(valid ? new Date(value) : new Date());
				setOpen(next);
			}}
		>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					className={cn(
						"w-full justify-start font-normal tabular-nums",
						!valid && "text-muted-foreground",
						className
					)}
				>
					<CalendarClock className="text-muted-foreground" />
					<span className="truncate">
						{valid ? formatDateTime(parsed) : "Pick a date and time"}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={draft}
					defaultMonth={draft}
					captionLayout="dropdown"
					onSelect={(day) => {
						if (!day) return;
						const next = new Date(draft);
						next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
						setDraft(next);
					}}
				/>
				<div className="flex items-end gap-1.5 border-t p-3">
					{PARTS.map((part, i) => (
						<div key={part.key} className="flex items-end gap-1.5">
							{i > 0 && (
								<span className="pb-2 text-muted-foreground">{part.key === "ms" ? "." : ":"}</span>
							)}
							<label className="flex flex-col gap-1">
								<span className="text-[10px] text-muted-foreground">
									{part.label.slice(0, part.key === "ms" ? 2 : 3)}
								</span>
								<input
									inputMode="numeric"
									aria-label={part.label}
									value={pad(partValue(part.key), part.width)}
									onChange={(e) => setPart(part.key, e.target.value.slice(-part.width))}
									onFocus={(e) => e.currentTarget.select()}
									className={cn(
										"h-8 rounded-md border border-input bg-transparent text-center font-mono text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
										part.width === 3 ? "w-12" : "w-10"
									)}
								/>
							</label>
						</div>
					))}
				</div>
				<div className="flex justify-end gap-2 border-t p-3">
					<Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						size="sm"
						onClick={() => {
							onChange(draft.toISOString());
							setOpen(false);
						}}
					>
						Apply
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
