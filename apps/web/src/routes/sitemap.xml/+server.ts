import { POSTS } from '#lib/marketing/posts/index.ts';
import { LEGAL_EFFECTIVE_DATE } from '#lib/marketing/site.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

/** Date the static marketing pages last changed. */
const SITE_UPDATED = '2026-10-20';

const STATIC_PAGES: readonly { readonly path: string; readonly lastmod: string }[] = [
	{ path: '/', lastmod: SITE_UPDATED },
	{ path: '/features', lastmod: SITE_UPDATED },
	{ path: '/options', lastmod: SITE_UPDATED },
	{ path: '/pricing', lastmod: SITE_UPDATED },
	{ path: '/about', lastmod: SITE_UPDATED },
	{ path: '/blog', lastmod: POSTS[0]?.date ?? SITE_UPDATED },
	{ path: '/changelog', lastmod: SITE_UPDATED },
	{ path: '/contact', lastmod: SITE_UPDATED },
	{ path: '/legal/privacy', lastmod: LEGAL_EFFECTIVE_DATE },
	{ path: '/legal/terms', lastmod: LEGAL_EFFECTIVE_DATE },
	{ path: '/legal/risk-disclosure', lastmod: LEGAL_EFFECTIVE_DATE }
];

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET: RequestHandler = ({ url }) => {
	const pages = [
		...STATIC_PAGES,
		...POSTS.map((post) => ({ path: `/blog/${post.slug}`, lastmod: post.date }))
	];

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...pages.map(
			(p) =>
				`\t<url><loc>${escapeXml(`${url.origin}${p.path}`)}</loc><lastmod>${p.lastmod}</lastmod></url>`
		),
		'</urlset>',
		''
	].join('\n');

	return new Response(body, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
};
