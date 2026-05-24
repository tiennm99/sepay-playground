import { fail, redirect } from '@sveltejs/kit';
import { createOrder, getOrder } from '$lib/server/orders.js';
import { buildQrUrl } from '$lib/server/sepay.js';

/**
 * Always re-read from Redis so the awaiting page can't render a stale
 * "pending" view if the webhook landed between order creation and first poll.
 */
export async function load({ url }) {
	const code = url.searchParams.get('code');
	if (!code) return { order: null, qrUrl: null };

	const order = await getOrder(code);
	if (!order) return { order: null, qrUrl: null, missing: code };

	return { order, qrUrl: buildQrUrl(order) };
}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const raw = String(data.get('amount') ?? '').replace(/[, ]/g, '');
		const amount = Number(raw);

		if (!Number.isInteger(amount) || amount < 1000 || amount > 50_000_000) {
			return fail(400, { amount: raw, error: 'Amount must be 1,000 – 50,000,000 VND.' });
		}

		const order = await createOrder({ amount });
		throw redirect(303, `/pay?code=${order.code}`);
	}
};
