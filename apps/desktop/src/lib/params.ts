import type { ReportTab, SettingsSection } from '@strikebook/ui';

export const REPORT_TABS: readonly ReportTab[] = [
	'overview',
	'options',
	'time',
	'risk',
	'tags',
	'symbols'
];
export const SETTINGS_SECTIONS: readonly SettingsSection[] = ['general', 'market-data', 'data'];

/** The `?tab=` value when it names a report tab, otherwise `undefined` (the screen's default). */
export function reportTab(value: string | null): ReportTab | undefined {
	return REPORT_TABS.find((tab) => tab === value);
}

/** The `?section=` value when it names a settings section, otherwise `undefined`. */
export function settingsSection(value: string | null): SettingsSection | undefined {
	return SETTINGS_SECTIONS.find((section) => section === value);
}
