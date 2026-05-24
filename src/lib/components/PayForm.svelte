<script>
	let { form, missing } = $props();
	let amount = $state('');
	// Seed from server-returned form value (after failed submit) without
	// re-capturing on every render.
	$effect(() => {
		if (form?.amount != null && amount === '') amount = String(form.amount);
	});
</script>

<p class="mb-2 font-mono text-[12px] text-muted">step 1 of 3 · new order</p>
<h1 class="mb-6 text-[20px] font-semibold tracking-tight">Enter an amount</h1>

{#if missing}
	<div
		class="mb-4 rounded border border-warning bg-warning-soft px-3 py-2 font-mono text-[12px] text-warning"
	>
		Order <span class="font-medium">{missing}</span> not found (expired or invalid).
	</div>
{/if}

<div class="rounded border border-border bg-surface p-6">
	<form method="POST" class="space-y-4">
		<div>
			<label
				for="amount"
				class="mb-2 block text-[12px] font-medium tracking-wide text-muted uppercase"
			>
				Amount (VND)
			</label>
			<div class="relative">
				<input
					id="amount"
					name="amount"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					placeholder="10000"
					bind:value={amount}
					aria-label="Amount in VND"
					aria-invalid={form?.error ? 'true' : undefined}
					class="h-10 w-full rounded border border-border bg-surface px-3 pr-14 font-mono text-[16px] text-ink placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
				/>
				<span
					class="absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[12px] text-muted"
				>VND</span>
			</div>
			{#if form?.error}
				<p class="mt-2 text-[12px] text-danger" aria-live="polite">{form.error}</p>
			{:else}
				<p class="mt-2 text-[12px] text-muted">
					Or use the
					<button
						type="button"
						onclick={() => (amount = '10000')}
						class="font-mono text-ink underline decoration-border underline-offset-2 hover:decoration-accent"
					>demo amount: 10,000</button>
				</p>
			{/if}
		</div>

		<button
			type="submit"
			class="h-10 w-full rounded bg-accent text-[14px] font-medium text-white transition hover:bg-accent-hover active:opacity-90"
		>
			Generate QR
		</button>
	</form>
</div>

<p class="mt-6 font-mono text-[12px] leading-[1.6] text-muted">
	// POST /pay → creates order → redirects to /pay?code=…
</p>
