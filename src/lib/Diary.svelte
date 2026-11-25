<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { entries, saveEntry, hooks, tagsOf } from './vault.svelte'
  import { prefs, PAST_YEAR_OPTIONS } from './prefs.svelte'
  import Icon from './Icon.svelte'
  import InkPad from './ink/InkPad.svelte'
  import { hasInk, type InkPage } from './ink/model'
  import * as d from './dates'

  let { date = $bindable(), onback }: { date: string; onback: () => void } = $props()

  const MOODS = ['좋음', '평온', '보통', '우울', '화남', '설렘', '피곤', '특별']

  let text = $state('')
  let mood = $state('')
  let ink = $state.raw<InkPage | null>(null)
  let inkSeed = $state.raw<InkPage | null>(null) // what the pad loads; changes only with the date
  let mode = $state<'text' | 'ink'>('text')
  let status = $state('')
  let loadedFor = ''
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let ta: HTMLTextAreaElement | undefined = $state()

  async function flush() {
    clearTimeout(timer)
    if (!dirty || !loadedFor) return
    dirty = false
    const [k, t, m, i] = [loadedFor, text, mood, ink]
    try {
      await saveEntry(k, t, m, i)
      if (k === loadedFor) status = t.trim() || m || hasInk(i) ? '저장됨' : ''
    } catch {
      dirty = true
      status = '저장 실패'
    }
  }
  hooks.flush = flush
  onDestroy(() => {
    flush()
    if (hooks.flush === flush) hooks.flush = null
  })

  // load the entry when the date changes (saving the previous one first)
  $effect(() => {
    const k = date
    untrack(() => {
      if (dirty) flush()
      const e = entries.get(k)
      text = e?.text ?? ''
      mood = e?.mood ?? ''
      ink = e?.ink ?? null
      inkSeed = ink
      if (!prefs.ink) mode = 'text'
      else if (ink && !text.trim()) mode = 'ink'
      loadedFor = k
      status = ''
      requestAnimationFrame(autosize)
    })
  })

  function changed() {
    dirty = true
    status = '저장 중…'
    clearTimeout(timer)
    timer = setTimeout(flush, 700)
    autosize()
  }

  function autosize() {
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.max(ta.scrollHeight, 220) + 'px'
  }

  function pickMood(m: string) {
    mood = mood === m ? '' : m
    changed()
  }

  function inkChanged(p: InkPage) {
    ink = p
    changed()
  }

  const viewYear = $derived(d.yearOf(date))
  const mds = $derived(d.sameDayKeys(date))

  // same month-day in previous years, limited by the "지난 해 기록 보기" setting; newest first
  const others = $derived.by(() => {
    if (prefs.pastYears === 0) return []
    const lo = prefs.pastYears < 0 ? -Infinity : viewYear - prefs.pastYears
    return [...entries.values()]
      .filter((e) => {
        const ey = d.yearOf(e.date)
        return ey < viewYear && ey >= lo && mds.includes(d.monthDay(e.date))
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  })

  const pastLabel = $derived(PAST_YEAR_OPTIONS.find((o) => o.v === prefs.pastYears)?.label ?? '')
  const isToday = $derived(date === d.todayKey())
  const lunarLabel = $derived(d.lunar(date))
  let expanded = $state<Record<string, boolean>>({})

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
    if (e.key === 'Escape') onback()
  }
</script>

<svelte:window onkeydown={onKey} onvisibilitychange={() => document.hidden && flush()} />

<div class="topline">
  <button class="ghost back" onclick={onback}><Icon name="back" /> 달력</button>
  <span class="small muted">{status}</span>
</div>

<section class="datebar">
  <div class="title">
    <span class="ymd">{d.formatLong(date)}</span>
    <span class="sub">{isToday ? '오늘' : ''}{isToday && lunarLabel ? ' · ' : ''}{lunarLabel}</span>
  </div>
</section>

<article class="card editor">
  <div class="bar">
    <div class="moods" role="group" aria-label="기분">
      <span class="small muted lab">기분</span>
      {#each MOODS as m}
        <button class={['mood', mood === m && 'on']} onclick={() => pickMood(m)} aria-pressed={mood === m}>{m}</button>
      {/each}
      {#if mood && !MOODS.includes(mood)}
        <button class="mood on" onclick={() => pickMood(mood)} aria-pressed="true">{mood}</button>
      {/if}
    </div>
    {#if prefs.ink}
      <div class="modes" role="tablist" aria-label="입력 방식">
        <button role="tab" aria-selected={mode === 'text'} class={['mb', mode === 'text' && 'on']} onclick={() => (mode = 'text')}><Icon name="text" /> 글</button>
        <button role="tab" aria-selected={mode === 'ink'} class={['mb', mode === 'ink' && 'on']} onclick={() => (mode = 'ink')}><Icon name="pen" /> 손글씨{hasInk(ink) ? ' •' : ''}</button>
      </div>
    {/if}
  </div>
  {#if mode === 'ink' && prefs.ink}
    <InkPad page={inkSeed} onchange={inkChanged} penOnly={prefs.penOnly} />
  {:else}
    <textarea bind:this={ta} bind:value={text} oninput={changed} onblur={flush}
      placeholder={isToday ? '오늘 하루를 기록하세요.' : '이 날의 기록을 남기세요. #태그 를 쓸 수 있습니다.'}></textarea>
    {#if hasInk(ink) && !prefs.ink}
      <p class="small muted">이 날에는 손글씨 기록도 있어요. 설정에서 손글씨 입력을 켜면 볼 수 있어요.</p>
    {/if}
  {/if}
</article>

{#if prefs.pastYears !== 0}
  <section class="past">
    <h2>지난 해 같은 날 <span class="muted small">{pastLabel} · {others.length}개</span></h2>
    {#if others.length === 0}
      <p class="muted empty">{pastLabel} 동안 {d.formatShort(date)}의 기록이 없습니다.</p>
    {/if}
    {#each others as e (e.date)}
      {@const long = e.text.length > 220 || e.text.split('\n').length > 6}
      <article class="card past-item">
        <header>
          <div class="jump">
            <b>{d.yearOf(e.date)}년</b>
            <span class="muted small">{d.yearsAgoLabel(viewYear, d.yearOf(e.date))} · {d.weekday(e.date)}요일{d.monthDay(e.date) !== d.monthDay(date) ? ` · ${d.formatShort(e.date)}` : ''}</span>
          </div>
          {#if e.mood}<span class="pmood">{e.mood}</span>{/if}
        </header>
        {#if e.text.trim()}
          <p class={['body', long && !expanded[e.date] && 'clamp']}>{e.text}</p>
          {#if long}
            <button class="ghost small more" onclick={() => (expanded[e.date] = !expanded[e.date])}>{expanded[e.date] ? '접기' : '더 보기'}</button>
          {/if}
        {/if}
        {#if e.ink && prefs.ink}
          <div class="inkview"><InkPad page={e.ink} readonly /></div>
        {:else if e.ink}
          <p class="small muted">손글씨 기록 있음</p>
        {/if}
        {#if tagsOf(e.text).length}
          <div class="tags">{#each tagsOf(e.text) as t}<span>#{t}</span>{/each}</div>
        {/if}
      </article>
    {/each}
    <p class="small muted hint">보여줄 기간은 달력 화면의 <b>보기 설정</b>에서 바꿀 수 있어요.</p>
  </section>
{/if}

<style>
  .topline { display: flex; justify-content: space-between; align-items: center; }
  .back { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.3rem 0.4rem; color: var(--accent); font-weight: 600; }
  .datebar { margin: 0.2rem 0 0.8rem; }
  .title { display: grid; justify-items: center; }
  .ymd { font-family: var(--serif); font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; }
  .sub { font-size: 0.85rem; color: var(--muted); min-height: 1.3em; }
  .editor { padding: 0.9rem 1.1rem 1rem; }
  .bar { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding-bottom: 0.6rem; border-bottom: 1px solid var(--line-soft); margin-bottom: 0.6rem; }
  .moods { display: flex; gap: 0.25rem; flex-wrap: wrap; align-items: center; }
  .lab { margin-right: 0.3rem; }
  .mood { padding: 0.15rem 0.55rem; font-size: 0.82rem; border-radius: 3px; color: var(--muted); }
  .mood.on { background: var(--accent); border-color: var(--accent); color: var(--paper); }
  .modes { display: flex; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  .mb { border: none; border-radius: 0; padding: 0.3rem 0.7rem; font-size: 0.85rem; display: inline-flex; gap: 0.3rem; align-items: center; }
  .mb + .mb { border-left: 1px solid var(--line); }
  .mb.on { background: var(--accent); color: var(--paper); }
  textarea {
    resize: none; min-height: 220px; border: none; padding: 0 0; background: transparent; overflow: hidden;
    line-height: 2rem; background-image: repeating-linear-gradient(transparent 0 calc(2rem - 1px), var(--line-soft) calc(2rem - 1px) 2rem);
    background-attachment: local; border-radius: 0;
  }
  .past h2 { font-family: var(--serif); font-size: 1.05rem; margin: 1.8rem 0 0.7rem; display: flex; gap: 0.6rem; align-items: baseline; padding-bottom: 0.4rem; border-bottom: 1px solid var(--line); }
  .empty { text-align: center; padding: 1.2rem 0; font-size: 0.95rem; }
  .past-item { padding: 0.85rem 1rem; margin-bottom: 0.6rem; border-left: 3px solid var(--mark); }
  .past-item header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .jump { padding: 0; display: flex; gap: 0.5rem; align-items: baseline; text-align: left; }
  .jump b { font-size: 1.02rem; }
  .pmood { font-size: 0.8rem; color: var(--muted); border: 1px solid var(--line); padding: 0 0.4rem; border-radius: 3px; }
  .body { white-space: pre-wrap; word-break: break-word; margin: 0.4rem 0 0; }
  .clamp { display: -webkit-box; -webkit-line-clamp: 5; line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
  .more { padding: 0.2rem 0; color: var(--accent); }
  .inkview { margin-top: 0.5rem; max-width: 420px; }
  .tags { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.4rem; }
  .tags span { font-size: 0.8rem; color: var(--accent); background: var(--accent-soft); padding: 0.05rem 0.45rem; border-radius: 3px; }
  .hint { text-align: center; margin-top: 1rem; }
</style>
