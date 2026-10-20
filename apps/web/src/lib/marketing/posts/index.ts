import type { Post } from './types.ts';
import { post as rMultiples } from './r-multiples-for-options.ts';
import { post as fills } from './fills-not-positions.ts';
import { post as attribution } from './reading-pnl-attribution.ts';

export type { Post, PostBlock } from './types.ts';

/** All published posts, newest first. */
export const POSTS: readonly Post[] = [rMultiples, fills, attribution].toSorted((a, b) =>
	b.date.localeCompare(a.date)
);

export function findPost(slug: string): Post | undefined {
	return POSTS.find((p) => p.slug === slug);
}
