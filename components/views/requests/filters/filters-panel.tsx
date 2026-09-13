"use client";

import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import { ChevronsUpDown, Globe, Plus, Route, X } from "lucide-react";
import { useHarStore, type AdvancedFilters } from "@/lib/stores/har-store";
import {
	countActiveAdvancedFilters,
	getEntryHttpVersion,
	normalizeHttpVersion,
} from "@/lib/filter-entries";
import { NumberField } from "@/components/common/number-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Field, FieldDescription, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/cn";
import {
	STATUS_CLASSES,
	UNKNOWN_HTTP_VERSION,
	bytesToKb,
	compareMethods,
	getRegexError,
	isValidStatusCode,
	kbToBytes,
	toHttpVersionFilterValue,
} from "./filter-utils";

export { FilterChips } from "./filter-chips";

export function useAdvancedFilterCount(): number {
	return useHarStore((s) => countActiveAdvancedFilters(s.advancedFilters));
}

type SectionProps = {
	filters: AdvancedFilters;
	update: (filters: Partial<AdvancedFilters>) => void;
};

const TOGGLE_ITEM_CLASS = "h-9 px-2.5 font-mono text-xs sm:h-8";

/** Body of the Filters popover/drawer; every control applies immediately. */
export function FiltersPanel() {
	const filters = useHarStore((s) => s.advancedFilters);
	const update = useHarStore((s) => s.setAdvancedFilters);
	const props = { filters, update };

	const sections = [
		<StatusSection key="status" {...props} />,
		<MethodSection key="method" {...props} />,
		<HttpVersionSection key="version" {...props} />,
		<div key="ranges" className="grid gap-5 sm:grid-cols-2 sm:gap-4">
			<RangeSection
				label="Response size"
				unit="KB"
				step={10}
				min={bytesToKb(filters.sizeMin)}
				max={bytesToKb(filters.sizeMax)}
				onChange={(min, max) => update({ sizeMin: kbToBytes(min), sizeMax: kbToBytes(max) })}
			/>
			<RangeSection
				label="Duration"
				unit="ms"
				step={50}
				min={filters.durationMin}
				max={filters.durationMax}
				onChange={(min, max) => update({ durationMin: min, durationMax: max })}
			/>
		</div>,
		<div key="patterns" className="grid gap-5 sm:grid-cols-2 sm:gap-4">
			<PatternField
				label="Domain"
				icon={<Globe />}
				value={filters.domainPattern}
				placeholder="example.com"
				onChange={(domainPattern) => update({ domainPattern })}
			/>
			<PatternField
				label="Path"
				icon={<Route />}
				value={filters.pathPattern}
				placeholder="/api/users"
				onChange={(pathPattern) => update({ pathPattern })}
			/>
		</div>,
		<HeadersSection key="headers" {...props} />,
	];

	return (
		<div className="flex w-full min-w-0 flex-col gap-5">
			{sections.map((section, i) => (
				<Fragment key={section.key}>
					{i > 0 && <Separator />}
					{section}
				</Fragment>
			))}
		</div>
	);
}

