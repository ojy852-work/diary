<script lang="ts">
  import { entries } from './vault.svelte'
  import { prefs, setPref, setCustomColor, PAST_YEAR_OPTIONS } from './prefs.svelte'
  import { DEFAULT_CUSTOM_COLORS, type ThemeMode } from './theme'
  import Icon from './Icon.svelte'
  import * as d from './dates'

  const THEME_OPTIONS: { v: ThemeMode; label: string }[] = [
    { v: 'system', label: '시스템 설정' },
    { v: 'light', label: '라이트' },
    { v: 'dark', label: '다크' },
    { v: 'custom', label: '사용자 지정' },
  ]
  const COLOR_FIELDS: { k: keyof typeof DEFAULT_CUSTOM_COLORS; label: string }[] = [
    { k: 'bg', label: '배경' },
    { k: 'paper', label: '카드·작성 칸' },
    { k: 'ink', label: '글자' },
    { k: 'accent', label: '포인트' },
  ]
  function resetColors() {
    for (const { k } of COLOR_FIELDS) setCustomColor(k, DEFAULT_CUSTOM_COLORS[k])
  }

  let { month = $bindable(), onpick }: { month: string; onpick: (date: string) => void } = $props()

  let showOpts = $state(false)

  const y = $derived(Number(month.slice(0, 4)))
  const m = $derived(Number(month.slice(5, 7)))
  const today = $derived(d.todayKey())

  const WEEK = ['일', '월', '화', '수', '목', '금', '토']
  const weekHead = $derived(prefs.weekStart === 1 ? [...WEEK.slice(1), WEEK[0]] : WEEK)

  const cells = $derived.by(() => {
    const first = new Date(y, m - 1, 1)
    const lead = (first.getDay() - prefs.weekStart + 7) % 7
    const days = new Date(y, m, 0).getDate()
    const out: (string | null)[] = []
    for (let i = 0; i < lead; i++) out.push(null)
    for (let i = 1; i <= days; i++) out.push(`${y}-${d.pad(m)}-${d.pad(i)}`)
    while (out.length % 7) out.push(null)
    return out
  })

  // month-day -> years that have an entry, for the "past years" marker in each cell
  const yearsByMd = $derived.by(() => {
    const map = new Map<string, number[]>()
    for (const k of entries.keys()) {
      const md = d.monthDay(k)
      const list = map.get(md)
      if (list) list.push(d.yearOf(k))
      else map.set(md, [d.yearOf(k)])
    }
    return map
  })

  function pastCount(k: string): number {
    if (prefs.pastYears === 0) return 0
    const cy = d.yearOf(k)
    const lo = prefs.pastYears < 0 ? -Infinity : cy - prefs.pastYears
    let n = 0
    for (const md of d.sameDayKeys(k)) for (const yy of yearsByMd.get(md) ?? []) if (yy < cy && yy >= lo) n++
    return n
  }

  const monthCount = $derived([...entries.keys()].filter((k) => k.startsWith(month)).length)

  const yearOptions = $derived.by(() => {
    const cur = new Date().getFullYear()
    let min = Math.min(y, cur - 10)
    for (const k of entries.keys()) min = Math.min(min, d.yearOf(k))
    const max = Math.max(y, cur + 1)
    const out: number[] = []
    for (let i = max; i >= min; i--) out.push(i)
    return out
  })

  function shift(n: number) {
    const dt = new Date(y, m - 1 + n, 1)
    month = `${dt.getFullYear()}-${d.pad(dt.getMonth() + 1)}`
  }
  const setYM = (yy: number, mm: number) => (month = `${yy}-${d.pad(mm)}`)

  function preview(k: string): string {
    const e = entries.get(k)
    if (!e) return ''
    const line = e.text.split('\n').find((l) => l.trim()) ?? ''
    return line.trim() || (e.ink ? '손글씨' : '')
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') shift(-1)
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') shift(1)
  }

  const pastLabel = $derived(PAST_YEAR_OPTIONS.find((o) => o.v === prefs.pastYears)?.label ?? '')
</script>

<svelte:window onkeydown={onKey} />

