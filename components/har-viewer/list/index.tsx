"use client";

import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useHarStore, getResourceType } from "@/lib/stores/har-store";
import { HarListItem } from "./list-item";
import { cn } from "@/lib/cn";

export function HarList() {
	const {
		entries,
		searchText,
		sortBy,
		sortOrder,
		resourceTypeFilter,
		advancedFilters,
		bookmarks,
		showBookmarksOnly,
		setVisibleEntryIndices,
		selectAll,
		deselectAll,
		scrollToIndex,
		setScrollToIndex,
	} = useHarStore();
	const parentRef = useRef<HTMLDivElement>(null);

	const filteredAndSortedEntries = useMemo(() => {
		let filtered = entries.map((entry, originalIndex) => ({
			entry,
			originalIndex,
		}));

		if (showBookmarksOnly) {
			filtered = filtered.filter(({ originalIndex }) =>
				bookmarks.has(originalIndex)
			);
		}

		if (resourceTypeFilter !== "all") {
			filtered = filtered.filter(
				({ entry }) => getResourceType(entry) === resourceTypeFilter
			);
		}

		if (searchText) {
			const search = searchText.toLowerCase();
			filtered = filtered.filter(
				({ entry }) =>
					entry.request.url.toLowerCase().includes(search) ||
					entry.request.method.toLowerCase().includes(search) ||
					entry.response.status.toString().includes(search) ||
					entry.response.content.mimeType
						.toLowerCase()
						.includes(search)
			);
		}

		if (advancedFilters.statusCodes.length > 0) {
			filtered = filtered.filter(({ entry }) =>
				advancedFilters.statusCodes.includes(entry.response.status)
			);
		}

		if (advancedFilters.statusRanges.length > 0) {
			filtered = filtered.filter(({ entry }) =>
				advancedFilters.statusRanges.some(
					(range) =>
						entry.response.status >= range.min &&
						entry.response.status <= range.max
				)
			);
		}

		if (advancedFilters.methodFilters.length > 0) {
			filtered = filtered.filter(({ entry }) =>
				advancedFilters.methodFilters.includes(entry.request.method)
			);
		}

		if (advancedFilters.sizeMin !== null) {
			filtered = filtered.filter(
				({ entry }) =>
					entry.response.content.size >= advancedFilters.sizeMin!
			);
		}

		if (advancedFilters.sizeMax !== null) {
			filtered = filtered.filter(
				({ entry }) =>
					entry.response.content.size <= advancedFilters.sizeMax!
			);
		}

		if (advancedFilters.durationMin !== null) {
			filtered = filtered.filter(
				({ entry }) => entry.time >= advancedFilters.durationMin!
			);
		}

		if (advancedFilters.durationMax !== null) {
			filtered = filtered.filter(
				({ entry }) => entry.time <= advancedFilters.durationMax!
			);
		}

		if (advancedFilters.domainPattern) {
			const pattern = advancedFilters.domainPattern.toLowerCase();
			filtered = filtered.filter(({ entry }) => {
				try {
					const url = new URL(entry.request.url);
					return url.hostname.toLowerCase().includes(pattern);
				} catch {
					return false;
				}
			});
		}

		if (advancedFilters.pathPattern) {
			const pattern = advancedFilters.pathPattern.toLowerCase();
			filtered = filtered.filter(({ entry }) => {
				try {
					const url = new URL(entry.request.url);
					return url.pathname.toLowerCase().includes(pattern);
				} catch {
					return entry.request.url.toLowerCase().includes(pattern);
				}
			});
		}

		if (advancedFilters.headerMatches.length > 0) {
			filtered = filtered.filter(({ entry }) =>
				advancedFilters.headerMatches.every((headerMatch) => {
					const header = entry.request.headers.find(
						(h) =>
							h.name.toLowerCase() ===
							headerMatch.name.toLowerCase()
					);
					return (
						header &&
						header.value
							.toLowerCase()
							.includes(headerMatch.value.toLowerCase())
					);
				})
			);
		}

		if (advancedFilters.httpVersions.length > 0) {
			filtered = filtered.filter(({ entry }) =>
				advancedFilters.httpVersions.includes(entry.request.httpVersion)
			);
		}

		const sorted = [...filtered].sort((a, b) => {
			let aVal: string | number;
			let bVal: string | number;

			switch (sortBy) {
				case "time":
					aVal = a.entry.time;
					bVal = b.entry.time;
					break;
				case "size":
					aVal = a.entry.response.content.size;
					bVal = b.entry.response.content.size;
					break;
				case "status":
					aVal = a.entry.response.status;
					bVal = b.entry.response.status;
					break;
				case "method":
					aVal = a.entry.request.method;
					bVal = b.entry.request.method;
					break;
				case "url":
					aVal = a.entry.request.url;
					bVal = b.entry.request.url;
					break;
			}

			if (typeof aVal === "string" && typeof bVal === "string") {
				return sortOrder === "asc"
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}

			if (typeof aVal === "number" && typeof bVal === "number") {
				return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
			}

			return 0;
		});

		return sorted;
	}, [
		entries,
		searchText,
		sortBy,
		sortOrder,
		resourceTypeFilter,
		advancedFilters,
		bookmarks,
		showBookmarksOnly,
	]);

	useEffect(() => {
		setVisibleEntryIndices(
			filteredAndSortedEntries.map(({ originalIndex }) => originalIndex)
		);
	}, [filteredAndSortedEntries, setVisibleEntryIndices]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (!(event.ctrlKey || event.metaKey)) return;
			if (event.key.toLowerCase() !== "a") return;
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.tagName === "SELECT" ||
					target.isContentEditable)
			) {
				return;
			}

			event.preventDefault();
			const { visibleEntryIndices, selectedEntries } =
				useHarStore.getState();
			const totalVisible = visibleEntryIndices.length;
			const selectedVisible = visibleEntryIndices.filter((i) =>
				selectedEntries.has(i)
			).length;
			if (totalVisible > 0 && selectedVisible === totalVisible) {
				deselectAll();
				return;
			}
			selectAll();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectAll, deselectAll]);

	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: filteredAndSortedEntries.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 50,
		overscan: 5,
	});

	useEffect(() => {
		if (scrollToIndex === null) return;

		const targetPosition = filteredAndSortedEntries.findIndex(
			({ originalIndex }) => originalIndex === scrollToIndex
		);

		if (targetPosition >= 0) {
			virtualizer.scrollToIndex(targetPosition, {
				align: "center",
				behavior: "smooth",
			});
		}

		setScrollToIndex(null);
	}, [
		scrollToIndex,
		filteredAndSortedEntries,
		setScrollToIndex,
		virtualizer,
	]);

	return (
		<div ref={parentRef} className="flex-1 overflow-auto select-none">
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
				}}
				className="w-full relative pointer-events-none"
			>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const { entry, originalIndex } =
						filteredAndSortedEntries[virtualRow.index];
					const expandedEntry = useHarStore.getState().expandedEntry;
					return (
						<div
							key={originalIndex}
							className={cn(
								"absolute top-0 left-0 w-full pointer-events-auto",
								originalIndex === expandedEntry && "z-50"
							)}
							style={{
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							<HarListItem entry={entry} index={originalIndex} />
						</div>
					);
				})}
			</div>
		</div>
	);
}
