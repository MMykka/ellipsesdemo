/**
 * Typed localStorage helpers for the small config data we deliberately persist (driver roster,
 * Excel column-mapping profiles). Trip data must never go through this module — it is
 * intentionally in-memory-only and wiped on reload/restart.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage can be unavailable (private browsing, quota) — config persistence is a
    // convenience, not a requirement, so failures here are silently ignored.
  }
}
