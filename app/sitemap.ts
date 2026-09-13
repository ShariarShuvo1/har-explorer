import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/constants";

// The app is a single page. No lastModified: a build-time date would claim the
// page changes on every deploy, which search engines learn to ignore.
export default function sitemap(): MetadataRoute.Sitemap {
	return [{ url: `${SITE_URL}/` }];
}
