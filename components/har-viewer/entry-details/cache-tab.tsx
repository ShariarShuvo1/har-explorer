"use client";

import {
	Database,
	CheckCircle,
	XCircle,
	Clock,
	Calendar,
	Tag,
	Lightbulb,
} from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { DetailSection, CompactCard } from "./shared-components";
import { analyzeCacheHeaders } from "./utils";
import { cn } from "@/lib/cn";

interface CacheTabProps {
	entry: HAREntry;
}

export function CacheTab({ entry }: CacheTabProps) {
	const cacheInfo = analyzeCacheHeaders(entry.response.headers);

	const formatDuration = (seconds: number) => {
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
		return `${Math.floor(seconds / 86400)}d`;
	};

	const getCacheStatus = () => {
		if (!cacheInfo.isCached) return "Not Cached";
		if (cacheInfo.isStale) return "Stale";
		if (cacheInfo.cacheControl?.includes("no-cache")) return "No Cache";
		if (cacheInfo.cacheControl?.includes("no-store")) return "No Store";
		return "Cached";
	};

	const status = getCacheStatus();
	const isGoodCache =
		cacheInfo.isCached && !cacheInfo.isStale && status === "Cached";

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-4 gap-2">
				<CompactCard
					label="Status"
					value={status}
					icon={
						isGoodCache ? (
							<CheckCircle className="w-3 h-3 text-green-500" />
						) : (
							<XCircle className="w-3 h-3 text-red-500" />
						)
					}
					className={cn(
						isGoodCache
							? "bg-green-500/10 text-green-400 border-green-500/30"
							: "bg-red-500/10 text-red-400 border-red-500/30"
					)}
				/>
				{cacheInfo.maxAge !== undefined && (
					<CompactCard
						label="Max Age"
						value={formatDuration(cacheInfo.maxAge)}
						icon={<Clock className="w-3 h-3 text-blue-500" />}
					/>
				)}
				{cacheInfo.age && (
					<CompactCard
						label="Age"
						value={formatDuration(parseInt(cacheInfo.age))}
						icon={<Clock className="w-3 h-3 text-purple-500" />}
						className={
							cacheInfo.isStale
								? "bg-orange-500/10 text-orange-400 border-orange-500/30"
								: ""
						}
					/>
				)}
				{cacheInfo.etag && (
					<CompactCard
						label="ETag"
						value="Present"
						icon={<Tag className="w-3 h-3 text-cyan-500" />}
						className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
					/>
				)}
			</div>

			{cacheInfo.cacheControl && (
				<DetailSection
					title="Cache-Control"
					icon={<Database className="w-3.5 h-3.5 text-purple-500" />}
				>
					<div className="bg-card/40 border border-border/30 rounded p-3">
						<div className="font-mono text-xs text-foreground break-all">
							{cacheInfo.cacheControl}
						</div>
						<div className="flex flex-wrap gap-1.5 mt-2">
							{cacheInfo.cacheControl
								.split(",")
								.map((directive, i) => (
									<span
										key={i}
										className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 font-mono"
									>
										{directive.trim()}
									</span>
								))}
						</div>
					</div>
				</DetailSection>
			)}

			<div className="space-y-2">
				{cacheInfo.etag && (
					<div className="bg-card/40 border border-border/30 rounded p-3">
						<div className="flex items-center gap-2 mb-1">
							<Tag className="w-3.5 h-3.5 text-cyan-500" />
							<span className="text-[10px] font-bold text-foreground/70 uppercase">
								ETag
							</span>
						</div>
						<div className="font-mono text-xs text-foreground/80 break-all">
							{cacheInfo.etag}
						</div>
					</div>
				)}

				{cacheInfo.lastModified && (
					<div className="bg-card/40 border border-border/30 rounded p-3">
						<div className="flex items-center gap-2 mb-1">
							<Calendar className="w-3.5 h-3.5 text-blue-500" />
							<span className="text-[10px] font-bold text-foreground/70 uppercase">
								Last Modified
							</span>
						</div>
						<div className="font-mono text-xs text-foreground/80">
							{new Date(cacheInfo.lastModified).toLocaleString()}
						</div>
					</div>
				)}

				{cacheInfo.expires && (
					<div className="bg-card/40 border border-border/30 rounded p-3">
						<div className="flex items-center gap-2 mb-1">
							<Calendar className="w-3.5 h-3.5 text-green-500" />
							<span className="text-[10px] font-bold text-foreground/70 uppercase">
								Expires
							</span>
						</div>
						<div className="font-mono text-xs text-foreground/80">
							{new Date(cacheInfo.expires).toLocaleString()}
						</div>
					</div>
				)}
			</div>

			{!cacheInfo.isCached && (
				<div className="text-center py-8 text-muted">
					<XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
					<p className="text-sm">No cache headers found</p>
					<p className="text-xs mt-1">
						This response will not be cached by the browser
					</p>
				</div>
			)}

			{cacheInfo.isStale && (
				<div className="bg-orange-500/10 border border-orange-500/30 rounded p-3 text-orange-400">
					<div className="flex items-center gap-2 mb-1">
						<Clock className="w-3.5 h-3.5" />
						<span className="text-xs font-bold">
							Cache is Stale
						</span>
					</div>
					<p className="text-[10px]">
						The cached resource has exceeded its max-age and should
						be revalidated.
					</p>
				</div>
			)}

			<DetailSection
				title="Cache Recommendations"
				icon={<CheckCircle className="w-3.5 h-3.5 text-green-500" />}
			>
				<div className="space-y-1.5">
					{!cacheInfo.cacheControl && (
						<div className="text-xs text-muted bg-yellow-500/10 border border-yellow-500/30 rounded p-2 flex items-start gap-1.5">
							<Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
							<span>
								Add Cache-Control header to enable caching
							</span>
						</div>
					)}
					{!cacheInfo.etag && !cacheInfo.lastModified && (
						<div className="text-xs text-muted bg-yellow-500/10 border border-yellow-500/30 rounded p-2 flex items-start gap-1.5">
							<Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
							<span>
								Add ETag or Last-Modified for better cache
								validation
							</span>
						</div>
					)}
					{cacheInfo.maxAge && cacheInfo.maxAge < 300 && (
						<div className="text-xs text-muted bg-yellow-500/10 border border-yellow-500/30 rounded p-2 flex items-start gap-1.5">
							<Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
							<span>
								Consider increasing max-age for better caching
								(currently {cacheInfo.maxAge}s)
							</span>
						</div>
					)}
					{isGoodCache && (
						<div className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded p-2 flex items-center gap-1.5">
							<CheckCircle className="w-3.5 h-3.5" />
							Cache configuration looks good
						</div>
					)}
				</div>
			</DetailSection>
		</div>
	);
}
