import type { Post } from './types.ts';

export const post: Post = {
	slug: 'r-multiples-for-options',
	title: 'How to calculate R-multiples for options trades',
	description:
		'R-multiples make trades of different sizes comparable. For options, the hard part is deciding what 1R is: premium paid, max loss, or the risk you planned. Worked examples for debit, credit and undefined-risk trades.',
	date: '2026-10-06',
	readingMinutes: 7,
	body: [
		{
			type: 'p',
			text: 'An R-multiple expresses a trade’s result in units of the risk you took to get it. Make $600 on a trade where you were prepared to lose $300 and the trade is +2R. Lose $150 on the same plan and it is −0.5R. Once every trade is measured this way, a $40 scalp and a $4,000 swing sit on the same scale, and averages, distributions and expectancy start to mean something.'
		},
		{
			type: 'p',
			text: 'For shares the definition is mechanical: 1R is the distance from entry to the initial stop, multiplied by the position size. Options make it harder, because there are several defensible answers to “how much was at risk?”, and they can differ by a factor of ten on the same trade.'
		},
		{
			type: 'formula',
			text: 'R-multiple = net P&L ÷ initial risk',
			caption:
				'Net P&L includes fees. Initial risk is fixed when the trade opens and never moves afterwards.'
		},
		{
			type: 'p',
			text: 'Two rules hold whatever definition of risk you choose. First, the risk is set at entry. If you move your stop later, R does not change: a trade that turned into a bigger loss because the stop was widened should show as a bigger negative R, not be quietly re-scaled. Second, fees belong in the numerator. On small options trades, commissions are a visible share of the result, and leaving them out flatters every number.'
		},
		{ type: 'h2', id: 'three-candidates', text: 'Three candidates for 1R' },
		{
			type: 'ul',
			items: [
				'Structural max loss: the most the position can lose at expiry, computed from strikes and premiums. For a long option, the premium paid. For a vertical, the width minus the credit, or the debit paid.',
				'Planned risk: the dollar amount you decided to risk before entering, usually defined by an exit rule such as “close if the premium halves” or “close if the spread doubles”.',
				'Stop distance on the underlying: the share-style definition. It works for stock and futures legs but translates poorly to options, because a $2 move in the underlying is not a fixed dollar amount of option P&L.'
			]
		},
		{
			type: 'p',
			text: 'None of these is universally correct. The right choice is the one that matches how you actually manage the trade, applied consistently. A trader who always holds long options to zero or target is genuinely risking the full premium. A trader who always cuts at half the premium is risking half.'
		},
		{ type: 'h2', id: 'debit', text: 'Debit trades: premium paid or planned exit' },
		{
			type: 'p',
			text: 'Say you buy one call for $3.20. The contract multiplier is 100, so you pay $320. Commission is $0.65 per contract each way. You sell it later for $5.00.'
		},
		{
			type: 'formula',
			text: 'Net P&L = (5.00 − 3.20) × 100 − 1.30 = $178.70',
			caption: 'One contract, $0.65 commission on the way in and on the way out.'
		},
		{
			type: 'p',
			text: 'If 1R is the premium, the trade made 178.70 ÷ 320 = +0.56R. If your rule was to sell the call if it fell to $1.60, your planned risk was (3.20 − 1.60) × 100 = $160, and the same trade is 178.70 ÷ 160 = +1.12R.'
		},
		{
			type: 'p',
			text: 'Neither number is wrong, but they tell different stories about your edge. If you consistently define risk as the full premium while actually cutting losers at half, your losing trades will cluster around −0.5R and your system will look safer than it is per unit of what you really put on the line. Pick the definition that describes your behaviour.'
		},
		{ type: 'h2', id: 'credit', text: 'Credit trades: the risk is the width, not the credit' },
		{
			type: 'p',
			text: 'Credit spreads invert the intuition. You receive money up front, so it is tempting to measure everything against the credit. But the credit is your maximum profit, not your risk.'
		},
		{
			type: 'p',
			text: 'Sell two 640/635 put spreads for $1.40 each. The width is $5.00, so each spread can lose at most 5.00 − 1.40 = $3.60, or $360. Two spreads put $720 at risk to make at most $280. Buy them back at $0.70 and the gross profit is (1.40 − 0.70) × 100 × 2 = $140.'
		},
		{
			type: 'table',
			caption: 'The same closed credit spread under two definitions of risk (fees omitted)',
			head: ['Definition of 1R', 'Initial risk', 'P&L', 'R-multiple'],
			rows: [
				['Structural max loss', '$720', '+$140', '+0.19R'],
				['Planned exit at 2× credit', '$280', '+$140', '+0.50R']
			],
			numeric: [1, 2, 3]
		},
		{
			type: 'p',
			text: 'The planned-exit row assumes a rule of closing the spread if it trades at $2.80, twice the credit: (2.80 − 1.40) × 100 × 2 = $280. Many premium sellers manage this way, and for them the structural number understates every winner. Others let spreads run to expiry, in which case the structural max loss is the honest denominator. A high win rate on credit spreads with average winners of +0.2R is a very different business from the same win rate at +0.5R.'
		},
		{ type: 'h2', id: 'undefined', text: 'Undefined risk: you must choose a number' },
		{
			type: 'p',
			text: 'For a naked short put the structural max loss exists but is useless. Selling the 200 put for $3.00 has a theoretical maximum loss of (200 − 3) × 100 = $19,700, the loss if the stock goes to zero. Every result divided by that rounds to 0.00R. For a naked short call the maximum loss is unbounded, and R cannot be computed from structure at all.'
		},
		{
			type: 'p',
			text: 'Undefined-risk trades need planned risk. The common conventions are a multiple of the credit (close at 2× or 3× the premium received), a fixed dollar amount, or the buying-power reduction your broker applies. Whichever you use, write it down before you enter. If you only decide what the risk was after the trade is closed, the R-multiple measures your hindsight, not your trading.'
		},
		{ type: 'h2', id: 'scaling', text: 'Adds, partial exits and multiple legs' },
		{
			type: 'p',
			text: 'Scaling complicates any per-trade metric. If you open three contracts and add two more, the risk on the full position is larger than the risk at the first fill. A consistent approach is to measure risk on the largest size the position reached and divide the net P&L of all fills by it. Partial exits then fall out naturally: profit taken on part of the position counts toward the same trade’s P&L, against the same risk.'
		},
		{
			type: 'p',
			text: 'For multi-leg structures, compute max loss for the structure as a whole, not per leg. The long put in a put credit spread has a max loss of its premium on its own, but as part of the spread it reduces risk. Treating legs separately produces numbers that don’t correspond to anything you actually held.'
		},
		{ type: 'h2', id: 'journalix', text: 'How Journalix decides' },
		{
			type: 'p',
			text: 'Journalix computes R for every closed trade using the first of these that applies:'
		},
		{
			type: 'ol',
			items: [
				'Planned risk, if you entered a dollar amount on the trade.',
				'Stop distance, for single-leg stock or futures trades with an initial stop: the distance from average entry to the first stop, times the peak position size.',
				'Structural max loss, for options structures where the loss is bounded.'
			]
		},
		{
			type: 'p',
			text: 'Options trades without planned risk therefore default to max loss, which is accurate for traders who hold to expiry and conservative for those who manage early. If you manage early, enter planned risk on each trade; the reports will follow. For undefined-risk trades, planned risk is not optional: a naked short call without it has no R and is left out of R statistics, and a naked short put without it is measured against its loss at zero, which makes every result look tiny.'
		},
		{
			type: 'quote',
			text: 'Choose the definition of risk that matches what you actually do, write it down before the trade, and never change it afterwards.'
		},
		{
			type: 'p',
			text: 'With R defined that way, the downstream metrics become trustworthy. Average R is your expectancy per unit of risk. The R distribution shows whether your edge comes from many small winners or a few large ones. And SQN, which divides the mean R by its standard deviation, tells you how consistent that edge is, which is the question every trader ends up asking.'
		}
	]
};
