import {
  prepareWithSegments,
  layoutNextLine,
  type LayoutCursor,
  type LayoutLine,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'

const BLURB = `Senior Software Engineer at Microsoft building distributed infrastructure for agentic development platforms and real-time collaborative state systems at global scale. End-to-end engineer spanning backend architecture, cloud deployment, observability, container orchestration, and Linux systems development. At home designing persistent data structures, wiring deployments, or fighting livesite fires with panache.`

const NAME = 'John Kelliher'
const TITLE = 'Senior Software Engineer'

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

function collectLines(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
): LayoutLine[] {
  const lines: LayoutLine[] = []
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  while (true) {
    const line = layoutNextLine(prepared, cursor, maxWidth)
    if (line === null) break
    lines.push(line)
    cursor = line.end
  }
  return lines
}

function countSpaces(text: string): number {
  let n = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') n++
  }
  return n
}

function layoutJustifiedText(
  prepared: PreparedTextWithSegments,
  font: string,
  color: string,
  lineHeight: number,
  maxWidth: number,
  x: number,
  startY: number,
): number {
  const lines = collectLines(prepared, maxWidth)
  let y = startY

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const isLast = i === lines.length - 1
    const el = getOrCreateLineEl()
    el.textContent = line.text
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.font = font
    el.style.color = color

    // Justify all lines except the last
    if (!isLast) {
      const spaces = countSpaces(line.text)
      if (spaces > 0) {
        const extra = maxWidth - line.width
        const perSpace = extra / spaces
        el.style.wordSpacing = `${perSpace}px`
      }
    }

    y += lineHeight
  }

  return y
}

function layoutText(
  prepared: PreparedTextWithSegments,
  font: string,
  color: string,
  lineHeight: number,
  maxWidth: number,
  x: number,
  startY: number,
  align: 'left' | 'center' = 'left',
): number {
  const lines = collectLines(prepared, maxWidth)
  let y = startY

  for (const line of lines) {
    const el = getOrCreateLineEl()
    el.textContent = line.text
    const offsetX = align === 'center' ? (maxWidth - line.width) / 2 : 0
    el.style.left = `${x + offsetX}px`
    el.style.top = `${y}px`
    el.style.font = font
    el.style.color = color
    y += lineHeight
  }

  return y
}

function render(): void {
  poolIndex = 0
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Responsive layout
  const narrow = vw < 560
  const padX = narrow ? 24 : 48
  const padY = narrow ? 32 : 48
  const maxContentWidth = 600
  const contentWidth = Math.min(maxContentWidth, vw - padX * 2 - 32)
  const cardWidth = contentWidth + padX * 2

  let y = padY

  // Name — centered
  y = layoutText(preparedName, NAME_FONT, COLOR_TEXT, NAME_LINE_HEIGHT, contentWidth, padX, y, 'center')
  y += 2

  // Title — centered
  y = layoutText(preparedTitle, TITLE_FONT, COLOR_MUTED, TITLE_LINE_HEIGHT, contentWidth, padX, y, 'center')
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

  // Blurb — justified
  y = layoutJustifiedText(preparedBlurb, BODY_FONT, COLOR_TEXT, BODY_LINE_HEIGHT, contentWidth, padX, y)
  y += 28

  // Links — centered
  const links = [
    { text: 'jackwkelliher@gmail.com', href: 'mailto:jackwkelliher@gmail.com' },
    { text: 'GitHub: jack-work', href: 'https://github.com/jack-work' },
  ]

  for (const link of links) {
    const el = getOrCreateLineEl()
    const a = document.createElement('a')
    a.href = link.href
    a.textContent = link.text
    if (link.href.startsWith('http')) {
      a.target = '_blank'
      a.rel = 'noopener'
    }
    el.appendChild(a)
    el.style.left = `${padX}px`
    el.style.top = `${y}px`
    el.style.font = LINK_FONT
    el.style.color = COLOR_MUTED
    el.style.textAlign = 'center'
    el.style.width = `${contentWidth}px`
    y += 28
  }

  y += padY - 12

  // Size & center the card
  const card = document.getElementById('card')!
  card.style.width = `${cardWidth}px`
  card.style.height = `${y}px`
  card.style.left = `${Math.max(0, (vw - cardWidth) / 2)}px`
  card.style.top = `${Math.max(16, (vh - y) / 2)}px`

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
