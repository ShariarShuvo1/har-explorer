"use client";

import { Focus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useHarStore } from "@/lib/stores/har-store";
import { useThemeStore } from "@/lib/stores/theme-store";
import { EntryDetailsProps } from "./types";
import { TAB_CONFIG } from "./constants";
import { GeneralTab } from "./general-tab";
import { HeadersTab } from "./headers-tab";
import { RequestTab } from "./request-tab";
import { ResponseTab } from "./response-tab";
import { TimingsTab } from "./timings-tab";
import { SecurityTab } from "./security-tab";
import { CacheTab } from "./cache-tab";
import { PerformanceTab } from "./performance-tab";
import { ExportTab } from "./export-tab";
import { FocusProvider } from "./focus-context";

export function HarEntryDetails({ entry, index }: EntryDetailsProps) {
	const { updateEntry, activeTab, setActiveTab, setFocusedEntry } =
		useHarStore();
	const { theme } = useThemeStore();

	const handleUpdateField = (path: string[], value: string | number) => {
		const updatedEntry = JSON.parse(JSON.stringify(entry));
		let current: Record<string, unknown> = updatedEntry;

		for (let i = 0; i < path.length - 1; i++) {
			if (!current[path[i]]) {
				current[path[i]] = {};
			}
			current = current[path[i]] as Record<string, unknown>;
		}

		current[path[path.length - 1]] = value;
		updateEntry(index, updatedEntry);
	};

	return (
		<div className="border border-border/50 bg-card/70 backdrop-blur-sm mx-2 my-2 rounded select-text overflow-hidden">
			<div className="flex items-center border-b border-border/50 bg-primary/5 overflow-x-auto">
				{TAB_CONFIG.map((tab) => {
					const Icon = tab.icon;
					return (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all relative border-b-2 border-transparent whitespace-nowrap",
								activeTab === tab.id
									? "text-primary border-b-primary bg-primary/10"
									: "text-muted hover:text-foreground hover:bg-card/40"
							)}
						>
							<Icon className="w-3.5 h-3.5" />
							{tab.label}
						</button>
					);
				})}

				<div className="flex-1" />

				<button
					onClick={() => setFocusedEntry(index)}
					className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-primary hover:bg-primary/10 transition-all whitespace-nowrap"
					title="Focus on this entry (fullscreen view)"
				>
					<Focus className="w-3.5 h-3.5" />
					Focus
				</button>
			</div>

			<FocusProvider isFocusMode={false}>
				<div className="p-3 max-h-[66vh] overflow-auto">
					{activeTab === "general" && (
						<GeneralTab
							entry={entry}
							onUpdateField={handleUpdateField}
						/>
					)}
					{activeTab === "headers" && (
						<HeadersTab
							entry={entry}
							onUpdateField={handleUpdateField}
						/>
					)}
					{activeTab === "request" && (
						<RequestTab
							entry={entry}
							onUpdateField={handleUpdateField}
						/>
					)}
					{activeTab === "response" && (
						<ResponseTab
							entry={entry}
							theme={theme}
							onUpdateField={handleUpdateField}
						/>
					)}
					{activeTab === "timings" && (
						<TimingsTab
							entry={entry}
							onUpdateField={handleUpdateField}
						/>
					)}
					{activeTab === "security" && <SecurityTab entry={entry} />}
					{activeTab === "cache" && <CacheTab entry={entry} />}
					{activeTab === "performance" && (
						<PerformanceTab entry={entry} />
					)}
					{activeTab === "export" && <ExportTab entry={entry} />}
				</div>
			</FocusProvider>
		</div>
	);
}
