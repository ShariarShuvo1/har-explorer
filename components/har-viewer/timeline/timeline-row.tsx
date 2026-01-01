import { getResourceType } from "@/lib/stores/har-store";
import { formatTime } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { TimelineEntry } from "./types";
import { TYPE_COLORS, TIMING_COLORS } from "./constants";

export function TimelineRow({
	te,
	isHighlighted,
	isHovered,
	isComparing,
	hasAnyHover,
	onMouseEnter,
	onMouseLeave,
	onMouseMove,
	onClick,
}: {
	te: TimelineEntry;
	isHighlighted: boolean;
	isHovered: boolean;
	isComparing?: boolean;
	hasAnyHover: boolean;
	onMouseEnter: (e: React.MouseEvent) => void;
	onMouseLeave: () => void;
	onMouseMove: (e: React.MouseEvent) => void;
	onClick: (e: React.MouseEvent) => void;
}) {
	const resourceType = getResourceType(te.entry);

	return (
		<div
			className={cn(
				"group relative cursor-pointer rounded transition-all",
				isHovered && "bg-primary/20 scale-[1.01] z-10 shadow-sm",
				isComparing && "bg-accent/20 ring-2 ring-accent shadow-lg",
				isHighlighted &&
					hasAnyHover &&
					!isHovered &&
					"bg-secondary/5 opacity-70"
			)}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onMouseMove={onMouseMove}
			onClick={onClick}
		>
			<div className="flex items-center gap-2 text-xs py-0.5">
				<div className="w-20 shrink-0">
					<span
						className={cn(
							"inline-block px-2 py-1 rounded text-xs font-semibold whitespace-nowrap",
							TYPE_COLORS[resourceType] || TYPE_COLORS.other
						)}
					>
						{resourceType.toUpperCase()}
					</span>
				</div>
				<div className="w-32 truncate text-muted group-hover:text-foreground transition-colors">
					{new URL(te.entry.request.url).pathname.split("/").pop() ||
						"/"}
				</div>
				<div className="flex-1 relative h-6 bg-card/50 rounded overflow-hidden">
					<div
						className="absolute top-0 h-full flex"
						style={{
							left: `${te.offset}%`,
							width: `${te.duration}%`,
						}}
					>
						{te.segments.map((segment, i) => {
							const segmentWidth =
								(segment.value / te.total) * 100;
							return (
								<div
									key={i}
									className={cn(
										"h-full transition-all group-hover:opacity-90",
										TIMING_COLORS[segment.type]
									)}
									style={{ width: `${segmentWidth}%` }}
								/>
							);
						})}
					</div>
				</div>
				<div className="w-16 text-right text-muted group-hover:text-foreground transition-colors font-medium">
					{formatTime(te.total)}
				</div>
			</div>
		</div>
	);
}
