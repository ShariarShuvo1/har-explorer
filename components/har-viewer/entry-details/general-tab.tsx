"use client";

import {
	Globe,
	Send,
	Zap,
	Clock,
	HardDrive,
	FileCode,
	Wifi,
	Server,
	FileText,
	Activity,
} from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { formatBytes, formatTime } from "@/lib/har-parser";
import { DetailSection, CompactCard } from "./shared-components";
import { EditableField } from "../shared/editable-field";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import {
	getStatusColor,
	getStatusBgColor,
	getStatusBorderColor,
} from "./utils";

interface GeneralTabProps {
	entry: HAREntry;
	onUpdateField: (path: string[], value: string | number) => void;
}

export function GeneralTab({ entry, onUpdateField }: GeneralTabProps) {
	return (
		<div className="space-y-3">
			<DetailSection
				title="URL"
				icon={<Globe className="w-3.5 h-3.5 text-cyan-500" />}
			>
				<div className="flex items-start gap-2">
					<EditableField
						value={entry.request.url}
						onSave={(value) =>
							onUpdateField(["request", "url"], value)
						}
						className="font-mono text-xs break-all flex-1"
					/>
					<CopyButton
						content={entry.request.url}
						size="sm"
						title="Copy URL"
					/>
				</div>
			</DetailSection>

			<div className="grid grid-cols-4 gap-2">
				<CompactCard
					label="Method"
					value={entry.request.method}
					icon={<Send className="w-3 h-3 text-blue-500" />}
					editable
					onSave={(value) =>
						onUpdateField(["request", "method"], value)
					}
				/>
				<CompactCard
					label="Status"
					value={`${entry.response.status} ${entry.response.statusText}`}
					icon={<Zap className="w-3 h-3 text-yellow-500" />}
					className={cn(
						getStatusColor(entry.response.status),
						getStatusBgColor(entry.response.status),
						getStatusBorderColor(entry.response.status),
						"border rounded"
					)}
				/>
				<CompactCard
					label="Time"
					value={formatTime(entry.time)}
					icon={<Clock className="w-3 h-3 text-green-500" />}
					className={cn(
						entry.time > 1000 && "text-orange-500",
						entry.time > 3000 && "text-red-500"
					)}
				/>
				<CompactCard
					label="Size"
					value={formatBytes(entry.response.content.size)}
					icon={<HardDrive className="w-3 h-3 text-purple-500" />}
				/>
			</div>

			<div className="grid grid-cols-3 gap-2">
				<CompactCard
					label="Content-Type"
					value={entry.response.content.mimeType || "unknown"}
					icon={<FileCode className="w-3 h-3 text-orange-500" />}
					editable
					onSave={(value) =>
						onUpdateField(
							["response", "content", "mimeType"],
							value
						)
					}
				/>
				<CompactCard
					label="HTTP Version"
					value={entry.request.httpVersion}
					icon={<Wifi className="w-3 h-3 text-pink-500" />}
				/>
				{entry.serverIPAddress && (
					<CompactCard
						label="Server IP"
						value={entry.serverIPAddress}
						icon={<Server className="w-3 h-3 text-cyan-500" />}
						editable
						onSave={(value) =>
							onUpdateField(["serverIPAddress"], value)
						}
					/>
				)}
			</div>

			{(entry._resourceType || entry._priority || entry.connection) && (
				<div className="grid grid-cols-4 gap-2">
					{entry._resourceType && (
						<CompactCard
							label="Resource Type"
							value={entry._resourceType}
							icon={<FileText className="w-3 h-3 text-muted" />}
						/>
					)}
					{entry._priority && (
						<CompactCard
							label="Priority"
							value={entry._priority}
							icon={<Activity className="w-3 h-3 text-muted" />}
						/>
					)}
					{entry.connection && (
						<CompactCard
							label="Connection"
							value={entry.connection}
							icon={<Wifi className="w-3 h-3 text-muted" />}
						/>
					)}
				</div>
			)}
		</div>
	);
}
