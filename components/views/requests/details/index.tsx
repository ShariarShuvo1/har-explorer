"use client";

import { useRef, useState, type ComponentType } from "react";
import { Code2, Database, Download, FileText, List, Send, Shield, Timer } from "lucide-react";
import type { HAREntry } from "@/lib/har-types";
import { useHarStore, type DetailTab } from "@/lib/stores/har-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CacheTab } from "./cache-tab";
import { CodeTab } from "./code-tab";
import { HeadersTab } from "./headers-tab";
import { OverviewTab } from "./overview-tab";
import { PayloadTab, getPayloadIndicator } from "./payload-tab";
import { ResponseTab } from "./response-tab";
import { SecurityTab } from "./security-tab";
import { TimingTab } from "./timing-tab";

export const DETAIL_TABS: ReadonlyArray<{
	id: DetailTab;
	label: string;
	icon: ComponentType<{ className?: string }>;
}> = [
	{ id: "overview", label: "Overview", icon: FileText },
	{ id: "headers", label: "Headers", icon: List },
	{ id: "payload", label: "Payload", icon: Send },
	{ id: "response", label: "Response", icon: Download },
	{ id: "timing", label: "Timing", icon: Timer },
	{ id: "cache", label: "Cache", icon: Database },
	{ id: "security", label: "Security", icon: Shield },
	{ id: "code", label: "Code", icon: Code2 },
];

function TabIndicator({ value }: { value: number | boolean }) {
	if (value === false || value === 0) return null;
	if (value === true) {
		return <span className="size-1.5 rounded-full bg-primary" aria-label="(has body)" />;
	}
	return (
		<span className="min-w-4 rounded-full bg-primary/10 px-1 text-[10px] leading-4 font-semibold text-primary tabular-nums">
			{value}
		</span>
	);
}

function TabPanel({ entry, index, tab }: { entry: HAREntry; index: number; tab: DetailTab }) {
	switch (tab) {
		case "overview":
			return <OverviewTab entry={entry} index={index} />;
		case "headers":
			return <HeadersTab entry={entry} index={index} />;
		case "payload":
			return <PayloadTab entry={entry} index={index} />;
		case "response":
			return <ResponseTab entry={entry} index={index} />;
		case "timing":
			return <TimingTab entry={entry} />;
		case "cache":
			return <CacheTab entry={entry} />;
		case "security":
			return <SecurityTab entry={entry} />;
		case "code":
			return <CodeTab entry={entry} />;
	}
}

export function RequestDetailsContent({ entry, index }: { entry: HAREntry; index: number }) {
	const detailTab = useHarStore((s) => s.detailTab);
	const setDetailTab = useHarStore((s) => s.setDetailTab);
	const payload = getPayloadIndicator(entry);
	const panelRef = useRef<HTMLDivElement>(null);
	const [pendingTab, setPendingTab] = useState<DetailTab | null>(null);

	const changeTab = (value: string) => {
		const tab = value as DetailTab;
		if (tab === detailTab) return;
		// Switching tabs unmounts the panel, which would drop unsaved inline edits.
		if (panelRef.current?.querySelector('[data-editing="true"][data-dirty="true"]')) {
			setPendingTab(tab);
		} else {
			setDetailTab(tab);
		}
	};

	return (
		<>
			<Tabs
				value={detailTab}
				onValueChange={changeTab}
				className="@container flex min-h-0 flex-1 flex-col gap-0"
			>
				<div className="sticky top-0 z-10 shrink-0 [scrollbar-width:none] overflow-x-auto overflow-y-hidden border-b bg-background [&::-webkit-scrollbar]:hidden">
					<TabsList variant="line" className="h-11 w-max justify-start rounded-none px-2">
						{DETAIL_TABS.map(({ id, label, icon: Icon }) => (
							<TabsTrigger
								key={id}
								value={id}
								className="flex-none px-2.5 text-[13px] group-data-[orientation=horizontal]/tabs:after:bottom-[-4px]"
							>
								<Icon className="size-3.5 @max-3xl:hidden" />
								{label}
								{id === "payload" && <TabIndicator value={payload} />}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
				<div ref={panelRef} className="min-h-0 flex-1 overflow-y-auto">
					{/* Keyed by index so per-request state (open editors, image errors, ...) resets on navigation. */}
					<TabsContent key={`${index}-${detailTab}`} value={detailTab} className="min-w-0">
						<TabPanel entry={entry} index={index} tab={detailTab} />
					</TabsContent>
				</div>
			</Tabs>
			<ConfirmDialog
				open={pendingTab !== null}
				onOpenChange={(open) => {
					if (!open) setPendingTab(null);
				}}
				title="Discard unsaved changes?"
				description="You have unsaved edits on this tab. Switching tabs will discard them."
				confirmLabel="Discard"
				cancelLabel="Keep editing"
				destructive
				onConfirm={() => {
					if (pendingTab) setDetailTab(pendingTab);
					setPendingTab(null);
				}}
			/>
		</>
	);
}
