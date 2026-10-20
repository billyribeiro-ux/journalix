/**
 * Encryption at rest for market-data API keys: AES-256-GCM with a random 96-bit IV per secret
 * and the provider config id as additional authenticated data, so a ciphertext cannot be moved
 * to another row. Stored as base64(iv ‖ tag ‖ ciphertext).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PROVIDER_KEY_SECRET } from '$app/env/private';

const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(): Buffer {
	if (!PROVIDER_KEY_SECRET) throw new Error('PROVIDER_KEY_SECRET is not set');
	const k = Buffer.from(PROVIDER_KEY_SECRET, 'base64');
	if (k.length !== 32) throw new Error('PROVIDER_KEY_SECRET must decode to 32 bytes');
	return k;
}

export function encryptSecret(plaintext: string, aad: string): string {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv('aes-256-gcm', key(), iv);
	cipher.setAAD(Buffer.from(aad, 'utf8'));
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decryptSecret(payload: string, aad: string): string {
	const data = Buffer.from(payload, 'base64');
	if (data.length < IV_BYTES + TAG_BYTES) throw new Error('Ciphertext is truncated');
	const iv = data.subarray(0, IV_BYTES);
	const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
	const ciphertext = data.subarray(IV_BYTES + TAG_BYTES);
	const decipher = createDecipheriv('aes-256-gcm', key(), iv);
	decipher.setAAD(Buffer.from(aad, 'utf8'));
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** `••••3F9A` — enough to recognise a key, never enough to use it. */
export function secretHint(secret: Readonly<Record<string, string>>): string | null {
	const primary = secret['apiKey'] ?? Object.values(secret)[0];
	if (!primary) return null;
	return `••••${primary.slice(-4)}`;
}
