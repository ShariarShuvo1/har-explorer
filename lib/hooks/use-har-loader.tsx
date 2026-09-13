"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, ReactNode } from "react";
import { toast } from "sonner";
import { useHarStore } from "@/lib/stores/har-store";
import type { HARData } from "@/lib/har-types";
import { HARParseError, parseHARFile, parseHARText } from "@/lib/har-parser";

export const SAMPLE_HAR_URL = "/samples/example.har";
export const SAMPLE_HAR_NAME = "example.har";
export const PASTED_HAR_NAME = "pasted.har";
export const ACCEPTED_EXTENSIONS = [".har", ".json"];
export const ACCEPT_ATTRIBUTE = ".har,.json,application/json";

export type HarDragIssue = "multiple" | "type" | null;

export interface HarLoadingState {
	fileName: string;
	/** Bytes; 0 when unknown (e.g. the sample before it downloads). */
	size: number;
}

export interface HarLoader {
	loadFile: (file: File) => Promise<boolean>;
	/** Validates that exactly one .har/.json file was given, then loads it. */
	loadFiles: (files: FileList | File[]) => Promise<boolean>;
	loadSample: () => Promise<boolean>;
	/** Parses synchronously; use `loadPastedText` to show the overlay first. */
	loadText: (text: string, fileName?: string) => boolean;
	/** Loads clipboard text with the loading overlay and paste-specific messages. */
	loadPastedText: (text: string) => Promise<boolean>;
	openFilePicker: () => void;
	/** Hidden <input type="file">; render it once where the hook is used. */
	fileInput: ReactNode;
	loading: HarLoadingState | null;
	error: string | null;
	clearError: () => void;
	/** True while a load is running (readable from event handlers). */
	isBusy: () => boolean;
}

/** An error whose message is safe and meaningful to show to the user. */
class LoadError extends Error {}

function hasAcceptedExtension(name: string): boolean {
	const lower = name.toLowerCase();
	return ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function isFileDrag(dataTransfer: DataTransfer | null): boolean {
	return Array.from(dataTransfer?.types ?? []).includes("Files");
}

// File names are hidden until drop, so only MIME types that are clearly not
// HAR/JSON are flagged early. Unknown ("") types are common for .har files.
export function getDragIssue(dataTransfer: DataTransfer | null): HarDragIssue {
	const items = Array.from(dataTransfer?.items ?? []).filter((item) => item.kind === "file");
	if (items.length > 1) return "multiple";
	const unsupported = items.some(
		(item) =>
			item.type !== "" &&
			item.type !== "text/plain" &&
			!item.type.includes("json") &&
			!item.type.includes("har")
	);
	return unsupported ? "type" : null;
}

function selectSingleFile(
	files: ArrayLike<File> | null
): { file: File; error?: undefined } | { file?: undefined; error: string } {
	const list = Array.from(files ?? []);
	if (list.length === 0) {
		return { error: "No file was received. Please try again." };
	}
	if (list.length > 1) {
		return {
			error: `${list.length} files were dropped. Please open one HAR file at a time.`,
		};
	}
	const [file] = list;
	if (!hasAcceptedExtension(file.name)) {
		return {
			error: `"${file.name}" is not a HAR file. Choose a .har file, or a .json file that contains HAR data.`,
		};
	}
	return { file };
}

function describeError(error: unknown, fallback: string): string {
	if (error instanceof HARParseError || error instanceof LoadError) {
		return error.message;
	}
	if (error instanceof RangeError) {
		return "This file is too large to load in this browser tab.";
	}
	if (error instanceof DOMException && error.name === "NotReadableError") {
		return "The file could not be read. It may have been moved, deleted or locked by another program.";
	}
	return fallback;
}

/** Lets the loading overlay paint before JSON parsing blocks the main thread. */
function waitForPaint(): Promise<void> {
	// Background tabs pause requestAnimationFrame, so fall back to a timer or
	// the load would stall until the tab becomes visible again.
	return new Promise((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			resolve();
		};
		requestAnimationFrame(() => setTimeout(finish, 0));
		setTimeout(finish, 100);
	});
}

function isEditableTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			target.closest("input, textarea, select, [contenteditable]") !== null)
	);
}

