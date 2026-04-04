import {
  prepareWithSegments,
  layoutNextLine,
  type LayoutCursor,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'

const BLURB = `Senior Software Engineer at Microsoft building distributed infrastructure for agentic development platforms and real-time collaborative state systems at global scale. End-to-end engineer spanning backend architecture, cloud deployment, observability, container orchestration, and Linux systems development. At home designing persistent data structures, wiring deployments, or fighting livesite fires with panache.`

const NAME = 'John Kelliher'
const TITLE = 'Senior Software Engineer'

const BODY_FONT = '17px "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif'
const NAME_FONT = '600 38px "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif'
const TITLE_FONT = 'italic 18px "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif'
const LINK_FONT = '16px "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif'

const BODY_LINE_HEIGHT = 26
const NAME_LINE_HEIGHT = 44
const TITLE_LINE_HEIGHT = 26

const COLOR_TEXT = '#2a2520'
const COLOR_MUTED = '#6b6258'
const COLOR_BG = '#f5f2ed'
const COLOR_CARD = '#ffffff'
const COLOR_DIVIDER = '#c4bdb4'

type PositionedLine = {
  text: string
  x: number
  y: number
  font: string
  color: string
}

const stage = document.getElementById('stage')!
const linePool: HTMLDivElement[] = []
let poolIndex = 0

let preparedName: PreparedTextWithSegments
let preparedTitle: PreparedTextWithSegments
let preparedBlurb: PreparedTextWithSegments

let scheduledRaf: number | null = null

function getOrCreateLineEl(): HTMLDivElement {
  if (poolIndex < linePool.length) {
    const el = linePool[poolIndex]!
    el.style.display = ''
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

function renderLine(line: PositionedLine): void {
  const el = getOrCreateLineEl()
  el.textContent = line.text
  el.style.left = `${line.x}px`
  el.style.top = `${line.y}px`
  el.style.font = line.font
  el.style.color = line.color
}

function layoutText(
  prepared: PreparedTextWithSegments,
  font: string,
  color: string,
  lineHeight: number,
  maxWidth: number,
  x: number,
  startY: number,
): number {
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = startY

  while (true) {
    const line = layoutNextLine(prepared, cursor, maxWidth)
    if (line === null) break
    renderLine({ text: line.text, x, y, font, color })
    cursor = line.end
    y += lineHeight
  }

  return y
}

function render(): void {
  poolIndex = 0
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Card sizing — responsive
  const cardPadX = vw < 500 ? 28 : 48
  const cardPadY = vw < 500 ? 28 : 40
  const cardMaxWidth = 520
  const cardWidth = Math.min(cardMaxWidth, vw - 32)
  const contentWidth = cardWidth - cardPadX * 2

  // Layout all text
  let y = cardPadY

  // Name
  y = layoutText(preparedName, NAME_FONT, COLOR_TEXT, NAME_LINE_HEIGHT, contentWidth, cardPadX, y)
  y += 4

  // Title
  y = layoutText(preparedTitle, TITLE_FONT, COLOR_MUTED, TITLE_LINE_HEIGHT, contentWidth, cardPadX, y)
  y += 20

  // Divider
  const divider = getOrCreateLineEl()
  divider.textContent = ''
  divider.style.left = `${cardPadX}px`
  divider.style.top = `${y}px`
  divider.style.width = '48px'
  divider.style.height = '1px'
  divider.style.background = COLOR_DIVIDER
  divider.style.font = BODY_FONT
  y += 20

  // Blurb
  y = layoutText(preparedBlurb, BODY_FONT, COLOR_TEXT, BODY_LINE_HEIGHT, contentWidth, cardPadX, y)
  y += 24

  // Links
  const links = [
    { text: 'jackwkelliher@gmail.com', href: 'mailto:jackwkelliher@gmail.com' },
    { text: 'GitHub: jack-work', href: 'https://github.com/jack-work' },
  ]

  for (const link of links) {
    const el = getOrCreateLineEl()
    el.textContent = ''
    const a = document.createElement('a')
    a.href = link.href
    a.textContent = link.text
    a.target = '_blank'
    a.rel = 'noopener'
    a.style.color = COLOR_MUTED
    a.style.textDecoration = 'none'
    el.appendChild(a)
    el.style.left = `${cardPadX}px`
    el.style.top = `${y}px`
    el.style.font = LINK_FONT
    el.style.color = COLOR_MUTED
    y += 24
  }

  y += cardPadY - 24 // last link doesn't need bottom gap

  // Size the card
  const card = document.getElementById('card')!
  card.style.width = `${cardWidth}px`
  card.style.height = `${y}px`

  // Center the card
  const left = Math.max(0, (vw - cardWidth) / 2)
  const top = Math.max(16, (vh - y) / 2)
  card.style.left = `${left}px`
  card.style.top = `${top}px`

  hideUnusedLines()
}

function scheduleRender(): void {
  if (scheduledRaf !== null) return
  scheduledRaf = requestAnimationFrame(() => {
    scheduledRaf = null
    render()
  })
}

async function init(): Promise<void> {
  await document.fonts.ready

  preparedName = prepareWithSegments(NAME, NAME_FONT)
  preparedTitle = prepareWithSegments(TITLE, TITLE_FONT)
  preparedBlurb = prepareWithSegments(BLURB, BODY_FONT)

  window.addEventListener('resize', scheduleRender)
  render()
}

init()
