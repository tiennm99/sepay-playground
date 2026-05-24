<script>
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	let { order, qrUrl } = $props();

	const EXPIRY_MS = 15 * 60 * 1000;
	const createdAt = $derived(new Date(order.createdAt).getTime());

	let now = $state(Date.now());
	const remainingMs = $derived(Math.max(0, createdAt + EXPIRY_MS - now));
	const expired = $derived(remainingMs === 0);
	const mm = $derived(String(Math.floor(remainingMs / 60000)).padStart(2, '0'));
	const ss = $derived(String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0'));

	let copied = $state(false);

	// Polling — single $effect owns timer + fetch lifecycle.
	$effect(() => {
		if (expired) return;
		const ctrl = new AbortController();
		let cancelled = false;

		async function tick() {
			if (cancelled) return;
			try {
				const res = await fetch(`/api/orders/${order.code}`, {
					signal: ctrl.signal,
					cache: 'no-store'
				});
				if (!res.ok) return;
				const fresh = await res.json();
				if (fresh.status === 'paid') {
					// triggers `load` rerun → view flips to 'paid'
					await invalidateAll();
				}
			} catch (err) {
				if (err.name !== 'AbortError') console.warn('[poll]', err);
			}
		}

		tick(); // run immediately — webhook may already have landed
		const id = setInterval(tick, 3000);
		const clock = setInterval(() => (now = Date.now()), 1000);

		return () => {
			cancelled = true;
			ctrl.abort();
			clearInterval(id);
			clearInterval(clock);
		};
	});

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(order.code);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* clipboard not available */
		}
	}

	const amountFmt = $derived(order.amount.toLocaleString('en-US'));
</script>

<p class="mb-2 font-mono text-[12px] text-muted">step 2 of 3 · awaiting payment</p>
<h1 class="mb-6 text-[20px] font-semibold tracking-tight">
	{expired ? 'Order expired' : 'Scan with your banking app'}
</h1>

<div class="rounded border border-border bg-surface p-6">
	<div class="mb-6 flex items-center justify-between">
		{#if expired}
			<span
				class="inline-flex h-5 items-center gap-1.5 rounded bg-danger-soft px-2 font-mono text-[12px] font-medium text-danger"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-danger"></span>expired
			</span>
		{:else}
			<span
				class="inline-flex h-5 items-center gap-1.5 rounded bg-warning-soft px-2 font-mono text-[12px] font-medium text-warning"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-warning"></span>pending
			</span>
			<span
				role="status"
				class="inline-flex items-center gap-2 font-mono text-[12px] text-muted"
			>
				<svg
					class="animate-spin"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="9" stroke-opacity="0.2" />
					<path d="M21 12a9 9 0 0 1-9 9" />
				</svg>
				<span class="sr-only">Waiting for payment</span>
				waiting…
			</span>
		{/if}
	</div>

	<div class="mx-auto h-[240px] w-[240px] overflow-hidden rounded border border-border bg-white">
		{#if expired}
			<div class="grid h-full w-full place-items-center font-mono text-[12px] text-muted">
				QR no longer valid
			</div>
		{:else}
			<img
				src={qrUrl}
				width="240"
				height="240"
				alt="VietQR code for order {order.code}"
				class="block h-[240px] w-[240px]"
			/>
		{/if}
	</div>

	<dl class="mt-6 grid grid-cols-3 gap-x-4 gap-y-3 text-[14px]">
		<dt class="col-span-1 text-[12px] tracking-wide text-muted uppercase">Amount</dt>
		<dd class="col-span-2 font-mono text-ink">{amountFmt} VND</dd>

		<dt class="col-span-1 text-[12px] tracking-wide text-muted uppercase">Order</dt>
		<dd class="col-span-2 flex items-center gap-2 font-mono text-ink">
			<span>{order.code}</span>
			<button
				type="button"
				onclick={copyCode}
				class="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted hover:border-accent hover:text-accent"
				aria-label="Copy order code"
			>
				{copied ? 'copied' : 'copy'}
			</button>
		</dd>

		<dt class="col-span-1 text-[12px] tracking-wide text-muted uppercase">Expires</dt>
		<dd class="col-span-2 font-mono text-muted">
			{expired ? '—' : `in ${mm}:${ss}`}
		</dd>
	</dl>
</div>

<div class="mt-4 flex items-center justify-between">
	<a href="/pay" class="text-[12px] text-muted transition hover:text-danger">
		Cancel / new order
	</a>
	<span class="font-mono text-[12px] text-muted">polling every 3s</span>
</div>
