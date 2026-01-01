import { HAREntry } from "@/lib/stores/har-store";
import { Pattern } from "../types";
import { THRESHOLDS } from "../constants";
import { getTimingPhase, formatDuration } from "../utils";

export function detectTimingAnomalies(entries: HAREntry[]): Pattern | null {
	const anomalies: Array<{
		index: number;
		url: string;
		phase: string;
		duration: number;
		details: string;
	}> = [];

	entries.forEach((entry, index) => {
		const dns = getTimingPhase(entry, "dns");
		const ssl = getTimingPhase(entry, "ssl");
		const wait = getTimingPhase(entry, "wait");

		if (dns > THRESHOLDS.DNS_SLOW_MS) {
			anomalies.push({
				index,
				url: entry.request.url,
				phase: "DNS",
				duration: dns,
				details: `Slow DNS lookup: ${formatDuration(dns)}`,
			});
		}

		if (ssl > THRESHOLDS.SSL_SLOW_MS) {
			anomalies.push({
				index,
				url: entry.request.url,
				phase: "SSL",
				duration: ssl,
				details: `Slow SSL handshake: ${formatDuration(ssl)}`,
			});
		}

		if (wait > THRESHOLDS.WAIT_SLOW_MS) {
			anomalies.push({
				index,
				url: entry.request.url,
				phase: "Wait",
				duration: wait,
				details: `Slow server response: ${formatDuration(wait)}`,
			});
		}
	});

	if (anomalies.length === 0) return null;

	const sortedByDuration = anomalies.sort((a, b) => b.duration - a.duration);

	const phaseGroups = {
		DNS: anomalies.filter((a) => a.phase === "DNS").length,
		SSL: anomalies.filter((a) => a.phase === "SSL").length,
		Wait: anomalies.filter((a) => a.phase === "Wait").length,
	};

	const hasSevereDNS = phaseGroups.DNS > 5;
	const hasSevereWait = phaseGroups.Wait > 3;

	return {
		type: "timing-anomalies",
		severity: hasSevereDNS || hasSevereWait ? "high" : "medium",
		title: "Timing Anomalies Detected",
		description: `${anomalies.length} requests with unusually slow timing phases`,
		count: anomalies.length,
		examples: sortedByDuration.slice(0, 5).map((a) => ({
			url: a.url,
			index: a.index,
			details: a.details,
		})),
		recommendation:
			"DNS issues: Use CDN or DNS prefetch. SSL: Enable session resumption. Wait: Optimize backend performance or use caching",
		impact: `DNS: ${phaseGroups.DNS}, SSL: ${phaseGroups.SSL}, Server Wait: ${phaseGroups.Wait} slow requests`,
		allAffectedIndices: sortedByDuration.map((a) => a.index),
	};
}