function parsePasted(text: string): HARData {
	const trimmed = text.trim();
	if (!trimmed.startsWith("{")) {
		throw new LoadError(
			"The pasted text is not HAR JSON. Copy the full contents of a .har file and paste again."
		);
	}
	try {
		return parseHARText(trimmed);
	} catch (err) {
		if (err instanceof HARParseError) {
			throw new LoadError(err.message.replace(/^The file /, "The pasted text "));
		}
		throw err;
	}
}

export function useHarLoader(options?: {
	onLoaded?: (fileName: string) => void;
	/** Set to false when the caller renders `error` inline, to avoid showing it twice. */
	toastErrors?: boolean;
}): HarLoader {
	const [loading, setLoading] = useState<HarLoadingState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const busyRef = useRef(false);
	const onLoadedRef = useRef(options?.onLoaded);
	const toastErrorsRef = useRef(options?.toastErrors ?? true);

	useEffect(() => {
		onLoadedRef.current = options?.onLoaded;
		toastErrorsRef.current = options?.toastErrors ?? true;
	});

	const fail = useCallback((message: string) => {
		setError(message);
		if (toastErrorsRef.current) toast.error(message);
		return false;
	}, []);

	const succeed = useCallback((data: HARData, fileName: string) => {
		useHarStore.getState().setHarData(data, fileName);
		setError(null);
		onLoadedRef.current?.(fileName);
		return true;
	}, []);

	const runLoad = useCallback(
		async (
			initial: HarLoadingState,
			load: () => Promise<{ data: HARData; fileName: string }>,
			fallbackError: string
		): Promise<boolean> => {
			if (busyRef.current) return false;
			busyRef.current = true;
			setError(null);
			setLoading(initial);
			try {
				await waitForPaint();
				const { data, fileName } = await load();
				return succeed(data, fileName);
			} catch (err) {
				return fail(describeError(err, fallbackError));
			} finally {
				busyRef.current = false;
				setLoading(null);
			}
		},
		[fail, succeed]
	);

	const loadFile = useCallback(
		(file: File) =>
			runLoad(
				{ fileName: file.name, size: file.size },
				async () => ({ data: await parseHARFile(file), fileName: file.name }),
				"The file could not be opened as a HAR file."
			),
		[runLoad]
	);

	const loadFiles = useCallback(
		async (files: FileList | File[]) => {
			if (busyRef.current) return false;
			const selection = selectSingleFile(files);
			if (!selection.file) return fail(selection.error);
			return loadFile(selection.file);
		},
		[fail, loadFile]
	);

	const loadSample = useCallback(
		() =>
			runLoad(
				{ fileName: SAMPLE_HAR_NAME, size: 0 },
				async () => {
					const response = await fetch(SAMPLE_HAR_URL).catch(() => {
						throw new LoadError(
							"Could not download the sample HAR. Check your connection and try again."
						);
					});
					if (!response.ok) {
						throw new LoadError(`Could not download the sample HAR (HTTP ${response.status}).`);
					}
					return {
						data: parseHARText(await response.text()),
						fileName: SAMPLE_HAR_NAME,
					};
				},
				"The sample HAR could not be loaded."
			),
		[runLoad]
	);

	const loadText = useCallback(
		(text: string, fileName: string = PASTED_HAR_NAME) => {
			if (busyRef.current) return false;
			try {
				return succeed(parsePasted(text), fileName);
			} catch (err) {
				return fail(describeError(err, "The pasted text could not be opened as HAR data."));
			}
		},
		[fail, succeed]
	);

	const loadPastedText = useCallback(
		(text: string) =>
			runLoad(
				{ fileName: PASTED_HAR_NAME, size: text.length },
				async () => ({
					data: parsePasted(text),
					fileName: PASTED_HAR_NAME,
				}),
				"The pasted text could not be opened as HAR data."
			),
		[runLoad]
	);

	const openFilePicker = useCallback(() => {
		if (busyRef.current) return;
		inputRef.current?.click();
	}, []);

	const clearError = useCallback(() => setError(null), []);
	const isBusy = useCallback(() => busyRef.current, []);

	const fileInput = useMemo(
		() => (
			<input
				ref={inputRef}
				type="file"
				accept={ACCEPT_ATTRIBUTE}
				className="hidden"
				tabIndex={-1}
				aria-hidden="true"
				onChange={(event) => {
					const files = Array.from(event.target.files ?? []);
					// Clearing the value lets the same file be picked again after an error.
					event.target.value = "";
					if (files.length > 0) void loadFiles(files);
				}}
			/>
		),
		[loadFiles]
	);

	return useMemo(
		() => ({
			loadFile,
			loadFiles,
			loadSample,
			loadText,
			loadPastedText,
			openFilePicker,
			fileInput,
			loading,
			error,
			clearError,
			isBusy,
		}),
		[
			loadFile,
			loadFiles,
			loadSample,
			loadText,
			loadPastedText,
			openFilePicker,
			fileInput,
			loading,
			error,
			clearError,
			isBusy,
		]
	);
}

