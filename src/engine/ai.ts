import { CARDS, handMonth, MONTH_NAME } from './cards'
import { applyAction, legalActions, previewStop, type ApplyResult } from './game'
import { missionProgress } from './missions'
import { breakdown } from './score'
import type { Action, GameState, Seat } from './types'

function rank(id: string) {
  const c = CARDS[id]
  if (!c) return 0.2
  if (c.kind === 'gwang') return c.rain ? 4.2 : 6
  if (c.kind === 'yeol') return c.godori ? 4.6 : c.gukjin ? 4 : 3.4
  if (c.kind === 'tti') return c.ttiGroup && c.ttiGroup !== 'plain' ? 3 : 1.8
  if (c.kind === 'bonus') return 3
  if (c.pi >= 3) return 2.2
  if (c.pi === 2) return 1.7
  return 0.35
}

function floorOf(state: GameState, month: number) {
  return state.floor.filter((id) => CARDS[id]?.month === month)
}

function playValue(state: GameState, seat: Seat, cardId: string) {
  const c = CARDS[cardId]
  if (!c) return 0.2
  if (c.kind === 'bonus') return 50
  const matches = floorOf(state, c.month)
  const captured = state.players[seat].captured
  const progress = missionProgress(state.mission, captured, state.players[seat].gukjinAsPi)
  const missionBoost = progress.target > 0 && progress.current + 1 >= progress.target ? 2.2 : 0.4
  if (matches.length >= 3) {
    const ppuk = state.ppuks.find((p) => p.month === c.month)
    return 7 + matches.reduce((s, id) => s + rank(id), 0) + rank(cardId) + (ppuk && ppuk.owner !== seat ? 2.5 : 0) + missionBoost
  }
  if (matches.length === 2) {
    const best = Math.max(...matches.map(rank))
    return 2.4 + best + missionBoost
  }
  if (matches.length === 1) return 1.1 + rank(matches[0]!) - 0.85 + missionBoost * 0.5
  return (rank(cardId) < 1 ? 0.65 : -rank(cardId) * 0.55) + (c.kind === 'pi' ? 0.2 : 0)
}

function cloneWithGukjin(state: GameState, seat: Seat, asPi: boolean) {
  const next = structuredClone(state) as GameState
  next.players[seat].gukjinAsPi = asPi
  return next
}

