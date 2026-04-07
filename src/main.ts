import {
  prepareWithSegments,
  layoutNextLine,
  type LayoutCursor,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'

// ─── Content ───────────────────────────────────────────────────────

const BLURB = `Senior Software Engineer at Microsoft building distributed infrastructure for agentic development platforms and real-time collaborative state systems at global scale. End-to-end engineer spanning backend architecture, cloud deployment, observability, container orchestration, and Linux systems development. At home designing persistent data structures, wiring deployments, or fighting livesite fires with panache.`

const NAME = 'John Kelliher'
const TITLE = 'Senior Software Engineer'

const LINKS = [
  { text: 'jackwkelliher@gmail.com', href: 'mailto:jackwkelliher@gmail.com' },
  { text: 'LinkedIn', href: 'https://www.linkedin.com/in/john-william-kelliher/' },
  { text: 'GitHub', href: 'https://github.com/jack-work' },
]

// ─── Typography ────────────────────────────────────────────────────

const BODY_FONT = '19px "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif'
const NAME_FONT = '600 42px "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif'
const TITLE_FONT = 'italic 20px "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif'
const LINK_FONT = '17px "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif'

const BODY_LINE_HEIGHT = 30
const NAME_LINE_HEIGHT = 48
const TITLE_LINE_HEIGHT = 28

const COLOR_TEXT = '#1a1714'
const COLOR_MUTED = '#6b6258'
const COLOR_DIVIDER = '#c4bdb4'

// ─── State ─────────────────────────────────────────────────────────

let flipped = false

type Ball = { x: number; y: number; vx: number; vy: number; r: number; active: boolean }
const ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, r: 28, active: false }
let lastFrameTime: number | null = null
let mouseX = 0, mouseY = 0
let cardLeft = 0, cardTop = 0, cardWidth = 0

// ─── Audio ─────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

function playCannonSound(): void {
  if (!audioCtx) audioCtx = new AudioContext()
  const ctx = audioCtx
  const t = ctx.currentTime

  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(80, t)
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.3)
  g.gain.setValueAtTime(0.4, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
  osc.connect(g).connect(ctx.destination)
  osc.start(t); osc.stop(t + 0.4)

  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03))
  const ns = ctx.createBufferSource()
  const ng = ctx.createGain()
  ns.buffer = buf
  ng.gain.setValueAtTime(0.25, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
  ns.connect(ng).connect(ctx.destination)
  ns.start(t)

  const o2 = ctx.createOscillator()
  const g2 = ctx.createGain()
  o2.type = 'triangle'
  o2.frequency.setValueAtTime(150, t)
  o2.frequency.exponentialRampToValueAtTime(40, t + 0.2)
  g2.gain.setValueAtTime(0.2, t)
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  o2.connect(g2).connect(ctx.destination)
  o2.start(t); o2.stop(t + 0.25)
}

