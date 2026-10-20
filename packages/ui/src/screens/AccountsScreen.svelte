<script lang="ts">
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import {
		AccountSchema,
		EMPTY_FILTER,
		formatMoney,
		formatPercent,
		newId,
		type Account
	} from '@strikebook/core';
	import * as v from 'valibot';
	import { useApp } from '../app/context.ts';
	import Button from '../primitives/Button.svelte';
	import Dialog from '../primitives/Dialog.svelte';
	import Field from '../primitives/Field.svelte';
	import TextInput from '../primitives/TextInput.svelte';
	import NumberInput from '../primitives/NumberInput.svelte';
	import Switch from '../primitives/Switch.svelte';
	import EmptyState from '../primitives/EmptyState.svelte';
	import Badge from '../primitives/Badge.svelte';
	import PageHeader from './parts/PageHeader.svelte';
	import Pnl from './parts/Pnl.svelte';

	const { journal, env, toaster } = useApp();

	interface AccountRow {
		readonly account: Account;
		readonly closed: number;
		readonly open: number;
		readonly netPnl: number;
		readonly fees: number;
		readonly winRate: number | null;
		readonly balance: number;
		readonly returnPct: number | null;
	}

	const rows = $derived.by<AccountRow[]>(() =>
		journal.accounts
			.map((account) => {
				const views = journal.views.filter((view) => view.trade.accountId === account.id);
				const closed = views.filter((view) => view.metrics.status === 'closed');
				const netPnl = closed.reduce((s, view) => s + view.metrics.netPnl, 0);
				const wins = closed.filter((view) => view.metrics.outcome === 'win').length;
				const losses = closed.filter((view) => view.metrics.outcome === 'loss').length;
				return {
					account,
					closed: closed.length,
					open: views.length - closed.length,
					netPnl,
					fees: closed.reduce((s, view) => s + view.metrics.fees, 0),
					winRate: wins + losses ? wins / (wins + losses) : null,
					balance: account.startingBalance + netPnl,
					returnPct: account.startingBalance > 0 ? netPnl / account.startingBalance : null
				};
			})
			.sort(
				(a, b) =>
					Number(a.account.archived) - Number(b.account.archived) ||
					a.account.name.localeCompare(b.account.name)
			)
	);

	// ----- editor -----
	let editorOpen = $state(false);
	let draft = $state<Account>(blank());
	let balance = $state<number | null>(0);
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);
	const isNew = $derived(!journal.accountById.has(draft.id));

	function blank(): Account {
		return {
			id: newId(),
			name: '',
			broker: '',
			currency: journal.settings.baseCurrency,
			startingBalance: 0,
			archived: false,
			createdAt: new Date().toISOString()
		};
	}

	function create(): void {
		draft = blank();
		balance = null;
		errors = {};
		editorOpen = true;
	}

	function edit(account: Account): void {
		draft = { ...account };
		balance = account.startingBalance;
		errors = {};
		editorOpen = true;
	}

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const parsed = v.safeParse(AccountSchema, { ...draft, startingBalance: balance ?? 0 });
		if (!parsed.success) {
			const next: Record<string, string> = {};
			for (const issue of parsed.issues)
				next[String(issue.path?.[0]?.key ?? 'form')] ??= issue.message;
			errors = next;
			return;
		}
		saving = true;
		try {
			await journal.saveAccount(parsed.output);
			toaster.success(isNew ? 'Account created' : 'Account saved');
			editorOpen = false;
		} catch (error) {
			toaster.error(
				'Could not save the account',
				error instanceof Error ? error.message : undefined
			);
		} finally {
			saving = false;
		}
	}

	// ----- delete (cascades to trades, so it asks for the account name) -----
	let deleteTarget = $state<AccountRow | null>(null);
	let deleteOpen = $state(false);
	let confirmName = $state('');
	let deleting = $state(false);

	function askDelete(row: AccountRow): void {
		deleteTarget = row;
		confirmName = '';
		deleteOpen = true;
	}

	async function remove(): Promise<void> {
		const target = deleteTarget;
		if (!target) return;
		deleting = true;
		try {
			await journal.deleteAccount(target.account.id);
			toaster.success(`Deleted ${target.account.name}`);
			deleteOpen = false;
			editorOpen = false;
		} catch (error) {
			toaster.error(
				'Could not delete the account',
				error instanceof Error ? error.message : undefined
			);
		} finally {
			deleting = false;
		}
	}

	function viewTrades(id: string): void {
		journal.setFilter({ ...EMPTY_FILTER, accountIds: [id] });
		void env.navigate({ name: 'trades' });
	}
</script>

<PageHeader
	title="Accounts"
	description="Each account has its own starting balance. Balances update as trades close."
