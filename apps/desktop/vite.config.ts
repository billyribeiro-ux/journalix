import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

// Tauri loads the static SPA from `build/` in production and the dev server on port 1420 in
// development (see src-tauri/tauri.conf.json). https://v2.tauri.app/start/frontend/sveltekit/
export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' })
		})
	],
	// Keep Rust compiler output visible when running under `tauri dev`.
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		watch: {
			// The Rust crate rebuilds itself; Vite must not reload on its changes.
			ignored: ['**/src-tauri/**']
		}
	},
	// Expose Tauri's build-time variables (platform, arch, debug) alongside VITE_*.
	envPrefix: ['VITE_', 'TAURI_ENV_*'],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
