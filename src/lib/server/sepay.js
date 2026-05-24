import { timingSafeEqual } from 'node:crypto';
import {
	SEPAY_ACCOUNT_NUMBER,
	SEPAY_BANK_CODE,
	SEPAY_ORDER_PREFIX,
	SEPAY_WEBHOOK_API_KEY
} from '$env/static/private';

const PREFIX = (SEPAY_ORDER_PREFIX || 'SEVQR').toUpperCase();

/**
 * Build the VietQR image URL for a given order. SePay hosts the QR; we just
 * point an <img> at it. Memo = order code so SePay can auto-extract it.
 *
 * @param {{ amount: number, code: string }} input
 */
export function buildQrUrl({ amount, code }) {
	const url = new URL('https://qr.sepay.vn/img');
	url.searchParams.set('acc', SEPAY_ACCOUNT_NUMBER);
	url.searchParams.set('bank', SEPAY_BANK_CODE);
	url.searchParams.set('amount', String(amount));
	url.searchParams.set('des', code);
	url.searchParams.set('template', 'compact');
	return url.toString();
}

/**
 * Constant-time check on `Authorization: Apikey <key>`. Case-insensitive on
 * the scheme name per RFC 7235; the key itself is compared byte-exact.
 *
 * @param {Request} request
 */
export function verifyWebhookAuth(request) {
	const header = request.headers.get('authorization');
	if (!header) return false;
	const firstSpace = header.indexOf(' ');
	if (firstSpace < 0) return false;
	const scheme = header.slice(0, firstSpace).toLowerCase();
	if (scheme !== 'apikey') return false;
	const presented = header.slice(firstSpace + 1).trim();
	const expected = SEPAY_WEBHOOK_API_KEY;
	if (!expected || presented.length !== expected.length) return false;
	return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

/**
 * Prefer the dashboard-extracted `code` field; fall back to scanning `content`
 * for "<PREFIX><6 alphanum>". Returns null when nothing usable matches.
 *
 * @param {import('$lib/types.js').SepayWebhookPayload} payload
 * @returns {string | null}
 */
export function extractOrderCode(payload) {
	if (payload.code && typeof payload.code === 'string') {
		const trimmed = payload.code.trim().toUpperCase();
		if (trimmed.length >= PREFIX.length + 4) return trimmed;
	}
	if (payload.content) {
		const m = payload.content.toUpperCase().match(new RegExp(PREFIX + '([A-Z0-9]{6})'));
		if (m) return PREFIX + m[1];
	}
	return null;
}
