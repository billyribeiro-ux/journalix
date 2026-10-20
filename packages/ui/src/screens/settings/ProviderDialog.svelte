<script lang="ts">
	import { newId, type ProviderConfigView, type ProviderId } from '@journalix/core';
	import { PROVIDER_ORDER, PROVIDERS, type ProviderField } from '@journalix/core/market-data';
	import { useApp } from '../../app/context.ts';
	import Button from '../../primitives/Button.svelte';
	import Dialog from '../../primitives/Dialog.svelte';
	import Field from '../../primitives/Field.svelte';
	import TextInput from '../../primitives/TextInput.svelte';
	import Select from '../../primitives/Select.svelte';
	import Checkbox from '../../primitives/Checkbox.svelte';
	import Badge from '../../primitives/Badge.svelte';

	interface Props {
		open?: boolean;
		/** Config being edited; `null` adds a new one. */
		editing: ProviderConfigView | null;
		onsaved?: (view: ProviderConfigView) => void;
	}

	let { open = $bindable(false), editing, onsaved }: Props = $props();
	const { journal, toaster } = useApp();

	let step = $state<'choose' | 'configure'>('choose');
	let id = $state(newId());
	let provider = $state<ProviderId>('massive');
	let label = $state('');
	let options = $state<Record<string, string>>({});
	let secrets = $state<Record<string, string>>({});
	let makeDefault = $state(false);
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	const info = $derived(PROVIDERS[provider]);
	const optionFields = $derived(info.fields.filter((f) => f.kind !== 'secret'));
	const secretFields = $derived(info.fields.filter((f) => f.kind === 'secret'));
	/** Editing the same provider keeps the stored key unless new values are typed. */
	const keepsSecret = $derived(
		editing !== null && editing.provider === provider && editing.secretHint !== null
	);

	function defaultsFor(
		fields: readonly ProviderField[],
		current: Readonly<Record<string, string>> = {}
	): Record<string, string> {
		const out: Record<string, string> = {};
		for (const f of fields) {
			if (f.kind === 'secret') continue;
			out[f.name] = current[f.name] ?? f.defaultValue ?? f.choices?.[0]?.value ?? '';
		}
		return out;
	}

	// Reset the form each time the dialog opens.
	let wasOpen = false;
	$effect.pre(() => {
		if (open && !wasOpen) {
			errors = {};
			secrets = {};
			if (editing) {
				id = editing.id;
				provider = editing.provider;
				label = editing.label;
				options = defaultsFor(PROVIDERS[editing.provider].fields, editing.options);
				makeDefault = editing.isDefault;
				step = 'configure';
			} else {
				id = newId();
				provider = 'massive';
				label = '';
				options = {};
				makeDefault = journal.providers.length === 0;
				step = 'choose';
			}
		}
		wasOpen = open;
	});

	function choose(next: ProviderId): void {
		provider = next;
		options = defaultsFor(PROVIDERS[next].fields);
		secrets = {};
		const taken = new Set(journal.providers.map((p) => p.label));
		let candidate = PROVIDERS[next].name;
		for (let n = 2; taken.has(candidate); n++) candidate = `${PROVIDERS[next].name} ${n}`;
		label = candidate;
		step = 'configure';
	}

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const next: Record<string, string> = {};
		if (!label.trim()) next['label'] = 'Give this connection a name';

		for (const f of optionFields) {
			if (f.required && !options[f.name]?.trim()) next[f.name] = `${f.label} is required`;
		}

		const typed = Object.fromEntries(
			secretFields
				.map((f) => [f.name, (secrets[f.name] ?? '').trim()] as const)
				.filter(([, value]) => value.length > 0)
		);
		const anyTyped = Object.keys(typed).length > 0;
		if (anyTyped || !keepsSecret) {
			for (const f of secretFields) {
				if (f.required && !typed[f.name])
					next[f.name] = keepsSecret
						? `Enter the ${f.label.toLowerCase()} too, or clear the other key fields`
						: `${f.label} is required`;
			}
		}

		errors = next;
		if (Object.keys(next).length) return;

		saving = true;
		try {
			const saved = await journal.saveProvider({
				id,
				provider,
				label: label.trim(),
				options: Object.fromEntries(
					Object.entries(options)
						.map(([k, value]) => [k, value.trim()])
						.filter(([, value]) => value !== '')
				),
				isDefault: makeDefault,
				secret: anyTyped ? typed : keepsSecret ? null : secretFields.length ? typed : null
			});
			secrets = {};
			toaster.success(
				editing ? `${saved.label} saved` : `${saved.label} added`,
				'Use Test to check the connection.'
			);
			open = false;
			onsaved?.(saved);
		} catch (error) {
			toaster.error(
				'Could not save the provider',
				error instanceof Error ? error.message : undefined
			);
		} finally {
			saving = false;
		}
	}
