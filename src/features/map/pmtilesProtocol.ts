import { addProtocol } from 'maplibre-gl'
import { Protocol } from 'pmtiles'

let registered = false

/** Registers the pmtiles:// protocol with MapLibre exactly once per app session. */
export function ensurePmtilesProtocolRegistered() {
  if (registered) return
  const protocol = new Protocol()
  addProtocol('pmtiles', protocol.tile)
  registered = true
}
