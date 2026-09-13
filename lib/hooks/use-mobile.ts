import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(callback: () => void) {
	const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
	mql.addEventListener("change", callback);
	return () => mql.removeEventListener("change", callback);
}

/** Subscribes to a CSS media query; false during server rendering. */
export function useMediaQuery(query: string) {
	return React.useSyncExternalStore(
		(callback) => {
			const mql = window.matchMedia(query);
			mql.addEventListener("change", callback);
			return () => mql.removeEventListener("change", callback);
		},
		() => window.matchMedia(query).matches,
		() => false
	);
}

export function useIsMobile() {
	return React.useSyncExternalStore(
		subscribe,
		() => window.innerWidth < MOBILE_BREAKPOINT,
		() => false
	);
}
