import { cn } from "@/lib/cn";

/**
 * Brand mark: staggered waterfall bars. Mirrors app/icon.svg; the indigo bars
 * lighten in dark mode so the mark stays visible on dark surfaces.
 */
export function Logo({ className }: { className?: string }) {
	return (
		<svg
			viewBox="32 32 1089 1089"
			aria-hidden="true"
			focusable="false"
			className={cn(
				"shrink-0 [--logo-accent:#5ed0ea] [--logo-base:#443e86] dark:[--logo-base:#9a93f0]",
				className
			)}
		>
			<g fill="var(--logo-base)">
				<rect x="65" y="232" width="512" height="111" rx="55.5" />
				<rect x="444" y="618" width="475" height="111" rx="55.5" />
				<rect x="577" y="811" width="512" height="111" rx="55.5" />
			</g>
			<rect x="257" y="425" width="510" height="111" rx="55.5" fill="var(--logo-accent)" />
		</svg>
	);
}
