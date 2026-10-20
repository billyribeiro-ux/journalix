<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Field, Select, TextInput, Textarea } from '@strikebook/ui';
	import Seo from '#lib/marketing/Seo.svelte';
	import { CONTACT_TOPICS, MESSAGE_MAX, type ContactTopic } from '#lib/marketing/site.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	const errors = $derived(form && 'errors' in form ? form.errors : {});
	const previous = $derived(form && 'values' in form ? form.values : null);
	const sent = $derived(form !== null && form !== undefined && 'success' in form);

	let name = $state('');
	let email = $state('');
	let topic = $state<ContactTopic>('general');
	let message = $state('');
	let submitting = $state(false);
	let successHeading = $state<HTMLHeadingElement>();

	// Restore what was typed when the server sends the form back with errors (no-JS path too).
	$effect.pre(() => {
		if (!previous) return;
		name = previous.name;
		email = previous.email;
		topic = CONTACT_TOPICS.some((t) => t.value === previous.topic)
			? (previous.topic as ContactTopic)
			: 'general';
		message = previous.message;
	});

	$effect(() => {
		if (sent) successHeading?.focus();
	});

	const describe = (field: string, help = false): string | undefined =>
		errors && field in errors ? `${field}-error` : help ? `${field}-help` : undefined;
</script>

<Seo
	title="Contact"
	description="Questions about Strikebook, help with the app, privacy requests or feedback. Send a message and we’ll reply by email."
	path="/contact"
/>

<header class="page-head container">
	<h1>Contact</h1>
	<p class="lede">
		Questions, problems, data requests or feature ideas. Messages are read by the person who builds
		Strikebook, and you’ll get a reply by email.
	</p>
</header>

<div class="container body">
	{#if sent}
		<section class="success" aria-labelledby="sent-title">
			<h2 id="sent-title" tabindex="-1" bind:this={successHeading}>Message sent</h2>
			<p>Thanks for writing. We’ll reply to the email address you gave.</p>
			<p><a href={resolve('')}>Back to the home page</a></p>
		</section>
	{:else}
		<form
			method="POST"
			novalidate
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			{#if errors && Object.keys(errors).length > 0}
				<p class="form-error" role="alert">Check the highlighted fields and try again.</p>
			{/if}

			<div class="row">
				<Field label="Name" for="name" error={errors?.name ?? null}>
					<TextInput
						id="name"
						name="name"
						autocomplete="name"
						required
						maxlength={120}
						bind:value={name}
						invalid={!!errors?.name}
						describedBy={describe('name')}
					/>
				</Field>
				<Field label="Email" for="email" error={errors?.email ?? null}>
					<TextInput
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						maxlength={254}
						bind:value={email}
						invalid={!!errors?.email}
						describedBy={describe('email')}
					/>
				</Field>
			</div>

			<Field label="Topic" for="topic" error={errors?.topic ?? null}>
				<Select
					id="topic"
					name="topic"
					options={CONTACT_TOPICS}
					bind:value={topic}
					invalid={!!errors?.topic}
					aria-describedby={describe('topic')}
				/>
			</Field>

			<Field
				label="Message"
				for="message"
				error={errors?.message ?? null}
				help="{message.length.toLocaleString('en-US')} of {MESSAGE_MAX.toLocaleString(
					'en-US'
				)} characters"
			>
				<Textarea
					id="message"
					name="message"
					rows={8}
					required
					maxlength={MESSAGE_MAX}
					bind:value={message}
					invalid={!!errors?.message}
					aria-describedby={describe('message', true)}
				/>
			</Field>

			<div class="hp" aria-hidden="true">
				<label for="company">Company</label>
				<input id="company" name="company" type="text" tabindex="-1" autocomplete="off" />
			</div>

			<div class="cta-row">
				<Button type="submit" variant="primary" busy={submitting}>Send message</Button>
			</div>
			<p class="note">
				We use your name and email only to reply. See the <a href={resolve('legal/privacy')}
					>privacy policy</a
				>.
			</p>
		</form>
	{/if}
</div>

<style>
	.body {
		padding-top: var(--space-12);
	}

	form,
	.success {
		display: grid;
		gap: var(--space-5);
		max-width: 40rem;
	}

	.row {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 640px) {
		.row {
			grid-template-columns: 1fr 1fr;
		}
	}

	.form-error {
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--color-loss);
		background: var(--color-loss-soft);
		color: var(--color-ink);
		font-size: var(--text-base);
	}

	.success h2 {
		font-size: var(--text-2xl);
		letter-spacing: var(--tracking-display);
	}

	.success h2:focus {
		outline: none;
	}

	.success p {
		color: var(--color-ink-2);
	}

	.hp {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
