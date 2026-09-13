"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const noop = () => () => {};

/** True after hydration; theme-dependent UI renders a neutral state before that. */
export function useMounted() {
	return useSyncExternalStore(
		noop,
		() => true,
		() => false
	);
}

export const THEME_OPTIONS = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeMenu({
	align = "end",
	side,
}: {
	align?: "start" | "center" | "end";
	side?: "top" | "right" | "bottom" | "left";
}) {
	const { theme, resolvedTheme, setTheme } = useTheme();
	const mounted = useMounted();
	const Icon = !mounted ? Sun : resolvedTheme === "dark" ? Moon : Sun;

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" aria-label="Change theme">
							<Icon />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Theme</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align={align} side={side} className="w-40">
				<DropdownMenuLabel>Theme</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={mounted ? (theme ?? "system") : "system"}
					onValueChange={setTheme}
				>
					{THEME_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							<option.icon className="text-muted-foreground" />
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
