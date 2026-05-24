import { json, error } from '@sveltejs/kit';
import { getOrder } from '$lib/server/orders.js';

export async function GET({ params, setHeaders }) {
	const order = await getOrder(params.code);
	if (!order) throw error(404, 'order not found');
	setHeaders({ 'cache-control': 'no-store' });
	return json(order);
}
