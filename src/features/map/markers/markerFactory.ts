export type StopKind = 'pickup' | 'dropoff'

function baseCircle(bg: string, border: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.width = '26px'
  el.style.height = '26px'
  el.style.borderRadius = '50%'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontSize = '12px'
  el.style.fontWeight = '700'
  el.style.color = '#fff'
  el.style.background = bg
  el.style.border = `2px solid ${border}`
  el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)'
  el.style.cursor = 'pointer'
  return el
}

export function createStopMarkerElement(sequenceNumber: number, kind: StopKind, isPreview = false): HTMLElement {
  const el = baseCircle(kind === 'pickup' ? '#16a34a' : '#dc2626', isPreview ? '#f59e0b' : '#ffffff')
  el.textContent = String(sequenceNumber)
  el.title = `${isPreview ? 'Preview — ' : ''}${kind === 'pickup' ? 'Pickup' : 'Dropoff'} #${sequenceNumber}`
  if (isPreview) {
    el.style.opacity = '0.75'
    el.style.borderStyle = 'dashed'
  }
  return el
}

export function createGarageMarkerElement(): HTMLElement {
  const el = baseCircle('#111827', '#ffffff')
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
