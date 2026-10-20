import { error } from '@sveltejs/kit';
import { POSTS, findPost } from '#lib/marketing/posts/index.ts';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => POSTS.map((post) => ({ slug: post.slug }));

export const load: PageLoad = ({ params }) => {
	const post = findPost(params.slug);
	if (!post) error(404, 'Post not found');
	return { post };
};
