"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Image from "next/image";
import { AlertCircle, Binary, Download } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { formatBytes } from "@/lib/har-parser";
import { base64ToBytes } from "@/lib/entry/entry-utils";
import { dataUrlToBlob, downloadBlob, extensionForMime } from "@/lib/download";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

/** Downloads a `data:` URL as a file, with a toast on failure. */
export function downloadDataUrl(dataUrl: string, fileName?: string) {
	const blob = dataUrlToBlob(dataUrl);
	if (!blob) {
		toast.error("The data could not be decoded");
		return;
	}
	downloadBlob(blob, fileName || `download-${Date.now()}.${extensionForMime(blob.type)}`);
}

function PreviewError({ title, reasons }: { title: string; reasons: string[] }) {
	return (
		<Alert variant="destructive">
			<AlertCircle />
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>
				<ul className="list-inside list-disc text-xs">
					{reasons.map((reason) => (
						<li key={reason}>{reason}</li>
					))}
				</ul>
			</AlertDescription>
		</Alert>
	);
}

function PreviewBar({ label, children }: { label: string; children?: React.ReactNode }) {
	return (
		<div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
			<span className="text-xs text-muted-foreground">{label}</span>
			{children && <div className="flex items-center gap-2">{children}</div>}
		</div>
	);
}

export function ImagePreview({ src, downloadName }: { src: string; downloadName: string }) {
	// Results are tagged with their src, so a new image never shows a stale error.
	const [result, setResult] = useState<{
		src: string;
		error?: boolean;
		width?: number;
		height?: number;
	} | null>(null);
	const current = result?.src === src ? result : null;

	return (
		<div className="space-y-2">
			<PreviewBar label={current?.width ? `Image · ${current.width} × ${current.height}` : "Image"}>
				<Button
					type="button"
					variant="outline"
					size="xs"
					onClick={() => downloadDataUrl(src, downloadName)}
				>
					<Download />
					Download
				</Button>
			</PreviewBar>
			{current?.error ? (
				<PreviewError
					title="The image could not be rendered"
					reasons={[
						"Corrupted, truncated or invalid image data",
						"Unsupported image format",
						"Malformed base64 encoding",
					]}
				/>
			) : (
				<div className="flex justify-center overflow-auto rounded-lg border bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-size-[16px_16px] p-3">
					<Image
						src={src}
						alt="Response content preview"
						width={800}
						height={600}
						style={{ width: "auto", height: "auto", maxWidth: "100%" }}
						onLoad={(e) =>
							setResult({
								src,
								width: e.currentTarget.naturalWidth,
								height: e.currentTarget.naturalHeight,
							})
						}
						onError={() => setResult({ src, error: true })}
						unoptimized
					/>
				</div>
			)}
		</div>
	);
}

export function FontPreview({ base64 }: { base64: string }) {
	const family = `har-font-preview-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
	const bytes = useMemo(() => base64ToBytes(base64), [base64]);
	const [loaded, setLoaded] = useState<{ bytes: Uint8Array; ok: boolean } | null>(null);

	// FontFace takes the raw bytes, so nothing from the HAR file is ever
	// interpolated into CSS.
	useEffect(() => {
		if (!bytes || typeof FontFace === "undefined") return;
		let cancelled = false;
		const face = new FontFace(family, bytes);
		face.load().then(
			() => {
				if (cancelled) return;
				document.fonts.add(face);
				setLoaded({ bytes, ok: true });
			},
			() => {
				if (!cancelled) setLoaded({ bytes, ok: false });
			}
		);
		return () => {
			cancelled = true;
			document.fonts.delete(face);
		};
	}, [bytes, family]);

	const status = !bytes
		? "error"
		: loaded?.bytes === bytes
			? loaded.ok
				? "loaded"
				: "error"
			: "loading";

	return (
		<div className="space-y-2">
			<PreviewBar label="Font" />
			{status === "error" ? (
				<PreviewError
					title="The font could not be loaded"
					reasons={[
						"Corrupted or truncated font data",
						"Unsupported font format (e.g. EOT)",
						"Malformed base64 encoding",
					]}
				/>
			) : (
				<div
					className={cn(
						"space-y-3 rounded-lg border p-4 break-words transition-opacity",
						status === "loading" && "opacity-40"
					)}
					style={{ fontFamily: `"${family}", sans-serif` }}
				>
					<div className="text-2xl font-bold">The Quick Brown Fox</div>
					<div className="text-lg">jumps over the lazy dog 1234567890</div>
					<div className="text-sm text-muted-foreground">
						ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz !@#$%&amp;*()
					</div>
				</div>
			)}
		</div>
	);
}

export function MediaPreview({ src, isVideo }: { src: string; isVideo: boolean }) {
	return (
		<div className="space-y-2">
			<PreviewBar label={isVideo ? "Video" : "Audio"} />
			{isVideo ? (
				<video controls src={src} className="max-h-96 max-w-full rounded-lg border" />
			) : (
				<audio controls src={src} className="w-full" />
			)}
		</div>
	);
}

function escapeHtmlAttribute(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function HtmlPreview({ html, baseUrl }: { html: string; baseUrl: string }) {
	const { resolvedTheme } = useTheme();
	const [allowRemote, setAllowRemote] = useState(false);
	const switchId = useId();

	// The iframe is fully sandboxed (no scripts, forms or popups). Unless the
	// user opts in, the CSP also keeps the page from contacting remote servers.
	const head = allowRemote
		? `<base href="${escapeHtmlAttribute(baseUrl)}">`
		: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:; media-src data:">`;
	// System colors follow color-scheme, so the page matches the app theme.
	const scheme = resolvedTheme === "dark" ? "dark" : "light";
	const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8">${head}<style>:root{color-scheme:${scheme}}body{background:Canvas;color:CanvasText}</style></head><body>${html}</body></html>`;

	return (
		<div className="space-y-2">
			<PreviewBar label="HTML (scripts disabled)">
				<Switch id={switchId} size="sm" checked={allowRemote} onCheckedChange={setAllowRemote} />
				<Label
					htmlFor={switchId}
					className="text-xs font-normal"
					title="Scripts stay disabled either way"
				>
					Load remote resources
				</Label>
			</PreviewBar>
			<iframe
				srcDoc={srcDoc}
				title="HTML response preview"
				className="h-96 w-full rounded-lg border bg-background"
				sandbox=""
				referrerPolicy="no-referrer"
			/>
		</div>
	);
}

export function BinaryCard({
	src,
	mimeType,
	base64Length,
	downloadName,
}: {
	src: string;
	mimeType: string;
	base64Length: number;
	downloadName: string;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
			<div className="flex min-w-0 items-center gap-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
					<Binary className="size-4" />
				</span>
				<div className="min-w-0">
					<p className="text-sm">Binary content, no text view available</p>
					<p className="truncate font-mono text-xs text-muted-foreground">
						{mimeType} · {formatBytes(Math.floor((base64Length * 3) / 4))}
					</p>
				</div>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => downloadDataUrl(src, downloadName)}
			>
				<Download />
				Download
			</Button>
		</div>
	);
}
