<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Field, TextInput } from '@strikebook/ui';
	import AuthCard from '#lib/auth/AuthCard.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
	let email = $derived(form?.email ?? '');
</script>

<svelte:head>
	<title>Sign in — Strikebook</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<AuthCard title="Sign in" subtitle="Pick up where your last session left off.">
	<form
		method="POST"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<Field label="Email" for="email">
			<TextInput id="email" name="email" type="email" autocomplete="email" required value={email} />
		</Field>
		<Field label="Password" for="password">
			<TextInput
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</Field>
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
		<Button type="submit" variant="primary" {busy}>Sign in</Button>
	</form>
	{#snippet footer()}
		New to Strikebook? <a href={resolve('signup')}>Create an account</a>
	{/snippet}
</AuthCard>

<style>
	form {
		display: grid;
		gap: var(--space-4);
	}

	.error {
		color: var(--color-loss);
		font-size: var(--text-sm);
	}
</style>
