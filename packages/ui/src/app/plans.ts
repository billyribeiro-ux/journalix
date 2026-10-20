/**
 * Plan catalogue shared by the pricing page and the in-app billing screen.
 * Billing is not connected to a payment processor yet: every account has full access during
 * early access, and these definitions only drive the UI.
 */
export type PlanId = 'starter' | 'pro' | 'desk';
export type BillingInterval = 'monthly' | 'yearly';

export interface Plan {
	readonly id: PlanId;
	readonly name: string;
	readonly summary: string;
	/** USD per month when billed monthly. */
	readonly monthly: number;
	/** USD per month when billed yearly. */
	readonly yearly: number;
	readonly includes: readonly string[];
	readonly featured?: boolean;
}

export const PLANS: readonly Plan[] = [
	{
		id: 'starter',
		name: 'Starter',
		summary: 'For one account and the full journal.',
		monthly: 0,
		yearly: 0,
		includes: [
			'1 trading account',
			'Full journal: legs, fills, stops and targets',
			'Chart review on simulated candles',
			'All core analytics and the P&L calendar',
			'Playbooks, tags and notebook'
		]
	},
	{
		id: 'pro',
		name: 'Pro',
		summary: 'For active options traders with real market data.',
		monthly: 29,
		yearly: 24,
		featured: true,
		includes: [
			'Everything in Starter',
			'Unlimited accounts',
			'Your own market data provider',
			'Payoff diagrams, IV, Greeks and attribution',
			'All reports and breakdowns',
			'Export your journal'
		]
	},
	{
		id: 'desk',
		name: 'Desk',
		summary: 'For traders who want the desktop app.',
		monthly: 59,
		yearly: 49,
		includes: [
			'Everything in Pro',
			'Desktop app for macOS, Windows and Linux',
			'Licence for up to 3 machines',
			'Priority support'
		]
	}
];

export function planPrice(plan: Plan, interval: BillingInterval): number {
	return interval === 'yearly' ? plan.yearly : plan.monthly;
}
