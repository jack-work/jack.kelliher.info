import {
  prepareWithSegments,
  layoutNextLine,
  type LayoutCursor,
  type LayoutLine,
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
const BALL_COLOR = '#2a2520'

// ─── Cannonball state ──────────────────────────────────────────────

type Ball = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  active: boolean
}

const ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, r: 28, active: false }
let lastFrameTime: number | null = null

// Card geometry — updated each render
let cardLeft = 0
let cardTop = 0
let cardWidth = 0
let cardHeight = 0

// ─── DOM ───────────────────────────────────────────────────────────

const stage = document.getElementById('stage')!
const card = document.getElementById('card')!
const linePool: HTMLDivElement[] = []
let poolIndex = 0

let ballEl: HTMLDivElement | null = null

function getBallEl(): HTMLDivElement {
  if (ballEl) return ballEl
  ballEl = document.createElement('div')
  ballEl.id = 'cannonball'
  document.body.appendChild(ballEl)
  return ballEl
}

let preparedName: PreparedTextWithSegments
let preparedTitle: PreparedTextWithSegments
let preparedBlurb: PreparedTextWithSegments

let scheduledRaf: number | null = null
let animating = false

function getOrCreateLineEl(): HTMLDivElement {
  if (poolIndex < linePool.length) {
    const el = linePool[poolIndex]!
    el.style.display = ''
    el.style.background = ''
    el.style.width = ''
    el.style.height = ''
    el.style.wordSpacing = ''
    el.style.textAlign = ''
    el.innerHTML = ''
    poolIndex++
    return el
  }
  const el = document.createElement('div')
  el.className = 'line'
  stage.appendChild(el)
  linePool.push(el)
  poolIndex++
  return el
}

function hideUnusedLines(): void {
  for (let i = poolIndex; i < linePool.length; i++) {
    linePool[i]!.style.display = 'none'
  }
}

// ─── Obstacle-aware text layout ────────────────────────────────────

type Interval = { left: number; right: number }

