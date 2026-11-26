import { CARDS, GUKJIN_ID } from './cards'
import type { Mission } from './types'

export const MISSION_POOL: Mission[] = [
  { id: 'hong', kind: 'hongdan', title: '홍단', desc: '송학·매조·벚꽃 홍단을 모으세요' },
  { id: 'cheong', kind: 'cheongdan', title: '청단', desc: '모란·국화·단풍 청단을 모으세요' },
  { id: 'cho', kind: 'chodan', title: '초단', desc: '흑싸리·난초·홍싸리 초단을 모으세요' },
  { id: 'godori', kind: 'godori', title: '고도리', desc: '매조, 흑싸리, 기러기를 모으세요' },
  { id: 'gwang2', kind: 'gwang', count: 2, title: '광 두 장', desc: '광을 두 장 모으세요' },
  { id: 'gwang3', kind: 'gwang', count: 3, title: '광 석 장', desc: '광을 세 장 모으세요' },
  { id: 'yeol3', kind: 'yeol', count: 3, title: '열끗 석 장', desc: '열끗을 세 장 모으세요' },
  { id: 'tti3', kind: 'tti', count: 3, title: '띠 석 장', desc: '띠를 세 장 모으세요' },
  { id: 'ssang2', kind: 'ssang', count: 2, title: '쌍피 사냥', desc: '쌍피(또는 쓰리피)를 두 장 모으세요' },
  { id: 'rain-crane', kind: 'cards', cardIds: ['m12-gwang', 'm01-gwang'], title: '비와 학', desc: '비광과 송학 광을 모으세요' },
  { id: 'birds', kind: 'cards', cardIds: ['m02-yeol', 'm08-yeol'], title: '새 두 마리', desc: '매조와 기러기를 모으세요' },
  { id: 'cup', kind: 'cards', cardIds: [GUKJIN_ID], title: '국진', desc: '국화 열끗 국진을 가져오세요' },
  { id: 'boar-deer', kind: 'cards', cardIds: ['m07-yeol', 'm10-yeol'], title: '멧돼지와 사슴', desc: '홍싸리 멧돼지와 단풍 사슴을 모으세요' },
  { id: 'cherry3', kind: 'month', month: 3, count: 3, title: '벚꽃 세 장', desc: '3월 패를 세 장 모으세요' },
  { id: 'rain2', kind: 'month', month: 12, count: 2, title: '비 오는 달', desc: '12월 패를 두 장 모으세요' },
  { id: 'odong', kind: 'cards', cardIds: ['m11-gwang', 'm11-ssang'], title: '오동 한 쌍', desc: '오동 광과 오동 쌍피를 모으세요' },
  { id: 'moon-geese', kind: 'cards', cardIds: ['m08-gwang', 'm08-yeol'], title: '달과 기러기', desc: '공산 광과 기러기를 모으세요' },
  { id: 'butterfly', kind: 'cards', cardIds: ['m06-yeol', 'm06-tti'], title: '모란 나비', desc: '모란 열끗과 청단을 모으세요' },
]

function yeolIds(captured: string[], gukjinAsPi: boolean) {
  return captured.filter((id) => {
    const c = CARDS[id]
    if (!c || c.kind !== 'yeol') return false
    if (gukjinAsPi && c.gukjin) return false
    return true
  })
}

export function missionProgress(mission: Mission, captured: string[], gukjinAsPi: boolean) {
  switch (mission.kind) {
    case 'hongdan':
      return { current: ['m01-tti', 'm02-tti', 'm03-tti'].filter((id) => captured.includes(id)).length, target: 3 }
    case 'cheongdan':
      return { current: ['m06-tti', 'm09-tti', 'm10-tti'].filter((id) => captured.includes(id)).length, target: 3 }
    case 'chodan':
      return { current: ['m04-tti', 'm05-tti', 'm07-tti'].filter((id) => captured.includes(id)).length, target: 3 }
    case 'godori':
      return { current: ['m02-yeol', 'm04-yeol', 'm08-yeol'].filter((id) => captured.includes(id)).length, target: 3 }
    case 'gwang':
      return { current: captured.filter((id) => CARDS[id]?.kind === 'gwang').length, target: mission.count }
    case 'yeol':
      return { current: yeolIds(captured, gukjinAsPi).length, target: mission.count }
    case 'tti':
      return { current: captured.filter((id) => CARDS[id]?.kind === 'tti').length, target: mission.count }
    case 'ssang':
      return {
        current: captured.filter((id) => (CARDS[id]?.pi ?? 0) >= 2).length,
        target: mission.count,
      }
    case 'cards':
      return { current: mission.cardIds.filter((id) => captured.includes(id)).length, target: mission.cardIds.length }
    case 'month':
      return { current: captured.filter((id) => CARDS[id]?.month === mission.month).length, target: mission.count }
  }
}

export function missionMet(mission: Mission, captured: string[], gukjinAsPi: boolean) {
  const p = missionProgress(mission, captured, gukjinAsPi)
  return p.current >= p.target
}

export function rollMission(rnd: () => number): Mission {
  const i = Math.floor(rnd() * MISSION_POOL.length) % MISSION_POOL.length
  return MISSION_POOL[i]!
}
