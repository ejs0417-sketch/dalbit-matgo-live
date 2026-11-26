import { CARDS, CHEONG_IDS, CHO_IDS, GODORI_IDS, GUKJIN_ID, HONG_IDS, isPiLike } from './cards'
import type { ScoreBreakdown, Seat, Settlement, SettlementFactor } from './types'

function hasAll(captured: string[], ids: string[]) {
  return ids.every((id) => captured.includes(id))
}

export function breakdown(captured: string[], gukjinAsPi: boolean): ScoreBreakdown {
  const cards = captured.map((id) => CARDS[id]).filter(Boolean)
  const gwangs = cards.filter((c) => c.kind === 'gwang')
  const hasRain = gwangs.some((c) => c.rain)
  let gwangPoints = 0
  let gwangName: string | undefined
  if (gwangs.length === 5) {
    gwangPoints = 15
    gwangName = '오광'
  } else if (gwangs.length === 4) {
    gwangPoints = 4
    gwangName = '사광'
  } else if (gwangs.length === 3 && hasRain) {
    gwangPoints = 2
    gwangName = '비삼광'
  } else if (gwangs.length === 3) {
    gwangPoints = 3
    gwangName = '삼광'
  }

  const yeols = cards.filter((c) => c.kind === 'yeol' && !(gukjinAsPi && c.gukjin))
  const yeolPoints = yeols.length >= 5 ? yeols.length - 4 : 0
  const godori = hasAll(captured, GODORI_IDS)
  const ttis = cards.filter((c) => c.kind === 'tti')
  const ttiPoints = ttis.length >= 5 ? ttis.length - 4 : 0
  const hong = hasAll(captured, HONG_IDS)
  const cheong = hasAll(captured, CHEONG_IDS)
  const cho = hasAll(captured, CHO_IDS)

  let piCount = 0
  for (const c of cards) {
    if (c.kind === 'pi' || c.kind === 'bonus') piCount += c.pi
  }
  if (gukjinAsPi && captured.includes(GUKJIN_ID)) piCount += 2
  const piPoints = piCount >= 10 ? piCount - 9 : 0

  const details: ScoreBreakdown['details'] = []
  if (gwangPoints) details.push({ label: gwangName!, points: gwangPoints })
  if (yeolPoints) details.push({ label: `열끗 ${yeols.length}장`, points: yeolPoints })
  if (godori) details.push({ label: '고도리', points: 5 })
  if (ttiPoints) details.push({ label: `띠 ${ttis.length}장`, points: ttiPoints })
  if (hong) details.push({ label: '홍단', points: 3 })
  if (cheong) details.push({ label: '청단', points: 3 })
  if (cho) details.push({ label: '초단', points: 3 })
  if (piPoints) details.push({ label: `피 ${piCount}장`, points: piPoints })

  const total =
    gwangPoints +
    yeolPoints +
    (godori ? 5 : 0) +
    ttiPoints +
    (hong ? 3 : 0) +
    (cheong ? 3 : 0) +
    (cho ? 3 : 0) +
    piPoints

  return {
    total,
    gwangPoints,
    gwangName,
    gwangCount: gwangs.length,
    yeolPoints,
    yeolCount: yeols.length,
    godori,
    ttiPoints,
    ttiCount: ttis.length,
    hong,
    cheong,
    cho,
    piPoints,
    piCount,
    details,
  }
}

export function piCountOf(captured: string[], gukjinAsPi: boolean) {
  return breakdown(captured, gukjinAsPi).piCount
}

export type YakuId = 'godori' | 'hong' | 'cheong' | 'cho' | 'sam' | 'bisam' | 'sa' | 'o'

export interface YakuHit {
  id: YakuId
  title: string
  cardIds: string[]
}

export function listYakus(captured: string[], gukjinAsPi: boolean): YakuHit[] {
  const score = breakdown(captured, gukjinAsPi)
  const hits: YakuHit[] = []
  if (score.godori) hits.push({ id: 'godori', title: '고도리', cardIds: GODORI_IDS.filter((id) => captured.includes(id)) })
  if (score.hong) hits.push({ id: 'hong', title: '홍단', cardIds: [...HONG_IDS] })
  if (score.cheong) hits.push({ id: 'cheong', title: '청단', cardIds: [...CHEONG_IDS] })
  if (score.cho) hits.push({ id: 'cho', title: '초단', cardIds: [...CHO_IDS] })
  const gwangs = captured.filter((id) => CARDS[id]?.kind === 'gwang')
  if (score.gwangName === '삼광') hits.push({ id: 'sam', title: '삼광', cardIds: gwangs })
  if (score.gwangName === '비삼광') hits.push({ id: 'bisam', title: '비삼광', cardIds: gwangs })
  if (score.gwangName === '사광') hits.push({ id: 'sa', title: '사광', cardIds: gwangs })
  if (score.gwangName === '오광') hits.push({ id: 'o', title: '오광', cardIds: gwangs })
  return hits
}

