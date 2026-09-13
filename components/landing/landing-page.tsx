"use client";

import { useId } from "react";
import { Logo } from "@/components/common/logo";
import { CircleAlert, FileUp, FlaskConical, FolderOpen, Lock, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatBytes, MAX_HAR_FILE_SIZE } from "@/lib/har-parser";
import { useHarDropTarget, useHarLoader, useHarPaste } from "@/lib/hooks/use-har-loader";
import { CREATOR_GITHUB_URL, CREATOR_NAME, REPOSITORY_URL, SITE_NAME } from "@/lib/seo/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "@/components/ui/github-icon";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeMenu } from "@/components/app-shell/theme-menu";
import { FeatureGrid, HarGuide } from "./landing-content";
import { LoadingOverlay } from "./loading-overlay";

export function LandingPage() {
	// Errors are shown in the inline alert below, so skip the toast.
	const loader = useHarLoader({ toastErrors: false });
	const busy = loader.loading !== null;
	const { isDragging, dragIssue, dropProps } = useHarDropTarget(loader);
	useHarPaste(loader);
	const hintId = useId();

	const invalid = dragIssue !== null;
	const title =
		dragIssue === "multiple"
			? "Drop one file at a time"
			: dragIssue === "type"
				? "This file type isn't supported"
				: isDragging
					? "Release to open"
					: "Drop a .har file here";

	const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if ((event.target as Element).closest("button, a")) return;
		loader.openFilePicker();
	};

	const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.target !== event.currentTarget) return;
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			loader.openFilePicker();
		}
	};

	return (
		<div
			{...dropProps}
			className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground"
		>
			<header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-sm">
				<div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
					<div className="flex min-w-0 items-center gap-2.5">
						<Logo className="size-7" />
						<span className="truncate text-base font-semibold tracking-tight">{SITE_NAME}</span>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon-sm" asChild>
									<a
										href={REPOSITORY_URL}
										target="_blank"
										rel="noopener noreferrer"
										aria-label="View source on GitHub"
									>
										<GithubIcon />
									</a>
								</Button>
							</TooltipTrigger>
							<TooltipContent>View source on GitHub</TooltipContent>
						</Tooltip>
						<ThemeMenu />
					</div>
				</div>
			</header>

			<main className="flex-1">
				<section
					aria-labelledby="hero-heading"
					className="mx-auto w-full max-w-3xl px-4 pt-10 pb-12 sm:px-6 sm:pt-16 sm:pb-16 lg:pt-20"
				>
					<div className="text-center">
						<h1
							id="hero-heading"
							className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl"
						>
							Inspect, analyze and export HAR files
						</h1>
						<p className="mx-auto mt-3 max-w-xl text-base text-pretty text-muted-foreground sm:mt-4 sm:text-lg">
							A fast HAR viewer with a waterfall timeline, performance insights, file comparison and
							exports, running entirely in your browser.
						</p>
					</div>

					<div
						role="group"
						tabIndex={0}
						aria-label="Open a HAR file: press Enter to choose a file, or drop one here"
						aria-describedby={hintId}
						aria-busy={busy}
						onClick={handleCardClick}
						onKeyDown={handleCardKeyDown}
						className={cn(
							"mt-8 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed bg-card px-4 py-10 text-center text-card-foreground transition-colors outline-none sm:mt-10 sm:px-8 sm:py-14",
							"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
							invalid
								? "border-destructive bg-destructive/5"
								: isDragging
									? "border-primary bg-primary/5"
									: "border-border hover:border-primary/50 hover:bg-accent/40"
						)}
					>
						<span
							className={cn(
								"flex size-12 items-center justify-center rounded-full transition-colors",
								invalid
									? "bg-destructive/10 text-destructive"
									: isDragging
										? "bg-primary/15 text-primary"
										: "bg-muted text-muted-foreground"
							)}
							aria-hidden="true"
						>
							{invalid ? <CircleAlert className="size-6" /> : <FileUp className="size-6" />}
						</span>
						<p
							className={cn("mt-4 text-base font-medium sm:text-lg", invalid && "text-destructive")}
							aria-live="polite"
						>
							{title}
						</p>
						<p className="mt-1 text-xs text-muted-foreground sm:text-sm">
							.har, or .json containing HAR data · up to {formatBytes(MAX_HAR_FILE_SIZE)}
						</p>

						<div className="mt-5 flex w-full items-center gap-3 text-xs text-muted-foreground sm:w-64">
							<span className="h-px flex-1 bg-border" />
							or
							<span className="h-px flex-1 bg-border" />
						</div>

						<div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
							<Button size="lg" onClick={loader.openFilePicker} disabled={busy}>
								<FolderOpen />
								Choose file
							</Button>
							<Button
								size="lg"
								variant="outline"
								onClick={() => void loader.loadSample()}
								disabled={busy}
							>
								<FlaskConical />
								Try a sample
							</Button>
						</div>

						<p id={hintId} className="mt-5 text-xs text-pretty text-muted-foreground">
							You can also paste HAR JSON{" "}
							<span className="whitespace-nowrap">
								(
								<KbdGroup className="align-middle">
									<Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>V</Kbd>
								</KbdGroup>
								)
							</span>
						</p>
					</div>
					{loader.fileInput}

					{loader.error && (
						<Alert variant="destructive" className="relative mt-4 pr-12">
							<CircleAlert />
							<AlertTitle>Couldn&apos;t open the file</AlertTitle>
							<AlertDescription className="wrap-break-word">{loader.error}</AlertDescription>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={loader.clearError}
								aria-label="Dismiss error"
								className="absolute top-2 right-2 text-muted-foreground"
							>
								<X />
							</Button>
						</Alert>
					)}

					<p className="mx-auto mt-6 flex max-w-xl items-start justify-center gap-2 text-sm text-pretty text-muted-foreground">
						<Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
						<span>
							Files are processed entirely in your browser and never uploaded. This site uses
							anonymous page analytics.
						</span>
					</p>
				</section>

				<div className="border-t">
					<FeatureGrid />
				</div>
				<HarGuide />
			</main>

			<footer className="border-t">
				<div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
					<p className="text-center sm:text-left">
						Built by{" "}
						<a
							href={CREATOR_GITHUB_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="font-medium text-foreground underline-offset-4 hover:underline"
						>
							{CREATOR_NAME}
						</a>
					</p>
					<a
						href={REPOSITORY_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-md underline-offset-4 hover:text-foreground hover:underline"
					>
						<GithubIcon className="size-4" />
						Source on GitHub
					</a>
				</div>
			</footer>

			<LoadingOverlay loading={loader.loading} />
		</div>
	);
}
