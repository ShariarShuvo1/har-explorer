import type { HAREntry, HARPage } from "@/lib/har-types";
import {
	getEntryStartTime,
	getEntryTransferSize,
	nonNegative,
	safeParseUrl,
} from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";

// Second-level labels that form a public suffix under a ccTLD (co.uk, com.au, ...).
const MULTI_PART_SLDS = new Set([
	"ac",
	"co",
	"com",
	"edu",
	"gob",
	"go",
	"gov",
	"ltd",
	"mil",
	"ne",
	"net",
	"nic",
	"or",
	"org",
	"plc",
	"sch",
]);

/** The site a hostname belongs to, e.g. "api.example.co.uk" -> "example.co.uk". */
export function getRegistrableDomain(hostname: string): string {
	const host = hostname.toLowerCase().replace(/\.$/, "");
	if (!host.includes(".") || host.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
		return host;
	}
	const labels = host.split(".");
	if (labels.length <= 2) return host;
	const tld = labels[labels.length - 1];
	const sld = labels[labels.length - 2];
	const take = tld.length === 2 && MULTI_PART_SLDS.has(sld) ? 3 : 2;
	return labels.slice(-take).join(".");
}

function getHostname(entry: HAREntry): string {
	const url = safeParseUrl(entry.request.url);
	return url && /^(https?|wss?):$/.test(url.protocol) ? url.hostname : "";
}

/**
 * The main site of the capture: the page URL recorded in `log.pages`, else the
 * earliest successful document request, else the most requested site.
 */
export function detectFirstPartySite(entries: HAREntry[], pages: HARPage[] | undefined): string {
	for (const page of pages ?? []) {
		const url = typeof page.title === "string" ? safeParseUrl(page.title) : null;
		if (url && /^https?:$/.test(url.protocol) && url.hostname) {
			return getRegistrableDomain(url.hostname);
		}
	}

	let bestDoc: { host: string; start: number; ok: boolean } | null = null;
	const siteCounts = new Map<string, number>();
	for (const entry of entries) {
		const host = getHostname(entry);
		if (!host) continue;
		const site = getRegistrableDomain(host);
		siteCounts.set(site, (siteCounts.get(site) ?? 0) + 1);

		if (getResourceType(entry) !== "doc") continue;
		const { status } = entry.response;
		const ok = status >= 200 && status < 300;
		const start = getEntryStartTime(entry) || Infinity;
		if (!bestDoc || (ok && !bestDoc.ok) || (ok === bestDoc.ok && start < bestDoc.start)) {
			bestDoc = { host, start, ok };
		}
	}
	if (bestDoc) return getRegistrableDomain(bestDoc.host);

	let topSite = "";
	let topCount = 0;
	siteCounts.forEach((count, site) => {
		if (count > topCount) {
			topSite = site;
			topCount = count;
		}
	});
	return topSite;
}

export type ThirdPartyCategory = "analytics" | "ads" | "fonts" | "social" | "cdn" | "other";

export const THIRD_PARTY_CATEGORY_LABELS: Record<ThirdPartyCategory, string> = {
	analytics: "Analytics",
	ads: "Ads",
	fonts: "Fonts",
	social: "Social",
	cdn: "CDN",
	other: "Other",
};

const PROVIDER_CATEGORIES: {
	name: Exclude<ThirdPartyCategory, "other">;
	domains: string[];
	keywords: string[];
}[] = [
	{
		name: "analytics",
		domains: [
			"google-analytics.com",
			"analytics.google.com",
			"googletagmanager.com",
			"segment.com",
			"segment.io",
			"mixpanel.com",
			"amplitude.com",
			"hotjar.com",
			"hotjar.io",
			"clarity.ms",
			"plausible.io",
			"heapanalytics.com",
			"fullstory.com",
			"newrelic.com",
			"nr-data.net",
			"sentry.io",
			"datadoghq.com",
			"cloudflareinsights.com",
			"posthog.com",
			"quantserve.com",
			"scorecardresearch.com",
			"chartbeat.com",
		],
		keywords: ["analytics", "tracker", "tracking", "telemetry", "metrics"],
	},
	{
		name: "ads",
		domains: [
			"doubleclick.net",
			"googlesyndication.com",
			"googleadservices.com",
			"adservice.google.com",
			"adnxs.com",
			"criteo.com",
			"criteo.net",
			"taboola.com",
			"outbrain.com",
			"amazon-adsystem.com",
			"adsrvr.org",
			"rubiconproject.com",
			"pubmatic.com",
			"moatads.com",
		],
		keywords: ["ads", "adserver", "adservice"],
	},
	{
		name: "fonts",
		domains: [
			"fonts.googleapis.com",
			"fonts.gstatic.com",
			"typekit.net",
			"fonts.bunny.net",
			"fontawesome.com",
		],
		keywords: ["fonts"],
	},
	{
		name: "social",
		domains: [
			"facebook.com",
			"facebook.net",
			"fbcdn.net",
			"twitter.com",
			"twimg.com",
			"x.com",
			"linkedin.com",
			"licdn.com",
			"instagram.com",
			"tiktok.com",
			"pinterest.com",
			"reddit.com",
			"redditstatic.com",
		],
		keywords: [],
	},
	{
		name: "cdn",
		domains: [
			"cloudfront.net",
			"fastly.net",
			"akamaihd.net",
			"akamaized.net",
			"edgekey.net",
			"jsdelivr.net",
			"unpkg.com",
			"cdnjs.cloudflare.com",
			"bootstrapcdn.com",
			"azureedge.net",
			"b-cdn.net",
			"gstatic.com",
			"ajax.googleapis.com",
			"code.jquery.com",
		],
		keywords: ["cdn"],
	},
];

