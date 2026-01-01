"use client";

import { useMemo } from "react";
import {
	BarChart,
	Bar,
	ResponsiveContainer,
	XAxis,
	YAxis,
	Tooltip,
	Cell,
} from "recharts";
import {
	Image as ImageIcon,
	Lightbulb,
	TrendingDown,
	AlertTriangle,
} from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { formatBytes } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { getTooltipStyle } from "./custom-tooltip";

interface ImageOptimizationProps {
	entries: HAREntry[];
}

export function ImageOptimization({ entries }: ImageOptimizationProps) {
	const imageData = useMemo(() => {
		if (!entries.length) return null;

		const imageEntries = entries.filter((entry) =>
			entry.response.content.mimeType.toLowerCase().includes("image")
		);

		if (imageEntries.length === 0) return null;

		const totalImageSize = imageEntries.reduce(
			(sum, e) => sum + e.response.content.size,
			0
		);

		const oversizedImages = imageEntries.filter(
			(e) => e.response.content.size > 100 * 1024
		);

		const uncompressedImages = imageEntries.filter((e) => {
			const compression = e.response.content.compression || 0;
			return compression === 0 && e.response.content.size > 10 * 1024;
		});

		const modernFormatCandidates = imageEntries.filter((e) => {
			const mime = e.response.content.mimeType.toLowerCase();
			return (
				(mime.includes("jpeg") ||
					mime.includes("jpg") ||
					mime.includes("png")) &&
				e.response.content.size > 50 * 1024
			);
		});

		const formatDistribution = new Map<
			string,
			{ count: number; size: number }
		>();
		imageEntries.forEach((entry) => {
			const mime = entry.response.content.mimeType.toLowerCase();
			let format = "other";
			if (mime.includes("jpeg") || mime.includes("jpg")) format = "JPEG";
			else if (mime.includes("png")) format = "PNG";
			else if (mime.includes("gif")) format = "GIF";
			else if (mime.includes("webp")) format = "WebP";
			else if (mime.includes("svg")) format = "SVG";
			else if (mime.includes("avif")) format = "AVIF";

			const existing = formatDistribution.get(format) || {
				count: 0,
				size: 0,
			};
			existing.count++;
			existing.size += entry.response.content.size;
			formatDistribution.set(format, existing);
		});

		const formats = Array.from(formatDistribution.entries())
			.map(([format, data]) => ({
				format,
				count: data.count,
				size: data.size,
				avgSize: Math.round(data.size / data.count),
			}))
			.sort((a, b) => b.size - a.size);

		const webpSavings = modernFormatCandidates.reduce((sum, e) => {
			return sum + Math.round(e.response.content.size * 0.25);
		}, 0);

		const compressionSavings = uncompressedImages.reduce((sum, e) => {
			return sum + Math.round(e.response.content.size * 0.3);
		}, 0);

		const potentialSavings = webpSavings + compressionSavings;

		const opportunities = [
			...oversizedImages.slice(0, 10).map((entry) => ({
				url: entry.request.url,
				size: entry.response.content.size,
				issue: "Oversized Image",
				recommendation: "Resize or compress image",
				potentialSaving: Math.round(entry.response.content.size * 0.5),
				severity:
					entry.response.content.size > 500 * 1024
						? "high"
						: "medium",
			})),
			...uncompressedImages.slice(0, 10).map((entry) => ({
				url: entry.request.url,
				size: entry.response.content.size,
				issue: "No Compression",
				recommendation: "Enable compression",
				potentialSaving: Math.round(entry.response.content.size * 0.3),
				severity: "medium" as const,
			})),
			...modernFormatCandidates.slice(0, 10).map((entry) => ({
				url: entry.request.url,
				size: entry.response.content.size,
				issue: "Legacy Format",
				recommendation: "Convert to WebP or AVIF",
				potentialSaving: Math.round(entry.response.content.size * 0.25),
				severity: "low" as const,
			})),
		]
			.sort((a, b) => b.potentialSaving - a.potentialSaving)
			.slice(0, 10);

		return {
			totalImages: imageEntries.length,
			totalImageSize,
			oversizedCount: oversizedImages.length,
			uncompressedCount: uncompressedImages.length,
			modernFormatCount: modernFormatCandidates.length,
			formats,
			potentialSavings,
			opportunities,
			savingsPercentage: Math.round(
				(potentialSavings / totalImageSize) * 100
			),
		};
	}, [entries]);

	if (!imageData) {
		return null;
	}

	const tooltipStyle = getTooltipStyle();
	const COLORS = [
		"#00ffff",
		"#ff00ff",
		"#00ff88",
		"#ffaa00",
		"#ff5555",
		"#5555ff",
	];

	return (
		<div className="space-y-6">
			<div>
				<div className="flex items-center gap-2 mb-4">
					<ImageIcon className="w-5 h-5 text-accent" />
					<h3 className="text-xl font-semibold text-foreground">
						Image Optimization Opportunities
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-primary/20 rounded">
								<ImageIcon className="w-5 h-5 text-primary" />
							</div>
							<div>
								<p className="text-xs text-muted">
									Total Images
								</p>
								<p className="text-2xl font-bold text-foreground">
									{imageData.totalImages}
								</p>
							</div>
						</div>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-secondary/20 rounded">
								<TrendingDown className="w-5 h-5 text-secondary" />
							</div>
							<div>
								<p className="text-xs text-muted">
									Total Image Size
								</p>
								<p className="text-2xl font-bold text-foreground">
									{formatBytes(imageData.totalImageSize)}
								</p>
							</div>
						</div>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-accent/20 rounded">
								<Lightbulb className="w-5 h-5 text-accent" />
							</div>
							<div>
								<p className="text-xs text-muted">
									Potential Savings
								</p>
								<p className="text-2xl font-bold text-foreground">
									{formatBytes(imageData.potentialSavings)}
								</p>
							</div>
						</div>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-green-500/20 rounded">
								<TrendingDown className="w-5 h-5 text-green-500" />
							</div>
							<div>
								<p className="text-xs text-muted">Reduction</p>
								<p className="text-2xl font-bold text-foreground">
									{imageData.savingsPercentage}%
								</p>
							</div>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-4">
							Image Format Distribution
						</h4>
						<ResponsiveContainer width="100%" height={250}>
							<BarChart data={imageData.formats}>
								<XAxis
									dataKey="format"
									tick={{ fill: "var(--foreground)" }}
								/>
								<YAxis
									tick={{ fill: "var(--muted)" }}
									label={{
										value: "Size (KB)",
										angle: -90,
										position: "insideLeft",
										fill: "var(--muted)",
									}}
								/>
								<Tooltip {...tooltipStyle} />
								<Bar dataKey="size" radius={[4, 4, 0, 0]}>
									{imageData.formats.map((_, index) => (
										<Cell
											key={`cell-${index}`}
											fill={COLORS[index % COLORS.length]}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-4">
							Optimization Issues Found
						</h4>
						<div className="space-y-3">
							<div className="flex items-center justify-between p-3 bg-card rounded border border-border">
								<div className="flex items-center gap-3">
									<AlertTriangle className="w-5 h-5 text-red-500" />
									<div>
										<p className="text-sm font-medium text-foreground">
											Oversized Images
										</p>
										<p className="text-xs text-muted">
											{">"} 100KB each
										</p>
									</div>
								</div>
								<span className="text-lg font-bold text-foreground">
									{imageData.oversizedCount}
								</span>
							</div>

							<div className="flex items-center justify-between p-3 bg-card rounded border border-border">
								<div className="flex items-center gap-3">
									<AlertTriangle className="w-5 h-5 text-orange-500" />
									<div>
										<p className="text-sm font-medium text-foreground">
											Uncompressed
										</p>
										<p className="text-xs text-muted">
											No compression applied
										</p>
									</div>
								</div>
								<span className="text-lg font-bold text-foreground">
									{imageData.uncompressedCount}
								</span>
							</div>

							<div className="flex items-center justify-between p-3 bg-card rounded border border-border">
								<div className="flex items-center gap-3">
									<Lightbulb className="w-5 h-5 text-yellow-500" />
									<div>
										<p className="text-sm font-medium text-foreground">
											Legacy Formats
										</p>
										<p className="text-xs text-muted">
											Can use WebP/AVIF
										</p>
									</div>
								</div>
								<span className="text-lg font-bold text-foreground">
									{imageData.modernFormatCount}
								</span>
							</div>
						</div>
					</div>
				</div>

				{imageData.opportunities.length > 0 && (
					<div className="mt-6 p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
							<Lightbulb className="w-4 h-4 text-accent" />
							Top Optimization Opportunities
						</h4>
						<div className="space-y-2">
							{imageData.opportunities.map((opp, index) => (
								<div
									key={index}
									className="p-3 bg-card rounded border border-border hover:bg-card-hover transition-colors"
								>
									<div className="flex items-start justify-between gap-3 mb-2">
										<div className="flex items-center gap-2">
											<span
												className={cn(
													"px-2 py-1 rounded text-xs font-bold uppercase",
													opp.severity === "high" &&
														"bg-red-500/20 text-red-500",
													opp.severity === "medium" &&
														"bg-orange-500/20 text-orange-500",
													opp.severity === "low" &&
														"bg-yellow-500/20 text-yellow-500"
												)}
											>
												{opp.issue}
											</span>
										</div>
										<div className="text-right">
											<p className="text-xs text-muted">
												Current Size
											</p>
											<p className="text-sm font-bold text-foreground">
												{formatBytes(opp.size)}
											</p>
										</div>
									</div>
									<p className="text-xs text-muted font-mono truncate mb-2">
										{opp.url}
									</p>
									<div className="flex items-center justify-between">
										<p className="text-xs text-accent">
											{opp.recommendation}
										</p>
										<p className="text-xs font-semibold text-green-500">
											Save ~
											{formatBytes(opp.potentialSaving)}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{imageData.potentialSavings > 0 && (
					<div className="mt-4 p-4 bg-accent/10 border border-accent/30 rounded-lg">
						<p className="text-sm text-foreground">
							<span className="font-semibold">
								Optimization Summary:
							</span>{" "}
							By optimizing images, you could reduce total image
							size by approximately{" "}
							{formatBytes(imageData.potentialSavings)} (
							{imageData.savingsPercentage}% reduction), improving
							page load performance significantly.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
