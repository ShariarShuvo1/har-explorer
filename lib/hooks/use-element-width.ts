"use client";

import { useCallback, useState } from "react";

/** Tracks an element's content width with a ResizeObserver (callback ref). */
export function useElementWidth<T extends HTMLElement>() {
	const [width, setWidth] = useState(0);
	const ref = useCallback((node: T | null) => {
		if (!node) return;
		setWidth(node.getBoundingClientRect().width);
		const observer = new ResizeObserver(([entry]) => {
			setWidth(entry.contentRect.width);
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	return [ref, width] as const;
}
