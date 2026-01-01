"use client";

import { Clock } from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { formatTime } from "@/lib/har-parser";
import { CompactCard, TimingCard } from "./shared-components";
import { cn } from "@/lib/cn";
import { TIMING_SEGMENTS } from "./constants";

interface TimingsTabProps {
	entry: HAREntry;
	onUpdateField: (path: string[], value: string | number) => void;
}

function TimingBar({ entry }: { entry: HAREntry }) {
	const total = entry.time || 1;
	const segments = TIMING_SEGMENTS.map((seg) => ({
		...seg,
		value: (entry.timings as Record<string, number>)[seg.key] || 0,
	})).filter((s) => s.value > 0);

	return (
		<div className="space-y-1.5">
			<div className="text-[10px] font-bold text-foreground/70 uppercase tracking-wide">
				Timing Breakdown
			</div>
			<div className="h-4 rounded overflow-hidden flex bg-card/60 border border-border/30">
				{segments.map((segment, i) => (
					<div
						key={i}
						className={cn(segment.color, "h-full")}
						style={{ width: `${(segment.value / total) * 100}%` }}
						title={`${segment.label}: ${formatTime(segment.value)}`}
					/>
				))}
			</div>
			<div className="flex flex-wrap gap-2">
				{segments.map((segment, i) => (
					<div key={i} className="flex items-center gap-1 text-[9px]">
						<div className={cn("w-2 h-2 rounded", segment.color)} />
						<span className="text-muted">{segment.label}</span>
					</div>
				))}
			</div>
		</div>
	);
}

export function TimingsTab({ entry, onUpdateField }: TimingsTabProps) {
	return (
		<div className="space-y-3">
			<div className="grid grid-cols-5 gap-2">
				<TimingCard
					label="Total"
					value={entry.time}
					color="primary"
					isTotal
				/>
				<TimingCard
					label="Blocked"
					value={entry.timings.blocked}
					color="gray"
				/>
				<TimingCard
					label="DNS"
					value={entry.timings.dns}
					color="cyan"
				/>
				<TimingCard
					label="Connect"
					value={entry.timings.connect}
					color="orange"
				/>
				<TimingCard
					label="SSL"
					value={entry.timings.ssl}
					color="green"
				/>
			</div>
			<div className="grid grid-cols-4 gap-2">
				<TimingCard
					label="Send"
					value={entry.timings.send}
					color="blue"
				/>
				<TimingCard
					label="Wait"
					value={entry.timings.wait}
					color="purple"
				/>
				<TimingCard
					label="Receive"
					value={entry.timings.receive}
					color="pink"
				/>
				<CompactCard
					label="Started"
					value={new Date(entry.startedDateTime).toLocaleTimeString()}
					icon={<Clock className="w-3 h-3 text-muted" />}
					editable
					onSave={(value) =>
						onUpdateField(["startedDateTime"], value)
					}
				/>
			</div>

			<TimingBar entry={entry} />
		</div>
	);
}
