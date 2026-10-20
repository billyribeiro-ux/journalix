const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, digits: number, compact: boolean): Intl.NumberFormat {
	const key = `${currency}:${digits}:${compact}`;
	let f = currencyFormatters.get(key);
	if (!f) {
		f = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency,
			minimumFractionDigits: compact ? 0 : digits,
			maximumFractionDigits: compact ? 1 : digits,
			...(compact ? { notation: 'compact' as const } : {})
		});
		currencyFormatters.set(key, f);
	}
	return f;
}

/** `$1,234.56` / `−$80.00` (true minus sign) / `+$1.2K` when signed and compact. */
export function formatMoney(
	value: number | null | undefined,
	options: { currency?: string; signed?: boolean; compact?: boolean; digits?: number } = {}
): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	const { currency = 'USD', signed = false, compact = false, digits = 2 } = options;
	const abs = currencyFormatter(currency, digits, compact).format(Math.abs(value));
	if (value < 0 && Math.abs(value) >= 0.005) return `−${abs}`;
	if (signed && value > 0 && Math.abs(value) >= 0.005) return `+${abs}`;
	return abs;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	const s = value.toLocaleString('en-US', {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
	return value < 0 ? `−${s.slice(1)}` : s;
}

/** Price with up to 4 decimals for sub-dollar premiums, 2 otherwise. */
export function formatPrice(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	return value.toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2
	});
}

export function formatPercent(
	value: number | null | undefined,
	digits = 1,
	signed = false
): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	const s = `${Math.abs(value * 100).toFixed(digits)}%`;
	if (value < 0 && Math.abs(value) * 100 >= 0.5 * 10 ** -digits) return `−${s}`;
	return signed && value > 0 ? `+${s}` : s;
}

export function formatR(value: number | null | undefined, digits = 2): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	const s = `${Math.abs(value).toFixed(digits)}R`;
	return value < 0 ? `−${s}` : value > 0 ? `+${s}` : s;
}

export function formatRatio(
	value: number | null | undefined,
	digits = 2,
	infiniteWhenNull = false
): string {
	if (value === null || value === undefined) return infiniteWhenNull ? '∞' : '—';
	if (!Number.isFinite(value)) return '∞';
	return value.toFixed(digits);
}

export function formatQuantity(value: number): string {
	return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** `45s`, `12m`, `3h 20m`, `4d 6h`. */
export function formatDuration(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—';
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
	const d = Math.floor(h / 24);
	return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatDateTime(
	instant: string | number | null | undefined,
	timeZone: string,
	style: 'date' | 'datetime' | 'time' | 'short' | 'month' = 'datetime'
): string {
	if (instant === null || instant === undefined || instant === '') return '—';
	const key = `${timeZone}:${style}`;
	let f = dateTimeFormatters.get(key);
	if (!f) {
		const opts: Intl.DateTimeFormatOptions =
			style === 'date'
				? { year: 'numeric', month: 'short', day: 'numeric' }
				: style === 'time'
					? { hour: 'numeric', minute: '2-digit' }
					: style === 'short'
						? { month: 'short', day: 'numeric' }
						: style === 'month'
							? { year: 'numeric', month: 'long' }
							: {
									year: 'numeric',
									month: 'short',
									day: 'numeric',
									hour: 'numeric',
									minute: '2-digit'
								};
		f = new Intl.DateTimeFormat('en-US', { timeZone, ...opts });
		dateTimeFormatters.set(key, f);
	}
	return f.format(new Date(instant));
}

/** Formats a `YYYY-MM-DD` key without shifting it through a time zone. */
export function formatDayKey(day: string, style: 'long' | 'short' = 'short'): string {
	const d = new Date(`${day}T12:00:00Z`);
	return d.toLocaleDateString('en-US', {
		timeZone: 'UTC',
		...(style === 'long'
			? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
			: { month: 'short', day: 'numeric' })
	});
}

/** `<datetime-local>` value (`YYYY-MM-DDTHH:mm`) of an instant in the given zone. */
export function toLocalInput(instant: string | number, timeZone: string): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	}).formatToParts(new Date(instant));
	const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '00';
	return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Converts a `<datetime-local>` value interpreted in `timeZone` to an ISO instant. */
export function fromLocalInput(value: string, timeZone: string): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
	if (!m) throw new RangeError(`Invalid local datetime: ${value}`);
	const [, y, mo, d, h, mi, s] = m;
	const asUtc = Date.UTC(
		Number(y),
		Number(mo) - 1,
		Number(d),
		Number(h),
		Number(mi),
		Number(s ?? 0)
	);
	// Two passes resolve the offset correctly across DST transitions.
	let guess = asUtc;
	for (let i = 0; i < 2; i++) {
		const shown = toLocalInput(guess, timeZone);
		const shownUtc = Date.parse(`${shown}:00Z`);
		guess += asUtc - shownUtc;
	}
	return new Date(guess).toISOString();
}
