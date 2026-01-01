"use client";

import { Link2, Send, Code, Cookie } from "lucide-react";
import { HAREntry } from "@/lib/stores/har-store";
import { DetailSection } from "./shared-components";
import { EditableField } from "../shared/editable-field";
import { EditableJsonHighlighter } from "../shared/editable-json-highlighter";
import { CopyButton } from "@/components/ui/copy-button";
import { formatResponseContent } from "./utils";
import { useFocusMode } from "./focus-context";

interface RequestTabProps {
	entry: HAREntry;
	onUpdateField: (path: string[], value: string | number) => void;
}

export function RequestTab({ entry, onUpdateField }: RequestTabProps) {
	const { isFocusMode } = useFocusMode();
	return (
		<div className="space-y-3">
			<DetailSection
				title="Query Parameters"
				icon={<Link2 className="w-3.5 h-3.5 text-blue-500" />}
			>
				{entry.request.queryString.length > 0 ? (
					<div className="space-y-1">
						{entry.request.queryString.map((param, i) => (
							<div
								key={i}
								className="grid grid-cols-3 gap-2 py-1.5 px-2 bg-card/40 rounded border border-border/30"
							>
								<EditableField
									value={param.name}
									onSave={(value) =>
										onUpdateField(
											[
												"request",
												"queryString",
												i.toString(),
												"name",
											],
											value
										)
									}
									className="font-mono text-xs font-medium text-primary"
								/>
								<EditableField
									value={param.value}
									onSave={(value) =>
										onUpdateField(
											[
												"request",
												"queryString",
												i.toString(),
												"value",
											],
											value
										)
									}
									className="font-mono text-xs col-span-2 break-all"
								/>
							</div>
						))}
					</div>
				) : (
					<div className="text-xs text-muted italic py-2">
						No query parameters
					</div>
				)}
			</DetailSection>

			{entry.request.postData && (
				<DetailSection
					title="Request Payload"
					icon={<Send className="w-3.5 h-3.5 text-green-500" />}
				>
					{entry.request.postData.mimeType?.includes("json") &&
					entry.request.postData.text ? (
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-[10px] text-muted">
								<Code className="w-3 h-3" />
								<span className="font-mono">
									{entry.request.postData.mimeType}
								</span>
							</div>
							<EditableJsonHighlighter
								content={formatResponseContent(
									entry.request.postData.text,
									entry.request.postData.mimeType
								)}
								onSave={(value) =>
									onUpdateField(
										["request", "postData", "text"],
										value
									)
								}
								isFocusMode={isFocusMode}
							/>
						</div>
					) : (
						<div className="space-y-2">
							{entry.request.postData.mimeType && (
								<div className="flex items-center gap-2 text-[10px] text-muted mb-1">
									<Code className="w-3 h-3" />
									<span className="font-mono">
										{entry.request.postData.mimeType}
									</span>
								</div>
							)}
							<EditableField
								value={entry.request.postData.text || ""}
								onSave={(value) =>
									onUpdateField(
										["request", "postData", "text"],
										value
									)
								}
								multiline
								className="font-mono text-xs bg-card/60 p-3 rounded border border-border/30 whitespace-pre-wrap break-all"
							/>
						</div>
					)}
				</DetailSection>
			)}

			<DetailSection
				title="Cookies"
				icon={<Cookie className="w-3.5 h-3.5 text-orange-500" />}
			>
				{entry.request.cookies.length > 0 ? (
					<div className="space-y-1">
						{entry.request.cookies.map((cookie, i) => (
							<div
								key={i}
								className="py-1.5 px-2 bg-card/40 rounded border border-border/30"
							>
								<div className="flex items-center justify-between gap-2 mb-1">
									<span className="text-[10px] text-muted">
										Cookie {i + 1}
									</span>
									<CopyButton
										content={JSON.stringify(
											cookie,
											null,
											2
										)}
										size="sm"
										className="p-1"
									/>
								</div>
								<pre className="font-mono text-xs whitespace-pre-wrap break-all text-foreground/80">
									{JSON.stringify(cookie, null, 2)}
								</pre>
							</div>
						))}
					</div>
				) : (
					<div className="text-xs text-muted italic py-2">
						No cookies
					</div>
				)}
			</DetailSection>
		</div>
	);
}
