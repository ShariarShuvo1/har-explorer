import { flattenSchema, type InferredSchema } from "./schema";

/**
 * A tiny document model so the same content can be rendered as Markdown and
 * as plain text without two hand-maintained generators drifting apart.
 */
export type DocBlock =
	| { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
	| { kind: "paragraph"; text: string }
	| { kind: "note"; text: string }
	| { kind: "fields"; items: DocField[] }
	| { kind: "list"; items: string[] }
	| { kind: "table"; columns: string[]; rows: DocCell[][] }
	| { kind: "schema"; schema: InferredSchema }
	| { kind: "code"; language: string; code: string }
	| { kind: "rule" };

export interface DocCell {
	text: string;
	code?: boolean;
}

export interface DocField {
	label: string;
	value: string;
	code?: boolean;
}

const TEXT_WIDTH = 70;
const MAX_CELL_LENGTH = 300;

function truncate(text: string, max = MAX_CELL_LENGTH): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function singleLine(text: string): string {
	return text.replace(/\r?\n|\r/g, " ");
}

function escapeMarkdown(text: string): string {
	return singleLine(text).replace(/[\\`*_[\]<>|~&#]/g, "\\$&");
}

function markdownCode(text: string, inTable = false): string {
	let content = singleLine(text);
	if (inTable) content = content.replace(/\|/g, "\\|");
	if (content === "") return "";
	const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
	const fence = "`".repeat(longestRun + 1);
	const pad = content.startsWith("`") || content.endsWith("`") ? " " : "";
	return `${fence}${pad}${content}${pad}${fence}`;
}

function markdownCell(cell: DocCell): string {
	const text = truncate(cell.text);
	if (text === "") return "—";
	return cell.code ? markdownCode(text, true) : escapeMarkdown(text);
}

function codeFence(code: string): string {
	const longestRun = Math.max(0, ...(code.match(/^`{3,}/gm) ?? []).map((run) => run.length));
	return "`".repeat(Math.max(3, longestRun + 1));
}

export function renderMarkdown(blocks: DocBlock[]): string {
	const out: string[] = [];

	for (const block of blocks) {
		switch (block.kind) {
			case "heading":
				out.push(`${"#".repeat(block.level)} ${escapeMarkdown(block.text)}`);
				break;
			case "paragraph":
				out.push(escapeMarkdown(block.text));
				break;
			case "note":
				out.push(`> ${escapeMarkdown(block.text)}`);
				break;
			case "fields":
				out.push(
					block.items
						.map(
							(item) =>
								`- **${escapeMarkdown(item.label)}**: ${
									item.value === ""
										? "—"
										: item.code
											? markdownCode(item.value)
											: escapeMarkdown(item.value)
								}`
						)
						.join("\n")
				);
				break;
			case "list":
				out.push(block.items.map((item) => `- ${escapeMarkdown(item)}`).join("\n"));
				break;
			case "table": {
				const header = `| ${block.columns.map(escapeMarkdown).join(" | ")} |`;
				const divider = `| ${block.columns.map(() => "---").join(" | ")} |`;
				const rows = block.rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`);
				out.push([header, divider, ...rows].join("\n"));
				break;
			}
			case "schema": {
				const { lines, truncated } = flattenSchema(block.schema);
				const rendered = lines.map((line) => {
					const indent = "  ".repeat(line.depth);
					const name = line.name === null ? "" : `${markdownCode(line.name)}: `;
					const optional = line.optional ? " _(optional)_" : "";
					return `${indent}- ${name}**${escapeMarkdown(line.type)}**${optional}`;
				});
				if (truncated > 0) rendered.push(`- _…and ${truncated} more fields_`);
				out.push(rendered.join("\n"));
				break;
			}
			case "code": {
				const fence = codeFence(block.code);
				out.push(`${fence}${block.language}\n${block.code}\n${fence}`);
				break;
			}
			case "rule":
				out.push("---");
				break;
		}
	}

	return out.join("\n\n") + "\n";
}

function padEnd(text: string, width: number): string {
	return text.length >= width ? text : text + " ".repeat(width - text.length);
}

export function renderPlainText(blocks: DocBlock[]): string {
	const out: string[] = [];

	for (const block of blocks) {
		switch (block.kind) {
			case "heading": {
				const text = singleLine(block.text);
				if (block.level === 1) {
					out.push(`${"=".repeat(TEXT_WIDTH)}\n${text}\n${"=".repeat(TEXT_WIDTH)}`);
				} else if (block.level === 2) {
					out.push(`${text.toUpperCase()}\n${"-".repeat(TEXT_WIDTH)}`);
				} else if (block.level === 3) {
					out.push(`${text}\n${"-".repeat(Math.min(Math.max(text.length, 3), TEXT_WIDTH))}`);
				} else {
					out.push(`${text}:`);
				}
				break;
			}
			case "paragraph":
			case "note":
				out.push(block.text);
				break;
			case "fields": {
				const width = Math.max(0, ...block.items.map((item) => item.label.length)) + 2;
				out.push(
					block.items
						.map((item) => `${padEnd(`${item.label}:`, width)}${singleLine(item.value) || "-"}`)
						.join("\n")
				);
				break;
			}
			case "list":
				out.push(block.items.map((item) => `  - ${singleLine(item)}`).join("\n"));
				break;
			case "table": {
				const rows = [
					block.columns,
					...block.rows.map((row) => row.map((cell) => truncate(singleLine(cell.text)) || "-")),
				];
				// The last column is left unpadded so long values do not stretch the layout.
				const widths = block.columns.map((_, col) =>
					Math.min(40, Math.max(...rows.map((row) => (row[col] ?? "").length)))
				);
				const lines = rows.map((row, index) => {
					const line = row
						.map((cell, col) => (col === row.length - 1 ? cell : padEnd(cell, widths[col])))
						.join("  ");
					return `  ${index === 0 ? line.toUpperCase() : line}`;
				});
				out.push(lines.join("\n"));
				break;
			}
			case "schema": {
				const { lines, truncated } = flattenSchema(block.schema);
				const rendered = lines.map((line) => {
					const indent = "  ".repeat(line.depth + 1);
					const name = line.name === null ? "" : `${line.name}: `;
					return `${indent}- ${name}${line.type}${line.optional ? " (optional)" : ""}`;
				});
				if (truncated > 0) rendered.push(`  - ...and ${truncated} more fields`);
				out.push(rendered.join("\n"));
				break;
			}
			case "code":
				out.push(block.code);
				break;
			case "rule":
				out.push("-".repeat(TEXT_WIDTH));
				break;
		}
	}

	return out.join("\n\n") + "\n";
}
