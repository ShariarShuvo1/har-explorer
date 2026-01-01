"use client";

import { useState, useEffect } from "react";
import { Monitor, Github, Code2 } from "lucide-react";
import { ControlContainer } from "@/components/layouts/control-container";
import { FullscreenToggle } from "@/components/controls/fullscreen-toggle";
import { ThemeToggle } from "@/components/controls/theme-toggle";
import { DropZone } from "@/components/upload/drop-zone";
import { HarViewer } from "@/components/har-viewer/har-viewer";
import { useHarStore } from "@/lib/stores/har-store";
import { CREATOR_NAME, REPOSITORY_URL } from "@/lib/seo/constants";

export default function Home() {
	const harData = useHarStore((state) => state.harData);
	const [isScreenSmall, setIsScreenSmall] = useState(true);
	const [windowWidth, setWindowWidth] = useState(0);

	useEffect(() => {
		const checkScreenSize = () => {
			setWindowWidth(window.innerWidth);
			setIsScreenSmall(window.innerWidth < 1024);
		};

		checkScreenSize();
		window.addEventListener("resize", checkScreenSize);
		return () => window.removeEventListener("resize", checkScreenSize);
	}, []);

	if (isScreenSmall) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8">
				<div className="flex flex-col items-center justify-center gap-6 max-w-md text-center py-12">
					<div className="relative">
						<div className="absolute inset-0 rounded-full blur-2xl bg-primary/20" />
						<div className="relative w-20 h-20 rounded-full bg-card border-2 border-control-border flex items-center justify-center">
							<Monitor
								className="w-10 h-10 text-muted"
								strokeWidth={1.5}
							/>
						</div>
					</div>
					<div className="space-y-3">
						<h1 className="text-2xl sm:text-3xl font-bold text-foreground">
							Larger Screen Required
						</h1>
						<p className="text-muted leading-relaxed">
							HAR Explorer is optimized for larger screens. Please
							use a device with a minimum screen width of{" "}
							<span className="font-semibold text-foreground">
								1024px
							</span>{" "}
							(like a laptop or desktop).
						</p>
						<div className="pt-3 space-y-2 text-sm text-muted/80">
							<p>
								Current width:{" "}
								<span className="font-mono text-foreground">
									{windowWidth}px
								</span>
							</p>
							<p>
								Minimum required:{" "}
								<span className="font-mono text-foreground">
									1024px
								</span>
							</p>
						</div>
					</div>
					<div className="pt-4">
						<div className="inline-block px-4 py-2 rounded-lg bg-control-bg border border-control-border">
							<p className="text-xs text-muted font-mono">
								Resize your window or use a larger device
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<>
			{!harData && (
				<ControlContainer>
					<FullscreenToggle />
					<div className="w-px h-6 bg-border" />
					<ThemeToggle />
					<div className="w-px h-6 bg-border" />
					<a
						href={REPOSITORY_URL}
						target="_blank"
						rel="noopener noreferrer"
						title="View Source Code on GitHub"
						className="p-2.5 rounded-lg hover:bg-card/60 transition-colors"
					>
						<Code2 className="w-5 h-5 text-foreground/70 hover:text-foreground" />
					</a>
					<a
						href="https://github.com/ShariarShuvo1"
						target="_blank"
						rel="noopener noreferrer"
						title={`Visit ${CREATOR_NAME}'s GitHub Profile`}
						className="p-2.5 rounded-lg hover:bg-card/60 transition-colors"
					>
						<Github className="w-5 h-5 text-foreground/70 hover:text-foreground" />
					</a>
				</ControlContainer>
			)}
			{harData ? <HarViewer /> : <DropZone />}
		</>
	);
}
