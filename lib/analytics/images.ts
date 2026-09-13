import type { HAREntry } from "@/lib/har-types";
import {
	extractPath,
	extractPathname,
	getBaseMimeType,
	getEntryContentSize,
	getHeaderValue,
} from "@/lib/har-parser";
import { getResourceType } from "@/lib/resource-type";
import { percentOf } from "./format";

export type ImageFormat =
	"JPEG" | "PNG" | "GIF" | "WebP" | "AVIF" | "JPEG XL" | "SVG" | "ICO" | "BMP" | "TIFF" | "Other";

export type ImageIssue = "large" | "legacy" | "uncompressed";

const MIME_FORMATS: Record<string, ImageFormat> = {
	"image/jpeg": "JPEG",
	"image/jpg": "JPEG",
	"image/pjpeg": "JPEG",
	"image/png": "PNG",
	"image/apng": "PNG",
	"image/gif": "GIF",
	"image/webp": "WebP",
	"image/avif": "AVIF",
	"image/jxl": "JPEG XL",
	"image/svg+xml": "SVG",
	"image/x-icon": "ICO",
	"image/vnd.microsoft.icon": "ICO",
	"image/bmp": "BMP",
	"image/x-ms-bmp": "BMP",
	"image/tiff": "TIFF",
};

const EXTENSION_FORMATS: Record<string, ImageFormat> = {
	jpg: "JPEG",
	jpeg: "JPEG",
	png: "PNG",
	apng: "PNG",
	gif: "GIF",
	webp: "WebP",
	avif: "AVIF",
	jxl: "JPEG XL",
	svg: "SVG",
	ico: "ICO",
	bmp: "BMP",
	tif: "TIFF",
	tiff: "TIFF",
};

export const LARGE_IMAGE_BYTES = 100 * 1024;
const VERY_LARGE_IMAGE_BYTES = 500 * 1024;
export const LEGACY_MIN_BYTES = 50 * 1024;
const COMPRESSIBLE_MIN_BYTES = 1024;

/** Rough size reduction from converting to WebP/AVIF. */
const LEGACY_FORMAT_SAVINGS: Partial<Record<ImageFormat, number>> = {
	JPEG: 0.25,
	PNG: 0.25,
	GIF: 0.3,
	BMP: 0.8,
	TIFF: 0.8,
};

/**
 * Formats that are not compressed internally and benefit from gzip/Brotli.
 * JPEG, PNG, WebP, etc. are already compressed, so Content-Encoding is moot.
 */
const COMPRESSIBLE_FORMAT_SAVINGS: Partial<Record<ImageFormat, number>> = {
	SVG: 0.5,
	ICO: 0.5,
	BMP: 0.5,
	TIFF: 0.5,
};

export const IMAGE_ISSUE_DETAILS: Record<ImageIssue, { label: string; recommendation: string }> = {
	large: {
		label: "Large file",
		recommendation: "Resize to the displayed dimensions or serve responsive sizes",
	},
	legacy: {
		label: "Legacy format",
		recommendation: "Convert to WebP or AVIF",
	},
	uncompressed: {
		label: "No compression",
		recommendation: "Enable gzip or Brotli for this format",
	},
};

function getImageFormat(entry: HAREntry): ImageFormat {
	const mime = getBaseMimeType(entry.response.content.mimeType);
	const fromMime = MIME_FORMATS[mime];
	if (fromMime) return fromMime;
	const extension = /\.([a-z0-9]+)$/.exec(extractPathname(entry.request.url).toLowerCase())?.[1];
	return (extension && EXTENSION_FORMATS[extension]) || "Other";
}

function isImageEntry(entry: HAREntry): boolean {
	return (
		getBaseMimeType(entry.response.content.mimeType).startsWith("image/") ||
		getResourceType(entry) === "img"
	);
}

function wasTransferred(entry: HAREntry): boolean {
	return entry.response.status !== 304 && entry.response._transferSize !== 0;
}

