import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const ORIGIN = `http://localhost:${PORT}`;

/**
 * End-to-end tests run against the production build served by `vite preview`, with the
 * database from `.env`. ORIGIN is overridden so Better Auth and the API origin guard accept
 * requests from the preview port. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a preinstalled
 * Chromium instead of `playwright install`.
 */
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: false,
	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 1 : 0,
	reporter: process.env['CI'] ? 'github' : 'list',
	timeout: 60_000,
	use: {
		baseURL: ORIGIN,
		trace: 'retain-on-failure',
		timezoneId: 'America/New_York'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
					? { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] }
					: {}
			}
		}
	],
	webServer: {
		command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort`,
		url: ORIGIN,
		reuseExistingServer: !process.env['CI'],
		timeout: 180_000,
		env: { ORIGIN }
	}
});
