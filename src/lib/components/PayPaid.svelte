<script>
	import { Check } from '@lucide/svelte';

	let { order } = $props();
	const amountFmt = $derived(order.amount.toLocaleString('en-US'));
</script>

<p class="mb-2 font-mono text-[12px] text-muted">step 3 of 3 · settled</p>
<h1 class="mb-6 text-[20px] font-semibold tracking-tight">Payment received</h1>

<div role="status" aria-live="polite" class="rounded border border-border bg-surface p-6">
	<span class="sr-only">Payment received.</span>

	<div class="mb-6 flex items-center justify-between">
		<span
			class="inline-flex h-5 items-center gap-1.5 rounded bg-success-soft px-2 font-mono text-[12px] font-medium text-success"
		>
			<span class="h-1.5 w-1.5 rounded-full bg-success"></span>paid
		</span>
		<div class="grid h-10 w-10 place-items-center rounded-full bg-success-soft" aria-hidden="true">
			<Check size={20} color="var(--color-success)" strokeWidth={2.5} />
		</div>
	</div>

	<div class="mb-6 border-b border-border pb-6">
		<p class="mb-1 text-[12px] tracking-wide text-muted uppercase">Amount paid</p>
		<p class="font-mono text-[30px] leading-none text-ink tabular-nums">
			{amountFmt} <span class="text-[16px] text-muted">VND</span>
		</p>
	</div>

	<dl class="grid grid-cols-3 gap-x-4 gap-y-3 text-[14px]">
		<dt class="col-span-1 text-[12px] tracking-wide text-muted uppercase">Order</dt>
		<dd class="col-span-2 font-mono text-ink">{order.code}</dd>

		<dt class="col-span-1 text-[12px] tracking-wide text-muted uppercase">Paid at</dt>
		<dd class="col-span-2 font-mono text-ink">{order.paidAt ?? '—'}</dd>

		<dt class="col-span-1 text-[12px] tracking-wide text-muted uppercase">Txn ref</dt>
		<dd class="col-span-2 font-mono text-muted">{order.txReference ?? '—'}</dd>
	</dl>
</div>

<a
	href="/pay"
	class="mt-6 inline-flex h-10 w-full items-center justify-center rounded bg-accent px-4 text-[14px] font-medium text-white transition hover:bg-accent-hover sm:w-auto"
>
	Start another
	<span aria-hidden="true" class="ml-2 font-mono">→</span>
</a>

<p class="mt-4 font-mono text-[12px] text-muted">// webhook received · order marked paid · ready</p>
