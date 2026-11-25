<script lang="ts">
  // Handwriting pad: Pointer Events (works with Apple Pencil, S Pen, Windows Ink, mouse).
  // Uses pressure when the device reports it, coalesced events for smooth lines,
  // and optional palm rejection (pen only: fingers are ignored).
  import { onMount, untrack } from 'svelte'
  import Icon from '../Icon.svelte'
  import { INK_WIDTH, INK_MIN_HEIGHT, compactStroke, drawStroke, drawPage, emptyPage, hitStroke, type InkPage, type InkStroke, type InkTool } from './model'

  let {
    page,
    onchange,
    penOnly = true,
    readonly = false,
  }: { page: InkPage | null | undefined; onchange?: (p: InkPage) => void; penOnly?: boolean; readonly?: boolean } = $props()

  const COLORS = ['#1f2328', '#1f3a5f', '#b0413e', '#2e6b4a']
  const WIDTHS = [{ v: 2.5, label: '가늘게' }, { v: 4, label: '보통' }, { v: 7, label: '굵게' }]

  let tool = $state<InkTool | 'eraser'>('pen')
  let color = $state(COLORS[0])
  let width = $state(4)

  let work: InkPage = emptyPage()
  let undoStack: InkStroke[][] = []
  let canUndo = $state(false)
  let heightUnits = $state(INK_MIN_HEIGHT)

  let wrap: HTMLDivElement | undefined = $state()
  let canvas: HTMLCanvasElement | undefined = $state()
  let ctx: CanvasRenderingContext2D | null = null
  let scale = 1
  let dpr = 1

  // reload when a different page comes in (another day)
  $effect(() => {
    const p = page
    untrack(() => {
      work = p ? { ...p, strokes: [...p.strokes] } : emptyPage()
      heightUnits = Math.max(INK_MIN_HEIGHT, work.h)
      undoStack = []
      canUndo = false
      layout()
    })
  })

  onMount(() => {
    const ro = new ResizeObserver(() => layout())
    if (wrap) ro.observe(wrap)
    return () => ro.disconnect()
  })

  function layout() {
    if (!canvas || !wrap) return
    const cssW = wrap.clientWidth
    if (!cssW) return
    dpr = window.devicePixelRatio || 1
    scale = cssW / INK_WIDTH
    const cssH = heightUnits * scale
    canvas.style.height = cssH + 'px'
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx = canvas.getContext('2d')
    redraw()
  }

  function redraw() {
    if (!ctx || !canvas) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
    // ruled lines, like a notebook page
    ctx.strokeStyle = '#e3e7ec'
    ctx.lineWidth = 1 / scale
    for (let y = 60; y < heightUnits; y += 50) {
      ctx.beginPath()
      ctx.moveTo(30, y)
      ctx.lineTo(INK_WIDTH - 30, y)
      ctx.stroke()
    }
    drawPage(ctx, work)
    if (current) drawStroke(ctx, current)
  }

  let current: InkStroke | null = null
  let activeId: number | null = null
  let erasing = false
  let erasedBefore: InkStroke[] | null = null
  let raf = 0
  const schedule = () => (raf ||= requestAnimationFrame(() => ((raf = 0), redraw())))

  function toPage(e: PointerEvent): [number, number, number] {
    const r = canvas!.getBoundingClientRect()
    const p = e.pointerType === 'mouse' || !e.pressure ? 0.5 : e.pressure
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale, p]
  }

  function down(e: PointerEvent) {
    if (readonly || activeId !== null) return
    if (penOnly && e.pointerType === 'touch') return // palm rejection: fingers don't draw
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    canvas!.setPointerCapture(e.pointerId)
    activeId = e.pointerId
    // the eraser end of a stylus, or the barrel button, erases
    erasing = tool === 'eraser' || (e.buttons & 32) !== 0
    if (erasing) {
      erasedBefore = work.strokes
      eraseAt(e)
      return
    }
    const [x, y, p] = toPage(e)
    current = { tool: tool as InkTool, color, width: tool === 'marker' ? width * 4 : width, pts: [x, y, p] }
    schedule()
  }

  function move(e: PointerEvent) {
    if (e.pointerId !== activeId) return
    e.preventDefault()
    if (erasing) return eraseAt(e)
    if (!current) return
    const evs = e.getCoalescedEvents?.() ?? [e]
    for (const ev of evs.length ? evs : [e]) {
      const [x, y, p] = toPage(ev)
      const n = current.pts.length
      const dx = x - current.pts[n - 3]
      const dy = y - current.pts[n - 2]
      if (dx * dx + dy * dy < 0.6) continue // skip near-duplicate points
      current.pts.push(x, y, p)
    }
    schedule()
  }

  function up(e: PointerEvent) {
    if (e.pointerId !== activeId) return
    activeId = null
    if (erasing) {
      erasing = false
      if (erasedBefore && erasedBefore !== work.strokes) commit(erasedBefore)
      erasedBefore = null
      return
    }
    if (!current) return
    const s = compactStroke(current)
    current = null
    const before = work.strokes
    work = { ...work, strokes: [...work.strokes, s] }
    // grow the page when writing near the bottom
    const maxY = Math.max(...s.pts.filter((_, i) => i % 3 === 1))
    if (maxY > heightUnits - 120) heightUnits += 350
    commit(before)
    layout()
  }

  function eraseAt(e: PointerEvent) {
    const [x, y] = toPage(e)
    const kept = work.strokes.filter((s) => !hitStroke(s, x, y, 12))
    if (kept.length !== work.strokes.length) {
      work = { ...work, strokes: kept }
      schedule()
    }
  }

  function commit(before: InkStroke[]) {
    undoStack.push(before)
    if (undoStack.length > 100) undoStack.shift()
    canUndo = true
    work = { ...work, h: heightUnits }
    onchange?.(work)
  }

  function undo() {
    const prev = undoStack.pop()
    if (!prev) return
    canUndo = undoStack.length > 0
    work = { ...work, strokes: prev }
    onchange?.(work)
    redraw()
  }

  function clearAll() {
    if (!work.strokes.length || !confirm('이 날의 손글씨를 모두 지울까요?')) return
    commit(work.strokes)
    work = { ...work, strokes: [] }
    onchange?.(work)
    redraw()
  }

  function addSpace() {
    heightUnits += 350
    work = { ...work, h: heightUnits }
    onchange?.(work)
    layout()
  }
