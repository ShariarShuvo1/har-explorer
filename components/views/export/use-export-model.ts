"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { copyText } from "@/components/common/copy-button";
import { useHarStore } from "@/lib/stores/har-store";
import { useFilteredEntryIndices } from "@/lib/hooks/use-filtered-entries";
import type { HAREntry } from "@/lib/har-types";
import { analyzeEndpoints, getEndpointHostLabel, type ApiEndpoint } from "@/lib/api-docs/endpoints";
import { buildOpenApiDocument, getOpenApiStats } from "@/lib/api-docs/openapi";
import { buildHarExport, estimateHarSize, serializeHar } from "@/lib/api-docs/har-export";
import { compareMethods } from "@/lib/api-docs/http";
import { getUrlParts } from "@/lib/api-docs/path-template";
import { downloadTextFile, getHarFileStem, todayStamp } from "@/lib/api-docs/download";
import {
	DEFAULT_OPTIONS,
	FORMAT_BY_ID,
	MAX_HAR_COPY,
	MAX_HAR_FULL_PREVIEW,
	MAX_HAR_PREVIEW,
} from "./constants";
import { generateMarkdown, generatePlainText } from "./generate-docs";
import type { ExportOptions, ExportScope } from "./types";

function sortedIndices(indices: Iterable<number>, count: number): number[] {
	return [...indices].filter((i) => i >= 0 && i < count).sort((a, b) => a - b);
}

/** Leading entries whose serialized size roughly fits in `limit` bytes (at least one). */
function sampleEntries(entries: HAREntry[], limit: number): HAREntry[] {
	const sample: HAREntry[] = [];
	let bytes = 0;
	for (const entry of entries) {
		const size = estimateHarSize([entry]);
		if (sample.length > 0 && bytes + size > limit) break;
		sample.push(entry);
		bytes += size;
	}
	return sample;
}

function utf8Size(text: string): number {
	return new Blob([text]).size;
}

