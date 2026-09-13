/**
 * Serializes structured data for a `<script type="application/ld+json">` tag.
 * `<` is escaped so a string containing `</script>` cannot close the tag.
 */
export function serializeJsonLd(data: unknown): string {
	return JSON.stringify(data).replace(/</g, "\\u003c");
}
