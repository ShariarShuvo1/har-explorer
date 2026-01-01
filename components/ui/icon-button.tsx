import { cn } from "@/lib/cn";
import { HTMLMotionProps, motion } from "framer-motion";
import { forwardRef } from "react";

interface IconButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
	active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
	({ className, active, children, ...props }, ref) => {
		return (
			<motion.button
				ref={ref}
				whileHover={{
					scale: 1.05,
					transition: { duration: 0.2, ease: "easeOut" },
				}}
				whileTap={{
					scale: 0.95,
					transition: { duration: 0.1 },
				}}
				className={cn(
					"relative flex items-center justify-center px-3.5 py-2.5 rounded-md transition-all duration-200 cursor-pointer",
					"focus:outline-none border border-transparent",
					"backdrop-blur-sm",
					active
						? "text-primary"
						: "text-muted hover:text-foreground/80",
					className
				)}
				{...props}
			>
				{children}
			</motion.button>
		);
	}
);

IconButton.displayName = "IconButton";
