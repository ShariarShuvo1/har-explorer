import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/constants";
import { THEME_COLORS } from "@/lib/seo/metadata";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: SITE_NAME,
		short_name: SITE_NAME,
		description: SITE_DESCRIPTION,
		start_url: "/",
		display: "standalone",
		background_color: THEME_COLORS.light,
		theme_color: THEME_COLORS.light,
		categories: ["developer", "productivity", "utilities"],
		icons: [
			{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
			{ src: "/icon.png", sizes: "512x512", type: "image/png" },
			{ src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
		],
	};
}
