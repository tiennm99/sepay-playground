import { json } from '@sveltejs/kit';
import { claimWebhookId, markPaid, getOrder } from '$lib/server/orders.js';
import { verifyWebhookAuth, extractOrderCode } from '$lib/server/sepay.js';

/**
 * SePay POSTs here. Spec:
 *  - Respond 200 {"success": true} within 30s on every accepted call.
 *  - 4xx only when auth fails (so SePay retries don't hammer a misconfigured route).
 *  - Idempotent on payload.id; outgoing transfers ignored.
 */
export async function POST({ request }) {
	if (!verifyWebhookAuth(request)) {
		return json({ success: false, error: 'unauthorized' }, { status: 401 });
	}

	/** @type {import('$lib/types.js').SepayWebhookPayload} */
	let payload;
	try {
		payload = await request.json();
	} catch {
		return json({ success: false, error: 'invalid json' }, { status: 400 });
	}

	if (payload.transferType !== 'in') {
		return json({ success: true, ignored: 'outgoing' });
	}

	const fresh = await claimWebhookId(payload.id);
	if (!fresh) {
		return json({ success: true, deduped: true });
	}

	const code = extractOrderCode(payload);
	if (!code) {
		console.warn('[sepay] unmatched webhook', { id: payload.id, content: payload.content });
		return json({ success: true, unmatched: true });
	}

	const existing = await getOrder(code);
	if (!existing) {
		console.warn('[sepay] webhook for missing/expired order', { id: payload.id, code });
		return json({ success: true, orphan: true });
	}

	const updated = await markPaid(code, {
		paidAt: payload.transactionDate,
		txReference: payload.referenceCode
	});

	return json({ success: true, code, status: updated?.status });
}
