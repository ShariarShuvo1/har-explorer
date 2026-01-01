"use client";

import { useMemo } from "react";
import {
	PieChart,
	Pie,
	Cell,
	ResponsiveContainer,
	Tooltip,
	BarChart,
	Bar,
	XAxis,
	YAxis,
} from "recharts";
import { ExternalLink, Shield, AlertCircle } from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { formatBytes, formatTime, extractDomain } from "@/lib/har-parser";
import { getTooltipStyle } from "./custom-tooltip";

interface ThirdPartyImpactProps {
	entries: HAREntry[];
}

export function ThirdPartyImpact({ entries }: ThirdPartyImpactProps) {
	const thirdPartyData = useMemo(() => {
		if (!entries.length) return null;

		const domainFrequency = new Map<string, number>();
		entries.forEach((entry) => {
			const domain = extractDomain(entry.request.url);
			domainFrequency.set(domain, (domainFrequency.get(domain) || 0) + 1);
		});

		const sortedDomains = Array.from(domainFrequency.entries()).sort(
			(a, b) => b[1] - a[1]
		);
		const primaryDomain = sortedDomains[0]?.[0] || "";

		const partyMap = new Map<
			string,
			{
				count: number;
				size: number;
				time: number;
				blockingTime: number;
			}
		>();

		entries.forEach((entry) => {
			const domain = extractDomain(entry.request.url);
			const isFirstParty = domain === primaryDomain;
			const party = isFirstParty ? "first-party" : domain;

			const existing = partyMap.get(party) || {
				count: 0,
				size: 0,
				time: 0,
				blockingTime: 0,
			};

			existing.count++;
			existing.size += entry.response.content.size;
			existing.time += entry.time;

			const isBlocking =
				entry.response.content.mimeType.includes("javascript") ||
				entry.response.content.mimeType.includes("css");
			if (isBlocking && !isFirstParty) {
				existing.blockingTime += entry.time;
			}

			partyMap.set(party, existing);
		});

		const firstPartyData = partyMap.get("first-party") || {
			count: 0,
			size: 0,
			time: 0,
			blockingTime: 0,
		};

		partyMap.delete("first-party");

		const thirdPartyDomains = Array.from(partyMap.entries())
			.map(([domain, data]) => ({
				domain,
				...data,
				percentage: Math.round((data.count / entries.length) * 100),
			}))
			.sort((a, b) => b.size - a.size);

		const thirdPartyTotal = thirdPartyDomains.reduce(
			(acc, d) => ({
				count: acc.count + d.count,
				size: acc.size + d.size,
				time: acc.time + d.time,
				blockingTime: acc.blockingTime + d.blockingTime,
			}),
			{ count: 0, size: 0, time: 0, blockingTime: 0 }
		);

		const distribution = [
			{
				name: "First-Party",
				value: firstPartyData.count,
				size: firstPartyData.size,
				time: firstPartyData.time,
			},
			{
				name: "Third-Party",
				value: thirdPartyTotal.count,
				size: thirdPartyTotal.size,
				time: thirdPartyTotal.time,
			},
		];

		const topThirdParties = thirdPartyDomains.slice(0, 10);

		const categoryMap = new Map<string, Set<string>>();
		const knownProviders = {
			analytics: [
				"google-analytics",
				"googletagmanager",
				"analytics",
				"segment",
				"mixpanel",
				"amplitude",
			],
			ads: [
				"doubleclick",
				"adsense",
				"googlesyndication",
				"advertising",
				"adservice",
			],
			cdn: ["cloudflare", "fastly", "cloudfront", "akamai", "cdn"],
			social: ["facebook", "twitter", "linkedin", "instagram"],
		};

		thirdPartyDomains.forEach(({ domain }) => {
			let categorized = false;
			for (const [category, keywords] of Object.entries(knownProviders)) {
				if (
					keywords.some((keyword) =>
						domain.toLowerCase().includes(keyword)
					)
				) {
					if (!categoryMap.has(category)) {
						categoryMap.set(category, new Set());
					}
					categoryMap.get(category)!.add(domain);
					categorized = true;
					break;
				}
			}
			if (!categorized) {
				if (!categoryMap.has("other")) {
					categoryMap.set("other", new Set());
				}
				categoryMap.get("other")!.add(domain);
			}
		});

		const categories = Array.from(categoryMap.entries()).map(
			([name, domains]) => ({
				name,
				count: domains.size,
			})
		);

		return {
			primaryDomain,
			firstPartyData,
			thirdPartyTotal,
			distribution,
			topThirdParties,
			categories,
			hasThirdParty: thirdPartyTotal.count > 0,
		};
	}, [entries]);

	if (!thirdPartyData) {
		return null;
	}

	const COLORS = ["#00ffff", "#ff00ff"];
	const BAR_COLORS = [
		"#00ffff",
		"#ff00ff",
		"#00ff88",
		"#ffaa00",
		"#ff5555",
		"#5555ff",
		"#55ff55",
		"#ff55ff",
		"#55ffff",
		"#ffff55",
	];
	const tooltipStyle = getTooltipStyle();

	return (
		<div className="space-y-6">
			<div>
				<div className="flex items-center gap-2 mb-4">
					<ExternalLink className="w-5 h-5 text-accent" />
					<h3 className="text-xl font-semibold text-foreground">
						Third-Party Resource Impact
					</h3>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<div className="flex items-center gap-3 mb-3">
							<div className="p-2 bg-primary/20 rounded">
								<Shield className="w-5 h-5 text-primary" />
							</div>
							<div>
								<p className="text-xs text-muted">
									First-Party
								</p>
								<p className="text-sm font-mono text-muted truncate max-w-50">
									{thirdPartyData.primaryDomain}
								</p>
							</div>
						</div>
						<div className="space-y-2">
							<div className="flex justify-between">
								<span className="text-xs text-muted">
									Requests
								</span>
								<span className="text-sm font-bold text-foreground">
									{thirdPartyData.firstPartyData.count}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-xs text-muted">Size</span>
								<span className="text-sm font-bold text-foreground">
									{formatBytes(
										thirdPartyData.firstPartyData.size
									)}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-xs text-muted">
									Total Time
								</span>
								<span className="text-sm font-bold text-foreground">
									{formatTime(
										thirdPartyData.firstPartyData.time
									)}
								</span>
							</div>
						</div>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<div className="flex items-center gap-3 mb-3">
							<div className="p-2 bg-secondary/20 rounded">
								<ExternalLink className="w-5 h-5 text-secondary" />
							</div>
							<div>
								<p className="text-xs text-muted">
									Third-Party
								</p>
								<p className="text-sm font-semibold text-foreground">
									{thirdPartyData.topThirdParties.length}{" "}
									domains
								</p>
							</div>
						</div>
						<div className="space-y-2">
							<div className="flex justify-between">
								<span className="text-xs text-muted">
									Requests
								</span>
								<span className="text-sm font-bold text-foreground">
									{thirdPartyData.thirdPartyTotal.count}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-xs text-muted">Size</span>
								<span className="text-sm font-bold text-foreground">
									{formatBytes(
										thirdPartyData.thirdPartyTotal.size
									)}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-xs text-muted">
									Blocking Time
								</span>
								<span className="text-sm font-bold text-red-500">
									{formatTime(
										thirdPartyData.thirdPartyTotal
											.blockingTime
									)}
								</span>
							</div>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-4">
							Request Distribution
						</h4>
						<ResponsiveContainer width="100%" height={250}>
							<PieChart>
								<Pie
									data={thirdPartyData.distribution}
									dataKey="value"
									nameKey="name"
									cx="50%"
									cy="50%"
									outerRadius={80}
									label={({ name, value }) =>
										`${name}: ${value}`
									}
								>
									{thirdPartyData.distribution.map(
										(_, index) => (
											<Cell
												key={`cell-${index}`}
												fill={COLORS[index]}
											/>
										)
									)}
								</Pie>
								<Tooltip {...tooltipStyle} />
							</PieChart>
						</ResponsiveContainer>
					</div>

					<div className="p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-4">
							Top Third-Party Domains by Size
						</h4>
						<ResponsiveContainer width="100%" height={250}>
							<BarChart
								data={thirdPartyData.topThirdParties.slice(
									0,
									5
								)}
								layout="vertical"
							>
								<XAxis
									type="number"
									tick={{
										fill: "var(--muted)",
										fontSize: 10,
									}}
								/>
								<YAxis
									type="category"
									dataKey="domain"
									width={120}
									tick={{
										fill: "var(--foreground)",
										fontSize: 10,
									}}
								/>
								<Tooltip {...tooltipStyle} />
								<Bar
									dataKey="size"
									fill="#ff00ff"
									radius={[0, 4, 4, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>

				{thirdPartyData.categories.length > 0 && (
					<div className="mt-6 p-4 bg-card/40 border border-border rounded-lg">
						<h4 className="text-sm font-semibold text-foreground mb-3">
							Third-Party Categories
						</h4>
						<div className="flex flex-wrap gap-3">
							{thirdPartyData.categories.map((cat, index) => (
								<div
									key={cat.name}
									className="px-3 py-2 rounded-lg border"
									style={{
										backgroundColor: `${
											BAR_COLORS[
												index % BAR_COLORS.length
											]
										}20`,
										borderColor: `${
											BAR_COLORS[
												index % BAR_COLORS.length
											]
										}50`,
									}}
								>
									<span className="text-xs font-semibold text-foreground capitalize">
										{cat.name}
									</span>
									<span className="ml-2 text-xs text-muted">
										({cat.count})
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{thirdPartyData.thirdPartyTotal.blockingTime > 1000 && (
					<div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
						<div className="flex items-start gap-2">
							<AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
							<div>
								<p className="text-sm font-semibold text-foreground">
									Performance Impact Warning
								</p>
								<p className="text-sm text-foreground mt-1">
									Third-party resources are adding{" "}
									{formatTime(
										thirdPartyData.thirdPartyTotal
											.blockingTime
									)}{" "}
									of blocking time. Consider async loading,
									defer attributes, or evaluating the
									necessity of these resources.
								</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
