import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SEPAY_WEBHOOK_API_KEY, DEV_SIMULATE_TOKEN } from '$env/static/private';
import { getOrder } from '$lib/server/orders.js';

/**
 * Dev-only helper: builds a SePay-shaped payload and re-POSTs it to the real
 * /api/webhooks/sepay handler so dedup/extract/markPaid logic stays single-sourced.
 *
 * Double-gated:
 *  1. Refuses unless SvelteKit's `dev` flag is set (true in `vite dev` only —
 *     false in Vercel preview/production builds).
 *  2. Requires the DEV_SIMULATE_TOKEN header so even a misconfigured deploy
 *     can't be hit by a stranger.
 */
export async function POST({ request, fetch }) {
	if (!dev) throw error(404, 'Not found');

	const presented = request.headers.get('x-dev-token');
	if (!DEV_SIMULATE_TOKEN || presented !== DEV_SIMULATE_TOKEN) {
		throw error(403, 'forbidden');
	}

	/** @type {{ code: string, amount?: number, corrupt?: boolean }} */
	const body = await request.json();
	if (!body?.code) throw error(400, 'code required');

	const order = await getOrder(body.code);
	if (!order) throw error(404, 'order not found');

	const amount = body.amount ?? order.amount;

	/** @type {import('$lib/types.js').SepayWebhookPayload} */
	const payload = {
		id: Date.now(),
		gateway: 'Vietcombank',
		transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
		accountNumber: '0010000000000',
		// corrupt mode strips `code` to force the content-regex fallback.
		code: body.corrupt ? null : order.code,
		content: `Test transfer ${order.code} from dev simulator`,
		transferType: 'in',
		transferAmount: amount,
		accumulated: amount,
		subAccount: null,
		referenceCode: `DEV.${shortRef()}`,
		description: ''
	};

	const res = await fetch('/api/webhooks/sepay', {
		method: 'POST',
		headers: {
			authorization: `Apikey ${SEPAY_WEBHOOK_API_KEY}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify(payload)
	});
	const upstream = await res.json();
	return json({ simulated: payload, upstream, status: res.status });
}

function shortRef() {
	return Math.random().toString(36).slice(2, 10).toUpperCase();
}
