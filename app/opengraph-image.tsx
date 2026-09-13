import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo/constants";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FEATURES = ["Waterfall", "Analytics", "Issue detection", "Compare", "OpenAPI export"];

/** Brand mark from components/common/logo.tsx (light colors). */
function Mark({ size: px }: { size: number }) {
	return (
		<svg width={px} height={px} viewBox="32 32 1089 1089">
			<rect x="65" y="232" width="512" height="111" rx="55.5" fill="#443e86" />
			<rect x="257" y="425" width="510" height="111" rx="55.5" fill="#5ed0ea" />
			<rect x="444" y="618" width="475" height="111" rx="55.5" fill="#443e86" />
			<rect x="577" y="811" width="512" height="111" rx="55.5" fill="#443e86" />
		</svg>
	);
}

export default function OpenGraphImage() {
	const host = new URL(SITE_URL).host;

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "72px 80px",
				background: "linear-gradient(135deg, #ffffff 0%, #f1f4f9 100%)",
				color: "#0f172a",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 28 }}>
				<Mark size={112} />
				<div style={{ fontSize: 64, letterSpacing: -1.5 }}>{SITE_NAME}</div>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
				<div style={{ fontSize: 54, lineHeight: 1.15, letterSpacing: -1, maxWidth: 980 }}>
					{SITE_TAGLINE}
				</div>
				<div style={{ display: "flex", gap: 12 }}>
					{FEATURES.map((feature) => (
						<div
							key={feature}
							style={{
								display: "flex",
								padding: "10px 20px",
								borderRadius: 999,
								border: "2px solid #dbe2ec",
								background: "#ffffff",
								fontSize: 24,
								color: "#475569",
							}}
						>
							{feature}
						</div>
					))}
				</div>
			</div>
			<div style={{ display: "flex", fontSize: 26, color: "#0090b7" }}>{host}</div>
		</div>,
		size
	);
}
