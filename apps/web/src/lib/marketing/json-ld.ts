/**
 * Serialises structured data for a `<script type="application/ld+json">` element.
 *
 * Svelte renders the element's text as escaped HTML text (`&` becomes `&amp;`), which would
 * corrupt the JSON because script contents are not entity-decoded. Writing `&`, `<` and `>` as
 * JSON unicode escapes leaves nothing for Svelte to escape, can never close the element early,
 * and parses back to exactly the same characters.
 */
export function jsonLdText(data: Record<string, unknown>): string {
	return JSON.stringify(data)
		.replace(/&/g, '\\u0026')
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e');
}
