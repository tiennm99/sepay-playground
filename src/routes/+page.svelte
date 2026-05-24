<svelte:head>
	<title>SePay Playground</title>
</svelte:head>

<main class="mx-auto max-w-[560px] px-4 pt-16 pb-16 md:px-6 md:pt-24">
	<p class="mb-4 font-mono text-[12px] text-muted">// vietqr · sepay webhook · demo</p>

	<h1 class="mb-8 text-[30px] leading-[1.2] font-semibold tracking-tight">
		Generate a VietQR, get paid, get a webhook.
	</h1>

	<a
		href="/pay"
		class="inline-flex h-10 items-center justify-center rounded bg-accent px-4 text-[14px] font-medium text-white transition hover:bg-accent-hover"
	>
		Start a payment
		<span aria-hidden="true" class="ml-2 font-mono">→</span>
	</a>

	<p class="mt-10 max-w-[44ch] text-[14px] leading-[1.6] text-muted">
		A minimal playground showing the SePay VietQR flow end-to-end: create an order, render the QR,
		listen for the bank webhook, confirm paid. Built for developers learning the integration.
	</p>
</main>
