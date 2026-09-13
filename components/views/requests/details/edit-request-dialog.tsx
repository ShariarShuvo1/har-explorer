"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import { normalizeTimestamp, withRequestUrl } from "@/lib/entry/entry-utils";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { NumberField } from "@/components/common/number-field";
import { DateTimePicker } from "@/components/common/date-time-picker";
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
	ResponsiveDialogTitle,
} from "@/components/common/responsive-dialog";
import { useHarStore } from "@/lib/stores/har-store";
import { useEntryUpdate } from "./shared";

const COMMON_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const HTTP_VERSIONS = ["HTTP/1.0", "HTTP/1.1", "HTTP/2", "HTTP/3"];
const KEEP_VERSION = "__keep__";

interface FormState {
	method: string;
	url: string;
	status: number | null;
	statusText: string;
	httpVersion: string;
	startedDateTime: string;
	serverIPAddress: string;
	mimeType: string;
}

function toForm(entry: HAREntry): FormState {
	return {
		method: entry.request.method,
		url: entry.request.url,
		status: entry.response.status,
		statusText: entry.response.statusText,
		httpVersion: entry.response.httpVersion || entry.request.httpVersion,
		startedDateTime: entry.startedDateTime,
		serverIPAddress: entry.serverIPAddress ?? "",
		mimeType: entry.response.content.mimeType,
	};
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState, original: FormState): Errors {
	const errors: Errors = {};
	if (!form.url.trim()) errors.url = "The URL cannot be empty";
	if (!/^[A-Za-z][A-Za-z-]*$/.test(form.method.trim())) {
		errors.method = "Use letters only, e.g. GET";
	}
	if (
		form.status === null ||
		!Number.isInteger(form.status) ||
		form.status < 0 ||
		form.status > 999
	) {
		errors.status = "Enter a whole number from 0 to 999";
	}
	// An invalid date already in the HAR must not block editing other fields.
	if (
		form.startedDateTime !== original.startedDateTime &&
		!normalizeTimestamp(form.startedDateTime)
	) {
		errors.startedDateTime = "Enter a valid date and time";
	}
	return errors;
}

function applyForm(entry: HAREntry, form: FormState, original: FormState): HAREntry {
	// Only changed fields are written, so edits made elsewhere while the dialog
	// was open are kept; the query string is re-derived only for a new URL.
	const changed = (key: keyof FormState) => form[key] !== original[key];
	let next = entry;
	if (changed("url")) next = withRequestUrl(next, form.url.trim());

	const request = { ...next.request };
	const response = { ...next.response };
	if (changed("method")) request.method = form.method.trim().toUpperCase();
	if (changed("httpVersion")) {
		request.httpVersion = form.httpVersion.trim();
		response.httpVersion = form.httpVersion.trim();
	}
	if (changed("status") && form.status !== null) response.status = form.status;
	if (changed("statusText")) response.statusText = form.statusText;
	if (changed("mimeType")) {
		response.content = { ...response.content, mimeType: form.mimeType.trim() };
	}
	next = { ...next, request, response };
	if (changed("startedDateTime")) {
		next.startedDateTime = normalizeTimestamp(form.startedDateTime) ?? next.startedDateTime;
	}
	if (changed("serverIPAddress")) next.serverIPAddress = form.serverIPAddress.trim();
	return next;
}

function FieldError({ id, message }: { id: string; message?: string }) {
	if (!message) return null;
	return (
		<p id={id} className="text-xs text-destructive">
			{message}
		</p>
	);
}

