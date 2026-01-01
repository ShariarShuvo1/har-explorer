import { cn } from "@/lib/cn";
import { EditableField } from "../shared/editable-field";
import { DetailSectionProps, CompactCardProps, TimingCardProps } from "./types";
import { formatTime } from "@/lib/har-parser";
import { TIMING_COLORS } from "./constants";

export function DetailSection({ title, icon, children }: DetailSectionProps) {
	return (
		<div className="space-y-1.5">
			<h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wide flex items-center gap-1.5">
				{icon}
				{title}
			</h4>
			<div className="text-foreground">{children}</div>
		</div>
	);
}

export function CompactCard({
	label,
	value,
	icon,
	className,
	editable,
	onSave,
}: CompactCardProps) {
	return (
		<div
			className={cn(
				"bg-card/40 rounded px-2 py-1.5 border border-border/30",
				className
			)}
		>
			<div className="flex items-center gap-1 text-[9px] text-muted uppercase tracking-wide mb-0.5">
				{icon}
				{label}
			</div>
			{editable && onSave ? (
				<EditableField
					value={value}
					onSave={onSave}
					className="font-mono text-xs font-medium"
				/>
			) : (
				<div className="font-mono text-xs font-medium truncate">
					{value}
				</div>
			)}
		</div>
	);
}

export function TimingCard({ label, value, color, isTotal }: TimingCardProps) {
	return (
		<div
			className={cn(
				"rounded px-2 py-1.5 border text-center",
				TIMING_COLORS[color] || TIMING_COLORS.gray
			)}
		>
			<div className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">
				{label}
			</div>
			<div
				className={cn(
					"font-mono font-bold",
					isTotal ? "text-sm" : "text-xs"
				)}
			>
				{formatTime(value)}
			</div>
		</div>
	);
}
