import { HAREntry } from "@/lib/stores/har-store";
import { Pattern } from "../types";
import { THRESHOLDS } from "../constants";
import { getCookieSize, extractDomain } from "../utils";

export function detectLargeCookies(entries: HAREntry[]): Pattern | null {
	const largeCookieRequests = entries
		.map((entry, index) => {
			const cookieSize = getCookieSize(entry);
			const cookieSizeKB = cookieSize / 1024;

			if (cookieSizeKB > THRESHOLDS.LARGE_COOKIE_KB) {
				return {
					index,
					url: entry.request.url,
					cookieSize,
					cookieSizeKB,
					domain: extractDomain(entry.request.url),
					cookieCount: entry.request.cookies.length,
				};
			}
			return null;
		})
		.filter(Boolean) as Array<{
		index: number;
		url: string;
		cookieSize: number;
		cookieSizeKB: number;
		domain: string;
		cookieCount: number;
	}>;

	if (largeCookieRequests.length === 0) return null;

	const sortedByCookieSize = largeCookieRequests.sort(
		(a, b) => b.cookieSize - a.cookieSize
	);
	const totalWastedBytes = largeCookieRequests.reduce(
		(sum, r) => sum + r.cookieSize,
		0
	);
	const totalWastedKB = totalWastedBytes / 1024;

	return {
		type: "large-cookies",
		severity: "medium",
		title: "Large Cookie Overhead",
		description: `${largeCookieRequests.length} requests with cookies >${THRESHOLDS.LARGE_COOKIE_KB}KB`,
		count: largeCookieRequests.length,
		examples: sortedByCookieSize.slice(0, 5).map((r) => ({
			url: r.url,
			index: r.index,
			details: `${r.cookieSizeKB.toFixed(2)}KB (${
				r.cookieCount
			} cookies)`,
		})),
		recommendation:
			"Reduce cookie size by removing unnecessary data, using shorter cookie names, or storing data server-side",
		impact: `${totalWastedKB.toFixed(2)}KB wasted on cookie transmission`,
		allAffectedIndices: sortedByCookieSize.map((r) => r.index),
	};
}
