import type { Post } from './types.ts';

export const post: Post = {
	slug: 'fills-not-positions',
	title: 'Journaling multi-leg options: why fills, not positions, are the source of truth',
	description:
		'A position is a summary; the fills are what happened. Why an options journal should record every execution, and how adds, partial exits, legging and assignment fall out correctly when it does.',
	date: '2026-10-13',
	readingMinutes: 7,
	body: [
		{
			type: 'p',
			text: 'Most trading journals store a trade as a position: a symbol, a size, an average entry, an average exit and a P&L. It is a compact record and for a simple share trade it is enough. For options it quietly throws away most of what you need to review.'
		},
		{
			type: 'p',
			text: 'A position is a summary of fills. You can always compute the position from the fills, but you can never recover the fills from the position. Once a journal stores only the summary, the questions a review should answer (where did I add, how much did I take off and when, which leg did I close first) are gone for good.'
		},
		{ type: 'h2', id: 'what-a-fill-is', text: 'What a fill records' },
		{
			type: 'p',
			text: 'A fill is one execution reported by your broker. For a journal that wants to support real options analysis, each fill needs:'
		},
		{
			type: 'ul',
			items: [
				'The leg it belongs to: underlying, call or put, strike, expiry and multiplier, or shares.',
				'Side and quantity: bought or sold, and how many contracts or shares.',
				'Price per share and fees: the premium as quoted, not multiplied out, and the commission and exchange fees for that execution.',
				'Time: to the minute at least, because the chart, holding time and time-of-day analytics depend on it.',
				'The underlying price at the moment of the fill: without it, implied volatility, Greeks and any option-on-chart review are guesswork.'
			]
		},
		{
			type: 'p',
			text: 'The last item is the one most journals skip, and the one that matters most for options. An option premium means little without knowing where the stock was. A call bought for $4.00 with the stock at $250 and one bought for $4.00 with the stock at $258 are very different trades.'
		},
		{ type: 'h2', id: 'adds-and-partials', text: 'Adds and partial exits' },
		{
			type: 'p',
			text: 'Consider a long call trade. You buy 3 contracts at $9.74. The next day the stock pulls back to your level and holds, so you add 2 more at $10.63. Two days later you sell 2 at $14.52 into strength and hold the rest, then sell the final 3 at $16.21.'
		},
		{
			type: 'table',
			caption: 'The fills of one long call trade',
			head: ['Fill', 'Side', 'Contracts', 'Price'],
			rows: [
				['Entry', 'Buy', '3', '9.74'],
				['Add', 'Buy', '2', '10.63'],
				['Partial exit', 'Sell', '2', '14.52'],
				['Exit', 'Sell', '3', '16.21']
			],
			numeric: [2, 3]
		},
		{
			type: 'p',
			text: 'A position-based journal records this as 5 contracts bought at an average of $10.096 and sold at an average of $15.534. The P&L is right. Everything else is lost: that the add came at a worse price than the entry, that the partial exit left $1.69 a contract on the table compared with holding, and that the position was never actually 5 contracts long at a single price.'
		},
		{
			type: 'p',
			text: 'Kept as fills, the same trade answers real questions. Do your adds improve your results or dilute them? Do your partial exits cost you more than they save? Across a hundred trades, those are some of the most actionable numbers a journal can produce, and they only exist if the fills do.'
		},
		{
			type: 'p',
			text: 'The arithmetic still needs a rule. A standard choice is the average-cost method: opening fills update the average price of the open size; closing fills realise P&L against that average. Replaying the fills above in time order gives an average open price of $10.096 and realised P&L of (14.52 − 10.096) × 2 × 100 + (16.21 − 10.096) × 3 × 100 = $884.80 + $1,834.20 = $2,719.00 before fees. That matches the position view, (15.534 − 10.096) × 5 × 100, because it has to: the fills and the summary describe the same money.'
		},
		{ type: 'h2', id: 'legging', text: 'Legging into a spread' },
		{
			type: 'p',
			text: 'Multi-leg trades make the case stronger. Suppose you want a put credit spread but think the stock will bounce first. You sell the 640 put on Monday and buy the 630 put on Tuesday after the bounce. Is that a short put that later became a spread, or a spread with a bad first fill?'
		},
		{
			type: 'p',
			text: 'If the journal only stores a position, it has to decide at the moment you enter it, and either answer misrepresents something. If it stores fills against two legs of one trade, it doesn’t have to choose. The structure is identified from the full opening size of each leg, so the trade is a bull put spread. The timing of each fill is preserved, so a review can show that for one day you held naked short put risk, and how much that legging gained or cost compared with opening both legs together.'
		},
		{
			type: 'p',
			text: 'The same applies when you close. Buying back the short call of an iron condor early and letting the put side expire is two different events at two different times. A journal of fills keeps both; a journal of positions blends them into an average exit that never traded.'
		},
		{ type: 'h2', id: 'assignment', text: 'Assignment, exercise and expiration' },
		{
			type: 'p',
			text: 'Options also end in ways that aren’t trades at all. A short put that finishes in the money gets assigned: the option disappears and 100 shares per contract appear in your account at the strike. A long option can be exercised. An out-of-the-money option simply expires.'
		},
		{
			type: 'p',
			text: 'Position-based tools often force you to invent a closing fill for these: “sell at 0.00” for an expiration, or a made-up buy-to-close for an assignment. That pollutes your fill data and your fee totals, and it hides the outcome. Expired-worthless and assigned trades behave very differently in a premium-selling business, and you want to see them separately.'
		},
		{
			type: 'p',
			text: 'With fills as the source of truth, these become distinct kinds of execution. An expiration closes the leg at zero with no fee. An assignment closes the option leg and is paired with the stock execution it produced, so the shares you now own are part of the same trade. Reports can then break down results by how each trade ended: closed early, expired, or assigned.'
		},
		{ type: 'h2', id: 'derived', text: 'Everything else is derived' },
		{
			type: 'p',
			text: 'Once fills are recorded, everything a journal shows can be computed from them and nothing has to be typed twice:'
		},
		{
			type: 'ul',
			items: [
				'Position size, average entry and exit, realised P&L and fees, per leg and in total.',
				'The opening structure, and from it the strategy name, max profit, max loss and breakevens.',
				'Holding time, days to expiry at entry, and whether the trade opened for a credit or a debit.',
				'Implied volatility and Greeks at entry, solved from the fill prices and the underlying price.',
				'The chart: every fill becomes a marker at its time and price.'
			]
		},
		{
			type: 'p',
			text: 'The cost is a little more typing per trade. The payoff is that the record can’t contradict itself. If you correct a fill price, every number that depends on it updates. If the P&L in the trade list disagrees with the P&L in a report, one of them is wrong, and with derived numbers that can’t happen.'
		},
		{
			type: 'quote',
			text: 'Record what happened, one execution at a time. Compute everything else.'
		},
		{
			type: 'p',
			text: 'That is the design Strikebook is built on. Each trade holds its legs; each leg holds its fills, including expirations and assignments; and every chart, metric and report is computed from those fills with the average-cost method. It is the only approach we found that stays correct for the way options are actually traded.'
		}
	]
};
