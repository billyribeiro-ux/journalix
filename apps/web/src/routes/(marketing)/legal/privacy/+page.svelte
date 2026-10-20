<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '#lib/marketing/Seo.svelte';
	import LegalDocument from '#lib/marketing/LegalDocument.svelte';
</script>

<Seo
	title="Privacy policy"
	description="What data Strikebook collects, how it is used and protected, how provider keys are encrypted, and how to export or delete your journal."
	path="/legal/privacy"
/>

<LegalDocument
	title="Privacy policy"
	summary="What we collect, why, how it is protected, and the control you have over it."
>
	<h2>Summary</h2>
	<ul>
		<li>We collect what is needed to run your account and your journal, and nothing more.</li>
		<li>We do not sell your data, share it with advertisers or use it to train AI models.</li>
		<li>
			Market data API keys you add are encrypted at rest and used only to fetch candles for you.
		</li>
		<li>Cookies are used only to keep you signed in.</li>
		<li>The desktop app stores your journal on your own computer.</li>
		<li>You can export or delete your journal at any time, and ask us to delete your account.</li>
	</ul>

	<h2>Who we are</h2>
	<p>
		This policy covers the Strikebook website, the Strikebook web application and the Strikebook
		desktop application (together, the “Service”). “Strikebook”, “we” and “us” refer to the operator
		of the Service. You can reach us through the <a href={resolve('contact')}>contact page</a>.
	</p>

	<h2>Information we collect</h2>
	<h3>Account information</h3>
	<p>
		When you create an account we collect your name, email address and a password. Passwords are
		stored only as a salted hash; we cannot read them. We also store session records (a session
		identifier, creation and expiry times, and the IP address and browser user agent of the sign-in)
		so you stay signed in and so sessions can be reviewed and revoked.
	</p>
	<h3>Journal data</h3>
	<p>
		Everything you enter into your journal: trading accounts and starting balances, trades, legs,
		executions, stops and targets, playbooks, tags, notes, ratings and settings such as your time
		zone and risk-free rate. This is the content of the Service, and it belongs to you.
	</p>
	<h3>Market data provider keys</h3>
	<p>
		If you connect a market data provider (such as Massive, Alpaca, Databento or Tiingo), we store
		the API key or keys you enter. Keys are encrypted at rest with AES-256-GCM using a key held
		separately from the database, and are only decrypted on our servers at the moment we request
		data from that provider on your behalf. They are never shown back to you in full and never sent
		to your browser after you save them.
	</p>
	<h3>Cached market data</h3>
	<p>
		Candles fetched from your provider are cached so the same chart does not use your provider’s
		rate limit twice. Cached candles are market prices, not personal data, and may be reused only
		within your own account.
	</p>
	<h3>Messages you send us</h3>
	<p>
		If you use the contact form, we store your name, email address, chosen topic and message so we
		can reply.
	</p>
	<h3>Technical information</h3>
	<p>
		Our servers keep standard request logs (IP address, time, requested URL, response status and
		browser user agent) for security and troubleshooting. We do not use analytics or advertising
		trackers, and we do not build profiles of your browsing.
	</p>

	<h2>How we use information</h2>
	<ul>
		<li>To provide the Service: store your journal, compute analytics and draw charts.</li>
		<li>To fetch market data from the provider you connected, using your key.</li>
		<li>To keep your account secure, detect abuse and fix problems.</li>
		<li>
			To reply to messages and send essential service notices, such as changes to these terms or to
			billing.
		</li>
	</ul>
	<p>
		We do not use your journal to market products to you, and we do not use it to train machine
		learning models.
	</p>

	<h2>Cookies</h2>
	<p>
		The Service uses a session cookie to keep you signed in, and the browser’s local storage to
		remember interface preferences such as the light or dark theme. These are strictly necessary for
		the Service to work. We do not use advertising or third-party tracking cookies, so there is no
		cookie banner.
	</p>

	<h2>Sharing</h2>
	<p>We share information only in these cases:</p>
	<ul>
		<li>
			<strong>Service providers</strong> that host our servers and database, under contracts that limit
			their use of the data to providing those services to us.
		</li>
		<li>
			<strong>Your market data provider</strong>, which receives requests authenticated with your
			own key, containing the symbol, timeframe and date range of the chart you open.
		</li>
		<li>
			<strong>Legal requirements</strong>, when we are required to by law, subpoena or court order,
			or to protect the rights, safety or property of our users or others.
		</li>
		<li>
			<strong>Business transfers</strong>, if the Service is sold or merged, in which case this
			policy continues to apply to your data and you will be notified.
		</li>
	</ul>
	<p>We do not sell personal information.</p>

	<h2>The desktop app</h2>
	<p>
		The desktop app stores your journal in a SQLite database file on your computer. That data is not
		sent to our servers. If you connect a market data provider in the desktop app, requests for
		candles go from your computer to that provider. You are responsible for backing up and securing
		the database file on your own machines.
	</p>

	<h2>Retention and deletion</h2>
	<p>
		We keep your account and journal for as long as your account exists. You can export your whole
		journal as a JSON file at any time from Settings, and you can delete all of your journal data
		from Settings yourself. To delete your account entirely, send a request through the
		<a href={resolve('contact')}>contact page</a>; we will delete the account together with its
		journal, provider keys and sessions, and confirm by email. Copies held in encrypted backups are
		removed as those backups expire on our normal rotation. Server logs and contact messages are
		kept only as long as needed for security, troubleshooting and replying to you.
	</p>

	<h2>Security</h2>
	<p>
		Connections to the Service use TLS. Passwords are hashed, provider keys are encrypted, and
		access to production systems is restricted. No system is perfectly secure; if we become aware of
		a breach that affects your personal information, we will notify you as required by law.
	</p>

	<h2>Your rights</h2>
	<p>
		Depending on where you live, you may have the right to access, correct, export or delete your
		personal information, and to object to or restrict certain processing. Most of this you can do
		yourself inside the app. For anything else, send a request through the
		<a href={resolve('contact')}>contact page</a> with the topic “Privacy or data request”. We will respond
		within 30 days and will not discriminate against you for exercising these rights.
	</p>

	<h2>Children</h2>
	<p>
		The Service is not directed to children and you must be at least 18 to use it. We do not
		knowingly collect information from anyone under 18.
	</p>

	<h2>International users</h2>
	<p>
		The Service is operated from the United States, and information is processed and stored there.
		By using the web app you understand your information will be transferred to and handled in the
		United States.
	</p>

	<h2>Changes to this policy</h2>
	<p>
		If we change this policy we will update the effective date above. If a change materially affects
		how we handle your information, we will tell you by email or in the app before it takes effect.
	</p>
</LegalDocument>
