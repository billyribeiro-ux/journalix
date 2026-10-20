<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '#lib/marketing/Seo.svelte';
	import LegalDocument from '#lib/marketing/LegalDocument.svelte';
</script>

<Seo
	title="Risk disclosure"
	description="Trading options, stocks and futures involves substantial risk. Journalix is a journal, not investment advice, and its calculations are estimates with known limitations."
	path="/legal/risk-disclosure"
/>

<LegalDocument
	title="Risk disclosure"
	summary="Trading involves substantial risk of loss. Please read this before relying on anything Journalix shows you."
>
	<h2>Not investment advice</h2>
	<p>
		Journalix is a journal and analytics tool. It is not a broker, dealer or investment adviser, and
		it is not registered as one with the SEC, FINRA, the CFTC, the NFA or any state regulator.
		Nothing on this website, in the app, in the blog or in any communication from us is a
		recommendation or solicitation to buy or sell any security, option, future or other financial
		instrument, or advice about whether a strategy is suitable for you.
	</p>
	<p>
		Educational content, such as articles explaining R-multiples, Greeks or P&L attribution,
		describes methods of measurement. It does not suggest that any trade or strategy will be
		profitable.
	</p>

	<h2>Trading risk</h2>
	<p>
		Trading stocks, options, futures and other leveraged instruments involves substantial risk and
		is not suitable for everyone. You can lose more than your initial investment in some strategies,
		including short options, uncovered positions and futures. Before trading options, read the
		Options Clearing Corporation’s booklet <em>Characteristics and Risks of Standardized Options</em
		>, which your broker is required to provide.
	</p>
	<ul>
		<li>
			<strong>Options</strong> can lose their entire value quickly, are affected by time decay and changes
			in implied volatility, and may be exercised or assigned, including early assignment on American-style
			options.
		</li>
		<li>
			<strong>Short and uncovered options</strong> can produce losses far greater than the premium received,
			and in the case of short calls, losses that are theoretically unlimited.
		</li>
		<li>
			<strong>Multi-leg strategies</strong> carry execution risk (legs may fill at different prices or
			not at all), assignment risk on individual legs, and pin risk near expiry.
		</li>
		<li>
			<strong>Futures and margin</strong> amplify gains and losses and can require you to deposit additional
			funds at short notice.
		</li>
	</ul>

	<h2>Past performance</h2>
	<p>
		Journalix’s analytics describe what happened in trades you recorded. Win rates, expectancy,
		R-multiples, Sharpe ratios, equity curves and every other statistic are historical. Past
		performance, whether yours or anyone else’s, does not guarantee or predict future results. Small
		samples are especially unreliable.
	</p>

	<h2>Models and estimates</h2>
	<p>
		Several features rely on models with known limitations, and their output should be read as
		estimates:
	</p>
	<ul>
		<li>
			<strong>Implied volatility and Greeks</strong> are computed with the Black-Scholes model from the
			prices you enter. Black-Scholes assumes European exercise, constant volatility and continuous trading,
			which real markets do not satisfy. Results are sensitive to the underlying price, time and interest
			rate you record.
		</li>
		<li>
			<strong>“Today” payoff curves</strong> assume implied volatility stays at the level solved from
			your fill and ignore dividends and early exercise.
		</li>
		<li>
			<strong>P&L attribution</strong> is a Taylor approximation using Greeks at entry. It ignores path,
			cross effects and changes in the Greeks during the trade, and shows the unexplained remainder as
			a residual.
		</li>
		<li>
			<strong>Max profit, max loss and breakevens</strong> are computed at expiry from the opening structure.
			They do not reflect early assignment, adjustments, or losses from legs closed at different times.
		</li>
		<li>
			<strong>Strategy detection</strong> names a structure from its legs. A detected name is a description,
			not a statement about risk or suitability.
		</li>
	</ul>

	<h2>Data accuracy</h2>
	<p>
		Every result is computed from what you enter. Mistyped prices, quantities, times or fees produce
		wrong results. Market data comes from third-party providers you connect, who may have gaps,
		delays or errors. Simulated prices are generated for illustration, are labelled as simulated,
		and are not market data. Do not use simulated charts to evaluate a trade.
	</p>

	<h2>Not for tax or regulatory reporting</h2>
	<p>
		Journalix’s P&L uses the average-cost method within each trade and does not apply tax rules such
		as wash sales, lot selection or Section 1256 treatment. Use your broker’s statements and a tax
		professional for tax reporting.
	</p>

	<h2>Your responsibility</h2>
	<p>
		You are solely responsible for your trading decisions and their results. Consider seeking advice
		from a licensed financial professional before trading. The limits of our responsibility are set
		out in the <a href={resolve('legal/terms')}>terms of service</a>.
	</p>
</LegalDocument>
