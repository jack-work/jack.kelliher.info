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
let mouseX = 0
let mouseY = 0

// Card geometry — updated each render
let cardLeft = 0
let cardTop = 0
let cardWidth = 0
let cardHeight = 0

// ─── Audio ─────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

function playCannonSound(): void {
  if (!audioCtx) audioCtx = new AudioContext()
  const ctx = audioCtx

  // Low boom
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(80, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3)
  gain.gain.setValueAtTime(0.4, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.4)

  // Noise burst for the crack
  const bufferSize = ctx.sampleRate * 0.15
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03))
  }
  const noise = ctx.createBufferSource()
  const noiseGain = ctx.createGain()
  noise.buffer = buffer
  noiseGain.gain.setValueAtTime(0.25, ctx.currentTime)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
  noise.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(ctx.currentTime)

  // Mid thump
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(150, ctx.currentTime)
  osc2.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2)
  gain2.gain.setValueAtTime(0.2, ctx.currentTime)
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.start(ctx.currentTime)
  osc2.stop(ctx.currentTime + 0.25)
}

function playBounceSound(): void {
  if (!audioCtx) return
  const ctx = audioCtx
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(120, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.08)
  gain.gain.setValueAtTime(0.1, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.1)
}

// ─── DOM ───────────────────────────────────────────────────────────

const stage = document.getElementById('stage')!
const card = document.getElementById('card')!
const ballEl = document.getElementById('cannonball')! as HTMLDivElement
const launchBtn = document.getElementById('launch-btn')!
const linePool: HTMLDivElement[] = []
let poolIndex = 0

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
  const regionWidth = regionRight - regionLeft
  const regionCenterX = regionLeft + regionWidth / 2

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
      if (y > startY + 800) break
      continue
    }

    let exhausted = false
    // Sort slots by proximity to center so text fills from center outward
    const sorted = [...slots].sort((a, b) => {
      const aMid = (a.left + a.right) / 2
      const bMid = (b.left + b.right) / 2
      return Math.abs(aMid - regionCenterX) - Math.abs(bMid - regionCenterX)
    })

    for (const slot of sorted) {
      const slotWidth = slot.right - slot.left
      const line = layoutNextLine(prepared, cursor, slotWidth)
      if (line === null) { exhausted = true; break }
      pending.push({ text: line.text, width: line.width, x: slot.left, y, maxWidth: slotWidth, isLast: false })
      cursor = line.end
    }

    y += lineHeight
    if (exhausted) break
  }

  if (pending.length > 0) pending[pending.length - 1]!.isLast = true

  for (const p of pending) {
    const el = getOrCreateLineEl()
    el.textContent = p.text
    el.style.top = `${p.y}px`
    el.style.font = font
    el.style.color = color

    if (justify && !p.isLast) {
      const spaces = countSpaces(p.text)
      if (spaces > 0) {
        const extra = p.maxWidth - p.width
        if (extra > 0 && extra < p.maxWidth * 0.3) {
          // Justified: position at slot left, stretch with word-spacing
          el.style.left = `${p.x}px`
          el.style.wordSpacing = `${extra / spaces}px`
        } else {
          // Can't justify reasonably, center in slot
          el.style.left = `${p.x + (p.maxWidth - p.width) / 2}px`
        }
      } else {
        el.style.left = `${p.x + (p.maxWidth - p.width) / 2}px`
      }
    } else {
      // Last line: center in the full region, not just the slot
      el.style.left = `${regionLeft + (regionWidth - p.width) / 2}px`
    }
  }

  return y
}

/** Simple text layout (for name, title) — always centered in content area */
function layoutCenteredText(
  prepared: PreparedTextWithSegments,
  font: string,
  color: string,
  lineHeight: number,
  contentWidth: number,
  contentLeft: number,
  startY: number,
): number {
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = startY
  while (true) {
    const line = layoutNextLine(prepared, cursor, contentWidth)
    if (line === null) break
    const el = getOrCreateLineEl()
    el.textContent = line.text
    // Center: place line in the middle of content area
    el.style.left = `${contentLeft + (contentWidth - line.width) / 2}px`
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
  cardLeft = Math.round((vw - cardWidth) / 2)

  // Ball position relative to the card's stage
  const ballLocalX = ball.x - cardLeft
  const ballLocalY = ball.y - cardTop

  let y = padY

  // Name — centered
  y = layoutCenteredText(preparedName, NAME_FONT, COLOR_TEXT, NAME_LINE_HEIGHT, contentWidth, padX, y)
  y += 2

  // Title — centered
  y = layoutCenteredText(preparedTitle, TITLE_FONT, COLOR_MUTED, TITLE_LINE_HEIGHT, contentWidth, padX, y)
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
  cardTop = Math.round(Math.max(16, (vh - cardHeight) / 2))
  card.style.left = `${cardLeft}px`
  card.style.top = `${cardTop}px`

  // Ball element
  if (ball.active) {
    ballEl.style.display = 'block'
    ballEl.style.left = `${ball.x - ball.r}px`
    ballEl.style.top = `${ball.y - ball.r}px`
    ballEl.style.width = `${ball.r * 2}px`
    ballEl.style.height = `${ball.r * 2}px`
  } else {
    ballEl.style.display = 'none'
  }

  hideUnusedLines()
}

// ─── Cannonball physics ────────────────────────────────────────────

function launchCannonball(): void {
  // Pick nearest corner to the button (bottom-right)
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Launch from bottom-right toward the mouse position
  ball.x = vw + ball.r
  ball.y = vh + ball.r

  // Aim at mouse (or card center if mouse hasn't moved)
  const targetX = mouseX || vw / 2
  const targetY = mouseY || vh / 2
  const dx = targetX - ball.x
  const dy = targetY - ball.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const speed = 700 + Math.random() * 200

  ball.vx = (dx / dist) * speed
  ball.vy = (dy / dist) * speed
  ball.active = true

  playCannonSound()

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

  const vw = window.innerWidth
  const vh = window.innerHeight

  // Bounce off viewport edges
  let bounced = false
  if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.85; bounced = true }
  if (ball.x + ball.r > vw) { ball.x = vw - ball.r; ball.vx = -Math.abs(ball.vx) * 0.85; bounced = true }
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * 0.85; bounced = true }
  if (ball.y + ball.r > vh) { ball.y = vh - ball.r; ball.vy = -Math.abs(ball.vy) * 0.85; bounced = true }

  if (bounced) playBounceSound()

  // Friction
  ball.vx *= 0.995
  ball.vy *= 0.995

  // Gravity — gentle pull down
  ball.vy += 60 * dt

  // Stop when slow enough
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
  if (speed < 10) {
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
  if (animating) return
  scheduledRaf = requestAnimationFrame(() => {
    scheduledRaf = null
    render()
  })
}

// Track mouse position for aiming
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX
  mouseY = e.clientY
})

// Launch button
launchBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  launchCannonball()
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
