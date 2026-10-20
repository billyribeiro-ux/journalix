import { loadDemoTrade } from '#lib/marketing/demo-trade.ts';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = async () => {
	return { demo: await loadDemoTrade() };
};
