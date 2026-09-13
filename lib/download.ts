/** Starts a client-side download and releases the object URL afterwards. */
export function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.rel = "noopener";
	anchor.style.display = "none";
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	// Revoking synchronously can cancel the download in some browsers.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Decodes a `data:` URL into a Blob, or null when it is malformed. */
export function dataUrlToBlob(dataUrl: string): Blob | null {
	const match = /^data:([^,]*),([\s\S]*)$/.exec(dataUrl);
	if (!match) return null;
	const meta = match[1];
	const isBase64 = /;base64$/i.test(meta);
	const type = meta.replace(/;base64$/i, "").split(";")[0] || "application/octet-stream";
	try {
		if (!isBase64) return new Blob([decodeURIComponent(match[2])], { type });
		const binary = atob(match[2].replace(/\s/g, ""));
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return new Blob([bytes], { type });
	} catch {
		return null;
	}
}

export function extensionForMime(mimeType: string): string {
	const subtype = mimeType.split("/")[1]?.split(/[+;]/)[0]?.trim();
	if (!subtype) return "bin";
	return subtype === "jpeg" ? "jpg" : subtype === "javascript" ? "js" : subtype;
}
