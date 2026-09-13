"use client";

import { Copy, Download } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMediaQuery } from "@/lib/hooks/use-mobile";
import { cn } from "@/lib/cn";
import { FORMAT_BY_ID, SCOPE_OPTIONS } from "./constants";
import { PreviewCard } from "./preview";
import { EndpointsSettings, FormatSettings, OptionsSettings, ScopeSettings } from "./settings";
import { useExportModel, type ExportModel } from "./use-export-model";

function ExportActions({ model, className }: { model: ExportModel; className?: string }) {
	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Button
				variant="outline"
				onClick={model.copy}
				disabled={!model.canCopy}
				className="max-sm:flex-1"
			>
				<Copy />
				Copy
			</Button>
			<Button onClick={model.download} disabled={!model.canDownload} className="max-sm:flex-1">
				<Download />
				Download {model.activeFormat.extension}
			</Button>
		</div>
	);
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<Card className="gap-3 py-4 shadow-xs">
			<CardHeader className="px-4">
				<CardTitle className="text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent className="px-4">{children}</CardContent>
		</Card>
	);
}

function AccordionSection({
	value,
	title,
	summary,
	children,
}: {
	value: string;
	title: string;
	summary?: string;
	children: React.ReactNode;
}) {
	return (
		<AccordionItem value={value}>
			<AccordionTrigger className="items-center py-3.5 hover:no-underline">
				<span className="flex min-w-0 flex-1 items-center justify-between gap-3">
					<span className="font-semibold">{title}</span>
					{summary && (
						<span className="truncate text-xs font-normal text-muted-foreground tabular-nums">
							{summary}
						</span>
					)}
				</span>
			</AccordionTrigger>
			<AccordionContent>{children}</AccordionContent>
		</AccordionItem>
	);
}

export function ExportView() {
	const model = useExportModel();
	const isDesktop = useMediaQuery("(min-width: 1024px)");
	const { options, format, endpoints, hiddenEndpoints, dedupe, scopeCounts } = model;
	const showEndpoints = options.format !== "har";
	const endpointsTitle = format === "har" || dedupe ? "Endpoints" : "Requests";
	const includedCount =
		endpoints.length - endpoints.filter((endpoint) => hiddenEndpoints.has(endpoint.key)).length;

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
			<div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 pt-5 pb-28 sm:px-6 sm:py-6 lg:min-h-0 lg:flex-1 lg:px-8">
				<PageHeader
					title="Export"
					description="Turn requests into API documentation, an OpenAPI spec or a new HAR file."
					actions={<ExportActions model={model} className="max-sm:hidden" />}
				/>

				{isDesktop ? (
					<div className="grid min-h-0 flex-1 grid-cols-[22rem_minmax(0,1fr)] gap-6">
						<aside
							aria-label="Export settings"
							className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1 pb-1"
						>
							<SettingsCard title="What to export">
								<ScopeSettings model={model} />
							</SettingsCard>
							<SettingsCard title="Format">
								<FormatSettings model={model} />
							</SettingsCard>
							<SettingsCard title="Options">
								<OptionsSettings model={model} />
							</SettingsCard>
							{showEndpoints && (
								<SettingsCard title={endpointsTitle}>
									<EndpointsSettings model={model} listClassName="max-h-[32rem]" />
								</SettingsCard>
							)}
						</aside>
						<PreviewCard model={model} className="min-h-0" />
					</div>
				) : (
					<>
						<Card className="gap-0 py-0 shadow-xs">
							<Accordion type="multiple" defaultValue={["scope", "format"]} className="px-4">
								<AccordionSection
									value="scope"
									title="What to export"
									summary={`${SCOPE_OPTIONS[options.scope].label} · ${scopeCounts[options.scope].toLocaleString()}`}
								>
									<ScopeSettings model={model} />
								</AccordionSection>
								<AccordionSection
									value="format"
									title="Format"
									summary={FORMAT_BY_ID[options.format].label}
								>
									<FormatSettings model={model} />
								</AccordionSection>
								<AccordionSection
									value="options"
									title="Options"
									summary={options.redactSecrets ? "Secrets redacted" : "Secrets kept"}
								>
									<OptionsSettings model={model} />
								</AccordionSection>
								{showEndpoints && (
									<AccordionSection
										value="endpoints"
										title={endpointsTitle}
										summary={
											endpoints.length > 0
												? `${includedCount.toLocaleString()} of ${endpoints.length.toLocaleString()}`
												: undefined
										}
									>
										<EndpointsSettings model={model} listClassName="max-h-[24rem]" />
									</AccordionSection>
								)}
							</Accordion>
						</Card>
						<PreviewCard model={model} className="h-[75svh] min-h-[26rem]" />
					</>
				)}
			</div>

			<div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
				<ExportActions model={model} />
			</div>
		</div>
	);
}
