/**
 * Navigation contract between the shared screens and each host app. Screens never build URLs
 * or call a router directly; the host maps these routes to its own paths
 * (`/app/trades/:id` on the web, `/trades/:id` on the desktop).
 */
export type ReportTab = 'overview' | 'options' | 'time' | 'risk' | 'tags' | 'symbols';
export type SettingsSection = 'general' | 'market-data' | 'data';

export type AppRoute =
	| { readonly name: 'dashboard' }
	| { readonly name: 'trades' }
	| { readonly name: 'trade-new'; readonly duplicateOf?: string }
	| { readonly name: 'trade'; readonly id: string }
	| { readonly name: 'trade-edit'; readonly id: string }
	| { readonly name: 'reports'; readonly tab?: ReportTab }
	| { readonly name: 'calendar' }
	| { readonly name: 'playbooks' }
	| { readonly name: 'tags' }
	| { readonly name: 'notebook' }
	| { readonly name: 'accounts' }
	| { readonly name: 'settings'; readonly section?: SettingsSection }
	| { readonly name: 'billing' };

export type RouteName = AppRoute['name'];

export interface AppUser {
	readonly name: string;
	readonly email: string;
}

export interface AppEnv {
	readonly platform: 'web' | 'desktop';
	href(route: AppRoute): string;
	navigate(route: AppRoute, options?: { readonly replace?: boolean }): Promise<void>;
	/** Name of the route currently shown, for navigation highlighting. */
	activeRoute(): RouteName;
	readonly user: AppUser | null;
	signOut?(): Promise<void>;
	/** Link back to the public site (web only). */
	readonly homeHref?: string;
	/**
	 * Saves a generated file. The desktop app shows a native save dialog; when absent, screens
	 * fall back to a browser download. Resolves `false` when the user cancels.
	 */
	saveFile?(file: SaveFileRequest): Promise<boolean>;
}

export interface SaveFileRequest {
	readonly name: string;
	readonly contents: string;
	readonly mime: string;
}
