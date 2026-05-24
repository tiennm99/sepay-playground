<script>
	import { fade } from 'svelte/transition';
	import PayForm from '$lib/components/PayForm.svelte';
	import PayAwaiting from '$lib/components/PayAwaiting.svelte';
	import PayPaid from '$lib/components/PayPaid.svelte';

	let { data, form } = $props();

	const view = $derived(
		!data.order ? 'form' : data.order.status === 'paid' ? 'paid' : 'awaiting'
	);

	let reduceMotion = $state(false);
	$effect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduceMotion = mq.matches;
		const onChange = (e) => (reduceMotion = e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	const fadeOpts = $derived(reduceMotion ? { duration: 0 } : { duration: 150 });
</script>

<svelte:head>
	<title>SePay Playground — /pay</title>
</svelte:head>

<main class="mx-auto max-w-[480px] px-4 pt-12 pb-16 md:px-6">
	{#if view === 'form'}
		<div in:fade={fadeOpts}>
			<PayForm {form} missing={data.missing} />
		</div>
	{:else if view === 'awaiting'}
		<div in:fade={fadeOpts}>
			<PayAwaiting order={data.order} qrUrl={data.qrUrl} />
		</div>
	{:else}
		<div in:fade={fadeOpts}>
			<PayPaid order={data.order} />
		</div>
	{/if}
</main>
