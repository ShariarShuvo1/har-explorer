"use client";

import { Maximize, Minimize } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { motion, AnimatePresence } from "framer-motion";

export function FullscreenToggle() {
	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () =>
			document.removeEventListener(
				"fullscreenchange",
				handleFullscreenChange
			);
	}, []);

	const toggleFullscreen = async () => {
		if (!document.fullscreenElement) {
			try {
				await document.documentElement.requestFullscreen();
			} catch (err) {
				console.error("Error entering fullscreen:", err);
			}
		} else {
			try {
				await document.exitFullscreen();
			} catch (err) {
				console.error("Error exiting fullscreen:", err);
			}
		}
	};

	return (
		<IconButton
			onClick={toggleFullscreen}
			active={isFullscreen}
			title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
		>
			<AnimatePresence mode="wait">
				<motion.div
					key={isFullscreen ? "minimize" : "maximize"}
					initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
					animate={{ scale: 1, opacity: 1, rotate: 0 }}
					exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
					transition={{ duration: 0.25, ease: "easeOut" }}
				>
					{isFullscreen ? (
						<Minimize
							className="w-5 h-5"
							style={{ color: "var(--fullscreen-color)" }}
						/>
					) : (
						<Maximize
							className="w-5 h-5"
							style={{ color: "var(--fullscreen-color)" }}
						/>
					)}
				</motion.div>
			</AnimatePresence>
		</IconButton>
	);
}
