"use client";

import { List } from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { EditableField } from "../shared/editable-field";
import { CopyButton } from "@/components/ui/copy-button";
import { useFocusMode } from "./focus-context";
import { cn } from "@/lib/cn";

interface HeadersTabProps {
	entry: HAREntry;
	onUpdateField: (path: string[], value: string | number) => void;
}

function HeadersSection({
	title,
	headers,
	onUpdateHeader,
	isFocusMode,
}: {
	title: string;
	headers: Array<{ name: string; value: string }>;
	onUpdateHeader: (i: number, field: string, value: string) => void;
	isFocusMode: boolean;
}) {
	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between">
				<h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wide flex items-center gap-1.5">
					<List className="w-3.5 h-3.5 text-blue-500" />
					{title}
					<span className="text-muted font-normal">
						({headers.length})
					</span>
				</h4>
				<CopyButton
					content={headers
						.map((h) => `${h.name}: ${h.value}`)
						.join("\n")}
					size="sm"
					className="p-1"
					title="Copy all headers"
				/>
			</div>
			<div
				className={cn(
					"space-y-0.5 overflow-auto",
					!isFocusMode && "max-h-[25vh]"
				)}
			>
				{headers.map((header, i) => (
					<div
						key={i}
						className="grid grid-cols-4 gap-2 py-1 px-2 bg-card/40 rounded border border-border/30 hover:bg-card/60 transition-colors"
					>
						<EditableField
							value={header.name}
							onSave={(value) => onUpdateHeader(i, "name", value)}
							className="font-mono text-xs font-medium text-primary"
						/>
						<EditableField
							value={header.value}
							onSave={(value) =>
								onUpdateHeader(i, "value", value)
							}
							className="font-mono text-xs col-span-3 break-all"
						/>
					</div>
				))}
			</div>
		</div>
	);
}

export function HeadersTab({ entry, onUpdateField }: HeadersTabProps) {
	const { isFocusMode } = useFocusMode();

	return (
		<div className="space-y-3">
			<HeadersSection
				title="Request Headers"
				headers={entry.request.headers}
				onUpdateHeader={(i, field, value) =>
					onUpdateField(
						["request", "headers", i.toString(), field],
						value
					)
				}
				isFocusMode={isFocusMode}
			/>
			<HeadersSection
				title="Response Headers"
				headers={entry.response.headers}
				onUpdateHeader={(i, field, value) =>
					onUpdateField(
						["response", "headers", i.toString(), field],
						value
					)
				}
				isFocusMode={isFocusMode}
			/>
		</div>
	);
}