export function useExportModel() {
	const { entries, harData, fileName, selectedEntries, bookmarks } = useHarStore(
		useShallow((s) => ({
			entries: s.entries,
			harData: s.harData,
			fileName: s.fileName,
			selectedEntries: s.selectedEntries,
			bookmarks: s.bookmarks,
		}))
	);
	const filteredIndices = useFilteredEntryIndices();

	const [options, setOptions] = useState<ExportOptions>(() => {
		const state = useHarStore.getState();
		// Read only; the effect below consumes it after mount.
		const pending = state.pendingExportScope;
		return {
			...DEFAULT_OPTIONS,
			scope: pending ?? (state.selectedEntries.size > 0 ? "selected" : "filtered"),
		};
	});
	const [hiddenEndpoints, setHiddenEndpoints] = useState<Set<string>>(() => new Set());
	const [deduplicateEndpoints, setDeduplicateEndpoints] = useState(true);

	useEffect(() => {
		// Another view may request a scope while this one stays mounted.
		const apply = () => {
			const state = useHarStore.getState();
			if (state.pendingExportScope === null) return;
			const scope = state.consumePendingExportScope();
			if (scope) setOptions((prev) => ({ ...prev, scope }));
		};
		apply();
		return useHarStore.subscribe(apply);
	}, []);

	const scopeCounts: Record<ExportScope, number> = {
		selected: selectedEntries.size,
		filtered: filteredIndices.length,
		all: entries.length,
		bookmarked: bookmarks.size,
	};
	const scopeOrder: ExportScope[] =
		selectedEntries.size > 0
			? ["selected", "filtered", "all", "bookmarked"]
			: ["filtered", "selected", "all", "bookmarked"];

	const scopeIndices = useMemo(() => {
		switch (options.scope) {
			case "selected":
				return sortedIndices(selectedEntries, entries.length);
			case "filtered":
				return filteredIndices;
			case "bookmarked":
				return sortedIndices(bookmarks.keys(), entries.length);
			case "all":
			default:
				return entries.map((_, i) => i);
		}
	}, [options.scope, selectedEntries, filteredIndices, bookmarks, entries]);

	const scopedEntries = useMemo(
		() => scopeIndices.map((i) => entries[i]).filter(Boolean),
		[scopeIndices, entries]
	);

	// Analysis and generation can take a while on large files; deferring keeps
	// the controls responsive and lets us show a pending indicator.
	const deferredEntries = useDeferredValue(scopedEntries);
	const deferredOptions = useDeferredValue(options);
	const deferredHidden = useDeferredValue(hiddenEndpoints);
	const deferredDedupe = useDeferredValue(deduplicateEndpoints);
	const isPending =
		deferredEntries !== scopedEntries ||
		deferredOptions !== options ||
		deferredHidden !== hiddenEndpoints ||
		deferredDedupe !== deduplicateEndpoints;

	const format = deferredOptions.format;
	// An OpenAPI document cannot list the same operation twice.
	const dedupe = format === "openapi" || deferredDedupe;

	const endpoints = useMemo(
		() => (format === "har" ? [] : analyzeEndpoints(deferredEntries, { dedupe })),
		[deferredEntries, format, dedupe]
	);

	const visibleEndpoints = useMemo(
		() => endpoints.filter((endpoint) => !deferredHidden.has(endpoint.key)),
		[endpoints, deferredHidden]
	);

	const openApiDocument = useMemo(() => {
		if (format !== "openapi" || visibleEndpoints.length === 0) return null;
		return buildOpenApiDocument(
			visibleEndpoints.flatMap((endpoint) => endpoint.entries),
			{ redact: deferredOptions.redactSecrets }
		);
	}, [format, visibleEndpoints, deferredOptions.redactSecrets]);

	const generatedContent = useMemo(() => {
		if (format === "openapi") {
			return openApiDocument ? JSON.stringify(openApiDocument, null, 2) : "";
		}
		if (format === "har" || visibleEndpoints.length === 0) return "";
		const meta = { dedupe, sourceName: fileName };
		return format === "markdown"
			? generateMarkdown(visibleEndpoints, deferredOptions, meta)
			: generatePlainText(visibleEndpoints, deferredOptions, meta);
	}, [format, openApiDocument, visibleEndpoints, deferredOptions, dedupe, fileName]);

	const contentSize = useMemo(() => utf8Size(generatedContent), [generatedContent]);

	const openApiStats = useMemo(
		() => (openApiDocument ? getOpenApiStats(openApiDocument) : null),
		[openApiDocument]
	);

	const docStats = useMemo(() => {
		if (format !== "markdown" && format !== "txt") return null;
		return {
			items: visibleEndpoints.length,
			calls: visibleEndpoints.reduce((sum, endpoint) => sum + endpoint.totalCalls, 0),
			hosts: new Set(visibleEndpoints.map(getEndpointHostLabel)).size,
		};
	}, [format, visibleEndpoints]);

	const harStats = useMemo(() => {
		if (format !== "har") return null;
		const hosts = new Set<string>();
		const methods = new Set<string>();
		for (const entry of deferredEntries) {
			const { host } = getUrlParts(entry.request.url);
			if (host) hosts.add(host);
			methods.add(entry.request.method);
		}
		return {
			entries: deferredEntries.length,
			size: estimateHarSize(deferredEntries),
			hosts: [...hosts].sort(),
			methods: [...methods].sort(compareMethods),
		};
	}, [format, deferredEntries]);

	// Identifies the current output so "Show full preview" resets when it changes.
	const previewToken = useMemo(
		() => ({ deferredEntries, deferredOptions, deferredHidden, deferredDedupe }),
		[deferredEntries, deferredOptions, deferredHidden, deferredDedupe]
	);
	const [fullPreviewFor, setFullPreviewFor] = useState<object | null>(null);
	const showFullPreview = fullPreviewFor === previewToken;
	const requestFullPreview = useCallback(() => setFullPreviewFor(previewToken), [previewToken]);

	const harPreview = useMemo(() => {
		if (format !== "har" || !harStats || deferredEntries.length === 0) return null;
		const full = showFullPreview && harStats.size <= MAX_HAR_FULL_PREVIEW;
		const shown =
			full || harStats.size <= MAX_HAR_PREVIEW
				? deferredEntries
				: sampleEntries(deferredEntries, MAX_HAR_PREVIEW);
		return {
			text: serializeHar(buildHarExport(harData, shown, { redact: deferredOptions.redactSecrets })),
			shownEntries: shown.length,
			canShowFull: harStats.size <= MAX_HAR_FULL_PREVIEW,
		};
	}, [format, harStats, deferredEntries, showFullPreview, harData, deferredOptions.redactSecrets]);

	const activeFormat = FORMAT_BY_ID[options.format];
	const canDownload =
		!isPending && (options.format === "har" ? scopedEntries.length > 0 : generatedContent !== "");
	const canCopy =
		!isPending &&
		(options.format === "har"
			? scopedEntries.length > 0 && (harStats?.size ?? Infinity) <= MAX_HAR_COPY
			: generatedContent !== "");

	const buildHarText = () =>
		serializeHar(buildHarExport(harData, scopedEntries, { redact: options.redactSecrets }));

	const download = () => {
		if (!canDownload) return;
		const name = `${getHarFileStem(fileName)}-${activeFormat.fileSuffix}-${todayStamp()}${activeFormat.extension}`;
		try {
			const content = options.format === "har" ? buildHarText() : generatedContent;
			downloadTextFile(content, name, activeFormat.mimeType);
			toast.success(`Downloaded ${name}`);
		} catch (error) {
			console.error("Export failed:", error);
			toast.error("Couldn't create the export file");
		}
	};

	const copy = () => {
		if (!canCopy) return;
		try {
			const content = options.format === "har" ? buildHarText() : generatedContent;
			void copyText(content, `${activeFormat.label} copied to clipboard`);
		} catch (error) {
			console.error("Export failed:", error);
			toast.error("Couldn't copy the export");
		}
	};

	const updateOption = useCallback(
		<K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => {
			setOptions((prev) => ({ ...prev, [key]: value }));
		},
		[]
	);

	const toggleEndpoint = useCallback((endpoint: ApiEndpoint) => {
		setHiddenEndpoints((prev) => {
			const next = new Set(prev);
			if (next.has(endpoint.key)) next.delete(endpoint.key);
			else next.add(endpoint.key);
			return next;
		});
	}, []);

	const setEndpointsIncluded = useCallback((keys: string[], included: boolean) => {
		setHiddenEndpoints((prev) => {
			const next = new Set(prev);
			for (const key of keys) {
				if (included) next.delete(key);
				else next.add(key);
			}
			return next;
		});
	}, []);

	const includeAllEndpoints = useCallback(() => setHiddenEndpoints(new Set()), []);

	return {
		options,
		updateOption,
		scopeCounts,
		scopeOrder,
		scopedEntries,
		isPending,
		format,
		dedupe,
		deduplicateEndpoints,
		setDeduplicateEndpoints,
		endpoints,
		visibleEndpoints,
		hiddenEndpoints,
		toggleEndpoint,
		setEndpointsIncluded,
		includeAllEndpoints,
		generatedContent,
		contentSize,
		openApiStats,
		docStats,
		harStats,
		harPreview,
		showFullPreview,
		requestFullPreview,
		activeFormat,
		canDownload,
		canCopy,
		download,
		copy,
	};
}

export type ExportModel = ReturnType<typeof useExportModel>;
