/** Copies text, falling back to execCommand where the async clipboard API is unavailable. */
export async function writeToClipboard(text: string): Promise<void> {
	if (window.isSecureContext && navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	// The async clipboard API is unavailable outside secure contexts.
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);
	textarea.select();
	const ok = document.execCommand("copy");
	textarea.remove();
	if (!ok) throw new Error("The browser rejected the copy command");
}