export function goIntensity(count: number): 1 | 2 | 3 | 4 | 5 {
  if (count <= 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  if (count === 4) return 4
  return 5
}

export const RECHARGE_AMOUNT = 1_000_000
export const RECHARGE_COOLDOWN_MS = 10_000
export const MONEY_CAP = 20_000_000

export function recharge(money: number) {
  return Math.min(MONEY_CAP, money + RECHARGE_AMOUNT)
}

export function rechargeGuard(money: number, lastAt: number, now: number, inPlay = false) {
  if (inPlay) return { ok: false as const, message: '대국 중에는 충전할 수 없습니다.' }
  if (money >= MONEY_CAP) return { ok: false as const, message: '보유 상한입니다.' }
  const wait = lastAt > 0 ? RECHARGE_COOLDOWN_MS - (now - lastAt) : 0
  if (wait > 0) return { ok: false as const, message: `${Math.ceil(wait / 1000)}초 뒤에 다시 충전할 수 있습니다.` }
  const gained = Math.min(RECHARGE_AMOUNT, MONEY_CAP - money)
  return { ok: true as const, money: money + gained, gained }
}

export function goMultiplier(goCount: number) {
  if (goCount < 3) return 1
  return 2 ** (goCount - 2)
}

export interface SettlementInput {
  captured: [string[], string[]]
  gukjinAsPi: [boolean, boolean]
  goCount: [number, number]
  shakeCount: number
  bombCount: number
  missionDone: boolean
  nagariMul: number
  pointValue: number
  kind: 'stop' | 'chongtong' | 'triplePpuk'
  winner: Seat
}

export function settle(input: SettlementInput): Settlement {
  const winner = input.winner
  const loser = (1 - winner) as Seat
  const winBreak = breakdown(input.captured[winner], input.gukjinAsPi[winner])
  let losePi = piCountOf(input.captured[loser], input.gukjinAsPi[loser])
  const loserHasGukjin = input.captured[loser].includes(GUKJIN_ID)
  if (!input.gukjinAsPi[loser] && loserHasGukjin) {
    const asPi = piCountOf(input.captured[loser], true)
    const backed = (pi: number) => winBreak.piCount >= 10 && pi >= 1 && pi <= 7
    if (backed(losePi) && !backed(asPi)) losePi = asPi
  }
  const loseGwang = input.captured[loser].filter((id) => CARDS[id]?.kind === 'gwang').length

  let base = input.kind === 'chongtong' ? 10 : winBreak.total
  if (input.kind === 'triplePpuk') base = Math.max(base, 7)

  const goCount = input.kind === 'chongtong' ? 0 : input.goCount[winner]
  const goBonus = goCount
  const subtotal = base + goBonus

  const factors: SettlementFactor[] = []
  const push = (id: string, label: string, mul: number) => {
    if (mul > 1) factors.push({ id, label, mul })
  }

  if (input.kind !== 'chongtong') {
    const gMul = goMultiplier(goCount)
    push('go', goCount >= 3 ? `${goCount}고` : '고', gMul)
    const shakeMul = input.shakeCount > 0 ? 2 ** input.shakeCount : 1
    push('shake', input.shakeCount > 1 ? `흔들기 ${input.shakeCount}회` : '흔들기', shakeMul)
    const bombMul = input.bombCount > 0 ? 2 ** input.bombCount : 1
    push('bomb', input.bombCount > 1 ? `폭탄 ${input.bombCount}회` : '폭탄', bombMul)
    push('mission', '미션', input.missionDone ? 2 : 1)
    const piBak = winBreak.piCount >= 10 && losePi >= 1 && losePi <= 7 ? 2 : 1
    push('pi', '피박', piBak)
    const gwangBak = winBreak.gwangPoints > 0 && loseGwang === 0 ? 2 : 1
    push('gwang', '광박', gwangBak)
    const meong = winBreak.yeolCount >= 7 ? 2 : 1
    push('meong', '멍박', meong)
    const gobak = input.goCount[loser] > 0 ? 2 : 1
    push('gobak', '고박', gobak)
    push('triple', '삼연뻑', input.kind === 'triplePpuk' ? 2 : 1)
  }
  push('nagari', input.nagariMul >= 4 ? `나가리 ×${input.nagariMul}` : '나가리', input.nagariMul)

  const totalMul = factors.reduce((acc, f) => acc * f.mul, 1)
  const points = subtotal * totalMul
  return {
    winner,
    loser,
    kind: input.kind,
    base,
    goCount,
    goBonus,
    subtotal,
    factors,
    totalMul,
    points,
    pointValue: input.pointValue,
    money: points * input.pointValue,
    piWinner: winBreak.piCount,
    piLoser: losePi,
    breakdown: winBreak,
  }
}

export function lowestPi(captured: string[]) {
  const pis = captured.filter((id) => isPiLike(id))
  pis.sort((a, b) => (CARDS[a]?.pi ?? 9) - (CARDS[b]?.pi ?? 9) || a.localeCompare(b))
  return pis[0] ?? null
}
