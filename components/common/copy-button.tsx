"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { writeToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/cn";

/** Copies text and confirms with a toast; returns whether it succeeded. */
export async function copyText(text: string, label = "Copied to clipboard") {
	try {
		await writeToClipboard(text);
		toast.success(label);
		return true;
	} catch (error) {
		console.error("Failed to copy:", error);
		toast.error("Couldn't copy to the clipboard");
		return false;
	}
}

interface CopyButtonProps extends Omit<
	ComponentProps<typeof Button>,
	"onClick" | "children" | "value"
> {
	value: string | (() => string);
	/** Accessible label and tooltip, e.g. "Copy URL". */
	label?: string;
	/** Toast text after copying. */
	successMessage?: string;
	/** Renders a text button instead of an icon button. */
	children?: React.ReactNode;
}

export function CopyButton({
	value,
	label = "Copy",
	successMessage,
	children,
	variant = "ghost",
	size,
	className,
	...props
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[]
	);

	const handleClick = async () => {
		const text = typeof value === "function" ? value() : value;
		if (await copyText(text, successMessage ?? "Copied to clipboard")) {
			setCopied(true);
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(() => setCopied(false), 1500);
		}
	};

	const Icon = copied ? Check : Copy;

	if (children) {
		return (
			<Button
				type="button"
				variant={variant}
				size={size ?? "sm"}
				onClick={handleClick}
				className={className}
				{...props}
			>
				<Icon className={cn(copied && "text-success")} />
				{children}
			</Button>
		);
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant={variant}
					size={size ?? "icon-sm"}
					onClick={handleClick}
					aria-label={label}
					className={cn("text-muted-foreground hover:text-foreground", className)}
					{...props}
				>
					<Icon className={cn(copied && "text-success")} />
				</Button>
			</TooltipTrigger>
			<TooltipContent>{copied ? "Copied" : label}</TooltipContent>
		</Tooltip>
	);
}
