export type StopKind = 'pickup' | 'dropoff'

const STOP_CIRCLE_SIZE_PX = 18
const STOP_CIRCLE_ENLARGED_SCALE = 1.8
const STOP_PIN_CIRCLE_CLASS = 'stop-pin-circle'

function baseCircle(bg: string, border: string, sizePx: number, fontSizePx: number): HTMLDivElement {
  const el = document.createElement('div')
  el.style.width = `${sizePx}px`
  el.style.height = `${sizePx}px`
  el.style.borderRadius = '50%'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontSize = `${fontSizePx}px`
  el.style.fontWeight = '700'
  el.style.color = '#fff'
  el.style.background = bg
  el.style.border = `2px solid ${border}`
  el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)'
  el.style.cursor = 'pointer'
  return el
}

/**
 * Returns a wrapper element (what MapLibre's Marker positions) containing an inner circle sized
 * by CSS transform. Scaling the inner element rather than the wrapper keeps our resize logic from
 * fighting MapLibre's own `transform: translate(...)` positioning, which it applies directly to
 * the element passed to `new Marker({ element })`.
 */
export function createStopMarkerElement(
  sequenceNumber: number,
  kind: StopKind,
  isPreview = false,
  overlapCount = 1,
): HTMLElement {
  const wrapper = document.createElement('div')
  const circle = baseCircle(
    kind === 'pickup' ? '#16a34a' : '#dc2626',
    isPreview ? '#f59e0b' : '#ffffff',
    STOP_CIRCLE_SIZE_PX,
    9,
  )
  circle.className = STOP_PIN_CIRCLE_CLASS
  circle.style.transition = 'transform 150ms ease, box-shadow 150ms ease'
  circle.style.transformOrigin = 'center center'
  circle.textContent = String(sequenceNumber)
  const overlapHint = overlapCount > 1 ? ` · ${overlapCount} stops share this address` : ''
  wrapper.title = `${isPreview ? 'Preview — ' : ''}${kind === 'pickup' ? 'Pickup' : 'Dropoff'} #${sequenceNumber}${overlapHint}`
  if (isPreview) {
    circle.style.opacity = '0.75'
    circle.style.borderStyle = 'dashed'
  }
  wrapper.appendChild(circle)
  return wrapper
}

/** Grows (or shrinks back) a stop marker's inner circle in place — used to make a pin easy to spot
 * on click when several stops share (or nearly share) a coordinate and stack on top of each other. */
export function setStopMarkerEnlarged(markerElement: HTMLElement, enlarged: boolean) {
  const circle = markerElement.querySelector<HTMLElement>(`.${STOP_PIN_CIRCLE_CLASS}`)
  if (!circle) return
  circle.style.transform = enlarged ? `scale(${STOP_CIRCLE_ENLARGED_SCALE})` : 'scale(1)'
  circle.style.zIndex = enlarged ? '30' : ''
  circle.style.boxShadow = enlarged ? '0 2px 8px rgba(0,0,0,0.55)' : '0 1px 3px rgba(0,0,0,0.4)'
}

export function createGarageMarkerElement(): HTMLElement {
  const el = baseCircle('#111827', '#ffffff', 22, 11)
  el.textContent = 'G'
  el.title = 'Garage'
  return el
}

interface StopPopupData {
  sequenceNumber: number
  kind: StopKind
  memberName: string
  arriveTimeLabel: string
  status: string
  isPreview?: boolean
}

export function createStopPopupContent(stop: StopPopupData): HTMLElement {
  const container = document.createElement('div')
  container.style.fontSize = '13px'
  container.style.lineHeight = '1.4'

  const title = document.createElement('div')
  title.style.fontWeight = '600'
  title.textContent = `#${stop.sequenceNumber} ${stop.kind === 'pickup' ? 'Pickup' : 'Dropoff'} — ${stop.memberName}`
  container.appendChild(title)

  const detail = document.createElement('div')
  detail.style.color = '#6b7280'
  detail.textContent = `ETA ${stop.arriveTimeLabel} · ${stop.status}`
  container.appendChild(detail)

  if (stop.isPreview) {
    const badge = document.createElement('div')
    badge.style.color = '#b45309'
    badge.style.fontWeight = '600'
    badge.style.marginTop = '2px'
    badge.textContent = 'Preview — not assigned'
    container.appendChild(badge)
  }

  return container
}
