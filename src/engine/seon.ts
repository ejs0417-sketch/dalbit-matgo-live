import { ALL_IDS, CARDS } from './cards'
import { makeRng, shuffle } from './rng'
import type { Seat } from './types'

export const SEON_POOL_SIZE = 6
export const SEON_PICK_TIMEOUT_MS = 10_000

/** KST (UTC+9) 기준 낮(06:00~17:59)이면 true(작은 월 선), 밤(18:00~05:59)이면 false(큰 월 선) */
export function isDaytimeKst(nowMs = Date.now()): boolean {
  const kstHour = Math.floor((nowMs + 9 * 3_600_000) / 3_600_000) % 24
  const normalized = (kstHour + 24) % 24
  return normalized >= 6 && normalized < 18
}

export function dealSeonPool(seed: number, size = SEON_POOL_SIZE): string[] {
  const rng = makeRng(seed)
  const pool = ALL_IDS.filter((id) => (CARDS[id]?.month ?? 0) > 0)
  return shuffle(pool, rng.next).slice(0, size)
}

export function judgeSeon(cardA: string, cardB: string, isDay: boolean): Seat | 'tie' {
  const ma = CARDS[cardA]?.month ?? 0
  const mb = CARDS[cardB]?.month ?? 0
  if (ma === mb) return 'tie'
  if (isDay) return ma < mb ? 0 : 1
  return ma > mb ? 0 : 1
}
