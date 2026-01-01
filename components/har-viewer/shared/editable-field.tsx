"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";

interface EditableFieldProps {
	value: string;
	onSave: (value: string) => void;
	className?: string;
	multiline?: boolean;
}

export function EditableField({
	value,
	onSave,
	className,
	multiline = false,
}: EditableFieldProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(value);
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isEditing]);

	const handleDoubleClick = () => {
		setIsEditing(true);
		setEditValue(value);
	};

	const handleSave = () => {
		if (editValue !== value) {
			onSave(editValue);
		}
		setIsEditing(false);
	};

	const handleKeyDown = (
		e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		if (e.key === "Enter" && !multiline) {
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			setEditValue(value);
			setIsEditing(false);
		} else if (e.key === "Enter" && multiline && e.ctrlKey) {
			e.preventDefault();
			handleSave();
		}
	};

	const handleBlur = () => {
		handleSave();
	};

	if (isEditing) {
		if (multiline) {
			return (
				<textarea
					ref={inputRef as React.RefObject<HTMLTextAreaElement>}
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
					aria-label="Edit field value"
					className={cn(
						"w-full px-2 py-1 border-2 border-primary rounded bg-control-bg text-foreground focus:outline-none resize-none h-[50vh] overflow-auto",
						className
					)}
					rows={Math.min(
						20,
						Math.max(3, editValue.split("\n").length)
					)}
				/>
			);
		}

		return (
			<input
				ref={inputRef as React.RefObject<HTMLInputElement>}
				type="text"
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
				aria-label="Edit field value"
				className={cn(
					"w-full px-2 py-1 border-2 border-primary rounded bg-control-bg text-foreground focus:outline-none",
					className
				)}
			/>
		);
	}

	return (
		<div
			onDoubleClick={handleDoubleClick}
			className={cn(
				"cursor-text hover:bg-control-bg/50 transition-colors rounded px-2 py-1 min-h-8 flex items-center text-foreground",
				className
			)}
			title="Double-click to edit"
		>
			{value || (
				<span className="text-muted italic">
					Double-click to add value
				</span>
			)}
		</div>
	);
}
