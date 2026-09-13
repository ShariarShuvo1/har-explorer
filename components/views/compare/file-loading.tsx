"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { useHarStore } from "@/lib/stores/har-store";
import { HARParseError, parseHARFile } from "@/lib/har-parser";
import { cn } from "@/lib/cn";
import { useCompareUiStore } from "./compare-ui-store";

const ACCEPTED_EXTENSIONS = /\.(har|json)$/i;

export interface ComparisonFileLoader {
	loadFile: (file: File | undefined) => Promise<void>;
	openPicker: () => void;
	isLoading: boolean;
	error: string | null;
	clearError: () => void;
	/** Hidden file input; render it once inside the view. */
	input: ReactNode;
}

export function useComparisonFileLoader(): ComparisonFileLoader {
	const setSecondaryHarData = useHarStore((s) => s.setSecondaryHarData);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requestId = useRef(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const loadFile = useCallback(
		async (file: File | undefined) => {
			if (!file) return;
			if (!ACCEPTED_EXTENSIONS.test(file.name)) {
				setError(`"${file.name}" is not a HAR file. Choose a .har (or .json) export.`);
				return;
			}

			const id = ++requestId.current;
			const baselineAtStart = useHarStore.getState().harData;
			setIsLoading(true);
			setError(null);
			try {
				const data = await parseHARFile(file);
				if (id !== requestId.current) return;
				// A different main file was opened while parsing; drop the result.
				if (useHarStore.getState().harData !== baselineAtStart) return;
				setSecondaryHarData(data, file.name);
				useCompareUiStore.getState().resetScroll();
			} catch (err) {
				if (id !== requestId.current) return;
				setError(
					err instanceof HARParseError
						? err.message
						: `Could not read the file${err instanceof Error ? `: ${err.message}` : "."}`
				);
			} finally {
				if (id === requestId.current) setIsLoading(false);
			}
		},
		[setSecondaryHarData]
	);

	const clearError = useCallback(() => setError(null), []);
	const openPicker = useCallback(() => inputRef.current?.click(), []);

	const input = (
		<input
			ref={inputRef}
			type="file"
			accept=".har,.json,application/json"
			className="hidden"
			aria-hidden="true"
			tabIndex={-1}
			onChange={(e) => {
				void loadFile(e.target.files?.[0]);
				// Allow picking the same file again after removing it.
				e.target.value = "";
			}}
		/>
	);

	return { loadFile, openPicker, isLoading, error, clearError, input };
}

export function useFileDrag(onFile: (file: File | undefined) => void) {
	const [isDragging, setIsDragging] = useState(false);

	const onDragEnter = useCallback((e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes("Files")) return;
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const onDragOver = useCallback((e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes("Files")) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	}, []);

	const onDragLeave = useCallback((e: React.DragEvent) => {
		const next = e.relatedTarget;
		if (next instanceof Node && e.currentTarget.contains(next)) return;
		setIsDragging(false);
	}, []);

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);
			onFile(e.dataTransfer.files[0]);
		},
		[onFile]
	);

	return {
		isDragging,
		handlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
	};
}

/** Lets a HAR file be dropped anywhere on the view. */
export function FileDropTarget({
	loader,
	label,
	className,
	children,
}: {
	loader: ComparisonFileLoader;
	label: string;
	className?: string;
	children: ReactNode;
}) {
	const { isDragging, handlers } = useFileDrag(loader.loadFile);
	return (
		<div {...handlers} className={cn("relative", className)}>
			{children}
			{isDragging && (
				<div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80">
					<span className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium text-primary shadow-xs">
						<Upload className="size-4" aria-hidden="true" />
						{label}
					</span>
				</div>
			)}
		</div>
	);
}