function playBounceSound(): void {
  if (!audioCtx) return
  const ctx = audioCtx; const t = ctx.currentTime
  const o = ctx.createOscillator(); const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(120, t)
  o.frequency.exponentialRampToValueAtTime(50, t + 0.08)
  g.gain.setValueAtTime(0.1, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
  o.connect(g).connect(ctx.destination)
  o.start(t); o.stop(t + 0.1)
}

// ─── DOM ───────────────────────────────────────────────────────────

const scene = document.getElementById('scene')!
const cardEl = document.getElementById('card')!
const stageFront = document.getElementById('stage-front')!
const stageBack = document.getElementById('stage-back')!
const ballEl = document.getElementById('cannonball')! as HTMLDivElement
const launchBtn = document.getElementById('launch-btn')!

let preparedName: PreparedTextWithSegments
let preparedTitle: PreparedTextWithSegments
let preparedBlurb: PreparedTextWithSegments

let scheduledRaf: number | null = null
let animating = false

// ─── Line pool per face ────────────────────────────────────────────

type Pool = { els: HTMLDivElement[]; idx: number; stage: HTMLElement }

function mkPool(stage: HTMLElement): Pool { return { els: [], idx: 0, stage } }

function getLine(p: Pool): HTMLDivElement {
  if (p.idx < p.els.length) {
    const el = p.els[p.idx]!
    el.style.cssText = '' // full reset
    el.className = 'line'
    el.style.display = ''
    el.innerHTML = ''
    p.idx++
    return el
  }
  const el = document.createElement('div')
  el.className = 'line'
  p.stage.appendChild(el)
  p.els.push(el)
  p.idx++
  return el
}

function hideRest(p: Pool): void {
  for (let i = p.idx; i < p.els.length; i++) p.els[i]!.style.display = 'none'
}

const poolFront = mkPool(stageFront)
const poolBack = mkPool(stageBack)

// ─── Obstacle math ─────────────────────────────────────────────────

type Interval = { left: number; right: number }

function circleBlocked(cx: number, cy: number, r: number, bTop: number, bBot: number, pad: number): Interval | null {
  const top = bTop - pad, bottom = bBot + pad
  if (top >= cy + r || bottom <= cy - r) return null
  const minDy = (cy >= top && cy <= bottom) ? 0 : cy < top ? top - cy : cy - bottom
  if (minDy >= r) return null
  const dx = Math.sqrt(r * r - minDy * minDy)
  return { left: cx - dx - pad, right: cx + dx + pad }
}

function carveSlots(base: Interval, blocked: Interval[]): Interval[] {
  let slots = [base]
  for (const b of blocked) {
    const next: Interval[] = []
    for (const s of slots) {
      if (b.right <= s.left || b.left >= s.right) { next.push(s); continue }
      if (b.left > s.left) next.push({ left: s.left, right: b.left })
      if (b.right < s.right) next.push({ left: b.right, right: s.right })
    }
    slots = next
  }
  return slots.filter(s => s.right - s.left >= 30)
}

// ─── Layout helpers ────────────────────────────────────────────────

/** Centered text — uses CSS text-align:center for pixel-perfect centering */
function layoutCentered(
  p: Pool, prepared: PreparedTextWithSegments,
  font: string, color: string, lineHeight: number,
  padX: number, contentWidth: number, startY: number,
): number {
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = startY
  while (true) {
    const line = layoutNextLine(prepared, cursor, contentWidth)
    if (line === null) break
    const el = getLine(p)
    el.textContent = line.text
    el.style.position = 'absolute'
    el.style.left = `${padX}px`
    el.style.top = `${y}px`
    el.style.width = `${contentWidth}px`
    el.style.textAlign = 'center'
    el.style.font = font
    el.style.color = color
    cursor = line.end
    y += lineHeight
  }
  return y
}

/** Justified text with obstacle avoidance */
function layoutJustified(
  p: Pool, prepared: PreparedTextWithSegments,
  font: string, color: string, lineHeight: number,
  padX: number, contentWidth: number, startY: number,
  blX: number, blY: number, blR: number, blActive: boolean,
): number {
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = startY
  const rL = padX, rR = padX + contentWidth

  type PL = { text: string; width: number; x: number; y: number; mw: number }
  const pending: PL[] = []

  while (true) {
    const base: Interval = { left: rL, right: rR }
    const blocked: Interval[] = []
    if (blActive) {
      const iv = circleBlocked(blX, blY, blR, y, y + lineHeight, 8)
      if (iv) blocked.push(iv)
    }
    const slots = carveSlots(base, blocked)
    if (slots.length === 0) { y += lineHeight; if (y > startY + 800) break; continue }

    let done = false
    for (const slot of slots.sort((a, b) => a.left - b.left)) {
      const sw = slot.right - slot.left
      const line = layoutNextLine(prepared, cursor, sw)
      if (!line) { done = true; break }
      pending.push({ text: line.text, width: line.width, x: slot.left, y, mw: sw })
      cursor = line.end
    }
    y += lineHeight
    if (done) break
  }

  for (let i = 0; i < pending.length; i++) {
    const ln = pending[i]!
    const isLast = i === pending.length - 1
    const el = getLine(p)
    el.textContent = ln.text
    el.style.position = 'absolute'
    el.style.top = `${ln.y}px`
    el.style.font = font
    el.style.color = color
    el.style.left = `${ln.x}px`
    el.style.width = `${ln.mw}px`

    if (!isLast) {
      // Browser-native justification — stretches text to fill slot width
      el.style.textAlign = 'justify'
      el.style.textAlignLast = 'justify'
    } else {
      // Last line: center in full content width
      el.style.left = `${padX}px`
      el.style.width = `${contentWidth}px`
      el.style.textAlign = 'center'
    }
  }
  return y
}

function renderDivider(p: Pool, padX: number, contentWidth: number, y: number): number {
  const el = getLine(p)
  el.style.position = 'absolute'
  el.style.left = `${padX + (contentWidth - 48) / 2}px`
  el.style.top = `${y}px`
  el.style.width = '48px'
  el.style.height = '1px'
  el.style.background = COLOR_DIVIDER
  return y + 28
}

function renderLinks(p: Pool, padX: number, contentWidth: number, y: number): number {
  const el = getLine(p)
  el.style.position = 'absolute'
  el.style.left = `${padX}px`
  el.style.top = `${y}px`
  el.style.width = `${contentWidth}px`
  el.style.textAlign = 'center'
  el.style.font = LINK_FONT
  el.style.color = COLOR_MUTED
  for (let i = 0; i < LINKS.length; i++) {
    if (i > 0) el.appendChild(document.createTextNode('  ·  '))
    const a = document.createElement('a')
    a.href = LINKS[i]!.href
    a.textContent = LINKS[i]!.text
    if (LINKS[i]!.href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener' }
    el.appendChild(a)
  }
  return y + 28
}

// ─── Main render ───────────────────────────────────────────────────

function render(): void {
  poolFront.idx = 0
  poolBack.idx = 0

  const vw = window.innerWidth
  const vh = window.innerHeight
  const narrow = vw < 560
  const padX = narrow ? 24 : 48
  const padY = narrow ? 32 : 48
  const contentWidth = Math.min(600, vw - padX * 2 - 32)
  cardWidth = contentWidth + padX * 2
  cardLeft = Math.round((vw - cardWidth) / 2)

  // ── Front face ──
  let fy = padY
  fy = layoutCentered(poolFront, preparedName, NAME_FONT, COLOR_TEXT, NAME_LINE_HEIGHT, padX, contentWidth, fy)
  fy += 2
  fy = layoutCentered(poolFront, preparedTitle, TITLE_FONT, COLOR_MUTED, TITLE_LINE_HEIGHT, padX, contentWidth, fy)
  fy += 24
  fy = renderDivider(poolFront, padX, contentWidth, fy)
  fy = renderLinks(poolFront, padX, contentWidth, fy)
  fy += padY - 12
  hideRest(poolFront)

  // ── Back face ──
  const blX = ball.x - cardLeft
  const blY = ball.y - cardTop
  let by = padY
  by = layoutCentered(poolBack, preparedName, NAME_FONT, COLOR_TEXT, NAME_LINE_HEIGHT, padX, contentWidth, by)
  by += 2
  by = layoutCentered(poolBack, preparedTitle, TITLE_FONT, COLOR_MUTED, TITLE_LINE_HEIGHT, padX, contentWidth, by)
  by += 24
  by = renderDivider(poolBack, padX, contentWidth, by)
  by = layoutJustified(poolBack, preparedBlurb, BODY_FONT, COLOR_TEXT, BODY_LINE_HEIGHT, padX, contentWidth, by, blX, blY, ball.r, ball.active)
  by += 28
  by = renderLinks(poolBack, padX, contentWidth, by)
  by += padY - 12
  hideRest(poolBack)

  // ── Position scene ──
  const h = flipped ? by : fy
  cardTop = Math.round(Math.max(16, (vh - h) / 2))

  scene.style.left = `${cardLeft}px`
  scene.style.top = `${cardTop}px`
  scene.style.width = `${cardWidth}px`
  scene.style.height = `${h}px`

  const front = document.getElementById('front')!
  const back = document.getElementById('back')!
  front.style.width = `${cardWidth}px`
  front.style.height = `${fy}px`
  back.style.width = `${cardWidth}px`
  back.style.height = `${by}px`

  // Ball
  if (ball.active) {
    ballEl.style.display = 'block'
    ballEl.style.left = `${ball.x - ball.r}px`
    ballEl.style.top = `${ball.y - ball.r}px`
    ballEl.style.width = `${ball.r * 2}px`
    ballEl.style.height = `${ball.r * 2}px`
  } else {
    ballEl.style.display = 'none'
  }
}

// ─── Cannonball ────────────────────────────────────────────────────

function launch(): void {
  const vw = window.innerWidth, vh = window.innerHeight
  ball.x = vw + ball.r; ball.y = vh + ball.r
  const tx = mouseX || vw / 2, ty = mouseY || vh / 2
  const dx = tx - ball.x, dy = ty - ball.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const speed = 700 + Math.random() * 200
  ball.vx = (dx / dist) * speed; ball.vy = (dy / dist) * speed
  ball.active = true
  playCannonSound()
  if (!animating) { animating = true; lastFrameTime = null; requestAnimationFrame(tick) }
}

function tick(time: number): void {
  if (!ball.active) { animating = false; lastFrameTime = null; render(); return }
  const dt = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 1 / 60
  lastFrameTime = time
  ball.x += ball.vx * dt; ball.y += ball.vy * dt
  const vw = window.innerWidth, vh = window.innerHeight
  let bounced = false
  if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.85; bounced = true }
  if (ball.x + ball.r > vw) { ball.x = vw - ball.r; ball.vx = -Math.abs(ball.vx) * 0.85; bounced = true }
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * 0.85; bounced = true }
  if (ball.y + ball.r > vh) { ball.y = vh - ball.r; ball.vy = -Math.abs(ball.vy) * 0.85; bounced = true }
  if (bounced) playBounceSound()
  ball.vx *= 0.995; ball.vy *= 0.995; ball.vy += 60 * dt
  if (Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) < 10) {
    ball.active = false; animating = false; lastFrameTime = null; render(); return
  }
  render(); requestAnimationFrame(tick)
}

// ─── Events ────────────────────────────────────────────────────────

function scheduleRender(): void {
  if (scheduledRaf !== null || animating) return
  scheduledRaf = requestAnimationFrame(() => { scheduledRaf = null; render() })
}

document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY })

cardEl.addEventListener('click', e => {
  if ((e.target as HTMLElement).closest('a')) return
  flipped = !flipped
  cardEl.classList.toggle('flipped', flipped)
  scheduleRender()
  setTimeout(scheduleRender, 350)
  setTimeout(scheduleRender, 700)
})

launchBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); launch() })

// ─── Init ──────────────────────────────────────────────────────────

async function init(): Promise<void> {
  await document.fonts.ready
  preparedName = prepareWithSegments(NAME, NAME_FONT)
  preparedTitle = prepareWithSegments(TITLE, TITLE_FONT)
  preparedBlurb = prepareWithSegments(BLURB, BODY_FONT)
  window.addEventListener('resize', scheduleRender)
  render()
}

init()