>
	{#snippet actions()}
		<Button variant="primary" onclick={create}>
			{#snippet icon()}<PlusIcon size={16} weight="bold" />{/snippet}
			New account
		</Button>
	{/snippet}
</PageHeader>

{#if rows.length === 0}
	<EmptyState
		title="No accounts yet"
		message="Create one for each brokerage account you trade, such as a margin account and an IRA, so their results stay separate."
	>
		{#snippet actions()}<Button variant="primary" onclick={create}>New account</Button>{/snippet}
	</EmptyState>
{:else}
	<div class="table-wrap">
		<table>
			<caption class="visually-hidden">Accounts</caption>
			<thead>
				<tr>
					<th scope="col">Account</th>
					<th scope="col" class="num">Starting balance</th>
					<th scope="col" class="num">Net P&L</th>
					<th scope="col" class="num">Return</th>
					<th scope="col" class="num">Balance</th>
					<th scope="col" class="num">Closed</th>
					<th scope="col" class="num">Open</th>
					<th scope="col" class="num">Win rate</th>
					<th scope="col" class="num">Fees</th>
					<th scope="col"><span class="visually-hidden">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.account.id)}
					{@const c = row.account.currency}
					<tr class:archived={row.account.archived}>
						<th scope="row">
							<span class="name">{row.account.name}</span>
							{#if row.account.broker}<span class="broker">{row.account.broker}</span>{/if}
							{#if row.account.archived}<Badge tone="outline">Archived</Badge>{/if}
						</th>
						<td class="num">{formatMoney(row.account.startingBalance, { currency: c })}</td>
						<td class="num"><Pnl value={row.netPnl} currency={c} /></td>
						<td class="num">{formatPercent(row.returnPct, 1, true)}</td>
						<td class="num strong">{formatMoney(row.balance, { currency: c })}</td>
						<td class="num">{row.closed}</td>
						<td class="num">{row.open}</td>
						<td class="num">{formatPercent(row.winRate)}</td>
						<td class="num">{formatMoney(row.fees, { currency: c })}</td>
						<td class="actions">
							<Button size="sm" variant="ghost" onclick={() => viewTrades(row.account.id)}
								>Trades</Button
							>
							<Button size="sm" variant="ghost" onclick={() => edit(row.account)}>Edit</Button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="note">Balances count closed trades only. Open positions are not marked to market.</p>
{/if}

<Dialog bind:open={editorOpen} title={isNew ? 'New account' : 'Edit account'} size="sm">
	<form id="account-form" class="form" onsubmit={save} novalidate>
		<Field label="Name" for="acct-name" error={errors['name']}>
			<TextInput
				id="acct-name"
				bind:value={draft.name}
				invalid={!!errors['name']}
				placeholder="Margin"
				maxlength={120}
				required
			/>
		</Field>
		<Field label="Broker" for="acct-broker" optional>
			<TextInput id="acct-broker" bind:value={draft.broker} placeholder="Schwab" maxlength={120} />
		</Field>
		<div class="pair">
			<Field label="Starting balance" for="acct-balance" error={errors['startingBalance']}>
				<NumberInput
					id="acct-balance"
					bind:value={balance}
					min={0}
					step="0.01"
					invalid={!!errors['startingBalance']}
				/>
			</Field>
			<Field
				label="Currency"
				for="acct-currency"
				error={errors['currency']}
				help="ISO code, such as USD."
			>
				<TextInput
					id="acct-currency"
					bind:value={draft.currency}
					maxlength={3}
					autocapitalize="characters"
					invalid={!!errors['currency']}
				/>
			</Field>
		</div>
		{#if !isNew}
			<Switch
				id="acct-archived"
				label="Archived (hidden from the trade editor)"
				bind:checked={draft.archived}
			/>
		{/if}
	</form>
	{#snippet footer()}
		{#if !isNew}
			{@const row = rows.find((r) => r.account.id === draft.id)}
			{#if row}<Button variant="danger" onclick={() => askDelete(row)}>Delete</Button>{/if}
		{/if}
		<span class="grow"></span>
		<Button variant="ghost" onclick={() => (editorOpen = false)}>Cancel</Button>
		<Button type="submit" form="account-form" variant="primary" busy={saving}
			>{isNew ? 'Create account' : 'Save account'}</Button
		>
	{/snippet}
</Dialog>

<Dialog
	bind:open={deleteOpen}
	title="Delete {deleteTarget?.account.name ?? 'account'}?"
	description="This permanently deletes the account and its {deleteTarget
		? deleteTarget.closed + deleteTarget.open
		: 0} trades. Export your journal first if you may need them."
	size="sm"
>
	<Field label="Type the account name to confirm" for="acct-confirm">
		<TextInput id="acct-confirm" bind:value={confirmName} autocomplete="off" />
	</Field>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (deleteOpen = false)}>Cancel</Button>
		<Button
			variant="danger"
			busy={deleting}
			disabled={confirmName.trim() !== deleteTarget?.account.name}
			onclick={remove}>Delete account and trades</Button
		>
	{/snippet}
</Dialog>

<style>
	.table-wrap {
		overflow-x: auto;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
		white-space: nowrap;
	}

	th,
	td {
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--color-line);
		text-align: left;
		font-weight: 400;
	}

	thead th {
		border-top: 0;
		color: var(--color-ink-3);
	}

	.num {
		text-align: right;
	}

	.strong {
		font-weight: 600;
	}

	.name {
		font-weight: 600;
		margin-right: var(--space-2);
	}

	.broker {
		color: var(--color-ink-3);
		margin-right: var(--space-2);
	}

	tr.archived > * {
		color: var(--color-ink-3);
	}

	.actions {
		text-align: right;
	}

	.note {
		margin-top: var(--space-3);
		font-size: var(--text-sm);
		color: var(--color-ink-3);
	}

	.form {
		display: grid;
		gap: var(--space-4);
	}

	.pair {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: var(--space-3);
	}

	.grow {
		flex: 1;
	}
</style>
