<script lang="ts">
  let { text }: { text: string } = $props()
  let open = $state(false)
  let rootEl: HTMLElement

  $effect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!rootEl.contains(e.target as Node)) open = false
    }
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  })
</script>

<span class="infotip" bind:this={rootEl}>
  <button type="button" class="infobtn" aria-expanded={open} aria-label="설명 보기" onclick={() => (open = !open)}>ⓘ</button>
  {#if open}
    <div class="popup" role="note">
      <p>{text}</p>
      <button type="button" class="close" aria-label="닫기" onclick={() => (open = false)}>×</button>
    </div>
  {/if}
</span>

<style>
  .infotip { position: relative; display: inline-flex; vertical-align: middle; }
  .infobtn {
    width: 1.3rem; height: 1.3rem; border-radius: 50%; border: 1px solid var(--line);
    background: var(--paper); color: var(--muted); font-size: 0.78rem; line-height: 1; font-weight: 600;
    display: inline-flex; align-items: center; justify-content: center; padding: 0; cursor: pointer;
  }
  .infobtn:hover, .infobtn[aria-expanded='true'] { color: var(--accent); border-color: var(--accent); }
  .popup {
    position: absolute; top: 140%; left: 0; z-index: 20; width: max(14rem, 60vw); max-width: 22rem;
    background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 0.6rem 1.6rem 0.6rem 0.8rem; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    font-size: 0.85rem; color: var(--ink); font-weight: 400; text-align: left;
  }
  .popup p { margin: 0; line-height: 1.4; }
  .popup .close {
    position: absolute; top: 0.25rem; right: 0.35rem; border: none; background: none; color: var(--muted);
    font-size: 1.05rem; cursor: pointer; line-height: 1; padding: 0.2rem;
  }
  .popup .close:hover { color: var(--ink); }
</style>
