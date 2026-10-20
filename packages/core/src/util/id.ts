/**
 * RFC 9562 UUIDv7: time-ordered, so rows sort by creation time and B-tree indexes stay compact.
 * Uses the Web Crypto API, available in browsers, Node 24 and the Tauri webview.
 */
export function newId(now: number = Date.now()): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	const ms = BigInt(Math.max(0, Math.floor(now)));
	for (let i = 0; i < 6; i++) {
		bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
	}
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // RFC 9562 variant
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
