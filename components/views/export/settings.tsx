"use client";

import { useId, useMemo, useState } from "react";
import { Info, Search, X } from "lucide-react";
import { MethodBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { getEndpointHostLabel } from "@/lib/api-docs/endpoints";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/har-parser";
import { DOC_TOGGLES, FORMAT_OPTIONS, GROUP_OPTIONS, SCOPE_OPTIONS } from "./constants";
import type { ExportFormat, ExportScope, GroupByOption } from "./types";
import type { ExportModel } from "./use-export-model";

const ENDPOINT_PAGE = 150;

const CHOICE_CARD =
	"flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal leading-snug transition-colors hover:bg-accent/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 dark:has-data-[state=checked]:bg-primary/10";

export function ScopeSettings({ model }: { model: ExportModel }) {
	const id = useId();
	const { options, updateOption, scopeCounts, scopeOrder } = model;
	return (
		<RadioGroup
			value={options.scope}
			onValueChange={(value) => updateOption("scope", value as ExportScope)}
			aria-label="What to export"
			className="gap-2"
		>
			{scopeOrder.map((scope) => {
				const option = SCOPE_OPTIONS[scope];
				const Icon = option.icon;
				const count = scopeCounts[scope];
				const disabled = count === 0 && options.scope !== scope;
				return (
					<Label
						key={scope}
						htmlFor={`${id}-${scope}`}
						className={cn(
							CHOICE_CARD,
							disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
						)}
					>
						<RadioGroupItem id={`${id}-${scope}`} value={scope} disabled={disabled} />
						<Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
						<span className="min-w-0 flex-1">
							<span className="block text-sm font-medium">{option.label}</span>
							<span className="block text-xs text-muted-foreground">{option.description}</span>
						</span>
						<Badge variant="secondary" className="tabular-nums">
							{count.toLocaleString()}
						</Badge>
					</Label>
				);
			})}
		</RadioGroup>
	);
}

export function FormatSettings({ model }: { model: ExportModel }) {
	const id = useId();
	const { options, updateOption } = model;
	return (
		<RadioGroup
			value={options.format}
			onValueChange={(value) => updateOption("format", value as ExportFormat)}
			aria-label="Format"
			className="gap-2"
		>
			{FORMAT_OPTIONS.map((option) => {
				const Icon = option.icon;
				return (
					<Label key={option.id} htmlFor={`${id}-${option.id}`} className={CHOICE_CARD}>
						<RadioGroupItem id={`${id}-${option.id}`} value={option.id} />
						<Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
						<span className="min-w-0 flex-1">
							<span className="flex items-baseline gap-2">
								<span className="text-sm font-medium">{option.label}</span>
								<span className="font-mono text-xs text-muted-foreground">{option.extension}</span>
							</span>
							<span className="block text-xs text-muted-foreground">{option.description}</span>
						</span>
					</Label>
				);
			})}
		</RadioGroup>
	);
}

function OptionSwitch({
	label,
	description,
	checked,
	onCheckedChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	const id = useId();
	return (
		<div className="flex min-h-9 items-start justify-between gap-3">
			<div className="min-w-0 space-y-1">
				<Label htmlFor={id} className="leading-snug">
					{label}
				</Label>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
		</div>
	);
}

function Note({ children }: { children: React.ReactNode }) {
	return (
		<p className="flex gap-2 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
			<Info className="mt-px size-3.5 shrink-0" aria-hidden />
			<span>{children}</span>
		</p>
	);
}

export function OptionsSettings({ model }: { model: ExportModel }) {
	const groupId = useId();
	const { options, updateOption, deduplicateEndpoints, setDeduplicateEndpoints } = model;
	const isDoc = options.format === "markdown" || options.format === "txt";

	return (
		<div className="flex flex-col gap-4">
			<OptionSwitch
				label="Redact secrets"
				description="Replace credentials, cookies and token-like values with REDACTED"
				checked={options.redactSecrets}
				onCheckedChange={(value) => updateOption("redactSecrets", value)}
			/>

			{options.format === "openapi" && (
				<Note>
					Requests are always merged into unique operations. WebSocket upgrades, CORS preflights and
					custom HTTP methods are left out.
				</Note>
			)}
			{options.format === "har" && (
				<Note>
					Keeps the original log metadata and only the pages the exported requests belong to.
				</Note>
			)}

			{isDoc && (
				<>
					<OptionSwitch
						label="Unique endpoints"
						description={
							deduplicateEndpoints
								? "Requests sharing a method and path pattern are merged"
								: "Every request is documented separately"
						}
						checked={deduplicateEndpoints}
						onCheckedChange={setDeduplicateEndpoints}
					/>
					<div className="flex items-center justify-between gap-3">
						<Label htmlFor={groupId}>Group by</Label>
						<Select
							value={options.groupBy}
							onValueChange={(value) => updateOption("groupBy", value as GroupByOption)}
						>
							<SelectTrigger id={groupId} size="sm" className="w-36">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{GROUP_OPTIONS.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<Separator />
					<p className="text-xs font-medium text-muted-foreground">Include</p>
					{DOC_TOGGLES.map((toggle) => (
						<OptionSwitch
							key={toggle.key}
							label={toggle.label}
							description={toggle.description}
							checked={options[toggle.key]}
							onCheckedChange={(value) => updateOption(toggle.key, value)}
						/>
					))}
				</>
			)}
		</div>
	);
}

export function EndpointsSettings({
	model,
	listClassName,
}: {
	model: ExportModel;
	listClassName?: string;
}) {
	const {
		endpoints,
		hiddenEndpoints,
		toggleEndpoint,
		setEndpointsIncluded,
		includeAllEndpoints,
		dedupe,
		isPending,
	} = model;
	const [query, setQuery] = useState("");
	const [limit, setLimit] = useState(ENDPOINT_PAGE);
	const noun = dedupe ? "endpoints" : "requests";

	const needle = query.trim().toLowerCase();
	const matches = useMemo(() => {
		if (!needle) return endpoints;
		return endpoints.filter((endpoint) =>
			`${endpoint.method} ${endpoint.path} ${getEndpointHostLabel(endpoint)}`
				.toLowerCase()
				.includes(needle)
		);
	}, [endpoints, needle]);

	const hiddenCount = endpoints.reduce(
		(sum, endpoint) => sum + (hiddenEndpoints.has(endpoint.key) ? 1 : 0),
		0
	);
	const shown = matches.slice(0, limit);

	if (endpoints.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
				{isPending ? (
					<>
						<Spinner />
						Analyzing requests…
					</>
				) : (
					`No ${noun} in this scope`
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<InputGroup>
				<InputGroupAddon>
					<Search aria-hidden />
				</InputGroupAddon>
				<InputGroupInput
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setLimit(ENDPOINT_PAGE);
					}}
					placeholder={`Search ${noun}`}
					aria-label={`Search ${noun}`}
				/>
				{query && (
					<InputGroupAddon align="inline-end">
						<InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQuery("")}>
							<X />
						</InputGroupButton>
					</InputGroupAddon>
				)}
			</InputGroup>

			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
					{isPending && <Spinner className="size-3" />}
					{(endpoints.length - hiddenCount).toLocaleString()} of {endpoints.length.toLocaleString()}{" "}
					included
				</span>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="xs"
						disabled={matches.length === 0}
						onClick={() =>
							setEndpointsIncluded(
								matches.map((endpoint) => endpoint.key),
								true
							)
						}
					>
						Select all
					</Button>
					<Button
						variant="ghost"
						size="xs"
						disabled={matches.length === 0}
						onClick={() =>
							setEndpointsIncluded(
								matches.map((endpoint) => endpoint.key),
								false
							)
						}
					>
						None
					</Button>
				</div>
			</div>

			{hiddenCount > 0 && (
				<div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
					<span>
						{hiddenCount.toLocaleString()} {hiddenCount === 1 ? noun.slice(0, -1) : noun} excluded
					</span>
					<Button variant="link" size="xs" className="h-auto px-0" onClick={includeAllEndpoints}>
						Show all
					</Button>
				</div>
			)}

			{matches.length === 0 ? (
				<p className="py-4 text-center text-sm text-muted-foreground">
					No {noun} match “{query}”
				</p>
			) : (
				<ul className={cn("-mx-1 flex flex-col overflow-y-auto", listClassName)}>
					{shown.map((endpoint) => {
						const hidden = hiddenEndpoints.has(endpoint.key);
						return (
							<li key={endpoint.key}>
								{/* Wrapping label: endpoint keys contain spaces, so they can't be element ids. */}
								<label className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-2 hover:bg-accent/50">
									<Checkbox
										checked={!hidden}
										onCheckedChange={() => toggleEndpoint(endpoint)}
										className="mt-0.5"
									/>
									<MethodBadge method={endpoint.method} />
									<span className="min-w-0 flex-1">
										<span
											className={cn(
												"block truncate font-mono text-xs",
												hidden && "text-muted-foreground line-through"
											)}
											title={endpoint.path}
										>
											{endpoint.path}
										</span>
										<span className="block truncate text-xs text-muted-foreground">
											{getEndpointHostLabel(endpoint)} ·{" "}
											{dedupe
												? `${endpoint.totalCalls} call${endpoint.totalCalls === 1 ? "" : "s"}`
												: formatTime(endpoint.avgResponseTime)}
										</span>
									</span>
								</label>
							</li>
						);
					})}
					{matches.length > shown.length && (
						<li className="px-1.5 pt-2">
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								onClick={() => setLimit((value) => value + ENDPOINT_PAGE)}
							>
								Show {Math.min(ENDPOINT_PAGE, matches.length - shown.length).toLocaleString()} more
							</Button>
						</li>
					)}
				</ul>
			)}
		</div>
	);
}
