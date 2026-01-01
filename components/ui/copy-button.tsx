"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { cn } from "@/lib/cn";

interface CopyButtonProps {
	content: string;
	className?: string;
	size?: "sm" | "md" | "lg";
	title?: string;
	mimeType?: string;
	filename?: string;
}

export function CopyButton({
	content,
	className,
	size = "md",
	title,
	mimeType,
	filename,
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const base64ToBlob = (base64: string, contentType: string): Blob => {
		const byteCharacters = atob(base64);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		return new Blob([byteArray], { type: contentType });
	};

	const downloadImageData = (dataUrl: string) => {
		const match = dataUrl.match(/data:([^;]+);base64,(.+)/);
		if (!match) return;

		const mime = match[1];
		const base64Data = match[2];
		const blob = base64ToBlob(base64Data, mime);

		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;

		const ext = mime.split("/")[1] || "png";
		link.download = filename || `image-${Date.now()}.${ext}`;

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handleCopy = async () => {
		try {
			const isImage =
				mimeType?.startsWith("image/") ||
				content.startsWith("data:image/");

			if (isImage) {
				downloadImageData(content);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			} else {
				await navigator.clipboard.writeText(content);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	const iconSize = {
		sm: "w-3 h-3",
		md: "w-4 h-4",
		lg: "w-5 h-5",
	}[size];

	const isImage =
		mimeType?.startsWith("image/") || content.startsWith("data:image/");

	return (
		<button
			onClick={handleCopy}
			className={cn(
				"inline-flex items-center justify-center rounded-md transition-colors",
				"hover:bg-primary/10 text-muted hover:text-foreground",
				"focus:outline-none focus:ring-2 focus:ring-primary/50",
				className
			)}
			title={
				copied
					? "Downloaded!"
					: title ||
					  (isImage ? "Download image" : "Copy to clipboard")
			}
			type="button"
		>
			{copied ? (
				<Check className={cn(iconSize, "text-green-500")} />
			) : isImage ? (
				<Download className={iconSize} />
			) : (
				<Copy className={iconSize} />
			)}
		</button>
	);
}