</script>

<Dialog
	bind:open
	title={editing
		? `Edit ${editing.label}`
		: step === 'choose'
			? 'Add a market data provider'
			: `Connect ${info.name}`}
	description={step === 'choose'
		? 'Candles behind each trade come from the provider you choose, with your own API key. Keys are stored encrypted and are never shown again.'
		: undefined}
	size="md"
>
	{#if step === 'choose'}
		<ul class="choices" role="list">
			{#each PROVIDER_ORDER as pid (pid)}
				{@const p = PROVIDERS[pid]}
				<li>
					<button type="button" class="choice" onclick={() => choose(pid)}>
						<span class="choice-head">
							<span class="choice-name">{p.name}</span>
							{#if p.supportsOptions}<Badge tone="outline">Stocks and options</Badge>{:else}<Badge
									tone="outline">Stocks</Badge
								>{/if}
						</span>
						<span class="choice-desc">{p.description}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<form id="provider-form" class="form" onsubmit={save} novalidate autocomplete="off">
			<p class="about">
				{info.description}
				<a href={info.docs} target="_blank" rel="noreferrer noopener">API documentation</a>
			</p>
			{#if info.notice}<p class="notice">{info.notice}</p>{/if}

			<Field
				label="Name"
				for="prov-label"
				error={errors['label']}
				help="Shown when you pick a data source on a trade."
			>
				<TextInput id="prov-label" bind:value={label} maxlength={120} invalid={!!errors['label']} />
			</Field>

			{#each secretFields as f (f.name)}
				<Field
					label={f.label}
					for="prov-{f.name}"
					error={errors[f.name]}
					optional={!f.required}
					help={keepsSecret
						? `Stored key ${editing?.secretHint ?? ''}. Leave blank to keep it.`
						: f.help}
				>
					<TextInput
						id="prov-{f.name}"
						type="password"
						bind:value={secrets[f.name]}
						placeholder={keepsSecret ? 'Unchanged' : f.placeholder}
						autocomplete="off"
						spellcheck={false}
						invalid={!!errors[f.name]}
					/>
				</Field>
			{/each}

			{#each optionFields as f (f.name)}
				<Field
					label={f.label}
					for="prov-{f.name}"
					error={errors[f.name]}
					optional={!f.required}
					help={f.help}
				>
					{#if f.kind === 'select' && f.choices}
						<Select id="prov-{f.name}" bind:value={options[f.name]} options={f.choices} />
					{:else}
						<TextInput
							id="prov-{f.name}"
							bind:value={options[f.name]}
							placeholder={f.placeholder}
							spellcheck={false}
							invalid={!!errors[f.name]}
						/>
					{/if}
				</Field>
			{/each}

			{#if !editing?.isDefault}
				<Checkbox
					id="prov-default"
					bind:checked={makeDefault}
					description="New trades load candles from this provider unless you pick another."
					>Use as the default provider</Checkbox
				>
			{/if}
		</form>
	{/if}

	{#snippet footer()}
		{#if step === 'configure' && !editing}
			<Button variant="ghost" onclick={() => (step = 'choose')}>Back</Button>
		{/if}
		<span class="grow"></span>
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		{#if step === 'configure'}
			<Button type="submit" form="provider-form" variant="primary" busy={saving}
				>{editing ? 'Save provider' : 'Add provider'}</Button
			>
		{/if}
	{/snippet}
</Dialog>

<style>
	.choices {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
	}

	.choice {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		padding: var(--space-4);
		text-align: left;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		color: inherit;
	}

	.choice:hover {
		border-color: var(--color-line-strong);
		background: var(--color-surface-2);
	}

	.choice:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}

	.choice-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.choice-name {
		font-weight: 600;
	}

	.choice-desc {
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.form {
		display: grid;
		gap: var(--space-4);
	}

	.about {
		font-size: var(--text-sm);
		color: var(--color-ink-2);
	}

	.notice {
		padding: var(--space-3);
		border-left: 2px solid var(--color-signal);
		background: var(--color-signal-soft);
		font-size: var(--text-sm);
	}

	.grow {
		flex: 1;
	}
</style>