function StatusSection({ filters, update }: SectionProps) {
	const { statusCodes, statusRanges } = filters;
	const [input, setInput] = useState("");
	const [attempted, setAttempted] = useState(false);
	const inputId = useId();
	const errorId = useId();

	const selectedClasses = STATUS_CLASSES.filter((c) =>
		statusRanges.some((r) => r.min === c.min && r.max === c.max)
	).map((c) => c.label);

	const setClasses = (labels: string[]) => {
		const isClass = (r: { min: number; max: number }) =>
			STATUS_CLASSES.some((c) => c.min === r.min && c.max === r.max);
		update({
			statusRanges: [
				// Keep any custom ranges that are not one of the class toggles.
				...statusRanges.filter((r) => !isClass(r)),
				...STATUS_CLASSES.filter((c) => labels.includes(c.label)).map(({ min, max }) => ({
					min,
					max,
				})),
			],
		});
	};

	const parsed = input === "" ? null : Number(input);
	const validationError =
		parsed === null
			? null
			: !isValidStatusCode(parsed)
				? "Enter a status code between 0 and 999"
				: statusCodes.includes(parsed)
					? "Already added"
					: null;
	// Partially typed codes ("40") are only flagged once the user tries to add.
	const error = validationError && (input.length === 3 || attempted) ? validationError : null;

	const addCode = () => {
		if (parsed === null || validationError) {
			setAttempted(parsed !== null);
			return;
		}
		update({ statusCodes: [...statusCodes, parsed] });
		setInput("");
		setAttempted(false);
	};

	return (
		<Field className="gap-2.5">
			<FieldTitle>Status</FieldTitle>
			<ToggleGroup
				type="multiple"
				variant="outline"
				spacing={1}
				value={selectedClasses}
				onValueChange={setClasses}
				className="flex-wrap"
				aria-label="Status classes"
			>
				{STATUS_CLASSES.map((c) => (
					<ToggleGroupItem
						key={c.label}
						value={c.label}
						title={c.title}
						aria-label={c.title}
						className={TOGGLE_ITEM_CLASS}
					>
						{c.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={inputId} className="text-xs font-normal text-muted-foreground">
					Exact codes
				</Label>
				<InputGroup className="sm:max-w-60">
					<InputGroupInput
						id={inputId}
						inputMode="numeric"
						maxLength={3}
						value={input}
						onChange={(e) => {
							setInput(e.target.value.replace(/\D/g, ""));
							setAttempted(false);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addCode();
							}
						}}
						placeholder="e.g. 404"
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? errorId : undefined}
						className="font-mono tabular-nums"
					/>
					<InputGroupAddon align="inline-end">
						<InputGroupButton onClick={addCode} disabled={parsed === null}>
							<Plus />
							Add
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				{error && (
					<FieldError id={errorId} className="text-xs">
						{error}
					</FieldError>
				)}
			</div>
			{statusCodes.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{statusCodes.map((code) => (
						<Badge key={code} variant="secondary" className="h-7 gap-1 pr-1 pl-2.5 font-mono">
							{code}
							<button
								type="button"
								aria-label={`Remove status code ${code}`}
								onClick={() => update({ statusCodes: statusCodes.filter((c) => c !== code) })}
								className="flex size-5 items-center justify-center rounded-full hover:bg-foreground/10"
							>
								<X className="size-3" />
							</button>
						</Badge>
					))}
				</div>
			)}
			{statusCodes.length > 0 && statusRanges.length > 0 && (
				<FieldDescription className="text-xs">
					Codes and classes are combined: any of them matches.
				</FieldDescription>
			)}
		</Field>
	);
}

function MethodSection({ filters, update }: SectionProps) {
	const entries = useHarStore((s) => s.entries);
	const { methodFilters } = filters;

	const counts = useMemo(() => {
		const result = new Map<string, number>();
		for (const entry of entries) {
			const method = entry.request.method.toUpperCase();
			if (method) result.set(method, (result.get(method) ?? 0) + 1);
		}
		return result;
	}, [entries]);

	const methods = useMemo(() => {
		const all = new Set(counts.keys());
		for (const method of methodFilters) all.add(method.toUpperCase());
		return [...all].sort(compareMethods);
	}, [counts, methodFilters]);

	const selected = methodFilters.map((m) => m.toUpperCase());

	return (
		<Field className="gap-2.5">
			<FieldTitle>Method</FieldTitle>
			{methods.length === 0 ? (
				<FieldDescription className="text-xs">No requests</FieldDescription>
			) : (
				<ToggleGroup
					type="multiple"
					variant="outline"
					spacing={1}
					value={selected}
					onValueChange={(value) => update({ methodFilters: value })}
					className="flex-wrap"
					aria-label="Methods"
				>
					{methods.map((method) => {
						const count = counts.get(method) ?? 0;
						return (
							<ToggleGroupItem
								key={method}
								value={method}
								aria-label={`${method}, ${count} ${count === 1 ? "request" : "requests"}`}
								className={TOGGLE_ITEM_CLASS}
							>
								{method}
								<span className="font-sans text-muted-foreground tabular-nums">{count}</span>
							</ToggleGroupItem>
						);
					})}
				</ToggleGroup>
			)}
		</Field>
	);
}

function HttpVersionSection({ filters, update }: SectionProps) {
	const entries = useHarStore((s) => s.entries);
	const idPrefix = useId();
	const selected = useMemo(
		() => new Set(filters.httpVersions.map(normalizeHttpVersion)),
		[filters.httpVersions]
	);

	const versions = useMemo(() => {
		const counts = new Map<string, number>();
		for (const entry of entries) {
			const version = getEntryHttpVersion(entry);
			counts.set(version, (counts.get(version) ?? 0) + 1);
		}
		// Keep selected versions listed even if no entry uses them any more.
		selected.forEach((version) => {
			if (!counts.has(version)) counts.set(version, 0);
		});
		return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
	}, [entries, selected]);

	const toggle = (version: string, checked: boolean) => {
		const next = checked ? [...selected, version] : [...selected].filter((v) => v !== version);
		update({ httpVersions: [...new Set(next)].map(toHttpVersionFilterValue) });
	};

	return (
		<Field className="gap-2.5">
			<FieldTitle>HTTP version</FieldTitle>
			{versions.length === 0 ? (
				<FieldDescription className="text-xs">No requests</FieldDescription>
			) : (
				<div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
					{versions.map(([version, count], i) => {
						const id = `${idPrefix}-${i}`;
						return (
							<div key={version} className="flex min-h-9 items-center gap-2 sm:min-h-7">
								<Checkbox
									id={id}
									checked={selected.has(version)}
									onCheckedChange={(checked) => toggle(version, checked === true)}
								/>
								<Label htmlFor={id} className="min-w-0 font-normal">
									<span className="truncate font-mono text-xs">
										{version === UNKNOWN_HTTP_VERSION ? "Unknown" : version}
									</span>
									<span className="text-xs text-muted-foreground tabular-nums">{count}</span>
								</Label>
							</div>
						);
					})}
				</div>
			)}
		</Field>
	);
}

function RangeSection({
	label,
	unit,
	step,
	min,
	max,
	onChange,
}: {
	label: string;
	unit: string;
	step: number;
	min: number | null;
	max: number | null;
	onChange: (min: number | null, max: number | null) => void;
}) {
	const errorId = useId();
	const invalid = min !== null && max !== null && min > max;
	const lower = label.toLowerCase();

	return (
		<Field className="gap-2.5" data-invalid={invalid || undefined}>
			<FieldTitle>
				{label} <span className="font-normal text-muted-foreground">({unit})</span>
			</FieldTitle>
			<div className="grid grid-cols-2 gap-2">
				<NumberField
					value={min}
					onChange={(value) => onChange(value, max)}
					min={0}
					step={step}
					placeholder="Min"
					aria-label={`Minimum ${lower} in ${unit}`}
					invalid={invalid}
				/>
				<NumberField
					value={max}
					onChange={(value) => onChange(min, value)}
					min={0}
					step={step}
					placeholder="Max"
					aria-label={`Maximum ${lower} in ${unit}`}
					invalid={invalid}
				/>
			</div>
			{invalid && (
				<FieldError id={errorId} className="text-xs">
					Minimum is greater than maximum, so nothing can match.
				</FieldError>
			)}
		</Field>
	);
}

function PatternField({
	label,
	icon,
	value,
	placeholder,
	onChange,
}: {
	label: string;
	icon: ReactNode;
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
}) {
	const inputId = useId();
	const hintId = useId();
	const error = getRegexError(value);

	return (
		<Field className="gap-2" data-invalid={error ? true : undefined}>
			<FieldLabel htmlFor={inputId}>{label}</FieldLabel>
			<InputGroup>
				<InputGroupAddon>{icon}</InputGroupAddon>
				<InputGroupInput
					id={inputId}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					spellCheck={false}
					autoComplete="off"
					aria-describedby={hintId}
					aria-invalid={error ? true : undefined}
					className="font-mono text-xs"
				/>
				{value && (
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							size="icon-xs"
							aria-label={`Clear ${label.toLowerCase()} pattern`}
							onClick={() => onChange("")}
						>
							<X />
						</InputGroupButton>
					</InputGroupAddon>
				)}
			</InputGroup>
			{error ? (
				<FieldError id={hintId} className="text-xs">
					{error}
				</FieldError>
			) : (
				<FieldDescription id={hintId} className="text-xs">
					Substring, or /regex/
				</FieldDescription>
			)}
		</Field>
	);
}

function HeadersSection({ filters, update }: SectionProps) {
	const entries = useHarStore((s) => s.entries);
	const { headerMatches } = filters;

	const headerNames = useMemo(() => {
		const names = new Map<string, string>();
		for (const entry of entries) {
			for (const header of entry.request.headers) {
				const key = header.name.toLowerCase();
				if (key && !names.has(key)) names.set(key, key);
			}
			for (const header of entry.response.headers) {
				const key = header.name.toLowerCase();
				if (key && !names.has(key)) names.set(key, key);
			}
		}
		return [...names.values()].sort();
	}, [entries]);

	const setRow = (index: number, patch: Partial<{ name: string; value: string }>) =>
		update({
			headerMatches: headerMatches.map((row, i) => (i === index ? { ...row, ...patch } : row)),
		});

	return (
		<Field className="gap-2.5">
			<FieldTitle>Headers</FieldTitle>
			{headerMatches.length > 0 && (
				<ul className="flex flex-col gap-2">
					{headerMatches.map((row, index) => (
						<li
							// Rows have no stable id; index keys are fine because rows are only appended or removed.
							key={index}
							className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
						>
							<HeaderNameCombobox
								value={row.name}
								names={headerNames}
								onChange={(name) => setRow(index, { name })}
								className="col-start-1 row-start-1"
							/>
							<Input
								value={row.value}
								onChange={(e) => setRow(index, { value: e.target.value })}
								placeholder="Value contains (optional)"
								aria-label="Header value contains"
								spellCheck={false}
								autoComplete="off"
								className="col-start-1 row-start-2 font-mono text-xs sm:col-start-2 sm:row-start-1"
							/>
							<Button
								variant="ghost"
								size="icon"
								className="col-start-2 row-start-1 sm:col-start-3"
								aria-label={`Remove header match ${row.name || index + 1}`}
								onClick={() =>
									update({ headerMatches: headerMatches.filter((_, i) => i !== index) })
								}
							>
								<X />
							</Button>
						</li>
					))}
				</ul>
			)}
			<Button
				variant="outline"
				size="sm"
				className="w-fit"
				onClick={() => update({ headerMatches: [...headerMatches, { name: "", value: "" }] })}
			>
				<Plus />
				Add header match
			</Button>
			<FieldDescription className="text-xs">
				Searches request and response headers. The name must match exactly (case-insensitive); leave
				the value empty to match any value. All matches must apply.
			</FieldDescription>
		</Field>
	);
}

const MAX_SUGGESTIONS = 200;

function HeaderNameCombobox({
	value,
	names,
	onChange,
	className,
}: {
	value: string;
	names: string[];
	onChange: (value: string) => void;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const typed = search.trim();
	const needle = typed.toLowerCase();
	const suggestions = useMemo(
		() =>
			(needle ? names.filter((name) => name.includes(needle)) : names).slice(0, MAX_SUGGESTIONS),
		[names, needle]
	);
	const exact = names.includes(needle);

	const choose = (name: string) => {
		onChange(name);
		setOpen(false);
		setSearch("");
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setSearch("");
			}}
		>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-label="Header name"
					className={cn(
						"w-full min-w-0 justify-between px-3 font-mono text-xs font-normal",
						className
					)}
				>
					<span className={cn("truncate", !value && "font-sans text-muted-foreground")}>
						{value || "Header name"}
					</span>
					<ChevronsUpDown className="text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 p-0">
				{/* Filtering is done above so the list can be capped for files with many headers. */}
				<Command shouldFilter={false}>
					<CommandInput
						value={search}
						onValueChange={setSearch}
						placeholder="Search or type a header"
					/>
					<CommandList>
						<CommandEmpty>No headers found.</CommandEmpty>
						{typed && !exact && (
							<CommandGroup>
								<CommandItem value={`custom:${typed}`} onSelect={() => choose(typed)}>
									<Plus />
									Use &ldquo;<span className="font-mono">{typed}</span>&rdquo;
								</CommandItem>
							</CommandGroup>
						)}
						{suggestions.length > 0 && (
							<CommandGroup heading="In this file">
								{suggestions.map((name) => (
									<CommandItem
										key={name}
										value={name}
										onSelect={() => choose(name)}
										className="font-mono text-xs"
									>
										{name}
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
