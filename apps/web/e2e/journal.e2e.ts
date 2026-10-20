import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'correct horse battery staple';

async function signUp(page: Page): Promise<void> {
	const email = `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
	await page.goto('/signup');
	await page.getByLabel('Name').fill('E2E Trader');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: /create account/i }).click();
	await page.waitForURL(/\/app/);
}

function watchConsole(page: Page): string[] {
	const problems: string[] = [];
	page.on('console', (m) => {
		if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
	});
	page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
	return problems;
}

test('marketing site links to pricing and sign up', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.getByRole('link', { name: 'Pricing' }).first().click();
	await expect(page).toHaveURL(/\/pricing$/);
	await expect(page.getByRole('heading', { name: 'Choose a plan' })).toBeVisible();
});

test('the app requires a session', async ({ page }) => {
	await page.goto('/app/trades');
	await expect(page).toHaveURL(/\/login\?next=/);
});

test('sample journal drives the dashboard, reports and trade chart', async ({ page }) => {
	const problems = watchConsole(page);
	await signUp(page);

	await page.goto('/app/settings?section=data');
	await page.getByRole('button', { name: 'Load sample journal' }).click();
	await page.getByRole('button', { name: 'Load sample', exact: true }).click();
	await page.waitForURL(/\/app\/?$/);

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await expect(page.getByText('Net P&L').first()).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Equity curve' })).toBeVisible();

	for (const tab of ['options', 'time', 'risk', 'tags', 'symbols']) {
		await page.goto(`/app/reports?tab=${tab}`);
		await expect(page.getByRole('tab', { selected: true })).toBeVisible();
	}

	await page.goto('/app/trades');
	await page.locator('main a[href^="/app/trades/0"]').first().click();
	await expect(page.getByRole('heading', { name: 'Chart' })).toBeVisible();
	await expect(page.locator('.trade-chart canvas').first()).toBeVisible();
	await expect(page.getByText('Simulated prices')).toBeVisible();

	expect(problems).toEqual([]);
});

test('a stock trade entered fill by fill computes its P&L', async ({ page }) => {
	const problems = watchConsole(page);
	await signUp(page);

	await page.goto('/app/accounts');
	await page.getByRole('button', { name: 'New account' }).first().click();
	await page.getByLabel('Name').fill('Test margin');
	await page.getByLabel('Starting balance').fill('25000');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('rowheader', { name: /Test margin/ })).toBeVisible();

	await page.goto('/app/trades/new');
	await page.getByLabel('Underlying symbol').fill('AAPL');
	await page.getByRole('radio', { name: 'Stock' }).click();

	await page.getByRole('button', { name: 'Add fill' }).click();
	await page.getByLabel('Quantity').nth(0).fill('100');
	await page.getByLabel('Price').nth(0).fill('200');
	await page.getByLabel('Fees').nth(0).fill('0');
	await page.getByLabel('Execution time').nth(0).fill('2026-10-19T10:00');

	await page.getByRole('button', { name: 'Add fill' }).click();
	await page.getByLabel('Side').nth(1).selectOption('sell');
	await page.getByLabel('Quantity').nth(1).fill('100');
	await page.getByLabel('Price').nth(1).fill('205');
	await page.getByLabel('Fees').nth(1).fill('0');
	await page.getByLabel('Execution time').nth(1).fill('2026-10-19T11:00');

	await page.getByRole('button', { name: 'Save trade' }).first().click();
	await page.waitForURL(/\/app\/trades\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { name: 'AAPL long shares' })).toBeVisible();
	await expect(page.getByText('+$500.00').first()).toBeVisible();

	expect(problems).toEqual([]);
});
