"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const THEME_STORAGE_KEY = "har-explorer-theme";
const LEGACY_THEME_KEY = "theme-storage";

// Earlier versions stored the theme under a Zustand key; carry that choice over once.
if (typeof window !== "undefined") {
	try {
		if (!localStorage.getItem(THEME_STORAGE_KEY)) {
			const legacy = JSON.parse(localStorage.getItem(LEGACY_THEME_KEY) ?? "null");
			const theme = legacy?.state?.theme;
			if (theme === "light" || theme === "dark") {
				localStorage.setItem(THEME_STORAGE_KEY, theme);
			}
		}
		localStorage.removeItem(LEGACY_THEME_KEY);
	} catch {
		// Storage may be unavailable (private mode, blocked site data).
	}
}

export function Providers({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider
			attribute="data-theme"
			defaultTheme="system"
			enableSystem
			storageKey={THEME_STORAGE_KEY}
			disableTransitionOnChange
		>
			<MotionConfig reducedMotion="user">
				<TooltipProvider delayDuration={300} skipDelayDuration={150}>
					{children}
					<Toaster position="bottom-right" closeButton richColors={false} />
				</TooltipProvider>
			</MotionConfig>
		</ThemeProvider>
	);
}