function EditRequestForm({
	index,
	entry,
	onDone,
}: {
	index: number;
	entry: HAREntry;
	onDone: () => void;
}) {
	const id = useId();
	const update = useEntryUpdate(index);
	const [original] = useState(() => toForm(entry));
	const [form, setForm] = useState<FormState>(original);
	const [submitted, setSubmitted] = useState(false);
	const [statusParsable, setStatusParsable] = useState(true);
	const errors = validate(form, original);
	const shownErrors = submitted ? errors : {};
	const statusError = statusParsable ? shownErrors.status : "Enter a number";
	const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
		setForm((current) => ({ ...current, [key]: value }));

	const versionValue = HTTP_VERSIONS.includes(form.httpVersion) ? form.httpVersion : KEEP_VERSION;

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		setSubmitted(true);
		if (!statusParsable || Object.keys(errors).length > 0) return;
		const changed = (Object.keys(form) as (keyof FormState)[]).some(
			(key) => form[key] !== original[key]
		);
		if (changed && useHarStore.getState().entries[index]) {
			update((current) => applyForm(current, form, original));
		}
		onDone();
	};

	return (
		<form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
			<ResponsiveDialogBody className="space-y-4">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
					<div className="space-y-1.5">
						<Label htmlFor={`${id}-method`}>Method</Label>
						<InputGroup>
							<InputGroupInput
								id={`${id}-method`}
								value={form.method}
								onChange={(e) => set("method", e.target.value)}
								aria-invalid={shownErrors.method ? true : undefined}
								aria-describedby={`${id}-method-error`}
								className="font-mono uppercase"
								autoComplete="off"
							/>
							<InputGroupAddon align="inline-end">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<InputGroupButton size="icon-xs" aria-label="Common methods">
											<ChevronDown />
										</InputGroupButton>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										{COMMON_METHODS.map((method) => (
											<DropdownMenuItem
												key={method}
												onSelect={() => set("method", method)}
												className="font-mono"
											>
												{method}
											</DropdownMenuItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							</InputGroupAddon>
						</InputGroup>
						<FieldError id={`${id}-method-error`} message={shownErrors.method} />
					</div>
					<div className="min-w-0 space-y-1.5">
						<Label htmlFor={`${id}-url`}>URL</Label>
						<Input
							id={`${id}-url`}
							value={form.url}
							onChange={(e) => set("url", e.target.value)}
							aria-invalid={shownErrors.url ? true : undefined}
							aria-describedby={`${id}-url-error ${id}-url-hint`}
							className="font-mono text-xs"
							autoComplete="off"
							spellCheck={false}
						/>
						<p id={`${id}-url-hint`} className="text-xs text-muted-foreground">
							Query parameters are updated to match the URL.
						</p>
						<FieldError id={`${id}-url-error`} message={shownErrors.url} />
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
					<div className="space-y-1.5">
						<Label htmlFor={`${id}-status`}>Status code</Label>
						<NumberField
							id={`${id}-status`}
							value={form.status}
							onChange={(value) => set("status", value)}
							min={0}
							max={999}
							invalid={Boolean(statusError)}
							onValidityChange={setStatusParsable}
							aria-describedby={`${id}-status-error`}
						/>
						<FieldError id={`${id}-status-error`} message={statusError} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor={`${id}-status-text`}>Status text</Label>
						<Input
							id={`${id}-status-text`}
							value={form.statusText}
							onChange={(e) => set("statusText", e.target.value)}
							placeholder="OK"
							autoComplete="off"
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="space-y-1.5">
						<Label htmlFor={`${id}-version`}>HTTP version</Label>
						<Select
							value={versionValue}
							onValueChange={(value) => {
								if (value !== KEEP_VERSION) set("httpVersion", value);
							}}
						>
							<SelectTrigger id={`${id}-version`} className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{HTTP_VERSIONS.map((version) => (
									<SelectItem key={version} value={version}>
										{version}
									</SelectItem>
								))}
								{versionValue === KEEP_VERSION && (
									<SelectItem value={KEEP_VERSION}>
										{form.httpVersion ? `Keep "${form.httpVersion}"` : "Not set"}
									</SelectItem>
								)}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor={`${id}-ip`}>Server IP</Label>
						<Input
							id={`${id}-ip`}
							value={form.serverIPAddress}
							onChange={(e) => set("serverIPAddress", e.target.value)}
							placeholder="e.g. 93.184.216.34"
							className="font-mono text-xs"
							autoComplete="off"
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="space-y-1.5">
						<Label htmlFor={`${id}-started`}>Started</Label>
						<DateTimePicker
							id={`${id}-started`}
							value={form.startedDateTime}
							onChange={(value) => set("startedDateTime", value)}
						/>
						<FieldError id={`${id}-started-error`} message={shownErrors.startedDateTime} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor={`${id}-mime`}>Response MIME type</Label>
						<Input
							id={`${id}-mime`}
							value={form.mimeType}
							onChange={(e) => set("mimeType", e.target.value)}
							placeholder="application/json"
							className="font-mono text-xs"
							autoComplete="off"
						/>
					</div>
				</div>
			</ResponsiveDialogBody>
			<ResponsiveDialogFooter>
				<Button type="button" variant="outline" onClick={onDone}>
					Cancel
				</Button>
				<Button type="submit" disabled={!statusParsable}>
					Save changes
				</Button>
			</ResponsiveDialogFooter>
		</form>
	);
}

export function EditRequestDialog({
	open,
	onOpenChange,
	entry,
	index,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entry: HAREntry;
	index: number;
}) {
	return (
		<ResponsiveDialog open={open} onOpenChange={onOpenChange}>
			<ResponsiveDialogContent size="lg">
				<ResponsiveDialogHeader>
					<ResponsiveDialogTitle>Edit request</ResponsiveDialogTitle>
					<ResponsiveDialogDescription>
						Changes are applied to this HAR file and can be undone.
					</ResponsiveDialogDescription>
				</ResponsiveDialogHeader>
				{open && <EditRequestForm index={index} entry={entry} onDone={() => onOpenChange(false)} />}
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}
