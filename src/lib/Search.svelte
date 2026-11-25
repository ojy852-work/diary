<script lang="ts">
  import { entries, tagsOf } from './vault.svelte'
  import * as d from './dates'

  let { onpick }: { onpick: (date: string) => void } = $props()
  let q = $state('')

  const allTags = $derived.by(() => {
    const count = new Map<string, number>()
    for (const e of entries.values()) for (const t of tagsOf(e.text)) count.set(t, (count.get(t) ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1]).slice(0, 30)
  })

  const results = $derived.by(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const words = term.split(/\s+/)
    return [...entries.values()]
      .filter((e) => {
        const hay = `${e.date} ${e.text}`.toLowerCase()
        return words.every((w) => hay.includes(w))
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 300)
  })

  function snippet(text: string): { pre: string; hit: string; post: string } {
    const w = q.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
    const i = text.toLowerCase().indexOf(w)
    if (!w || i < 0) return { pre: text.slice(0, 120), hit: '', post: '' }
    const start = Math.max(0, i - 40)
    return {
      pre: (start > 0 ? '…' : '') + text.slice(start, i),
      hit: text.slice(i, i + w.length),
      post: text.slice(i + w.length, i + w.length + 80),
    }
  }
</script>

<input type="search" placeholder="단어, #태그, 2019-05 같은 날짜로 찾기" bind:value={q} />

{#if !q.trim()}
  {#if allTags.length}
    <h3 class="small muted">태그</h3>
    <div class="tags">
      {#each allTags as [t, n]}<button class="tag" onclick={() => (q = '#' + t)}>#{t} <span class="muted">{n}</span></button>{/each}
    </div>
  {/if}
  <p class="muted small hint">모든 검색은 이 기기 안에서만 이루어져요.</p>
{:else}
  <p class="muted small">{results.length}개 찾음</p>
  {#each results as e (e.date)}
    {@const s = snippet(e.text)}
    <button class="card row" onclick={() => onpick(e.date)}>
      <span class="date">{d.formatLong(e.date)} {e.mood}</span>
      <span class="snip">{s.pre}<mark>{s.hit}</mark>{s.post}</span>
    </button>
  {/each}
{/if}

<style>
  h3 { margin: 1.2rem 0 0.4rem; font-weight: 500; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .tag { border-radius: 3px; padding: 0.2rem 0.7rem; font-size: 0.9rem; color: var(--accent); }
  .hint { margin-top: 2rem; text-align: center; }
  .row { display: grid; gap: 0.2rem; width: 100%; text-align: left; padding: 0.8rem 1rem; margin-bottom: 0.5rem; }
  .date { font-weight: 600; font-size: 0.95rem; }
  .snip { color: var(--muted); font-size: 0.92rem; white-space: pre-wrap; word-break: break-word; }
  mark { background: var(--accent-soft); color: var(--ink); border-radius: 3px; }
</style>