export function categorizeHost(host: string): ThirdPartyCategory {
	const matchesDomain = (domain: string) => host === domain || host.endsWith(`.${domain}`);
	for (const category of PROVIDER_CATEGORIES) {
		if (category.domains.some(matchesDomain)) return category.name;
	}
	// Whole DNS label tokens only, so "roadservice" never matches "ads".
	const tokens = new Set(host.split(/[.-]/));
	for (const category of PROVIDER_CATEGORIES) {
		if (category.keywords.some((keyword) => tokens.has(keyword))) {
			return category.name;
		}
	}
	return "other";
}

export interface PartyStats {
	count: number;
	size: number;
	time: number;
	/** Combined duration of scripts and stylesheets, which can block rendering. */
	scriptTime: number;
}

const emptyStats = (): PartyStats => ({ count: 0, size: 0, time: 0, scriptTime: 0 });

export interface ThirdPartyDomain extends PartyStats {
	domain: string;
	category: ThirdPartyCategory;
}

export interface ThirdPartyAnalytics {
	firstPartySite: string;
	firstParty: PartyStats;
	thirdPartyTotal: PartyStats;
	thirdPartyDomainCount: number;
	distribution: { name: "First-party" | "Third-party"; value: number }[];
	/** Sorted by transfer size. */
	domains: ThirdPartyDomain[];
	/** Sorted by domain count, "other" last. */
	categories: {
		name: ThirdPartyCategory;
		domains: number;
		count: number;
		size: number;
	}[];
}

export function computeThirdParty(
	entries: HAREntry[],
	indices: number[],
	firstPartySite: string
): ThirdPartyAnalytics | null {
	if (!indices.length) return null;

	const firstParty = emptyStats();
	const thirdPartyHosts = new Map<string, PartyStats>();

	for (const index of indices) {
		const entry = entries[index];
		const host = getHostname(entry);
		// Inline data:/blob: URLs belong to the page itself.
		const isFirstParty = !host || getRegistrableDomain(host) === firstPartySite;

		let stats = firstParty;
		if (!isFirstParty) {
			stats = thirdPartyHosts.get(host) ?? emptyStats();
			thirdPartyHosts.set(host, stats);
		}

		const time = nonNegative(entry.time);
		stats.count++;
		stats.size += getEntryTransferSize(entry);
		stats.time += time;
		const type = getResourceType(entry);
		if (type === "js" || type === "css") stats.scriptTime += time;
	}

	const domains = Array.from(thirdPartyHosts, ([domain, stats]): ThirdPartyDomain => ({
		domain,
		category: categorizeHost(domain),
		...stats,
	})).sort((a, b) => b.size - a.size || b.count - a.count);

	const thirdPartyTotal = emptyStats();
	const categoryMap = new Map<
		ThirdPartyCategory,
		{ name: ThirdPartyCategory; domains: number; count: number; size: number }
	>();
	for (const domain of domains) {
		thirdPartyTotal.count += domain.count;
		thirdPartyTotal.size += domain.size;
		thirdPartyTotal.time += domain.time;
		thirdPartyTotal.scriptTime += domain.scriptTime;
		const category = categoryMap.get(domain.category) ?? {
			name: domain.category,
			domains: 0,
			count: 0,
			size: 0,
		};
		category.domains++;
		category.count += domain.count;
		category.size += domain.size;
		categoryMap.set(domain.category, category);
	}

	const distribution = (
		[
			{ name: "First-party", value: firstParty.count },
			{ name: "Third-party", value: thirdPartyTotal.count },
		] as const
	)
		.filter((slice) => slice.value > 0)
		.map((slice) => ({ ...slice }));

	const categories = Array.from(categoryMap.values()).sort((a, b) =>
		a.name === "other" ? 1 : b.name === "other" ? -1 : b.domains - a.domains
	);

	return {
		firstPartySite,
		firstParty,
		thirdPartyTotal,
		thirdPartyDomainCount: domains.length,
		distribution,
		domains,
		categories,
	};
}