</script>

{#if !readonly}
  <div class="toolbar" role="toolbar" aria-label="손글씨 도구">
    <div class="grp">
      <button class={['tb', tool === 'pen' && 'on']} onclick={() => (tool = 'pen')} aria-pressed={tool === 'pen'}><Icon name="pen" /> 펜</button>
      <button class={['tb', tool === 'marker' && 'on']} onclick={() => (tool = 'marker')} aria-pressed={tool === 'marker'}>형광펜</button>
      <button class={['tb', tool === 'eraser' && 'on']} onclick={() => (tool = 'eraser')} aria-pressed={tool === 'eraser'}><Icon name="eraser" /> 지우개</button>
    </div>
    <div class="grp">
      {#each COLORS as c}
        <button class={['sw', color === c && 'on']} style:--c={c} onclick={() => ((color = c), tool === 'eraser' && (tool = 'pen'))} aria-label="색 {c}" aria-pressed={color === c}></button>
      {/each}
    </div>
    <div class="grp">
      <select bind:value={width} aria-label="굵기">
        {#each WIDTHS as w}<option value={w.v}>{w.label}</option>{/each}
      </select>
      <button class="tb" onclick={undo} disabled={!canUndo} title="되돌리기"><Icon name="undo" /></button>
      <button class="tb" onclick={clearAll} title="모두 지우기"><Icon name="trash" /></button>
    </div>
  </div>
{/if}
<div class="pad" bind:this={wrap}>
  <canvas bind:this={canvas} class:penonly={penOnly} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}
    oncontextmenu={(e) => e.preventDefault()}></canvas>
</div>
{#if !readonly}
  <div class="foot">
    <span class="small muted">{penOnly ? '펜으로만 써져요. 손가락은 무시돼요.' : '펜, 손가락, 마우스로 쓸 수 있어요.'}</span>
    <button class="small ghost" onclick={addSpace}>아래로 공간 늘리기</button>
  </div>
{/if}

<style>
  .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid var(--line-soft); margin-bottom: 0.6rem; }
  .grp { display: flex; gap: 0.3rem; align-items: center; }
  .tb { padding: 0.3rem 0.6rem; font-size: 0.85rem; display: inline-flex; gap: 0.3rem; align-items: center; }
  .tb.on { background: var(--accent); border-color: var(--accent); color: var(--paper); }
  .sw { width: 1.6rem; height: 1.6rem; padding: 0; border-radius: 50%; background: var(--c); border: 2px solid var(--paper); box-shadow: 0 0 0 1px var(--line); }
  .sw.on { box-shadow: 0 0 0 2px var(--accent); }
  select { width: auto; padding: 0.3rem 0.5rem; font-size: 0.85rem; }
  .pad { width: 100%; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; background: #fff; }
  canvas { display: block; width: 100%; touch-action: none; cursor: crosshair; }
  .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 0.3rem; }
</style>
