"use client";

import { createContext, useContext } from "react";

interface FocusContextValue {
	isFocusMode: boolean;
}

const FocusContext = createContext<FocusContextValue>({ isFocusMode: false });

export function FocusProvider({
	children,
	isFocusMode,
}: {
	children: React.ReactNode;
	isFocusMode: boolean;
}) {
	return (
		<FocusContext.Provider value={{ isFocusMode }}>
			{children}
		</FocusContext.Provider>
	);
}

export function useFocusMode() {
	return useContext(FocusContext);
}
