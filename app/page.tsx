"use client";

import { useHarStore } from "@/lib/stores/har-store";
import { AppShell } from "@/components/app-shell/app-shell";
import { LandingPage } from "@/components/landing/landing-page";

export default function Home() {
	const hasHarData = useHarStore((state) => state.harData !== null);
	return hasHarData ? <AppShell /> : <LandingPage />;
}
