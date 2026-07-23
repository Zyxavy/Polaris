<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
	<link rel="icon" href="/favicon.ico" sizes="any" />
	<link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
	<link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/site.webmanifest" />
</svelte:head>

{@render children()}


