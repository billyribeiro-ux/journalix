<script lang="ts">
	import { UserSettingsSchema, type UserSettings } from '@journalix/core';
	import * as v from 'valibot';
	import { untrack } from 'svelte';
	import { useApp } from '../../app/context.ts';
	import Button from '../../primitives/Button.svelte';
	import Field from '../../primitives/Field.svelte';
	import TextInput from '../../primitives/TextInput.svelte';
	import NumberInput from '../../primitives/NumberInput.svelte';
	import Select from '../../primitives/Select.svelte';
	import Panel from '../../primitives/Panel.svelte';

	const { journal, toaster } = useApp();

	// Full IANA list where the engine exposes it; a curated set otherwise.
	const ZONES: readonly string[] = (() => {
		try {
			return Intl.supportedValuesOf('timeZone');
		} catch {
			return [
				'America/New_York',
				'America/Chicago',
				'America/Denver',
				'America/Los_Angeles',
				'Europe/London',
				'Europe/Berlin',
				'Asia/Tokyo',
				'Asia/Singapore',
				'Australia/Sydney',
				'UTC'
			];
		}
	})();

	interface Form {
		displayName: string;
		timeZone: string;
		baseCurrency: string;
		breakevenThreshold: number | null;
		defaultCommissionPerContract: number | null;
		defaultCommissionPerShare: number | null;
		riskFreePct: number | null;
		theme: UserSettings['theme'];
		weekStartsOn: '0' | '1';
	}

	function fromSettings(s: UserSettings): Form {
		return {
			displayName: s.displayName,
			timeZone: s.timeZone,
			baseCurrency: s.baseCurrency,
			breakevenThreshold: s.breakevenThreshold,
			defaultCommissionPerContract: s.defaultCommissionPerContract,
			defaultCommissionPerShare: s.defaultCommissionPerShare,
			riskFreePct: Math.round(s.riskFreeRate * 100_000) / 1000,
			theme: s.theme,
			weekStartsOn: s.weekStartsOn === 0 ? '0' : '1'
		};
	}

	let form = $state<Form>(untrack(() => fromSettings(journal.settings)));
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	const candidate = $derived({
		displayName: form.displayName,
		timeZone: form.timeZone,
		baseCurrency: form.baseCurrency,
		breakevenThreshold: form.breakevenThreshold ?? 0,
		defaultCommissionPerContract: form.defaultCommissionPerContract ?? 0,
		defaultCommissionPerShare: form.defaultCommissionPerShare ?? 0,
		riskFreeRate: (form.riskFreePct ?? 0) / 100,
		theme: form.theme,
		weekStartsOn: form.weekStartsOn === '0' ? 0 : 1
	} satisfies Record<keyof UserSettings, unknown>);

	const dirty = $derived(JSON.stringify(fromSettings(journal.settings)) !== JSON.stringify(form));

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const parsed = v.safeParse(UserSettingsSchema, candidate);
		if (!parsed.success) {
			const next: Record<string, string> = {};
			for (const issue of parsed.issues)
				next[String(issue.path?.[0]?.key ?? 'form')] ??= issue.message;
			errors = next;
			return;
		}
		errors = {};
		saving = true;
		try {
			const saved = await journal.saveSettings(parsed.output);
			form = fromSettings(saved);
			toaster.success('Settings saved');
		} catch (error) {
			toaster.error('Could not save settings', error instanceof Error ? error.message : undefined);
		} finally {
			saving = false;
		}
	}
</script>

<form class="stack" onsubmit={save} novalidate>
	<Panel title="Profile and display">
		<div class="grid">
			<Field label="Display name" for="set-name" optional>
				<TextInput
					id="set-name"
					bind:value={form.displayName}
					maxlength={120}
					autocomplete="nickname"
				/>
			</Field>
			<Field label="Theme" for="set-theme">
				<Select
					id="set-theme"
					bind:value={form.theme}
					options={[
						{ value: 'system', label: 'Match the system' },
						{ value: 'light', label: 'Light' },
						{ value: 'dark', label: 'Dark' }
					]}
				/>
			</Field>
		</div>
	</Panel>

	<Panel
		title="Trading day"
		subtitle="Trades are grouped into days, weeks and hours in this time zone."
	>
		<div class="grid">
			<Field label="Time zone" for="set-tz" error={errors['timeZone']}>
				<Select
					id="set-tz"
					bind:value={form.timeZone}
					options={ZONES.map((z) => ({ value: z, label: z.replaceAll('_', ' ') }))}
				/>
			</Field>
			<Field label="Week starts on" for="set-week">
				<Select
					id="set-week"
					bind:value={form.weekStartsOn}
					options={[
						{ value: '1', label: 'Monday' },
						{ value: '0', label: 'Sunday' }
					]}
				/>
			</Field>
		</div>
	</Panel>

	<Panel title="Money" subtitle="Defaults for new fills and how results are classified.">
		<div class="grid">
			<Field
				label="Base currency"
				for="set-currency"
				error={errors['baseCurrency']}
				help="ISO code used in reports, such as USD."
			>
				<TextInput
					id="set-currency"
					bind:value={form.baseCurrency}
					maxlength={3}
					invalid={!!errors['baseCurrency']}
				/>
			</Field>
			<Field
				label="Breakeven band"
				for="set-be"
				error={errors['breakevenThreshold']}
				help="A closed trade within plus or minus this amount counts as breakeven."
			>
				<NumberInput
					id="set-be"
					bind:value={form.breakevenThreshold}
					min={0}
					step="0.01"
					invalid={!!errors['breakevenThreshold']}
				/>
			</Field>
			<Field
				label="Commission per option contract"
				for="set-cpc"
				error={errors['defaultCommissionPerContract']}
			>
				<NumberInput
					id="set-cpc"
					bind:value={form.defaultCommissionPerContract}
					min={0}
					step="0.01"
					invalid={!!errors['defaultCommissionPerContract']}
				/>
			</Field>
			<Field label="Commission per share" for="set-cps" error={errors['defaultCommissionPerShare']}>
				<NumberInput
					id="set-cps"
					bind:value={form.defaultCommissionPerShare}
					min={0}
					step="0.0001"
					invalid={!!errors['defaultCommissionPerShare']}
				/>
			</Field>
		</div>
	</Panel>

	<Panel
		title="Options model"
		subtitle="Used for implied volatility, Greeks and P&L attribution (Black-Scholes, European exercise)."
	>
		<div class="grid">
			<Field
				label="Risk-free rate"
				for="set-rate"
				error={errors['riskFreeRate']}
				help="Annual rate, such as the 3-month Treasury bill yield."
			>
				<NumberInput
					id="set-rate"
					bind:value={form.riskFreePct}
					min={-5}
					max={25}
					step="0.01"
					suffix="%"
					invalid={!!errors['riskFreeRate']}
				/>
			</Field>
		</div>
	</Panel>

	<div class="actions">
		<Button type="submit" variant="primary" busy={saving} disabled={!dirty}>Save settings</Button>
		{#if dirty}<Button variant="ghost" onclick={() => (form = fromSettings(journal.settings))}
				>Discard changes</Button
			>{/if}
	</div>
</form>

<style>
	.stack {
		display: grid;
		gap: var(--space-5);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
		gap: var(--space-4) var(--space-5);
	}

	.actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
