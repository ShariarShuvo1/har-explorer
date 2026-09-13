"use client";

import { Spinner } from "@/components/ui/spinner";
import { formatBytes } from "@/lib/har-parser";
import type { HarLoadingState } from "@/lib/hooks/use-har-loader";

/** Full-screen overlay shown while a HAR file is read and parsed. */
export function LoadingOverlay({ loading }: { loading: HarLoadingState | null }) {
	if (!loading) return null;

	return (
		<div
			role="status"
			aria-live="polite"
			className="fixed inset-0 z-100 flex animate-in cursor-progress items-center justify-center bg-background/80 p-4 backdrop-blur-sm fade-in-0"
		>
			<div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card px-6 py-8 text-center text-card-foreground shadow-xs">
				<Spinner className="size-8 text-primary" role="presentation" aria-hidden="true" />
				<div className="w-full min-w-0 space-y-1">
					<p className="text-sm font-medium">Opening HAR file…</p>
					<p className="font-mono text-xs break-all text-muted-foreground">
						{loading.fileName}
						{loading.size > 0 && (
							<span className="tabular-nums"> · {formatBytes(loading.size)}</span>
						)}
					</p>
				</div>
			</div>
		</div>
	);
}
