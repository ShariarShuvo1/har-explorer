"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useThemeStore } from "@/lib/stores/theme-store";
import { IconButton } from "@/components/ui/icon-button";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle() {
	const { theme, setTheme } = useThemeStore();

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
	}, [theme]);

	return (
		<div className="relative flex items-center gap-0.5 border border-border/50 rounded-lg p-0.5 bg-card/40 backdrop-blur-sm">
			<motion.div
				className="absolute left-0.5 top-0.5 bottom-0.5 w-[calc(50%-0.25rem)] bg-primary/20 rounded-md"
				animate={{
					x: theme === "light" ? 0 : "calc(100% + 0.125rem)",
				}}
				transition={{
					type: "spring",
					stiffness: 400,
					damping: 30,
				}}
			/>

			<IconButton
				active={theme === "light"}
				onClick={() => setTheme("light")}
				title="Light mode"
				className="relative z-10"
			>
				<AnimatePresence mode="wait">
					<motion.div
						key={
							theme === "light"
								? "light-active"
								: "light-inactive"
						}
						initial={{ scale: 0.8, rotate: -90 }}
						animate={{
							scale: 1,
							rotate: 0,
						}}
						exit={{ scale: 0.8, rotate: 90 }}
						transition={{ duration: 0.3, ease: "easeOut" }}
					>
						<Sun
							className="w-5 h-5 transition-colors duration-200"
							style={{
								color:
									theme === "light"
										? "var(--sun-color)"
										: "var(--muted)",
							}}
						/>
					</motion.div>
				</AnimatePresence>
			</IconButton>

			<IconButton
				active={theme === "dark"}
				onClick={() => setTheme("dark")}
				title="Dark mode"
				className="relative z-10"
			>
				<AnimatePresence mode="wait">
					<motion.div
						key={theme === "dark" ? "dark-active" : "dark-inactive"}
						initial={{ scale: 0.8, rotate: -90 }}
						animate={{
							scale: 1,
							rotate: 0,
						}}
						exit={{ scale: 0.8, rotate: 90 }}
						transition={{ duration: 0.3, ease: "easeOut" }}
					>
						<Moon
							className="w-5 h-5 transition-colors duration-200"
							style={{
								color:
									theme === "dark"
										? "var(--moon-color)"
										: "var(--muted)",
							}}
						/>
					</motion.div>
				</AnimatePresence>
			</IconButton>
		</div>
	);
}