function isCompressedInTransit(entry: HAREntry): boolean {
	const encoding = getHeaderValue(entry.response.headers, "content-encoding")?.trim().toLowerCase();
	if (encoding && encoding !== "identity") return true;
	const { bodySize, content } = entry.response;
	return bodySize > 0 && content.size > 0 && bodySize < content.size * 0.9;
}

export interface ImageOpportunity {
	index: number;
	url: string;
	path: string;
	format: ImageFormat;
	size: number;
	issues: ImageIssue[];
	potentialSaving: number;
	severity: "high" | "medium" | "low";
}

export interface ImageAnalytics {
	totalImages: number;
	totalImageSize: number;
	largeCount: number;
	legacyCount: number;
	uncompressedCount: number;
	potentialSavings: number;
	savingsPercentage: number;
	formats: { format: ImageFormat; count: number; size: number }[];
	opportunityCount: number;
	topOpportunities: ImageOpportunity[];
}

export function computeImages(
	entries: HAREntry[],
	indices: number[],
	{ top = 10 } = {}
): ImageAnalytics | null {
	let totalImages = 0;
	let totalImageSize = 0;
	let largeCount = 0;
	let legacyCount = 0;
	let uncompressedCount = 0;
	let potentialSavings = 0;
	const formatMap = new Map<ImageFormat, { count: number; size: number }>();
	const opportunities: ImageOpportunity[] = [];

	for (const index of indices) {
		const entry = entries[index];
		if (!isImageEntry(entry)) continue;

		const size = getEntryContentSize(entry);
		const format = getImageFormat(entry);
		totalImages++;
		totalImageSize += size;

		const formatStats = formatMap.get(format) ?? { count: 0, size: 0 };
		formatStats.count++;
		formatStats.size += size;
		formatMap.set(format, formatStats);

		const issues: ImageIssue[] = [];
		// Fixes overlap (a converted BMP no longer needs gzip), so the
		// estimate is the best single fix rather than a sum.
		let saving = 0;

		if (size > LARGE_IMAGE_BYTES) {
			issues.push("large");
			largeCount++;
		}
		const legacyRate = LEGACY_FORMAT_SAVINGS[format];
		if (legacyRate && size > LEGACY_MIN_BYTES) {
			issues.push("legacy");
			legacyCount++;
			saving = Math.max(saving, size * legacyRate);
		}
		const compressionRate = COMPRESSIBLE_FORMAT_SAVINGS[format];
		if (
			compressionRate &&
			size > COMPRESSIBLE_MIN_BYTES &&
			wasTransferred(entry) &&
			!isCompressedInTransit(entry)
		) {
			issues.push("uncompressed");
			uncompressedCount++;
			saving = Math.max(saving, size * compressionRate);
		}

		if (issues.length === 0) continue;
		saving = Math.round(saving);
		potentialSavings += saving;
		opportunities.push({
			index,
			url: entry.request.url,
			path: extractPath(entry.request.url),
			format,
			size,
			issues,
			potentialSaving: saving,
			severity:
				size > VERY_LARGE_IMAGE_BYTES
					? "high"
					: issues.includes("large") || issues.includes("uncompressed")
						? "medium"
						: "low",
		});
	}

	if (totalImages === 0) return null;

	const formats = Array.from(formatMap, ([format, stats]) => ({
		format,
		...stats,
	})).sort((a, b) => b.size - a.size || b.count - a.count);

	opportunities.sort((a, b) => b.potentialSaving - a.potentialSaving || b.size - a.size);

	return {
		totalImages,
		totalImageSize,
		largeCount,
		legacyCount,
		uncompressedCount,
		potentialSavings,
		savingsPercentage: percentOf(potentialSavings, totalImageSize),
		formats,
		opportunityCount: opportunities.length,
		topOpportunities: opportunities.slice(0, top),
	};
}
