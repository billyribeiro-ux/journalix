import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { db } from '#lib/server/db/index.ts';
import { contactMessage } from '#lib/server/db/schema.ts';
import { CONTACT_TOPICS, MESSAGE_MAX, type ContactField } from '#lib/marketing/site.ts';
import type { Actions } from './$types';

// The page must accept POST, so it is rendered on demand rather than prerendered.
export const prerender = false;

const ContactSchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Enter your name.'),
		v.maxLength(120, 'Keep your name under 120 characters.')
	),
	email: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Enter your email address.'),
		v.maxLength(254, 'That email address is too long.'),
		v.email('Enter a valid email address, like name@example.com.')
	),
	topic: v.picklist(
		CONTACT_TOPICS.map((t) => t.value),
		'Choose a topic.'
	),
	message: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(10, 'Write at least a sentence so we can help.'),
		v.maxLength(
			MESSAGE_MAX,
			`Keep your message under ${MESSAGE_MAX.toLocaleString('en-US')} characters.`
		)
	)
});

function text(data: FormData, key: string): string {
	const value = data.get(key);
	return typeof value === 'string' ? value : '';
}

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const values = {
			name: text(data, 'name'),
			email: text(data, 'email'),
			topic: text(data, 'topic'),
			message: text(data, 'message')
		};

		// Honeypot: people never see this field, so anything in it came from a bot. Report success
		// without storing anything so the bot learns nothing.
		if (text(data, 'company') !== '') {
			return { success: true as const };
		}

		const result = v.safeParse(ContactSchema, values);
		if (!result.success) {
			const errors: Partial<Record<ContactField, string>> = {};
			for (const issue of result.issues) {
				const key = v.getDotPath(issue) as ContactField | null;
				if (key && !errors[key]) errors[key] = issue.message;
			}
			return fail(400, { values, errors });
		}

		await db.insert(contactMessage).values(result.output);
		return { success: true as const };
	}
};
