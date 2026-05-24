<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />

<div class="min-h-screen bg-bg text-ink">
	<header class="border-b border-border">
		<div class="mx-auto flex h-12 max-w-[560px] items-center justify-between px-4 md:px-6">
			<a href="/" class="font-mono text-[14px] font-medium tracking-tight">
				sepay/<span class="text-muted">playground</span>
			</a>
			<span class="font-mono text-[12px] text-muted">v0.1</span>
		</div>
	</header>

	{@render children()}

	<footer class="mx-auto max-w-[560px] px-4 pb-10 md:px-6">
		<p class="font-mono text-[12px] text-muted">
			demo only · no real bank transfers triggered from this UI
		</p>
	</footer>
</div>
