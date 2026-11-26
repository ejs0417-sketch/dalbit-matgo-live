import { describe, expect, it } from 'vitest'
import { CARD_LIST } from '../engine/cards'
import {
  FLOOR_SLOT_COUNT,
  SLOT_FILL_ORDER,
  emptySlots,
  fitFixedSlotWidth,
  floorSlotKey,
  syncFloorSlots,
  uniqueFloorKeys,
} from './floorSlots'

function monthId(month: number) {
  const hit = CARD_LIST.find((c) => c.month === month && c.kind === 'pi')
  if (!hit) throw new Error(`no pi for month ${month}`)
  return hit.id
}

describe('fixed floor slots', () => {
  it('초기 바닥패를 좌우 균형 슬롯에 배치한다', () => {
    const ids = [1, 2, 3, 4].map(monthId)
    const slots = syncFloorSlots(emptySlots(), uniqueFloorKeys(ids), true)
    expect(slots).toHaveLength(FLOOR_SLOT_COUNT)
    expect(slots[SLOT_FILL_ORDER[0]]).toBe(1)
    expect(slots[SLOT_FILL_ORDER[1]]).toBe(2)
    expect(slots[SLOT_FILL_ORDER[2]]).toBe(3)
    expect(slots[SLOT_FILL_ORDER[3]]).toBe(4)
    expect(slots.filter((s) => s === null)).toHaveLength(8)
  })

  it('먹혀 사라진 월은 빈 칸으로 남기고 다른 월 슬롯은 그대로다', () => {
    const start = syncFloorSlots(emptySlots(), uniqueFloorKeys([1, 2, 3, 4].map(monthId)), true)
    const afterEat = syncFloorSlots(start, uniqueFloorKeys([1, 3, 4].map(monthId)), false)
    expect(afterEat[SLOT_FILL_ORDER[0]]).toBe(1)
    expect(afterEat[SLOT_FILL_ORDER[1]]).toBe(null)
    expect(afterEat[SLOT_FILL_ORDER[2]]).toBe(3)
    expect(afterEat[SLOT_FILL_ORDER[3]]).toBe(4)
    // 다른 월의 슬롯 번호가 당겨지지 않는다
    expect(afterEat[SLOT_FILL_ORDER[1]]).not.toBe(3)
  })

  it('새로 깔리는 월만 빈 칸에 들어가고 기존 슬롯은 1칸도 이동하지 않는다', () => {
    const start = syncFloorSlots(emptySlots(), uniqueFloorKeys([1, 2, 3].map(monthId)), true)
    const snapshot = [...start]
    const next = syncFloorSlots(start, uniqueFloorKeys([1, 2, 3, 8].map(monthId)), false)
    expect(next[SLOT_FILL_ORDER[0]]).toBe(snapshot[SLOT_FILL_ORDER[0]])
    expect(next[SLOT_FILL_ORDER[1]]).toBe(snapshot[SLOT_FILL_ORDER[1]])
    expect(next[SLOT_FILL_ORDER[2]]).toBe(snapshot[SLOT_FILL_ORDER[2]])
    expect(next[SLOT_FILL_ORDER[3]]).toBe(8)
  })

  it('같은 월에 패가 추가되거나 뻑으로 3장이 되어도 슬롯 번호는 유지된다', () => {
    const a = monthId(7)
    const b = CARD_LIST.find((c) => c.month === 7 && c.id !== a)!.id
    const start = syncFloorSlots(emptySlots(), uniqueFloorKeys([a]), true)
    const stacked = syncFloorSlots(start, uniqueFloorKeys([a, b]), false)
    expect(stacked.filter((s) => s === 7)).toHaveLength(1)
    expect(stacked.indexOf(7)).toBe(start.indexOf(7))
  })

  it('새 라운드 reset 시 이전 슬롯을 버리고 다시 배치한다', () => {
    const prev = syncFloorSlots(emptySlots(), uniqueFloorKeys([9, 10].map(monthId)), true)
    const next = syncFloorSlots(prev, uniqueFloorKeys([1, 2].map(monthId)), true)
    expect(next).not.toContain(9)
    expect(next).not.toContain(10)
    expect(next[SLOT_FILL_ORDER[0]]).toBe(1)
    expect(next[SLOT_FILL_ORDER[1]]).toBe(2)
  })

  it('보너스패(month 0)는 카드 id 별로 별도 슬롯을 쓴다', () => {
    const bonuses = CARD_LIST.filter((c) => c.month === 0).slice(0, 2).map((c) => c.id)
    expect(bonuses.length).toBe(2)
    expect(floorSlotKey(bonuses[0])).toBe(bonuses[0])
    const slots = syncFloorSlots(emptySlots(), uniqueFloorKeys(bonuses), true)
    expect(slots).toContain(bonuses[0])
    expect(slots).toContain(bonuses[1])
    expect(slots.indexOf(bonuses[0])).not.toBe(slots.indexOf(bonuses[1]))
  })

  it('카드 폭은 바닥 장수와 무관하게 컨테이너 크기로만 계산된다', () => {
    const a = fitFixedSlotWidth(400, 160, 64)
    const b = fitFixedSlotWidth(400, 160, 64)
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(16)
    expect(6 * a + 5 * Math.max(4, Math.round(a * 0.14))).toBeLessThanOrEqual(400)
    expect(2 * a * 1.63 + Math.max(4, Math.round(a * 0.12))).toBeLessThanOrEqual(160)
    // 더 좁은 높이에서는 폭이 줄어 2행이 들어간다
    const tight = fitFixedSlotWidth(400, 80, 64)
    expect(tight).toBeLessThanOrEqual(a)
    expect(2 * tight * 1.63 + Math.max(4, Math.round(tight * 0.12))).toBeLessThanOrEqual(80)
  })
})