<section class="head">
  <div class="ym">
    <button class="ghost nav" aria-label="이전 달" onclick={() => shift(-1)}><Icon name="prev" /></button>
    <select class="sel" aria-label="연도" value={y} onchange={(e) => setYM(Number(e.currentTarget.value), m)}>
      {#each yearOptions as yy}<option value={yy}>{yy}년</option>{/each}
    </select>
    <select class="sel" aria-label="월" value={m} onchange={(e) => setYM(y, Number(e.currentTarget.value))}>
      {#each Array.from({ length: 12 }, (_, i) => i + 1) as mm}<option value={mm}>{mm}월</option>{/each}
    </select>
    <button class="ghost nav" aria-label="다음 달" onclick={() => shift(1)}><Icon name="next" /></button>
  </div>
  <div class="actions">
    <button class="small" onclick={() => onpick(today)}>오늘 쓰기</button>
    <button class={['small', 'optbtn', showOpts && 'on']} onclick={() => (showOpts = !showOpts)} aria-expanded={showOpts} title="보기 설정">
      <Icon name="sliders" /> 보기 설정
    </button>
  </div>
</section>

{#if showOpts}
  <section class="card opts">
    <div class="opt">
      <div class="lbl">
        <b>지난 해 기록 보기</b>
        <span class="small muted">날짜를 열었을 때, 그 날짜 기준으로 지난 몇 년의 같은 날 기록을 함께 보여줘요.</span>
      </div>
      <div class="seg" role="radiogroup" aria-label="지난 해 기록 보기">
        {#each PAST_YEAR_OPTIONS as o}
          <button role="radio" aria-checked={prefs.pastYears === o.v} class={['segb', prefs.pastYears === o.v && 'on']} onclick={() => setPref('pastYears', o.v)}>{o.label}</button>
        {/each}
      </div>
    </div>
    <div class="opt">
      <div class="lbl"><b>한 주의 시작</b></div>
      <div class="seg" role="radiogroup" aria-label="한 주의 시작">
        <button role="radio" aria-checked={prefs.weekStart === 0} class={['segb', prefs.weekStart === 0 && 'on']} onclick={() => setPref('weekStart', 0)}>일요일</button>
        <button role="radio" aria-checked={prefs.weekStart === 1} class={['segb', prefs.weekStart === 1 && 'on']} onclick={() => setPref('weekStart', 1)}>월요일</button>
      </div>
    </div>
    <div class="opt">
      <div class="lbl"><b>테마</b></div>
      <div class="seg" role="radiogroup" aria-label="테마">
        {#each THEME_OPTIONS as o}
          <button role="radio" aria-checked={prefs.themeMode === o.v} class={['segb', prefs.themeMode === o.v && 'on']} onclick={() => setPref('themeMode', o.v)}>{o.label}</button>
        {/each}
      </div>
      {#if prefs.themeMode === 'custom'}
        <div class="colors">
          {#each COLOR_FIELDS as f}
            <label class="colorpick">
              <input type="color" value={prefs.customColors[f.k]} oninput={(e) => setCustomColor(f.k, e.currentTarget.value)} />
              <span>{f.label}</span>
            </label>
          {/each}
        </div>
        <button class="small" onclick={resetColors}>기본값으로</button>
      {/if}
    </div>
  </section>
{/if}

<section class="card cal" aria-label="{y}년 {m}월 달력">
  <div class="row week">
    {#each weekHead as w}<div class={['wd', w === '일' && 'sun', w === '토' && 'sat']}>{w}</div>{/each}
  </div>
  <div class="grid">
    {#each cells as k, i (k ?? 'x' + i)}
      {#if k}
        {@const e = entries.get(k)}
        {@const pc = pastCount(k)}
        {@const wd = d.fromKey(k).getDay()}
        <button class={['cell', k === today && 'today', e && 'has', wd === 0 && 'sun', wd === 6 && 'sat']} onclick={() => onpick(k)}
          aria-label="{d.formatLong(k)}{e ? ', 기록 있음' : ''}{pc ? `, 지난 해 기록 ${pc}개` : ''}">
          <span class="num">{Number(k.slice(8))}</span>
          {#if e}<span class="pv">{preview(k)}</span>{/if}
          <span class="marks">
            {#if e}<span class="dot" title="기록 있음"></span>{/if}
            {#if pc}<span class="past" title="지난 해 같은 날 기록">{pc}</span>{/if}
          </span>
        </button>
      {:else}
        <div class="cell empty" aria-hidden="true"></div>
      {/if}
    {/each}
  </div>
</section>

<p class="legend small muted">
  <span><span class="dot"></span> 이 날 기록</span>
  {#if prefs.pastYears !== 0}<span><span class="past">n</span> {pastLabel} 같은 날 기록 수</span>{/if}
  <span class="sp">이번 달 {monthCount}일 기록</span>
</p>

<style>
  .head { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.7rem; }
  .ym { display: flex; align-items: center; gap: 0.2rem; }
  .nav { padding: 0.35rem 0.5rem; font-size: 1.1rem; color: var(--muted); }
  .sel { width: auto; border-color: transparent; background: transparent; font-family: var(--serif); font-size: 1.35rem; font-weight: 700; padding: 0.15rem 0.3rem; cursor: pointer; }
  .sel:hover { border-color: var(--line); }
  .actions { display: flex; gap: 0.4rem; }
  .optbtn { display: inline-flex; align-items: center; gap: 0.35rem; }
  .optbtn.on { background: var(--accent-soft); border-color: var(--accent); }
  .opts { padding: 0.9rem 1rem; margin-bottom: 0.8rem; display: grid; gap: 0.9rem; }
  .opt { display: grid; gap: 0.45rem; }
  .lbl { display: grid; }
  .seg { display: flex; flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; width: fit-content; max-width: 100%; }
  .segb { border: none; border-radius: 0; border-right: 1px solid var(--line); padding: 0.35rem 0.75rem; font-size: 0.88rem; background: var(--paper); }
  .segb:last-child { border-right: none; }
  .segb.on { background: var(--accent); color: var(--paper); font-weight: 600; }
  .colors { display: flex; gap: 1.1rem; flex-wrap: wrap; margin: 0.6rem 0 0.4rem; }
  .colorpick { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--muted); }
  .colorpick input[type='color'] { width: 3rem; height: 2rem; padding: 0.15rem; cursor: pointer; }
  .cal { overflow: hidden; }
  .row.week, .grid { display: grid; grid-template-columns: repeat(7, 1fr); }
  .wd { text-align: center; font-size: 0.8rem; color: var(--muted); padding: 0.45rem 0; border-bottom: 1px solid var(--line); background: var(--line-soft); font-weight: 600; }
  .sun { color: var(--sun); }
  .sat { color: var(--sat); }
  .cell {
    min-height: 92px; border: none; border-radius: 0; background: var(--paper);
    border-right: 1px solid var(--line-soft); border-bottom: 1px solid var(--line-soft);
    display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; padding: 0.35rem 0.4rem; text-align: left; min-width: 0;
  }
  .grid > :nth-child(7n) { border-right: none; }
  .cell:hover { background: var(--accent-soft); }
  .cell.empty { background: color-mix(in srgb, var(--line-soft) 45%, var(--paper)); }
  .num { font-size: 0.9rem; font-weight: 600; line-height: 1.4; min-width: 1.6rem; text-align: center; border-radius: 3px; }
  .cell:not(.sun):not(.sat) .num { color: var(--ink); }
  .today .num { background: var(--accent); color: var(--paper) !important; }
  .pv { font-size: 0.75rem; color: var(--muted); line-height: 1.35; width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; word-break: break-all; }
  .marks { margin-top: auto; display: flex; gap: 0.3rem; align-items: center; }
  .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
  .past { display: inline-block; font-size: 0.68rem; line-height: 1; padding: 0.15rem 0.3rem; border: 1px solid var(--mark); color: var(--mark); border-radius: 3px; font-weight: 600; }
  .legend { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; margin-top: 0.6rem; }
  .legend > span { display: inline-flex; align-items: center; gap: 0.35rem; }
  .legend .sp { margin-left: auto; }
  @media (max-width: 640px) {
    .cell { min-height: 58px; padding: 0.25rem; align-items: center; }
    .pv { display: none; }
    .sel { font-size: 1.15rem; }
  }
</style>
