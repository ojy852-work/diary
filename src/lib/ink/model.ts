// Handwriting (pen) data model. Stored inside each entry's encrypted payload, so it is
// encrypted, backed up and restored exactly like the text.
//
// Coordinates are in "page units": the page is always INK_WIDTH wide, whatever the screen,
// so a page written on a tablet looks the same on a phone or PC (just scaled).

export const INK_WIDTH = 1000
export const INK_MIN_HEIGHT = 700

export type InkTool = 'pen' | 'marker'

export interface InkStroke {
  tool: InkTool
  color: string
  /** base width in page units; actual width varies with pressure */
  width: number
  /** flat list: x, y, pressure(0..1), x, y, pressure, ... */
  pts: number[]
}

export interface InkPage {
  v: 1
  w: typeof INK_WIDTH
  h: number
  strokes: InkStroke[]
}

export const emptyPage = (): InkPage => ({ v: 1, w: INK_WIDTH, h: INK_MIN_HEIGHT, strokes: [] })

export const hasInk = (p: InkPage | undefined | null): p is InkPage => !!p && p.strokes.length > 0

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

/** Rounds points so stored pages stay small (about 6 bytes per point after JSON). */
export function compactStroke(s: InkStroke): InkStroke {
  const pts: number[] = []
  for (let i = 0; i < s.pts.length; i += 3) pts.push(r1(s.pts[i]), r1(s.pts[i + 1]), r2(s.pts[i + 2]))
  return { ...s, pts }
}

/** Draws a page onto a 2D context already scaled so 1 unit = 1 page unit. */
export function drawPage(ctx: CanvasRenderingContext2D, page: InkPage) {
  for (const s of page.strokes) drawStroke(ctx, s)
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: InkStroke) {
  const p = s.pts
  if (p.length < 3) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  if (s.tool === 'marker') ctx.globalAlpha = 0.35
  if (p.length === 3) {
    ctx.beginPath()
    ctx.arc(p[0], p[1], widthAt(s, p[2]) / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  // pressure-varying width: draw each segment separately, smoothed through midpoints
  for (let i = 3; i < p.length; i += 3) {
    const x0 = i >= 6 ? (p[i - 6] + p[i - 3]) / 2 : p[i - 3]
    const y0 = i >= 6 ? (p[i - 5] + p[i - 2]) / 2 : p[i - 2]
    const x1 = (p[i - 3] + p[i]) / 2
    const y1 = (p[i - 2] + p[i + 1]) / 2
    ctx.beginPath()
    ctx.lineWidth = widthAt(s, (p[i - 1] + p[i + 2]) / 2)
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(p[i - 3], p[i - 2], x1, y1)
    if (i + 3 >= p.length) ctx.lineTo(p[i], p[i + 1])
    ctx.stroke()
  }
  ctx.restore()
}

function widthAt(s: InkStroke, pressure: number) {
  if (s.tool === 'marker') return s.width
  return s.width * (0.35 + 0.9 * Math.min(1, Math.max(0, pressure)))
}

/** True if point (x, y) is within `r` page units of the stroke (used by the eraser). */
export function hitStroke(s: InkStroke, x: number, y: number, r: number): boolean {
  const p = s.pts
  const rr = (r + s.width / 2) ** 2
  for (let i = 0; i < p.length; i += 3) {
    const dx = p[i] - x
    const dy = p[i + 1] - y
    if (dx * dx + dy * dy <= rr) return true
    if (i >= 3) {
      // distance to segment
      const ax = p[i - 3], ay = p[i - 2]
      const vx = p[i] - ax, vy = p[i + 1] - ay
      const len = vx * vx + vy * vy
      if (len > 0) {
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len))
        const cx = ax + t * vx - x
        const cy = ay + t * vy - y
        if (cx * cx + cy * cy <= rr) return true
      }
    }
  }
  return false
}