export function chooseAiAction(state: GameState, seat: Seat): Action {
  const legal = legalActions(state, seat)
  if (!legal.length) throw new Error('AI에게 가능한 수가 없습니다')
  const me = state.players[seat]
  const opp = state.players[(1 - seat) as Seat]
  const myScore = breakdown(me.captured, me.gukjinAsPi).total
  const oppScore = breakdown(opp.captured, opp.gukjinAsPi).total
  const behind = oppScore >= 7 && myScore + 2 < oppScore

  if (state.phase === 'chongtong') return { type: 'chongtong', declare: true }

  if (state.phase === 'goStop') {
    const gukjin = legal.find((a) => a.type === 'gukjin')
    if (gukjin && gukjin.type === 'gukjin' && me.captured.includes('m09-yeol')) {
      const current = previewStop(state, seat)
      const flipped = previewStop(cloneWithGukjin(state, seat, gukjin.asPi), seat)
      const curBase = breakdown(me.captured, me.gukjinAsPi).total
      const nextBase = breakdown(me.captured, gukjin.asPi).total
      const better = flipped > current || (current < 0 && nextBase > curBase)
      if (better) return gukjin
    }
    if (legal.some((a) => a.type === 'pass')) return { type: 'pass' }
    const points = previewStop(state, seat)
    const handQ = me.hand.reduce((s, id) => s + rank(id), 0)
    const goCount = me.goCount
    if (goCount >= 5 || points >= 40) return { type: 'stop' }
    if (oppScore >= myScore && myScore >= 7 && handQ < 6) return { type: 'stop' }
    if (myScore >= 15 && handQ < 8) return { type: 'stop' }
    if (!behind && handQ >= 6 && goCount < 4 && oppScore + 3 < myScore + handQ) return { type: 'go' }
    if (goCount === 0 && handQ >= 4 && oppScore < 7 && myScore < 13) return { type: 'go' }
    if (goCount < 2 && oppScore < 5 && handQ >= 5) return { type: 'go' }
    return { type: 'stop' }
  }

  if (state.phase === 'choose') {
    const options = legal.filter((a) => a.type === 'choose')
    options.sort((a, b) => rank((b as { cardId: string }).cardId) - rank((a as { cardId: string }).cardId))
    return options[0]!
  }

  const gukjin = legal.find((a) => a.type === 'gukjin')
  if (gukjin && gukjin.type === 'gukjin') {
    const cur = breakdown(me.captured, me.gukjinAsPi).total
    const next = breakdown(me.captured, gukjin.asPi).total
    if (next > cur) return gukjin
  }

  if (!behind) {
    const shakes = legal.filter((a) => a.type === 'shake')
    for (const shake of shakes) {
      if (shake.type !== 'shake') continue
      const ids = handMonth(me.hand, shake.month)
      const rich = ids.some((id) => {
        const c = CARDS[id]
        return c?.kind === 'gwang' || c?.kind === 'yeol' || (c?.kind === 'tti' && c.ttiGroup && c.ttiGroup !== 'plain')
      })
      if (rich || myScore >= 5) return shake
    }
  }

  const bombs = legal.filter((a) => a.type === 'bomb')
  let bestBomb: { action: Action; value: number } | null = null
  if (!behind) {
    for (const bomb of bombs) {
      if (bomb.type !== 'bomb') continue
      const floor = floorOf(state, bomb.month)
      const value = 3.2 + floor.reduce((s, id) => s + rank(id), 0) + (myScore >= 4 ? 1.4 : 0)
      if (!bestBomb || value > bestBomb.value) bestBomb = { action: bomb, value }
    }
  }

  const plays = legal.filter((a) => a.type === 'play')
  let bestPlay: { action: Action; value: number } | null = null
  for (const play of plays) {
    if (play.type !== 'play') continue
    const value = play.cardId.startsWith('bomb:') ? (me.hand.filter((id) => !id.startsWith('bomb:')).length < 3 ? 0.7 : 0.05) : playValue(state, seat, play.cardId)
    if (!bestPlay || value > bestPlay.value || (value === bestPlay.value && play.cardId < (bestPlay.action as { cardId: string }).cardId)) {
      bestPlay = { action: play, value }
    }
  }

  if (bestBomb && (!bestPlay || bestBomb.value >= bestPlay.value)) return bestBomb.action
  if (bestPlay) return bestPlay.action
  return legal[0]!
}

export function seatNameHint(month: number) {
  return MONTH_NAME[month] ?? ''
}

export function applyAi(state: GameState, seat: Seat): ApplyResult {
  return applyAction(state, seat, chooseAiAction(state, seat))
}

export function timeoutAction(state: GameState, seat: Seat): Action {
  const legal = legalActions(state, seat)
  if (!legal.length) throw new Error('시간 초과 수가 없습니다')
  if (state.phase === 'chongtong') return { type: 'chongtong', declare: true }
  if (state.phase === 'goStop') {
    const stop = legal.find((action) => action.type === 'stop')
    if (stop) return stop
    const pass = legal.find((action) => action.type === 'pass')
    if (pass) return pass
  }
  const chosen = chooseAiAction(state, seat)
  if (chosen.type === 'shake' || chosen.type === 'gukjin' || chosen.type === 'go') {
    return (
      legal.find((action) => action.type === 'play' || action.type === 'choose' || action.type === 'bomb' || action.type === 'stop' || action.type === 'pass') ??
      chosen
    )
  }
  return chosen
}
