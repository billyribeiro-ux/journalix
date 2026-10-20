import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

export interface NavLink {
	readonly label: string;
	/**
	 * Resolves the link at render time: during server rendering `resolve()` produces a path
	 * relative to the page being rendered, so it must not run at module load.
	 */
	readonly href: () => ResolvedPathname;
	/** Absolute pathname, used to mark the current page. */
	readonly path: string;
}

export interface FooterColumn {
	readonly title: string;
	readonly links: readonly NavLink[];
}

/** Primary navigation in the site header. */
export const NAV_LINKS: readonly NavLink[] = [
	{ label: 'Features', href: () => resolve('features'), path: '/features' },
	{ label: 'Options', href: () => resolve('options'), path: '/options' },
	{ label: 'Pricing', href: () => resolve('pricing'), path: '/pricing' },
	{ label: 'Blog', href: () => resolve('blog'), path: '/blog' }
];

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
	{
		title: 'Product',
		links: [
			{ label: 'Features', href: () => resolve('features'), path: '/features' },
			{ label: 'For options traders', href: () => resolve('options'), path: '/options' },
			{ label: 'Pricing', href: () => resolve('pricing'), path: '/pricing' },
			{ label: 'Changelog', href: () => resolve('changelog'), path: '/changelog' }
		]
	},
	{
		title: 'Company',
		links: [
			{ label: 'About', href: () => resolve('about'), path: '/about' },
			{ label: 'Blog', href: () => resolve('blog'), path: '/blog' },
			{ label: 'Contact', href: () => resolve('contact'), path: '/contact' }
		]
	},
	{
		title: 'Legal',
		links: [
			{ label: 'Privacy policy', href: () => resolve('legal/privacy'), path: '/legal/privacy' },
			{ label: 'Terms of service', href: () => resolve('legal/terms'), path: '/legal/terms' },
			{
				label: 'Risk disclosure',
				href: () => resolve('legal/risk-disclosure'),
				path: '/legal/risk-disclosure'
			}
		]
	}
];

/** Effective date shared by the legal documents. */
export const LEGAL_EFFECTIVE_DATE = '2026-10-20';

export const CONTACT_TOPICS = [
	{ value: 'general', label: 'General question' },
	{ value: 'support', label: 'Help with the app' },
	{ value: 'billing', label: 'Plans and billing' },
	{ value: 'privacy', label: 'Privacy or data request' },
	{ value: 'feedback', label: 'Feature request or feedback' }
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]['value'];

export type ContactField = 'name' | 'email' | 'topic' | 'message';

/** Longest contact message accepted, in characters. */
export const MESSAGE_MAX = 5000;

/** Formats a `YYYY-MM-DD` date as "October 20, 2026" without time-zone drift. */
export function formatLongDate(day: string): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	}).format(new Date(`${day}T00:00:00Z`));
}
