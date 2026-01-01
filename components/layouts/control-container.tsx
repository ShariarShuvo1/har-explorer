"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ControlContainerProps {
	children: ReactNode;
}

export function ControlContainer({ children }: ControlContainerProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: 0.4,
				ease: [0.22, 1, 0.36, 1],
			}}
			className="fixed top-6 right-6 z-50"
		>
			<motion.div
				whileHover={{
					scale: 1.02,
					transition: { duration: 0.2 },
				}}
				className="flex items-center gap-3 p-3 rounded-lg backdrop-blur-md border bg-control-bg border-control-border neon-glow"
			>
				{children}
			</motion.div>
		</motion.div>
	);
}
