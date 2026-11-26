import { CARDS } from '../engine/cards'

/** 라운드 동안 위치가 고정되는 바닥 슬롯 수 (좌 6 + 우 6, 2행×6열) */
export const FLOOR_SLOT_COUNT = 12

/**
 * 좌측 6칸(0–5)과 우측 6칸(6–11)을 번갈아 채워 처음 깔릴 때부터 좌우 균형을 맞춘다.
 * 한 번 배정된 칸은 그 월이 바닥에서 사라질 때까지 절대 재정렬하지 않는다.
 */
export const SLOT_FILL_ORDER = [0, 6, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11] as const

export type SlotKey = number | string
export type SlotMap = Array<SlotKey | null>

export function emptySlots(): SlotMap {
  return Array.from({ length: FLOOR_SLOT_COUNT }, () => null)
}

/** 같은 월(1–12)은 한 슬롯을 공유하고, 보너스(month 0)는 카드별 슬롯을 쓴다. */
export function floorSlotKey(id: string): SlotKey {
  const month = CARDS[id]?.month ?? 0
  return month > 0 ? month : id
}

export function uniqueFloorKeys(ids: string[]): SlotKey[] {
  const seen = new Set<string>()
  const keys: SlotKey[] = []
  for (const id of ids) {
    const key = floorSlotKey(id)
    const tag = String(key)
    if (seen.has(tag)) continue
    seen.add(tag)
    keys.push(key)
  }
  return keys
}

/**
 * 라운드 슬롯 맵을 갱신한다.
 * - reset: 새 라운드. 초기 바닥패를 빈 칸에 좌우 균형으로 배치.
 * - 이미 배정된 키는 슬롯 번호가 바뀌지 않음.
 * - 사라진 키는 그 칸만 null로 비움 (당김/재정렬 없음).
 * - 새로 나타난 키만 빈 칸에 들어감.
 */
export function syncFloorSlots(prev: SlotMap, keys: SlotKey[], reset: boolean): SlotMap {
  const next: SlotMap = reset ? emptySlots() : prev.slice(0, FLOOR_SLOT_COUNT)
  while (next.length < FLOOR_SLOT_COUNT) next.push(null)

  const present = new Set(keys.map((k) => String(k)))
  for (let i = 0; i < FLOOR_SLOT_COUNT; i++) {
    if (next[i] !== null && !present.has(String(next[i]))) next[i] = null
  }

  const assigned = new Set(next.filter((k) => k !== null).map((k) => String(k)))
  for (const key of keys) {
    if (assigned.has(String(key))) continue
    const preferred = SLOT_FILL_ORDER.find((i) => next[i] === null)
    const slot = preferred !== undefined ? preferred : next.findIndex((s) => s === null)
    if (slot >= 0) {
      next[slot] = key
      assigned.add(String(key))
    }
  }
  return next
}

/** 12칸 고정 그리드가 컨테이너에 안 잘리고 들어가는 최대 카드 폭. 바닥 장수와 무관하게 계산한다. */
export function fitFixedSlotWidth(W: number, H: number, max: number) {
  if (W <= 0 || H <= 0) return Math.max(16, max)
  for (let cw = max; cw >= 16; cw -= 1) {
    const gx = Math.max(4, Math.round(cw * 0.14))
    const gy = Math.max(4, Math.round(cw * 0.12))
    const ch = cw * 1.63
    if (6 * cw + 5 * gx <= W && 2 * ch + gy <= H) return cw
  }
  return 16
}
