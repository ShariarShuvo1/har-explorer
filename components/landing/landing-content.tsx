import type { LucideIcon } from "lucide-react";
import {
	ChartColumn,
	ChartGantt,
	ChartPie,
	FileOutput,
	GitCompareArrows,
	ScanSearch,
	TriangleAlert,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const FEATURE_CARDS: { icon: LucideIcon; title: string; description: string }[] = [
	{
		icon: ChartGantt,
		title: "Requests & waterfall",
		description:
			"Search and filter every request on a waterfall timeline, then inspect headers, payloads, responses and timings.",
	},
	{
		icon: ChartColumn,
		title: "Analytics",
		description:
			"Bandwidth over time, protocol usage, third-party impact and image optimization insights.",
	},
	{
		icon: ScanSearch,
		title: "Pattern detection",
		description:
			"Spot duplicate and failed requests, redirect chains, missing cache headers, mixed content and more.",
	},
	{
		icon: ChartPie,
		title: "Statistics",
		description:
			"Connection reuse, initiators, priorities, transfer sizes and server IPs at a glance.",
	},
	{
		icon: GitCompareArrows,
		title: "Compare HAR files",
		description: "Load a second HAR file and compare it with the first.",
	},
	{
		icon: FileOutput,
		title: "Export",
		description:
			"Export all, selected, filtered or bookmarked requests to Markdown, text, OpenAPI 3.0 or a new HAR file.",
	},
];

export function FeatureGrid() {
	return (
		<section
			aria-labelledby="features-heading"
			className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20"
		>
			<div className="mx-auto max-w-2xl text-center">
				<h2 id="features-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
					Everything you need to understand a HAR file
				</h2>
				<p className="mt-2 text-sm text-pretty text-muted-foreground sm:text-base">
					Open a capture and switch between views from the sidebar.
				</p>
			</div>
			<ul className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
				{FEATURE_CARDS.map((feature) => (
					<li
						key={feature.title}
						className="flex gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-xs sm:flex-col sm:gap-3 sm:p-5"
					>
						<span
							className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
							aria-hidden="true"
						>
							<feature.icon className="size-4.5" />
						</span>
						<div className="min-w-0">
							<h3 className="text-sm font-semibold">{feature.title}</h3>
							<p className="mt-1 text-sm text-pretty text-muted-foreground">
								{feature.description}
							</p>
						</div>
					</li>
				))}
			</ul>
			<p className="mx-auto mt-6 max-w-2xl text-center text-sm text-pretty text-muted-foreground">
				Also: copy requests as cURL, fetch or PowerShell, edit or delete requests, bookmark with
				notes, and keyboard shortcuts.
			</p>
		</section>
	);
}

type Step = React.ReactNode;

function MacInspectorKeys() {
	return (
		<KbdGroup className="align-middle">
			<Kbd>⌘</Kbd>
			<Kbd>⌥</Kbd>
			<Kbd>I</Kbd>
		</KbdGroup>
	);
}

const BROWSER_GUIDES: { value: string; label: string; steps: Step[] }[] = [
	{
		value: "chromium",
		label: "Chrome / Edge",
		steps: [
			<>
				Open DevTools with <Kbd className="align-middle">F12</Kbd> (<MacInspectorKeys /> on Mac).
			</>,
			<>
				Select the <strong className="font-medium text-foreground">Network</strong> tab. Turn on{" "}
				<em>Preserve log</em> to keep requests across page loads.
			</>,
			"Reload the page or reproduce the issue to record requests.",
			<>
				Click the <em>Export HAR</em> (download) button in the Network toolbar, or right-click the
				request list and choose <em>Save all as HAR</em>.
			</>,
		],
	},
	{
		value: "firefox",
		label: "Firefox",
		steps: [
			<>
				Open Developer Tools with <Kbd className="align-middle">F12</Kbd> (<MacInspectorKeys /> on
				Mac).
			</>,
			<>
				Select the <strong className="font-medium text-foreground">Network</strong> tab. Enable{" "}
				<em>Persist Logs</em> in its settings to keep requests across page loads.
			</>,
			"Reload the page or reproduce the issue to record requests.",
			<>
				Right-click any request and choose <em>Save All As HAR</em>.
			</>,
		],
	},
	{
		value: "safari",
		label: "Safari",
		steps: [
			<>
				In Safari Settings › Advanced, turn on <em>Show features for web developers</em>.
			</>,
			<>
				Open Web Inspector with <MacInspectorKeys /> and select the{" "}
				<strong className="font-medium text-foreground">Network</strong> tab.
			</>,
			"Reload the page or reproduce the issue to record requests.",
			<>
				Click <em>Export</em> in the Network tab toolbar to save a .har file.
			</>,
		],
	},
];

export function HarGuide() {
	return (
		<section aria-labelledby="guide-heading" className="border-t bg-muted/40">
			<div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
				<div className="min-w-0">
					<h2 id="guide-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
						How to get a HAR file
					</h2>
					<p className="mt-2 text-sm text-pretty text-muted-foreground sm:text-base">
						Every major browser can record network activity and save it as a HAR (HTTP Archive) file
						from its developer tools.
					</p>
					<p className="mt-4 flex items-start gap-2 text-sm text-pretty text-muted-foreground">
						<TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
						HAR files can contain cookies, auth tokens and other private data. Be careful where you
						share them.
					</p>
				</div>
				<Tabs defaultValue="chromium" className="min-w-0 gap-4">
					<TabsList className="w-full sm:w-fit">
						{BROWSER_GUIDES.map((guide) => (
							<TabsTrigger key={guide.value} value={guide.value} className="sm:px-3">
								{guide.label}
							</TabsTrigger>
						))}
					</TabsList>
					{BROWSER_GUIDES.map((guide) => (
						// Force-mounted so every browser's steps are in the server-rendered HTML.
						<TabsContent
							key={guide.value}
							value={guide.value}
							forceMount
							className="data-[state=inactive]:hidden"
						>
							<ol className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs sm:p-6">
								{guide.steps.map((step, index) => (
									<li key={index} className="flex gap-3 text-sm">
										<span
											className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground tabular-nums"
											aria-hidden="true"
										>
											{index + 1}
										</span>
										<span className="min-w-0 pt-0.5 text-pretty text-muted-foreground">{step}</span>
									</li>
								))}
							</ol>
						</TabsContent>
					))}
				</Tabs>
			</div>
		</section>
	);
}
