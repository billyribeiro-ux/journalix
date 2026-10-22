<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { Button, Field, TextInput } from '@journalix/ui';
	import AuthCard from '#lib/auth/AuthCard.svelte';
	import PasswordField from '#lib/auth/PasswordField.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
	let email = $derived(form?.email ?? '');
</script>

<svelte:head>
	<title>Sign in — Journalix</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<AuthCard
	title="Sign in"
	subtitle="Pick up where your last session left off."
	error={form?.message ?? null}
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
					// To the field that needs fixing: the email when it was rejected, otherwise the password
					// (selected, so the retry is one keystroke away).
					await tick();
					const emailInput = document.getElementById('email');
					const emailRejected =
						result.data?.message === 'Enter a valid email address' ||
						(emailInput instanceof HTMLInputElement && emailInput.value === '');
					const target = document.getElementById(emailRejected ? 'email' : 'password');
					if (target instanceof HTMLInputElement) {
						target.focus();
						target.select();
					}
				}
			};
		}}
	>
		<Field label="Email" for="email">
			<TextInput id="email" name="email" type="email" autocomplete="email" required value={email} />
		</Field>
		<PasswordField label="Password" id="password" name="password" autocomplete="current-password" />
		<Button type="submit" variant="primary" {busy}>Sign in</Button>
	</form>
	{#snippet footer()}
		New to Journalix? <a href={resolve('signup')}>Create an account</a>
	{/snippet}
</AuthCard>

<style>
	form {
		display: grid;
		gap: var(--space-4);
	}
</style>
