"use client";

import Link from "next/link";
import { Home, AlertCircle } from "lucide-react";
import { ControlContainer } from "@/components/layouts/control-container";
import { FullscreenToggle } from "@/components/controls/fullscreen-toggle";
import { ThemeToggle } from "@/components/controls/theme-toggle";

export default function NotFound() {
	return (
		<>
			<ControlContainer>
				<FullscreenToggle />
				<div className="w-px h-6 bg-border" />
				<ThemeToggle />
			</ControlContainer>

			<div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8">
				<div className="flex flex-col items-center justify-center gap-8 max-w-2xl text-center">
					<div className="relative">
						<div className="absolute inset-0 rounded-full blur-3xl bg-primary/20 scale-150" />
						<div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-card border-2 border-primary/50 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,255,0.3)]">
							<AlertCircle
								className="w-16 h-16 sm:w-20 sm:h-20 text-primary"
								strokeWidth={1.5}
							/>
						</div>
					</div>

					<div className="space-y-4">
						<h1 className="text-6xl sm:text-8xl font-bold text-primary">
							404
						</h1>
						<h2 className="text-2xl sm:text-3xl font-bold text-foreground">
							Page Not Found
						</h2>
						<p className="text-base sm:text-lg text-muted leading-relaxed max-w-md">
							The page you&apos;re looking for doesn&apos;t exist
							or has been moved. Let&apos;s get you back to
							analyzing HAR files.
						</p>
					</div>

					<Link
						href="/"
						className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-background font-semibold hover:bg-primary-hover transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)] hover:shadow-[0_0_30px_rgba(0,255,255,0.6)] active:scale-95"
					>
						<Home className="w-5 h-5" />
						Go Home
					</Link>

					<div className="flex items-center gap-3 px-6 py-3 rounded-lg border border-control-border bg-control-bg/50 backdrop-blur-sm mt-4">
						<div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
						<span className="text-xs sm:text-sm text-muted font-mono">
							Error code: 404 - Resource not found
						</span>
					</div>
				</div>
			</div>
		</>
	);
}
