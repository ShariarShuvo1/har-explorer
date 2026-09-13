"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { STATISTICS_SECTIONS, scrollToSection, type StatisticsSectionId } from "./sections";

const SECTION_IDS = STATISTICS_SECTIONS.map((section) => section.id);

/** The section crossing a thin band near the top of the viewport. */
function useActiveSection() {
	const [active, setActive] = useState<StatisticsSectionId>(SECTION_IDS[0]);

	useEffect(() => {
		const intersecting = new Set<string>();
		const observer = new IntersectionObserver(
			(records) => {
				for (const record of records) {
					if (record.isIntersecting) intersecting.add(record.target.id);
					else intersecting.delete(record.target.id);
				}
				// Prefer the lowest section in the band: it's the one being read.
				for (let i = SECTION_IDS.length - 1; i >= 0; i--) {
					if (intersecting.has(SECTION_IDS[i])) {
						setActive(SECTION_IDS[i]);
						return;
					}
				}
			},
			{ rootMargin: "-12% 0px -80% 0px" }
		);
		for (const id of SECTION_IDS) {
			const element = document.getElementById(id);
			if (element) observer.observe(element);
		}
		return () => observer.disconnect();
	}, []);

	const navigate = (id: StatisticsSectionId) => {
		setActive(id);
		scrollToSection(id);
	};

	return { active, navigate };
}

/** Docs-style "On this page" list for large screens. */
export function SectionNavList({ className }: { className?: string }) {
	const { active, navigate } = useActiveSection();
	return (
		<nav aria-label="On this page" className={className}>
			<p className="mb-2 text-xs font-medium text-muted-foreground">On this page</p>
			<ul className="space-y-0.5 border-l">
				{STATISTICS_SECTIONS.map((section) => {
					const isActive = section.id === active;
					return (
						<li key={section.id}>
							<a
								href={`#${section.id}`}
								aria-current={isActive ? "location" : undefined}
								onClick={(event) => {
									event.preventDefault();
									navigate(section.id);
								}}
								className={cn(
									"-ml-px block border-l py-1 pl-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
									isActive
										? "border-primary font-medium text-foreground"
										: "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
								)}
							>
								{section.label}
							</a>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

/** Compact section picker for small screens. */
export function SectionNavSelect({ className }: { className?: string }) {
	const { active, navigate } = useActiveSection();
	return (
		<Select value={active} onValueChange={(value) => navigate(value as StatisticsSectionId)}>
			<SelectTrigger aria-label="Jump to section" className={cn("w-full sm:w-72", className)}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{STATISTICS_SECTIONS.map((section) => (
					<SelectItem key={section.id} value={section.id}>
						{section.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
