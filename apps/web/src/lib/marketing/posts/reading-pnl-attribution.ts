import type { Post } from './types.ts';

export const post: Post = {
	slug: 'reading-pnl-attribution',
	title: 'Reading your P&L attribution: delta, theta and vega in a closed trade',
	description:
		'Why did an options trade make or lose money: direction, time or volatility? A worked example of Greek-based P&L attribution, why it is an estimate, and how to read the residual.',
	date: '2026-10-20',
	readingMinutes: 8,
	body: [
		{
			type: 'p',
			text: 'A closed options trade has one P&L number, but several things moved while you held it. The underlying went up or down. Time passed. Implied volatility rose or fell. Attribution is the attempt to say how much of the result came from each.'
		},
		{
			type: 'p',
			text: 'It matters because the same P&L can hide opposite lessons. A long call that made money because the stock ran, despite a volatility crush, tells you your directional read was good and your timing around volatility was poor. A long call that made the same amount because volatility spiked while the stock went nowhere tells you something else entirely: you got paid for a risk you may not have meant to take.'
		},
		{ type: 'h2', id: 'expansion', text: 'The idea: a Taylor expansion around entry' },
		{
			type: 'p',
			text: 'An option’s price depends on the underlying price S, time t and implied volatility σ (plus rates and dividends, which barely move over a typical holding period). The Greeks are the sensitivities of the price to each input, measured at a single point. If you know them at entry, you can approximate how the price changes when the inputs change:'
		},
		{
			type: 'formula',
			text: 'ΔP ≈ Δ·dS + ½·Γ·dS² + Θ·dt + ν·dσ',
			caption:
				'Δ is delta, Γ gamma, Θ theta per day, ν vega per volatility point. dS is the underlying move, dt the days held, dσ the change in IV in points.'
		},
		{
			type: 'p',
			text: 'Multiply each term by the number of contracts and the multiplier and you have a dollar amount for each effect. Whatever the four terms don’t explain is the residual.'
		},
		{ type: 'h2', id: 'example', text: 'A worked example' },
		{
			type: 'p',
			text: 'You buy 2 calls, strike 250, 30 days to expiry, with the stock at $245.00. You pay $7.10 per share, which implies a volatility of 32%. Six days later the stock is at $252.00, implied volatility has dropped to 29%, and you sell the calls for $8.84.'
		},
		{
			type: 'formula',
			text: 'Actual P&L = (8.84 − 7.10) × 2 × 100 = $348.00',
			caption:
				'Gross of fees. Fees are a cost of trading, not a market effect, so they are left out of attribution.'
		},
		{
			type: 'p',
			text: 'At entry, Black-Scholes with those inputs (and a 4% rate) gives these Greeks per share:'
		},
		{
			type: 'table',
			caption: 'Greeks of the 250 call at entry, per share',
			head: ['Greek', 'Value', 'Meaning'],
			rows: [
				['Delta', '0.445', '$0.445 per $1 move in the stock'],
				['Gamma', '0.0176', 'Delta change per $1 move'],
				['Theta', '−0.159', 'Dollars per calendar day'],
				['Vega', '0.278', 'Dollars per 1 point of IV']
			],
			numeric: [1]
		},
		{
			type: 'p',
			text: 'The position is 2 contracts × 100 = 200 shares’ worth of each Greek. The inputs moved by dS = +7.00, dt = 6 days and dσ = −3 points. Plugging in:'
		},
		{
			type: 'table',
			caption: 'Estimated attribution of the $348.00 result',
			head: ['Component', 'Calculation', 'Dollars'],
			rows: [
				['Delta', '0.445 × 200 × 7.00', '+623.00'],
				['Gamma', '½ × 0.0176 × 200 × 7.00²', '+86.24'],
				['Theta', '−0.159 × 200 × 6', '−190.80'],
				['Vega', '0.278 × 200 × (−3)', '−166.80'],
				['Greek estimate', 'Sum of the four', '+351.64'],
				['Residual', '348.00 − 351.64', '−3.64'],
				['Actual', '', '+348.00']
			],
			numeric: [2]
		},
		{
			type: 'p',
			text: 'Read it top to bottom. Direction was worth about $709 (delta plus gamma, both driven by the stock move). Time cost about $191. The volatility drop cost about $167. Together the Greeks explain all but $3.64 of the result.'
		},
		{
			type: 'p',
			text: 'The lesson here is not “the trade made $348”. It is that the directional idea was worth more than twice what you kept, and the rest went to time decay and a falling IV. If that pattern repeats across your long-option trades, the fix is not a better entry signal. It is structure: a vertical spread would have given up some of the upside but sold back much of the theta and vega you paid for.'
		},
		{ type: 'h2', id: 'estimate', text: 'Why it is an estimate' },
		{
			type: 'p',
			text: 'Attribution is a model of what happened, not an accounting identity. Several things keep the four terms from summing exactly to the actual P&L:'
		},
		{
			type: 'ul',
			items: [
				'The Greeks change during the trade. Delta at entry is not delta on day five. The expansion uses entry values for the whole move, so the larger the move or the longer the hold, the larger the error.',
				'Cross effects are ignored. Vega depends on the stock price; theta depends on volatility. Terms like “vanna” and “charm” capture these interactions and are left out of a first-pass attribution.',
				'The path is ignored. Only the start and end values of S, t and σ are used. A stock that went to 260 and back to 252 produces the same attribution as one that drifted straight up.',
				'Fill quality is mixed in. If you paid the ask on entry and sold on the bid, part of the result is spread cost that no Greek describes.',
				'Implied volatility comes from the model. IV is solved from your fill price with Black-Scholes, so any mismatch between that model and the market’s pricing (skew, dividends, early exercise) shows up as volatility.'
			]
		},
		{
			type: 'p',
			text: 'This is why the residual matters. A small residual, like the $3.64 above, means the expansion described the trade well. A large one means one of those effects was significant, and the four Greek numbers should be read as rough directions rather than precise amounts.'
		},
		{ type: 'h2', id: 'reading', text: 'How to read your own trades' },
		{
			type: 'ol',
			items: [
				'Look at the sign of each term before its size. Did direction help or hurt? Did time? Did volatility? That alone sorts most trades into a clear story.',
				'Compare the largest term with the P&L. If one Greek is several times the final result, two effects were fighting, and you kept the difference.',
				'Check the residual. Under about 10% of the P&L, trust the breakdown. Much larger, especially on long holds or big moves, treat it as indicative only.',
				'Aggregate by strategy. Single trades are noisy. Across twenty long-call trades, a consistently negative vega term is a finding; on one trade, it is an anecdote.'
			]
		},
		{ type: 'h2', id: 'multi-leg', text: 'Multi-leg trades' },
		{
			type: 'p',
			text: 'For spreads, the same calculation runs per leg and the results are summed. This is where attribution earns its keep. A short iron condor typically shows a positive theta term, a vega term that depends on whether IV fell, and delta and gamma terms that are near zero if the stock stayed in range and sharply negative if it didn’t. Seeing those four numbers for every condor you close is a faster education in what you are actually selling than any payoff diagram.'
		},
		{
			type: 'p',
			text: 'Journalix computes this for every closed options trade where the underlying price was recorded on the opening and closing fills. Implied volatility is solved from each fill, Greeks are taken at the first opening fill of each leg, and the four terms and the residual are shown side by side, labelled as an estimate. If you record the underlying price at each fill, you get the breakdown for free.'
		}
	]
};
