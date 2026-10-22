<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Field, TextInput } from '@journalix/ui';
	import AuthCard from '#lib/auth/AuthCard.svelte';
	import PasswordField from '#lib/auth/PasswordField.svelte';
	import type { PageProps } from './$types';

	let { form, data }: PageProps = $props();
	let busy = $state(false);
	let password = $state('');

	const MIN_PASSWORD = 15;
	// A live count instead of a rule the person has to remember; the rule text returns once met.
	const passwordHelp = $derived(
		password.length === 0
			? 'At least 15 characters. A short phrase is easier to remember and harder to guess.'
			: password.length < MIN_PASSWORD
				? `${password.length} of ${MIN_PASSWORD} characters. A short phrase works well.`
				: `${password.length} characters. That length is fine.`
	);
	// A rejection that was about length goes away once the length is fixed, instead of lingering
	// until the next submit.
	const passwordError = $derived(
		form?.field === 'password' && password.length < MIN_PASSWORD ? form.message : null
	);
	const planName = $derived(data.plan ? data.plan[0]?.toUpperCase() + data.plan.slice(1) : null);
</script>

<svelte:head>
	<title>Create your account — Journalix</title>
	<meta
		name="description"
		content="Create a Journalix account and start journaling your options trades."
	/>
</svelte:head>

<AuthCard
	title="Create your account"
	subtitle={planName
		? `${planName} plan — every feature is free during early access.`
		: 'Every feature is free during early access.'}
	error={form?.message && !form.field ? form.message : null}
>
	<form
		method="POST"
		novalidate
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				await update({ reset: false });
				busy = false;
				if (result.type === 'failure') {
					// Move to the first field the server rejected.
					await tick();
					document.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus();
				}
			};
		}}
	>
		<Field label="Name" for="name" error={form?.field === 'name' ? form.message : null}>
			<TextInput
				id="name"
				name="name"
				autocomplete="name"
				required
				value={form?.name ?? ''}
				invalid={form?.field === 'name'}
			/>
		</Field>
		<Field label="Email" for="email" error={form?.field === 'email' ? form.message : null}>
			<TextInput
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
				invalid={form?.field === 'email'}
			/>
		</Field>
		<PasswordField
			label="Password"
			id="password"
			name="password"
			autocomplete="new-password"
			minlength={MIN_PASSWORD}
			maxlength={128}
			bind:value={password}
			help={passwordHelp}
			error={passwordError}
		/>
		<Button type="submit" variant="primary" {busy}>Create account</Button>
	</form>
	{#snippet footer()}
		Already have an account? <a href={resolve('login')}>Sign in</a>
	{/snippet}
</AuthCard>

<style>
	form {
		display: grid;
		gap: var(--space-4);
	}
</style>