function circleBlockedInterval(
  cx: number, cy: number, r: number,
  bandTop: number, bandBottom: number,
  pad: number,
): Interval | null {
  const top = bandTop - pad
  const bottom = bandBottom + pad
  if (top >= cy + r || bottom <= cy - r) return null
  const minDy = (cy >= top && cy <= bottom) ? 0 : cy < top ? top - cy : cy - bottom
  if (minDy >= r) return null
  const maxDx = Math.sqrt(r * r - minDy * minDy)
  return { left: cx - maxDx - pad, right: cx + maxDx + pad }
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

function countSpaces(text: string): number {
  let n = 0
  for (let i = 0; i < text.length; i++) if (text[i] === ' ') n++
  return n
}

/** Layout text with obstacle avoidance and justification */
function layoutFlowingText(
  prepared: PreparedTextWithSegments,
  font: string,
  color: string,
  lineHeight: number,
  regionLeft: number,
  regionRight: number,
  startY: number,
  justify: boolean,
  ballLocalX: number,
  ballLocalY: number,
  ballR: number,
  ballActive: boolean,
): number {
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = startY

  // Collect all lines first for justification (need to know which is last)
  type PendingLine = { text: string; width: number; x: number; y: number; maxWidth: number; isLast: boolean }
  const pending: PendingLine[] = []

  while (true) {
    const bandTop = y
    const bandBottom = y + lineHeight
    const base: Interval = { left: regionLeft, right: regionRight }
    const blocked: Interval[] = []

    if (ballActive) {
      const interval = circleBlockedInterval(ballLocalX, ballLocalY, ballR, bandTop, bandBottom, 8)
      if (interval !== null) blocked.push(interval)
    }

    const slots = carveSlots(base, blocked)
    if (slots.length === 0) {
      y += lineHeight
      if (y > startY + 800) break // safety
      continue
    }

    let exhausted = false
    for (const slot of slots.sort((a, b) => a.left - b.left)) {
      const slotWidth = slot.right - slot.left
      const line = layoutNextLine(prepared, cursor, slotWidth)
      if (line === null) { exhausted = true; break }
      pending.push({ text: line.text, width: line.width, x: slot.left, y, maxWidth: slotWidth, isLast: false })
      cursor = line.end
    }

    y += lineHeight
    if (exhausted) break
  }

  // Mark last line
  if (pending.length > 0) pending[pending.length - 1]!.isLast = true

  // Render
  for (const p of pending) {
    const el = getOrCreateLineEl()
    el.textContent = p.text
    el.style.left = `${p.x}px`
    el.style.top = `${p.y}px`
    el.style.font = font
    el.style.color = color

    if (justify && !p.isLast) {
      const spaces = countSpaces(p.text)
      if (spaces > 0) {
        const extra = p.maxWidth - p.width
        if (extra > 0 && extra < p.maxWidth * 0.3) {
          el.style.wordSpacing = `${extra / spaces}px`
        }
      }
    }
  }

  return y
}

/** Simple single-line text layout (for name, title, links) */
function layoutSimpleText(
  prepared: PreparedTextWithSegments,
  font: string,
  color: string,
  lineHeight: number,
  maxWidth: number,
  x: number,
  startY: number,
  align: 'left' | 'center' = 'left',
): number {
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = startY
  while (true) {
    const line = layoutNextLine(prepared, cursor, maxWidth)
    if (line === null) break
    const el = getOrCreateLineEl()
    el.textContent = line.text
    const offsetX = align === 'center' ? (maxWidth - line.width) / 2 : 0
    el.style.left = `${x + offsetX}px`
    el.style.top = `${y}px`
    el.style.font = font
    el.style.color = color
    cursor = line.end
    y += lineHeight
  }
  return y
}

// ─── Render ────────────────────────────────────────────────────────

function render(): void {
  poolIndex = 0
  const vw = window.innerWidth
  const vh = window.innerHeight

  const narrow = vw < 560
  const padX = narrow ? 24 : 48
  const padY = narrow ? 32 : 48
  const maxContentWidth = 600
  const contentWidth = Math.min(maxContentWidth, vw - padX * 2 - 32)
  cardWidth = contentWidth + padX * 2
  cardLeft = Math.max(0, (vw - cardWidth) / 2)

  // Ball position relative to the card's stage
  const ballLocalX = ball.x - cardLeft
  const ballLocalY = ball.y - cardTop

  let y = padY

  // Name — centered
  y = layoutSimpleText(preparedName, NAME_FONT, COLOR_TEXT, NAME_LINE_HEIGHT, contentWidth, padX, y, 'center')
  y += 2

  // Title — centered
  y = layoutSimpleText(preparedTitle, TITLE_FONT, COLOR_MUTED, TITLE_LINE_HEIGHT, contentWidth, padX, y, 'center')
  y += 24

  // Divider — centered
  const dividerWidth = 48
  const divider = getOrCreateLineEl()
  divider.textContent = ''
  divider.style.left = `${padX + (contentWidth - dividerWidth) / 2}px`
  divider.style.top = `${y}px`
  divider.style.width = `${dividerWidth}px`
  divider.style.height = '1px'
  divider.style.background = COLOR_DIVIDER
  y += 28

  // Blurb — justified, obstacle-aware
  y = layoutFlowingText(
    preparedBlurb, BODY_FONT, COLOR_TEXT, BODY_LINE_HEIGHT,
    padX, padX + contentWidth, y,
    true,
    ballLocalX, ballLocalY, ball.r,
    ball.active,
  )
  y += 28

  // Links — inline, centered
  const linkEl = getOrCreateLineEl()
  linkEl.style.left = `${padX}px`
  linkEl.style.top = `${y}px`
  linkEl.style.font = LINK_FONT
  linkEl.style.color = COLOR_MUTED
  linkEl.style.textAlign = 'center'
  linkEl.style.width = `${contentWidth}px`

  for (let i = 0; i < LINKS.length; i++) {
    const link = LINKS[i]!
    if (i > 0) {
      const sep = document.createTextNode('  ·  ')
      linkEl.appendChild(sep)
    }
    const a = document.createElement('a')
    a.href = link.href
    a.textContent = link.text
    if (link.href.startsWith('http')) {
      a.target = '_blank'
      a.rel = 'noopener'
    }
    linkEl.appendChild(a)
  }
  y += 28

  y += padY - 12

  // Size & position card
  cardHeight = y
  card.style.width = `${cardWidth}px`
  card.style.height = `${cardHeight}px`
  cardTop = Math.max(16, (vh - cardHeight) / 2)
  card.style.left = `${cardLeft}px`
  card.style.top = `${cardTop}px`

  // Ball element
  if (ball.active) {
    const el = getBallEl()
    el.style.display = ''
    el.style.left = `${ball.x - ball.r}px`
    el.style.top = `${ball.y - ball.r}px`
    el.style.width = `${ball.r * 2}px`
    el.style.height = `${ball.r * 2}px`
  } else if (ballEl) {
    ballEl.style.display = 'none'
  }

  hideUnusedLines()
}

// ─── Cannonball physics ────────────────────────────────────────────

function launchCannonball(): void {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Launch from a random corner
  const corner = Math.floor(Math.random() * 4)
  const speed = 350 + Math.random() * 150

  switch (corner) {
    case 0: // top-left
      ball.x = -ball.r; ball.y = -ball.r
      ball.vx = speed * (0.6 + Math.random() * 0.4)
      ball.vy = speed * (0.6 + Math.random() * 0.4)
      break
    case 1: // top-right
      ball.x = vw + ball.r; ball.y = -ball.r
      ball.vx = -speed * (0.6 + Math.random() * 0.4)
      ball.vy = speed * (0.6 + Math.random() * 0.4)
      break
    case 2: // bottom-left
      ball.x = -ball.r; ball.y = vh + ball.r
      ball.vx = speed * (0.6 + Math.random() * 0.4)
      ball.vy = -speed * (0.6 + Math.random() * 0.4)
      break
    case 3: // bottom-right
      ball.x = vw + ball.r; ball.y = vh + ball.r
      ball.vx = -speed * (0.6 + Math.random() * 0.4)
      ball.vy = -speed * (0.6 + Math.random() * 0.4)
      break
  }

  ball.active = true

  if (!animating) {
    animating = true
    lastFrameTime = null
    requestAnimationFrame(animationLoop)
  }
}

function animationLoop(time: number): void {
  if (!ball.active) {
    animating = false
    lastFrameTime = null
    render()
    return
  }

  const dt = lastFrameTime !== null ? Math.min((time - lastFrameTime) / 1000, 0.05) : 1 / 60
  lastFrameTime = time

  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  // Bounce off viewport edges
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.9 }
  if (ball.x + ball.r > vw) { ball.x = vw - ball.r; ball.vx = -Math.abs(ball.vx) * 0.9 }
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * 0.9 }
  if (ball.y + ball.r > vh) { ball.y = vh - ball.r; ball.vy = -Math.abs(ball.vy) * 0.9 }

  // Friction
  ball.vx *= 0.997
  ball.vy *= 0.997

  // Gravity — gentle pull down
  ball.vy += 40 * dt

  // Stop when slow enough
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
  if (speed < 8) {
    ball.active = false
    animating = false
    lastFrameTime = null
    render()
    return
  }

  render()
  requestAnimationFrame(animationLoop)
}

// ─── Events ────────────────────────────────────────────────────────

function scheduleRender(): void {
  if (scheduledRaf !== null) return
  if (animating) return // animation loop handles renders
  scheduledRaf = requestAnimationFrame(() => {
    scheduledRaf = null
    render()
  })
}

// Launch on click anywhere that isn't a link
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a')) return
  launchCannonball()
})

// Also launch on spacebar
document.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    launchCannonball()
  }
})

async function init(): Promise<void> {
  await document.fonts.ready

  preparedName = prepareWithSegments(NAME, NAME_FONT)
  preparedTitle = prepareWithSegments(TITLE, TITLE_FONT)
  preparedBlurb = prepareWithSegments(BLURB, BODY_FONT)

  window.addEventListener('resize', scheduleRender)
  render()
}

init()
