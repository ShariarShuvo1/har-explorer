"use client";

import { useState, useRef, useCallback } from "react";
import { FileJson, Zap, AlertCircle, Shield } from "lucide-react";
import { cn } from "@/lib/cn";
import { useHarStore } from "@/lib/stores/har-store";
import { parseHARFile } from "@/lib/har-parser";

export function DropZone() {
	const [isDragging, setIsDragging] = useState(false);
	const [isInvalidFile, setIsInvalidFile] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const setHarData = useHarStore((state) => state.setHarData);

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const hasFiles = e.dataTransfer.types?.includes("Files");
		if (!hasFiles) {
			setIsDragging(true);
			return;
		}

		const files = Array.from(e.dataTransfer.items || []);
		const fileList = files
			.filter((item) => item.kind === "file")
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);

		const hasValidFile = fileList.some((file) =>
			file.name.endsWith(".har")
		);
		const hasInvalidFile = fileList.some(
			(file) => !file.name.endsWith(".har")
		);

		setIsDragging(true);
		setIsInvalidFile(hasInvalidFile && !hasValidFile);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.currentTarget === e.target) {
			setIsDragging(false);
			setIsInvalidFile(false);
		}
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);
			setIsInvalidFile(false);
			setError(null);

			const files = Array.from(e.dataTransfer.files);
			const harFile = files.find((file) => file.name.endsWith(".har"));

			if (harFile) {
				setIsLoading(true);
				try {
					const data = await parseHARFile(harFile);
					setHarData(data);
				} catch (err) {
					setError(
						err instanceof Error
							? err.message
							: "Failed to parse HAR file"
					);
				} finally {
					setIsLoading(false);
				}
			} else {
				setError("Invalid file type dropped");
			}
		},
		[setHarData]
	);

	const handleClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file && file.name.endsWith(".har")) {
				setIsLoading(true);
				setError(null);
				try {
					const data = await parseHARFile(file);
					setHarData(data);
				} catch (err) {
					setError(
						err instanceof Error
							? err.message
							: "Failed to parse HAR file"
					);
				} finally {
					setIsLoading(false);
				}
			}
		},
		[setHarData]
	);

	return (
		<div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8">
			<div
				className={cn(
					"relative w-full max-w-4xl h-170 rounded-2xl border-2 border-dashed",
					"transition-all duration-300 ease-out cursor-pointer group",
					"bg-card/50 backdrop-blur-sm",
					isInvalidFile
						? "border-destructive bg-destructive/10 scale-[1.02] shadow-[0_0_40px_rgba(220,38,38,0.3)]"
						: isDragging
						? "border-primary bg-primary/10 scale-[1.02] shadow-[0_0_40px_rgba(0,255,255,0.3)]"
						: "border-control-border hover:border-primary/50 hover:bg-card/70 hover:shadow-[0_0_20px_rgba(0,255,255,0.15)]"
				)}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				onClick={handleClick}
			>
				<div className="absolute inset-0 overflow-hidden rounded-2xl">
					<div
						className={cn(
							"absolute top-0 left-1/2 -translate-x-1/2 w-full h-1",
							"bg-linear-to-r from-transparent via-primary to-transparent",
							"transition-opacity duration-300",
							isDragging
								? "opacity-100"
								: "opacity-0 group-hover:opacity-50"
						)}
					/>
					<div
						className={cn(
							"absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-1",
							"bg-linear-to-r from-transparent via-secondary to-transparent",
							"transition-opacity duration-300",
							isDragging
								? "opacity-100"
								: "opacity-0 group-hover:opacity-50"
						)}
					/>
				</div>

				<div className="relative h-full flex flex-col items-center justify-center gap-8 px-6 sm:px-12">
					{isLoading && (
						<div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl z-10">
							<div className="flex flex-col items-center gap-4">
								<div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
								<p className="text-foreground font-medium">
									Parsing HAR file...
								</p>
							</div>
						</div>
					)}

					{error && (
						<div className="absolute top-4 left-4 right-4 p-4 bg-destructive/10 border border-destructive rounded-lg flex items-center gap-3 z-20">
							<AlertCircle className="w-5 h-5 text-destructive shrink-0" />
							<p className="text-sm text-destructive">{error}</p>
						</div>
					)}

					<div className="relative">
						<div
							className={cn(
								"absolute inset-0 rounded-full blur-3xl transition-all duration-500",
								isInvalidFile
									? "bg-destructive/30 scale-150"
									: isDragging
									? "bg-primary/30 scale-150"
									: "bg-primary/10 scale-100 group-hover:bg-primary/20 group-hover:scale-125"
							)}
						/>
						<div
							className={cn(
								"relative w-32 h-32 sm:w-40 sm:h-40 rounded-full",
								"flex items-center justify-center",
								"border-2 transition-all duration-300",
								isInvalidFile
									? "border-destructive bg-destructive/20 scale-110 shadow-[0_0_30px_rgba(220,38,38,0.5)]"
									: isDragging
									? "border-primary bg-primary/20 scale-110 shadow-[0_0_30px_rgba(0,255,255,0.5)]"
									: "border-control-border bg-card group-hover:border-primary/50 group-hover:bg-primary/10"
							)}
						>
							{isInvalidFile ? (
								<AlertCircle
									className="w-16 h-16 sm:w-20 sm:h-20 text-destructive animate-pulse"
									strokeWidth={1.5}
								/>
							) : isDragging ? (
								<Zap
									className="w-16 h-16 sm:w-20 sm:h-20 text-primary animate-pulse"
									strokeWidth={1.5}
								/>
							) : (
								<FileJson
									className={cn(
										"w-16 h-16 sm:w-20 sm:h-20 text-muted transition-all duration-300",
										"group-hover:text-primary group-hover:scale-110"
									)}
									strokeWidth={1.5}
								/>
							)}
						</div>
					</div>

					<div className="text-center space-y-4 max-w-md">
						<h2
							className={cn(
								"text-2xl sm:text-3xl font-bold transition-all duration-300",
								isInvalidFile
									? "text-destructive"
									: isDragging
									? "text-primary neon-text"
									: "text-foreground group-hover:text-primary/90"
							)}
						>
							{isInvalidFile
								? "Invalid File Type"
								: isDragging
								? "Drop HAR File Here"
								: "Drop HAR File"}
						</h2>
						<p className="text-sm sm:text-base text-muted leading-relaxed">
							{isInvalidFile
								? "Only .har files are supported"
								: "Drag and drop your HAR file here, or click to browse"}
						</p>
						<div className="flex flex-wrap items-center justify-center gap-2 pt-2">
							<span
								className={cn(
									"px-3 py-1 rounded-full text-xs sm:text-sm font-mono transition-all duration-300",
									isInvalidFile
										? "bg-destructive/10 border border-destructive/30 text-destructive"
										: "bg-primary/10 border border-primary/30 text-primary"
								)}
							>
								.har
							</span>
							<span className="text-muted text-xs">
								files only
							</span>
						</div>
					</div>

					<div
						className={cn(
							"flex items-center gap-3 px-6 py-3 rounded-lg",
							"border border-control-border bg-control-bg/50",
							"transition-all duration-300",
							isDragging
								? "border-primary/50 bg-primary/5"
								: "group-hover:border-primary/30"
						)}
					>
						<div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
						<span className="text-xs sm:text-sm text-muted font-mono">
							Ready to analyze HTTP Archives
						</span>
					</div>

					<div
						className={cn(
							"relative w-full max-w-2xl overflow-hidden rounded-xl",
							"bg-linear-to-br from-emerald-500/10 via-transparent to-teal-500/10",
							"border border-emerald-500/40 backdrop-blur-sm",
							"px-6 py-5 sm:px-8 sm:py-6"
						)}
					>
						<div className="absolute top-0 right-0 w-40 h-40 bg-linear-to-br from-emerald-400/20 to-transparent rounded-full blur-3xl -z-10" />
						<div className="absolute bottom-0 left-0 w-32 h-32 bg-linear-to-tr from-teal-400/20 to-transparent rounded-full blur-3xl -z-10" />

						<div className="flex gap-4">
							<div className="shrink-0">
								<div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40">
									<Shield
										className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
										strokeWidth={2}
									/>
								</div>
							</div>
							<div className="flex-1">
								<h3 className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-300 mb-1">
									Complete Privacy & Security
								</h3>
								<p className="text-xs sm:text-sm text-emerald-600/90 dark:text-emerald-400/80 leading-relaxed">
									This analysis runs entirely in your browser.{" "}
									<span className="font-semibold">
										Nothing is uploaded, transmitted, or
										stored
									</span>{" "}
									anywhere. Since HAR files may contain
									sensitive data (cookies, auth tokens,
									headers), we process everything locally on
									your machine to guarantee complete privacy.
								</p>
							</div>
						</div>
					</div>

					<div
						className={cn(
							"absolute inset-0 rounded-2xl pointer-events-none",
							"transition-opacity duration-300",
							isDragging
								? "opacity-100 bg-linear-to-br from-primary/5 via-transparent to-secondary/5"
								: "opacity-0"
						)}
					>
						<div className="absolute top-8 left-8 w-3 h-3 border-t-2 border-l-2 border-primary rounded-tl-lg" />
						<div className="absolute top-8 right-8 w-3 h-3 border-t-2 border-r-2 border-primary rounded-tr-lg" />
						<div className="absolute bottom-8 left-8 w-3 h-3 border-b-2 border-l-2 border-secondary rounded-bl-lg" />
						<div className="absolute bottom-8 right-8 w-3 h-3 border-b-2 border-r-2 border-secondary rounded-br-lg" />
					</div>
				</div>

				<input
					title="har file input"
					ref={fileInputRef}
					type="file"
					accept=".har"
					onChange={handleFileChange}
					className="hidden"
				/>
			</div>
		</div>
	);
}
