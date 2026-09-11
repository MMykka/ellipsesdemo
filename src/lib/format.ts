export function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function formatMiles(miles: number | undefined): string {
  if (miles === undefined) return '—'
  return `${miles.toFixed(2)} mi`
}