/**
 * Makes an element (spread `dropProps` on it) a HAR drop target. While mounted,
 * file drops elsewhere on the window are swallowed so the browser does not
 * navigate away to the dropped file; `enabled` only controls whether drops on
 * the target are accepted. `onFiles` replaces the default `loader.loadFiles`.
 */
export function useHarDropTarget(
	loader: HarLoader,
	{ enabled = true, onFiles }: { enabled?: boolean; onFiles?: (files: File[]) => void } = {}
) {
	const [dragging, setDragging] = useState(false);
	const [dragIssue, setDragIssue] = useState<HarDragIssue>(null);
	const depthRef = useRef(0);
	const onFilesRef = useRef(onFiles);

	useEffect(() => {
		onFilesRef.current = onFiles;
	});

	useEffect(() => {
		const prevent = (event: DragEvent) => {
			if (!isFileDrag(event.dataTransfer) || event.defaultPrevented) return;
			// Reached only when no drop target handled the event first.
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
		};
		window.addEventListener("dragover", prevent);
		window.addEventListener("drop", prevent);
		return () => {
			window.removeEventListener("dragover", prevent);
			window.removeEventListener("drop", prevent);
		};
	}, []);

	const reset = useCallback(() => {
		depthRef.current = 0;
		setDragging(false);
		setDragIssue(null);
	}, []);

	const dropProps = useMemo(
		() => ({
			onDragEnter: (event: ReactDragEvent<HTMLElement>) => {
				if (!enabled || !isFileDrag(event.dataTransfer)) return;
				event.preventDefault();
				depthRef.current += 1;
				if (depthRef.current === 1) {
					setDragging(true);
					setDragIssue(getDragIssue(event.dataTransfer));
				}
			},
			onDragOver: (event: ReactDragEvent<HTMLElement>) => {
				if (!enabled || !isFileDrag(event.dataTransfer)) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = loader.isBusy() ? "none" : "copy";
			},
			onDragLeave: (event: ReactDragEvent<HTMLElement>) => {
				if (!enabled || !isFileDrag(event.dataTransfer)) return;
				depthRef.current = Math.max(0, depthRef.current - 1);
				if (depthRef.current === 0) reset();
			},
			onDrop: (event: ReactDragEvent<HTMLElement>) => {
				if (!enabled || !isFileDrag(event.dataTransfer)) return;
				event.preventDefault();
				reset();
				const files = Array.from(event.dataTransfer.files);
				if (onFilesRef.current) onFilesRef.current(files);
				else void loader.loadFiles(files);
			},
		}),
		[enabled, loader, reset]
	);

	return {
		isDragging: enabled && dragging,
		dragIssue: enabled && dragging ? dragIssue : null,
		dropProps,
	};
}

/** Loads HAR files or HAR JSON pasted anywhere outside text fields. */
export function useHarPaste(loader: HarLoader, { enabled = true }: { enabled?: boolean } = {}) {
	const handlePaste = useEffectEvent((event: ClipboardEvent) => {
		if (!event.clipboardData || isEditableTarget(event.target)) return;
		const { files } = event.clipboardData;
		if (files.length > 0) {
			event.preventDefault();
			void loader.loadFiles(Array.from(files));
			return;
		}
		const text = event.clipboardData.getData("text/plain");
		if (text.trim()) {
			event.preventDefault();
			void loader.loadPastedText(text);
		}
	});

	useEffect(() => {
		if (!enabled) return;
		const listener = (event: ClipboardEvent) => handlePaste(event);
		document.addEventListener("paste", listener);
		return () => document.removeEventListener("paste", listener);
	}, [enabled]);
}
