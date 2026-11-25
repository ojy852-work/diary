<script lang="ts">
  // Simple line icons (no emoji) so the UI stays calm and consistent on every platform.
  let { name }: { name: 'calendar' | 'search' | 'settings' | 'lock' | 'back' | 'prev' | 'next' | 'pen' | 'text' | 'undo' | 'eraser' | 'trash' | 'sliders' | 'eye' | 'eye-off' } = $props()
</script>

<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'calendar'}
    <rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" />
  {:else if name === 'search'}
    <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
  {:else if name === 'settings'}
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  {:else if name === 'lock'}
    <rect x="5" y="11" width="14" height="9.5" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  {:else if name === 'back'}
    <path d="M15 5l-7 7 7 7" />
  {:else if name === 'prev'}
    <path d="M14.5 6l-6 6 6 6" />
  {:else if name === 'next'}
    <path d="M9.5 6l6 6-6 6" />
  {:else if name === 'pen'}
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" />
  {:else if name === 'text'}
    <path d="M5 6h14M5 11h14M5 16h9" />
  {:else if name === 'undo'}
    <path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  {:else if name === 'eraser'}
    <path d="M20 20H9l-5-5a2 2 0 0 1 0-2.8l8.2-8.2a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L13 19" /><path d="M7.5 9.5l7 7" />
  {:else if name === 'trash'}
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
  {:else if name === 'sliders'}
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
  {:else if name === 'eye'}
    <path d="M2 12c2.3-4.3 5.8-6.5 10-6.5s7.7 2.2 10 6.5c-2.3 4.3-5.8 6.5-10 6.5S4.3 16.3 2 12Z" /><circle cx="12" cy="12" r="2.6" />
  {:else if name === 'eye-off'}
    <path d="M3.3 3.3l17.4 17.4" /><path d="M9.9 5.6A10.6 10.6 0 0 1 12 5.5c4.2 0 7.7 2.2 10 6.5a16.6 16.6 0 0 1-3.2 4M6.4 6.9C4.5 8.2 3 10 2 12c2.3 4.3 5.8 6.5 10 6.5 1.3 0 2.5-.2 3.6-.6" /><path d="M14.4 14.4a2.6 2.6 0 0 1-3.7-3.7" />
  {/if}
</svg>
