"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { cn } from "@/lib/cn";

const MobileContext = createContext(false);

interface RootProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: ReactNode;
}

/**
 * A centered dialog on tablets and desktops that becomes a bottom sheet on
 * phones. The API mirrors the shadcn Dialog parts.
 */
export function ResponsiveDialog({ open, onOpenChange, children }: RootProps) {
	const isMobile = useIsMobile();
	const Root = isMobile ? Drawer : Dialog;
	return (
		<MobileContext.Provider value={isMobile}>
			<Root open={open} onOpenChange={onOpenChange}>
				{children}
			</Root>
		</MobileContext.Provider>
	);
}

export function ResponsiveDialogTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
	const isMobile = useContext(MobileContext);
	return isMobile ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

export function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
	const isMobile = useContext(MobileContext);
	return isMobile ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

export function ResponsiveDialogContent({
	className,
	children,
	size = "md",
	...props
}: {
	className?: string;
	children: ReactNode;
	size?: "sm" | "md" | "lg" | "xl";
} & Omit<React.ComponentProps<typeof DialogContent>, "children">) {
	const isMobile = useContext(MobileContext);
	if (isMobile) {
		return (
			<DrawerContent className={cn("max-h-[92dvh]", className)}>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
			</DrawerContent>
		);
	}
	return (
		<DialogContent
			className={cn(
				"flex max-h-[min(88dvh,56rem)] flex-col gap-0 overflow-hidden p-0",
				size === "sm" && "sm:max-w-md",
				size === "md" && "sm:max-w-lg",
				size === "lg" && "sm:max-w-2xl",
				size === "xl" && "sm:max-w-4xl",
				className
			)}
			{...props}
		>
			{children}
		</DialogContent>
	);
}

export function ResponsiveDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	const isMobile = useContext(MobileContext);
	return isMobile ? (
		<DrawerHeader className={cn("text-left", className)} {...props} />
	) : (
		<DialogHeader className={cn("px-6 pt-6 pb-4", className)} {...props} />
	);
}

/** Scrollable middle section between header and footer. */
export function ResponsiveDialogBody({ className, ...props }: React.ComponentProps<"div">) {
	const isMobile = useContext(MobileContext);
	return (
		<div
			className={cn(
				// Children must not shrink, or flex bodies would clip them instead of scrolling.
				"min-h-0 flex-1 overflow-y-auto *:shrink-0",
				isMobile ? "px-4 pb-4" : "px-6 pb-6",
				className
			)}
			{...props}
		/>
	);
}

export function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
	const isMobile = useContext(MobileContext);
	return isMobile ? (
		<DrawerFooter className={cn("border-t pt-3", className)} {...props} />
	) : (
		<DialogFooter className={cn("border-t bg-muted/30 px-6 py-3", className)} {...props} />
	);
}

export function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
	const isMobile = useContext(MobileContext);
	return isMobile ? <DrawerTitle {...props} /> : <DialogTitle {...props} />;
}

export function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
	const isMobile = useContext(MobileContext);
	return isMobile ? <DrawerDescription {...props} /> : <DialogDescription {...props} />;
}
