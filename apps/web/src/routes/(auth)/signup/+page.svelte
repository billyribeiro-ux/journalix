<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Field, TextInput } from '@strikebook/ui';
	import AuthCard from '#lib/auth/AuthCard.svelte';
	import type { PageProps } from './$types';

	let { form, data }: PageProps = $props();
	let busy = $state(false);
	const planName = $derived(data.plan ? data.plan[0]?.toUpperCase() + data.plan.slice(1) : null);
</script>

<svelte:head>
	<title>Create your account — Strikebook</title>
	<meta
		name="description"
		content="Create a Strikebook account and start journaling your options trades."
	/>
</svelte:head>

<AuthCard
	title="Create your account"
	subtitle={planName
		? `${planName} plan — every feature is free during early access.`
		: 'Every feature is free during early access.'}
>
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
		<Field
			label="Password"
			for="password"
			help="At least 15 characters. A short phrase is easier to remember and harder to guess."
			error={form?.field === 'password' ? form.message : null}
		>
			<TextInput
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength={15}
				maxlength={128}
				required
				invalid={form?.field === 'password'}
				describedBy="password-help"
			/>
		</Field>
		{#if form?.message && !form.field}<p class="error" role="alert">{form.message}</p>{/if}
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

	.error {
		color: var(--color-loss);
		font-size: var(--text-sm);
	}
</style>
