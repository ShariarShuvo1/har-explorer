import { formatTime, nonNegative } from "@/lib/har-parser";
import type { PatternDetector } from "../types";
import { THRESHOLDS } from "../constants";
import { plural } from "../utils";

export const detectTimingAnomalies: PatternDetector = ({ entries }) => {
	const anomalies: Array<{ index: number; slowest: number; details: string }> = [];
	let slowDns = 0;
	let slowSsl = 0;
	let slowWait = 0;

	entries.forEach((entry, index) => {
		const dns = nonNegative(entry.timings.dns);
		const ssl = nonNegative(entry.timings.ssl);
		const wait = nonNegative(entry.timings.wait);
		const phases: string[] = [];

		if (dns > THRESHOLDS.DNS_SLOW_MS) {
			slowDns++;
			phases.push(`DNS lookup ${formatTime(dns)}`);
		}
		if (ssl > THRESHOLDS.SSL_SLOW_MS) {
			slowSsl++;
			phases.push(`TLS handshake ${formatTime(ssl)}`);
		}
		if (wait > THRESHOLDS.WAIT_SLOW_MS) {
			slowWait++;
			phases.push(`server response ${formatTime(wait)}`);
		}

		if (phases.length > 0) {
			anomalies.push({
				index,
				slowest: Math.max(dns, ssl, wait),
				details: `Slow ${phases.join(", ")}`,
			});
		}
	});
	if (anomalies.length === 0) return null;

	anomalies.sort((a, b) => b.slowest - a.slowest || a.index - b.index);

	const breakdown = [
		slowDns && plural(slowDns, "slow DNS lookup"),
		slowSsl && plural(slowSsl, "slow TLS handshake"),
		slowWait && plural(slowWait, "slow server response"),
	].filter(Boolean);

	return {
		type: "timing-anomalies",
		severity: slowDns > 5 || slowWait > 3 ? "high" : "medium",
		title: "Timing Anomalies",
		description: `${plural(anomalies.length, "request")} with unusually slow DNS, TLS or server response times`,
		recommendation:
			"DNS: use dns-prefetch/preconnect or a faster DNS provider. TLS: enable session resumption and TLS 1.3. Server wait: profile the backend and add caching",
		impact: breakdown.join(", "),
		affected: anomalies.map(({ index, details }) => ({ index, details })),
	};
};
