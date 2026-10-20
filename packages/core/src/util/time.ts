const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
	let f = dayKeyFormatters.get(timeZone);
	if (!f) {
		// en-CA formats as YYYY-MM-DD.
		f = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
		dayKeyFormatters.set(timeZone, f);
	}
	return f;
}

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
	let f = partsFormatters.get(timeZone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
		partsFormatters.set(timeZone, f);
	}
	return f;
}

/** Trading-day key (`YYYY-MM-DD`) of an instant in the given IANA time zone. */
export function dayKey(instant: string | number | Date, timeZone: string): string {
	return dayFormatter(timeZone).format(new Date(instant));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface ZonedParts {
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly hour: number;
	readonly minute: number;
	/** 0 = Sunday … 6 = Saturday */
	readonly weekday: number;
}

export function zonedParts(instant: string | number | Date, timeZone: string): ZonedParts {
	const parts = partsFormatter(timeZone).formatToParts(new Date(instant));
	const get = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((p) => p.type === type)?.value ?? '0';
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour: Number(get('hour')),
		minute: Number(get('minute')),
		weekday: WEEKDAYS.indexOf(get('weekday') as (typeof WEEKDAYS)[number])
	};
}

/** Whole calendar days from `from` (instant) to `to` (YYYY-MM-DD), evaluated in `timeZone`. */
export function calendarDaysBetween(from: string, toDate: string, timeZone: string): number {
	const start = Date.parse(`${dayKey(from, timeZone)}T00:00:00Z`);
	const end = Date.parse(`${toDate}T00:00:00Z`);
	return Math.round((end - start) / 86_400_000);
}

/** Adds whole days to a `YYYY-MM-DD` key. */
export function addDays(date: string, days: number): string {
	const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
	return new Date(t).toISOString().slice(0, 10);
}

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
