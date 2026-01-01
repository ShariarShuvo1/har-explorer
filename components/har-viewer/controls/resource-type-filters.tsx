"use client";

import {
	useHarStore,
	getResourceType,
	ResourceType,
} from "@/lib/stores/har-store";
import { cn } from "@/lib/cn";
import { useMemo } from "react";
import {
	Globe,
	FileText,
	Palette,
	Code2,
	Type,
	Image,
	Film,
	FileJson,
	Network,
	Box,
	MoreHorizontal,
} from "lucide-react";

const filterConfig: Array<{
	type: ResourceType;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}> = [
	{ type: "all", label: "All", icon: Globe },
	{ type: "fetch", label: "Fetch/XHR", icon: Network },
	{ type: "doc", label: "Doc", icon: FileText },
	{ type: "css", label: "CSS", icon: Palette },
	{ type: "js", label: "JS", icon: Code2 },
	{ type: "font", label: "Font", icon: Type },
	{ type: "img", label: "Img", icon: Image },
	{ type: "media", label: "Media", icon: Film },
	{ type: "manifest", label: "Manifest", icon: FileJson },
	{ type: "ws", label: "WS", icon: Network },
	{ type: "wasm", label: "Wasm", icon: Box },
	{ type: "other", label: "Other", icon: MoreHorizontal },
];

export function ResourceTypeFilters() {
	const { entries, resourceTypeFilter, setResourceTypeFilter } =
		useHarStore();

	const counts = useMemo(() => {
		const result: Record<ResourceType, number> = {
			all: entries.length,
			fetch: 0,
			doc: 0,
			css: 0,
			js: 0,
			font: 0,
			img: 0,
			media: 0,
			manifest: 0,
			ws: 0,
			wasm: 0,
			other: 0,
		};

		entries.forEach((entry) => {
			const type = getResourceType(entry);
			result[type]++;
		});

		return result;
	}, [entries]);

	return (
		<div className="flex items-center gap-1 overflow-x-auto">
			{filterConfig.map(({ type, icon: Icon }) => {
				const count = counts[type];
				const isActive = resourceTypeFilter === type;
				const hasItems = count > 0 || type === "all";

				return (
					<button
						key={type}
						onClick={() => setResourceTypeFilter(type)}
						disabled={!hasItems}
						aria-label={`Filter by ${type}`}
						title={`Filter by ${type}`}
						className={cn(
							"flex items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-all whitespace-nowrap border",
							"hover:bg-primary/10 active:scale-95",
							isActive && "bg-primary/20  border-primary/30",
							!isActive &&
								hasItems &&
								" hover:text-foreground border-border/60",
							!hasItems &&
								"opacity-40 cursor-not-allowed border-border/30"
						)}
					>
						<Icon className="w-3 h-3" />
						{isActive && (
							<span className="text-xs font-semibold">
								{type}
							</span>
						)}
						<span
							className={cn(
								"px-1 py-0.5 rounded text-[10px] font-bold min-w-5 text-center",
								isActive && "bg-primary/30",
								!isActive && "bg-muted/20"
							)}
						>
							{count}
						</span>
					</button>
				);
			})}
		</div>
	);
}
