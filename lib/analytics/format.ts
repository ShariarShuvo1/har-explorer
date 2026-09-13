/** Compact byte label for chart axes (e.g. "1.5 MB"). */
export function formatBytesAxis(value: unknown): string {
	const bytes = Number(value);
	if (!Number.isFinite(bytes) || bytes <= 0) return "0";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const scaled = bytes / Math.pow(1024, exponent);
	const rounded = scaled >= 100 ? Math.round(scaled) : Number(scaled.toFixed(1));
	return `${rounded} ${units[exponent]}`;
}

/** Compact duration label for chart axes. */
export function formatMsAxis(value: unknown): string {
	const ms = Number(value);
	if (!Number.isFinite(ms) || ms <= 0) return "0";
	if (ms < 1000) return `${Math.round(ms)} ms`;
	if (ms < 60_000) return `${Number((ms / 1000).toFixed(1))} s`;
	return `${Number((ms / 60_000).toFixed(1))} m`;
}

/** Seconds offset label, e.g. "1.25s". */
export function formatSeconds(seconds: unknown): string {
	const value = Number(seconds);
	if (!Number.isFinite(value)) return "";
	return `${Number(value.toFixed(value < 10 ? 2 : 1))}s`;
}

export function truncateLabel(value: unknown, max = 22): string {
	const text = String(value ?? "");
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function percentOf(part: number, total: number): number {
	return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function plural(count: number, word: string, pluralWord = `${word}s`): string {
	return `${count.toLocaleString()} ${count === 1 ? word : pluralWord}`;
}
