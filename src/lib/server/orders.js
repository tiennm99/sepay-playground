import { customAlphabet } from 'nanoid';
import { getRedis, pkey } from './redis.js';
import { SEPAY_ORDER_PREFIX } from '$env/static/private';

const ORDER_TTL_SECONDS = 60 * 60 * 24; // 24h — demo only
const ORDER_KEY = (/** @type {string} */ code) => `order:${code}`;
const WEBHOOK_KEY = (/** @type {string|number} */ id) => `webhook:${id}`;

// Alphanumeric uppercase — no dashes, no ambiguous chars.
// 6 chars × 32 alphabet = ~1B codes; collision retry below covers the rare clash.
const codeBody = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const PREFIX = (SEPAY_ORDER_PREFIX || 'SEVQR').toUpperCase();

/**
 * @param {{ amount: number }} input
 * @returns {Promise<import('$lib/types.js').Order>}
 */
export async function createOrder({ amount }) {
	if (!Number.isInteger(amount) || amount < 1000 || amount > 50_000_000) {
		throw new Error('amount must be an integer between 1,000 and 50,000,000 VND');
	}

	const h = getRedis();
	// Retry on collision (NX returns null on existing key).
	for (let attempt = 0; attempt < 3; attempt++) {
		const code = `${PREFIX}${codeBody()}`;
		/** @type {import('$lib/types.js').Order} */
		const order = {
			code,
			amount,
			status: 'pending',
			createdAt: new Date().toISOString()
		};
		const set = await h.client.set(pkey(h, ORDER_KEY(code)), order, {
			nx: true,
			ex: ORDER_TTL_SECONDS
		});
		if (set === 'OK') return order;
	}
	throw new Error('failed to mint a unique order code after 3 attempts');
}

/**
 * @param {string} code
 * @returns {Promise<import('$lib/types.js').Order | null>}
 */
export async function getOrder(code) {
	const h = getRedis();
	return /** @type {any} */ (await h.client.get(pkey(h, ORDER_KEY(code))));
}

/**
 * Idempotent mark-paid. Preserves the existing TTL via `keepTtl`.
 * No-op if the order is already paid or missing.
 *
 * @param {string} code
 * @param {{ paidAt: string, txReference: string }} meta
 * @returns {Promise<import('$lib/types.js').Order | null>}
 */
export async function markPaid(code, { paidAt, txReference }) {
	const current = await getOrder(code);
	if (!current) return null;
	if (current.status === 'paid') return current;
	const updated = { ...current, status: 'paid', paidAt, txReference };
	const h = getRedis();
	await h.client.set(pkey(h, ORDER_KEY(code)), updated, { keepTtl: true });
	return updated;
}

/**
 * Dedup helper. Returns true if this webhook id is being seen for the first
 * time; false on retry. TTL = 7 days (SePay retries up to ~5h).
 *
 * @param {number|string} id
 * @returns {Promise<boolean>}
 */
export async function claimWebhookId(id) {
	const h = getRedis();
	const set = await h.client.set(pkey(h, WEBHOOK_KEY(id)), '1', {
		nx: true,
		ex: 60 * 60 * 24 * 7
	});
	return set === 'OK';
}
