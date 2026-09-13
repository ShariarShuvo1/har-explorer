"use client";

import type { ReactNode } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	description?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	onConfirm: () => void;
	/** Extra action rendered between cancel and confirm. */
	secondaryAction?: { label: string; onClick: () => void };
}

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	destructive = false,
	onConfirm,
	secondaryAction,
}: ConfirmDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{description && (
						<AlertDialogDescription asChild>
							<div className="space-y-2 text-sm text-muted-foreground">{description}</div>
						</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
					{secondaryAction && (
						<AlertDialogAction variant="outline" onClick={secondaryAction.onClick}>
							{secondaryAction.label}
						</AlertDialogAction>
					)}
					<AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
