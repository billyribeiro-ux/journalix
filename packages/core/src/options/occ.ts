/**
 * OCC option symbology (Options Clearing Corporation, 21 characters):
 * root padded to 6, YYMMDD, C/P, strike × 1000 as 8 digits — e.g. `SPY   261218C00450000`.
 * Vendors usually drop the padding (`SPY261218C00450000`); Massive prefixes `O:`.
 */
export interface OptionContractRef {
	readonly underlying: string;
	/** `YYYY-MM-DD` */
	readonly expiration: string;
	readonly kind: 'call' | 'put';
	readonly strike: number;
}

function strikeDigits(strike: number): string {
	const milli = Math.round(strike * 1000);
	if (milli <= 0 || milli > 99_999_999) throw new RangeError(`Strike out of OCC range: ${strike}`);
	return String(milli).padStart(8, '0');
}

function yymmdd(expiration: string): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiration);
	if (!m) throw new RangeError(`Invalid expiration: ${expiration}`);
	return `${m[1]?.slice(2)}${m[2]}${m[3]}`;
}

/** Canonical 21-character OCC symbol. */
export function formatOcc(c: OptionContractRef): string {
	const root = c.underlying.toUpperCase();
	if (root.length === 0 || root.length > 6) throw new RangeError(`Invalid OCC root: ${root}`);
	return `${root.padEnd(6, ' ')}${yymmdd(c.expiration)}${c.kind === 'call' ? 'C' : 'P'}${strikeDigits(c.strike)}`;
}

/** Compact OCC symbol without padding, as used by Alpaca and most APIs. */
export function formatOccCompact(c: OptionContractRef): string {
	return formatOcc(c).replace(/ /g, '');
}

const OCC_PATTERN = /^(?:O:)?([A-Z0-9.]{1,6})\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;

export function parseOcc(symbol: string): OptionContractRef | null {
	const m = OCC_PATTERN.exec(symbol.trim().toUpperCase());
	if (!m) return null;
	const [, root, yy, mm, dd, cp, strike] = m;
	if (!root || !yy || !mm || !dd || !cp || !strike) return null;
	const expiration = `20${yy}-${mm}-${dd}`;
	if (Number.isNaN(Date.parse(`${expiration}T00:00:00Z`))) return null;
	return {
		underlying: root,
		expiration,
		kind: cp === 'C' ? 'call' : 'put',
		strike: Number(strike) / 1000
	};
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Human label, e.g. `SPY 18 Dec 26 450C`. */
export function describeContract(c: OptionContractRef): string {
	const [y, m, d] = c.expiration.split('-');
	const month = MONTHS[Number(m) - 1] ?? m;
	const strike = Number.isInteger(c.strike) ? String(c.strike) : String(c.strike);
	return `${c.underlying} ${Number(d)} ${month} ${y?.slice(2)} ${strike}${c.kind === 'call' ? 'C' : 'P'}`;
}
