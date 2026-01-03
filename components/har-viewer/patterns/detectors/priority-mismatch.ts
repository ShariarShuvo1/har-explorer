import { HAREntry } from "@/lib/stores/har-store";
import { Pattern } from "../types";
import { getResourceType } from "../utils";

export function detectPriorityMismatches(entries: HAREntry[]): Pattern | null {
	const mismatches = entries
		.map((entry, index) => {
			const priority = (entry as unknown as Record<string, unknown>)
				._priority as string | undefined;
			if (!priority) return null;

			const resourceType = getResourceType(entry);
			const size = entry.response.content.size || 0;

			const isCritical = ["stylesheet", "font", "script"].includes(
				resourceType
			);
			const isLargeImage = resourceType === "image" && size > 100 * 1024;

			if (isCritical && priority.toLowerCase() === "low") {
				return {
					index,
					url: entry.request.url,
					type: "critical-low-priority",
					resourceType,
					priority,
					details: `Critical ${resourceType} with low priority`,
				};
			}

			if (isLargeImage && priority.toLowerCase() === "high") {
				return {
					index,
					url: entry.request.url,
					type: "large-image-high-priority",
					resourceType,
					priority,
					size,
					details: `Large image (${Math.round(
						size / 1024
					)}KB) with high priority`,
				};
			}

			return null;
		})
		.filter(Boolean) as Array<{
		index: number;
		url: string;
		type: string;
		resourceType: string;
		priority: string;
		size?: number;
		details: string;
	}>;

	if (mismatches.length === 0) return null;

	const criticalLowPriority = mismatches.filter(
		(m) => m.type === "critical-low-priority"
	);

	const hasCriticalIssues = criticalLowPriority.length > 0;

	return {
		type: "priority-mismatch",
		severity: hasCriticalIssues ? "high" : "medium",
		title: "Resource Priority Mismatches",
		description: `${mismatches.length} resources with suboptimal loading priorities`,
		count: mismatches.length,
		examples: mismatches.slice(0, 5).map((m) => ({
			url: m.url,
			index: m.index,
			details: m.details,
		})),
		recommendation:
			"Adjust resource priorities using <link rel='preload'> for critical resources or fetchpriority attribute",
		impact: hasCriticalIssues
			? "Render-blocking resources delayed, affecting page load performance"
			: "Suboptimal loading order may impact perceived performance",
		allAffectedIndices: mismatches.map((m) => m.index),
	};
}
