import { formatBytes, getHeaderValue } from "@/lib/har-parser";
import type { PatternDetector } from "../types";
import { THRESHOLDS } from "../constants";
import { getRequestCookieBytes, plural } from "../utils";

function countCookies(cookies: number, cookieHeader: string | undefined): number {
	if (cookies > 0) return cookies;
	return cookieHeader ? cookieHeader.split(";").filter((c) => c.trim()).length : 0;
}

export const detectLargeCookies: PatternDetector = ({ entries }) => {
	const limit = THRESHOLDS.LARGE_COOKIE_KB * 1024;
	const large: Array<{ index: number; bytes: number; count: number }> = [];

	entries.forEach((entry, index) => {
		const bytes = getRequestCookieBytes(entry);
		if (bytes <= limit) return;
		large.push({
			index,
			bytes,
			count: countCookies(
				entry.request.cookies.length,
				getHeaderValue(entry.request.headers, "cookie")
			),
		});
	});
	if (large.length === 0) return null;

	large.sort((a, b) => b.bytes - a.bytes || a.index - b.index);
	const totalBytes = large.reduce((sum, item) => sum + item.bytes, 0);

	return {
		type: "large-cookies",
		severity: "medium",
		title: "Large Cookie Overhead",
		description: `${plural(large.length, "request")} sending more than ${THRESHOLDS.LARGE_COOKIE_KB} KB of cookies`,
		recommendation:
			"Reduce cookie size by removing unnecessary data, scoping cookies to the paths and domains that need them, or storing data server-side",
		impact: `${formatBytes(totalBytes)} of cookie data uploaded in request headers`,
		affected: large.map(({ index, bytes, count }) => ({
			index,
			details: `${formatBytes(bytes)} in ${plural(count, "cookie")}`,
		})),
	};
};
