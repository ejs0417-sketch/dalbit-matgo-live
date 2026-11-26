import { ALL_IDS, CARDS, GUKJIN_ID, handMonth, isPiLike } from './cards'
import { missionMet, rollMission } from './missions'
import { makeRng, shuffle } from './rng'
import { breakdown, listYakus, lowestPi, settle, type SettlementInput } from './score'
import type {
  Action,
  EndKind,
  GameEvent,
  GameState,
  Mission,
  PlayerState,
  Seat,
} from './types'

export interface CreateOptions {
  seon?: Seat
  nagariMul?: number
  pointValue?: number
  seed?: number
  deck?: string[]
  mission?: Mission
}

function emptyPlayer(): PlayerState {
  return {
    hand: [],
    captured: [],
    shaken: [],
    bombs: 0,
    goCount: 0,
    decidedScore: 0,
    gukjinAsPi: false,
    piDebt: 0,
    revealed: [],
    yakuSeen: [],
  }
}

export function sandbox(seed = 1): GameState {
  return {
    players: [emptyPlayer(), emptyPlayer()],
    turn: 0,
    seon: 0,
    floor: [],
    deck: [],
    ppuks: [],
    phase: 'turn',
    chongtongQueue: [],
    consecutivePpuk: 0,
    ppukStreak: [0, 0],
    turnsPlayed: [0, 0],
    nagariMul: 1,
    pointValue: 1000,
    mission: rollMission(makeRng(seed).next),
    missionDone: [false, false],
    rngState: seed,
    bombSeq: 1,
  }
}

function fourMonth(ids: string[]): number | null {
  const counts = new Map<number, number>()
  for (const id of ids) {
    const month = CARDS[id]?.month ?? 0
    if (!month) continue
    counts.set(month, (counts.get(month) ?? 0) + 1)
  }
  for (const [month, n] of counts) if (n >= 4) return month
  return null
}

function dealOnce(opts: CreateOptions, deck: string[], rngState: number): { state: GameState; events: GameEvent[] } {
  const seon: Seat = opts.seon ?? 0
  const events: GameEvent[] = [{ type: 'deal' }]
  const pile = [...deck]
  const p0 = pile.splice(0, 10)
  const p1 = pile.splice(0, 10)
  const floor = pile.splice(0, 8)
  const state = sandbox(rngState)
  state.seon = seon
  state.turn = seon
  state.nagariMul = opts.nagariMul ?? 1
  state.pointValue = opts.pointValue ?? 1000
  state.players[0].hand = p0
  state.players[1].hand = p1
  state.floor = floor
  state.deck = pile
  state.rngState = rngState
  if (opts.mission) state.mission = opts.mission

  const taken: string[] = []
  state.floor = state.floor.filter((id) => {
    if (CARDS[id]?.kind === 'bonus') {
      taken.push(id)
      return false
    }
    return true
  })
  let guard = 0
  while (state.floor.length < 8 && state.deck.length && guard++ < 40) {
    const c = state.deck.shift()!
    if (CARDS[c]?.kind === 'bonus') taken.push(c)
    else state.floor.push(c)
  }
  if (taken.length) {
    state.players[seon].captured.push(...taken)
    events.push({ type: 'floorBonus', player: seon, cardIds: taken })
    noteYakus(state, seon, events)
  }

  const queue: Seat[] = []
  if (fourMonth(state.players[seon].hand)) queue.push(seon)
  const other = (1 - seon) as Seat
  if (fourMonth(state.players[other].hand)) queue.push(other)
  state.chongtongQueue = queue
  if (queue.length) {
    state.phase = 'chongtong'
    state.turn = queue[0]!
  } else {
    state.phase = 'turn'
    state.turn = seon
  }
  refreshMission(state, 0, events)
  refreshMission(state, 1, events)
  return { state, events }
}

export function createGame(opts: CreateOptions = {}): { state: GameState; events: GameEvent[] } {
  if (opts.deck) return dealOnce(opts, opts.deck, opts.seed ?? 1)
  const seed = (opts.seed ?? 1) >>> 0 || 1
  let last: { state: GameState; events: GameEvent[] } | null = null
  for (let i = 0; i < 16; i++) {
    const rng = makeRng(seed + i * 997)
    const deck = shuffle(ALL_IDS, rng.next)
    if (!opts.mission) {
      const rolled = rollMission(rng.next)
      last = dealOnce({ ...opts, mission: rolled }, deck, rng.seed)
    } else {
      last = dealOnce(opts, deck, rng.seed)
    }
    if (!fourMonth(last.state.floor)) return last
  }
  return last!
}

export type ApplyResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string }

export function decider(state: GameState): Seat | null {
  if (state.phase === 'ended') return null
  if (state.phase === 'chongtong') return state.chongtongQueue[0] ?? null
  return state.turn
}

export function legalActions(state: GameState, seat: Seat): Action[] {
  if (decider(state) !== seat) return []
  const me = state.players[seat]
  const actions: Action[] = []
  if (state.phase === 'chongtong') {
    actions.push({ type: 'chongtong', declare: true }, { type: 'chongtong', declare: false })
    return actions
  }
  if (hasGukjin(me) && (state.phase === 'turn' || state.phase === 'goStop')) {
    actions.push({ type: 'gukjin', asPi: !me.gukjinAsPi })
  }
  if (state.phase === 'goStop') {
    const score = breakdown(me.captured, me.gukjinAsPi).total
    if (score >= 7) {
      actions.push({ type: 'go' }, { type: 'stop' })
    } else {
      actions.push({ type: 'pass' })
    }
    return actions
  }
  if (state.phase === 'choose' && state.pending) {
    for (const cardId of state.pending.options) actions.push({ type: 'choose', cardId })
    return actions
  }
  if (state.phase !== 'turn') return actions
  const counts = new Map<number, number>()
  for (const id of me.hand) {
    const month = CARDS[id]?.month ?? 0
    if (month) counts.set(month, (counts.get(month) ?? 0) + 1)
  }
  for (const [month, n] of counts) {
    if (n === 3 && !me.shaken.includes(month)) actions.push({ type: 'shake', month })
    if (n >= 3 && floorMonth(state, month).length === 1) actions.push({ type: 'bomb', month })
  }
  for (const cardId of me.hand) actions.push({ type: 'play', cardId })
  return actions
}

function hasGukjin(player: PlayerState) {
  return player.captured.includes(GUKJIN_ID)
}

function floorMonth(state: GameState, month: number) {
  return state.floor.filter((id) => CARDS[id]?.month === month)
}

function removeFloor(state: GameState, ids: string[]) {
  const drop = new Set(ids)
  state.floor = state.floor.filter((id) => !drop.has(id))
}

function bothHandsEmpty(state: GameState) {
  return state.players[0].hand.length === 0 && state.players[1].hand.length === 0
}

function addCards(state: GameState, seat: Seat, ids: string[], events: GameEvent[], reason: string) {
  const me = state.players[seat]
  const opp = state.players[(1 - seat) as Seat]
  const kept: string[] = []
  const paid: string[] = []
  for (const id of ids) {
    if (me.piDebt > 0 && isPiLike(id)) {
      me.piDebt -= 1
      opp.captured.push(id)
      paid.push(id)
    } else {
      me.captured.push(id)
      kept.push(id)
    }
  }
  if (kept.length) events.push({ type: 'capture', player: seat, cardIds: kept, reason })
  if (paid.length) events.push({ type: 'debtPay', player: seat, to: (1 - seat) as Seat, cardIds: paid })
  noteYakus(state, seat, events)
  if (paid.length) noteYakus(state, (1 - seat) as Seat, events)
}

function noteYakus(state: GameState, seat: Seat, events: GameEvent[]) {
  const me = state.players[seat]
  const hits = listYakus(me.captured, me.gukjinAsPi)
  const live = new Set(hits.map((hit) => hit.id))
  for (const hit of hits) {
    if (me.yakuSeen.includes(hit.id)) continue
    me.yakuSeen.push(hit.id)
    events.push({ type: 'yaku', player: seat, id: hit.id, title: hit.title, cardIds: hit.cardIds })
  }
  me.yakuSeen = me.yakuSeen.filter((id) => live.has(id as (typeof hits)[number]['id']))
}

function doSteal(state: GameState, seat: Seat, n: number, events: GameEvent[]) {
  const me = state.players[seat]
  const from = (1 - seat) as Seat
  const opp = state.players[from]
  const got: string[] = []
  let debt = 0
  for (let i = 0; i < n; i++) {
    const id = lowestPi(opp.captured)
    if (!id) {
      opp.piDebt += 1
      debt += 1
      continue
    }
    opp.captured = opp.captured.filter((c) => c !== id)
    if (me.piDebt > 0) {
      me.piDebt -= 1
      opp.captured.push(id)
      continue
    }
    me.captured.push(id)
    got.push(id)
  }
  if (got.length || debt) events.push({ type: 'steal', player: seat, from, cardIds: got, debt })
}

function refreshMission(state: GameState, seat: Seat, events: GameEvent[]) {
  const me = state.players[seat]
  const met = missionMet(state.mission, me.captured, me.gukjinAsPi)
  if (met && !state.missionDone[seat]) {
    state.missionDone[seat] = true
    events.push({ type: 'mission', player: seat, title: state.mission.title })
  } else if (!met && state.missionDone[seat]) {
    state.missionDone[seat] = false
  }
}

function nextFlip(state: GameState, seat: Seat, events: GameEvent[]): string | null {
  while (state.deck.length) {
    const c = state.deck.shift()!
    if (CARDS[c]?.kind === 'bonus') {
      addCards(state, seat, [c], events, 'bonus')
      events.push({ type: 'bonusDraw', player: seat, cardId: c })
      continue
    }
    events.push({ type: 'flip', cardId: c })
    return c
  }
  return null
}

function eatFour(state: GameState, seat: Seat, ids: string[], events: GameEvent[], month: number) {
  const ppuk = state.ppuks.find((p) => p.month === month)
  state.ppuks = state.ppuks.filter((p) => p.month !== month)
  const reason = ppuk ? (ppuk.owner === seat ? 'ownPpuk' : 'eatPpuk') : 'four'
  addCards(state, seat, ids, events, reason)
  if (ppuk && ppuk.owner === seat) {
    events.push({ type: 'ownPpuk', player: seat, month })
    doSteal(state, seat, 2, events)
  } else if (ppuk) {
    events.push({ type: 'eatPpuk', player: seat, month })
    doSteal(state, seat, 1, events)
  } else {
    events.push({ type: 'four', player: seat, month })
    doSteal(state, seat, 1, events)
  }
}

function processIndependent(state: GameState, seat: Seat, cardId: string, events: GameEvent[]) {
  const month = CARDS[cardId]!.month
  const matches = floorMonth(state, month)
  if (matches.length === 0) {
    state.floor.push(cardId)
    events.push({ type: 'drop', player: seat, cardId })
    return
  }
  if (matches.length >= 3) {
    removeFloor(state, matches)
    eatFour(state, seat, [cardId, ...matches], events, month)
    return
  }
  removeFloor(state, matches)
  addCards(state, seat, [cardId, ...matches], events, 'flip')
}

function maybeSweep(state: GameState, seat: Seat, events: GameEvent[]) {
  if (state.phase === 'ended') return
  if (state.floor.length === 0 && !bothHandsEmpty(state)) {
    events.push({ type: 'sweep', player: seat })
    doSteal(state, seat, 1, events)
  }
}

function makePpuk(state: GameState, seat: Seat, cards: string[], month: number, events: GameEvent[]) {
  state.floor.push(...cards)
  state.ppuks.push({ month, owner: seat, cards })
  state.consecutivePpuk += 1
  state.ppukStreak[seat] += 1
  events.push({ type: 'ppuk', player: seat, month, combo: state.consecutivePpuk, cardIds: [...cards] })
  if (state.turnsPlayed[seat] === 0) events.push({ type: 'firstPpuk', player: seat, points: 7 })
  const triple = state.consecutivePpuk >= 3 || state.ppukStreak[seat] >= 3
  if (!triple && state.ppukStreak[seat] === 2) events.push({ type: 'doublePpuk', player: seat, points: 14 })
  if (triple) {
    events.push({ type: 'triple', player: seat })
    endGame(state, seat, 'triplePpuk', events)
    return true
  }
  return false
}

function resolvePlay(state: GameState, seat: Seat, playedId: string, chosen: string | null, events: GameEvent[]) {
  const month = CARDS[playedId]!.month
  const matches = floorMonth(state, month)
  let madePpuk = false

  if (matches.length >= 3) {
    const ids = [...matches]
    removeFloor(state, ids)
    eatFour(state, seat, [playedId, ...ids], events, month)
    const flip = nextFlip(state, seat, events)
    if (flip && state.phase !== 'ended') processIndependent(state, seat, flip, events)
  } else if (matches.length === 2) {
    if (!chosen || !matches.includes(chosen)) throw new Error('선택 패가 없습니다')
    const other = matches.find((id) => id !== chosen)!
    removeFloor(state, [chosen])
    const flip = nextFlip(state, seat, events)
    if (flip && CARDS[flip]!.month === month) {
      removeFloor(state, [other])
      addCards(state, seat, [playedId, chosen, other, flip], events, 'ttadak')
      events.push({ type: 'ttadak', player: seat })
      doSteal(state, seat, 1, events)
    } else {
      addCards(state, seat, [playedId, chosen], events, 'match')
      if (flip) processIndependent(state, seat, flip, events)
    }
  } else if (matches.length === 1) {
    const m = matches[0]!
    removeFloor(state, [m])
    const flip = nextFlip(state, seat, events)
    if (flip && CARDS[flip]!.month === month) {
      madePpuk = true
      makePpuk(state, seat, [playedId, m, flip], month, events)
    } else {
      addCards(state, seat, [playedId, m], events, 'match')
      if (flip && state.phase !== 'ended') processIndependent(state, seat, flip, events)
    }
  } else {
    const flip = nextFlip(state, seat, events)
    if (flip && CARDS[flip]!.month === month) {
      addCards(state, seat, [playedId, flip], events, 'jjok')
      events.push({ type: 'jjok', player: seat })
      doSteal(state, seat, 1, events)
    } else {
      state.floor.push(playedId)
      events.push({ type: 'drop', player: seat, cardId: playedId })
      if (flip) processIndependent(state, seat, flip, events)
    }
  }

  if (state.phase === 'ended') return
  if (!madePpuk) {
    state.consecutivePpuk = 0
    state.ppukStreak[seat] = 0
  }
  state.turnsPlayed[seat] += 1
  maybeSweep(state, seat, events)
}

function scoreOf(state: GameState, seat: Seat) {
  const me = state.players[seat]
  return breakdown(me.captured, me.gukjinAsPi).total
}

function passTurn(state: GameState, from: Seat, events: GameEvent[]) {
  if (bothHandsEmpty(state)) {
    endNagari(state, events)
    return
  }
  const next = (1 - from) as Seat
  if (state.players[next].hand.length > 0) {
    state.turn = next
    state.phase = 'turn'
    state.pending = undefined
    return
  }
  if (state.players[from].hand.length > 0) {
    state.turn = from
    state.phase = 'turn'
    state.pending = undefined
    return
  }
  endNagari(state, events)
}

function finishTurn(state: GameState, seat: Seat, events: GameEvent[]) {
  if (state.phase === 'ended') return
  state.pending = undefined
  refreshMission(state, 0, events)
  refreshMission(state, 1, events)
  const base = scoreOf(state, seat)
  if (base >= 7 && bothHandsEmpty(state)) {
    events.push({ type: 'stop', player: seat, score: base, auto: true })
    endGame(state, seat, 'stop', events)
    return
  }
  if (base >= 7 && base > state.players[seat].decidedScore) {
    state.phase = 'goStop'
    state.turn = seat
    events.push({ type: 'offer', player: seat, score: base })
    return
  }
  passTurn(state, seat, events)
}

function settlementInput(state: GameState, winner: Seat, kind: Exclude<EndKind, 'nagari'>): SettlementInput {
  return {
    captured: [state.players[0].captured, state.players[1].captured],
    gukjinAsPi: [state.players[0].gukjinAsPi, state.players[1].gukjinAsPi],
    goCount: [state.players[0].goCount, state.players[1].goCount],
    shakeCount: state.players[0].shaken.length + state.players[1].shaken.length,
    bombCount: state.players[0].bombs + state.players[1].bombs,
    missionDone: state.missionDone[winner],
    nagariMul: state.nagariMul,
    pointValue: state.pointValue,
    kind,
    winner,
  }
}

function endGame(state: GameState, winner: Seat, kind: Exclude<EndKind, 'nagari'>, events: GameEvent[]) {
  const settlement = settle(settlementInput(state, winner, kind))
  state.phase = 'ended'
  state.pending = undefined
  state.end = { kind, winner, settlement }
  for (const f of settlement.factors) {
    if (f.id === 'pi' || f.id === 'gwang' || f.id === 'meong' || f.id === 'gobak') {
      events.push({ type: 'bak', kind: f.id, player: winner })
    }
  }
  events.push({ type: 'win', player: winner, kind })
}

function endNagari(state: GameState, events: GameEvent[]) {
  state.phase = 'ended'
  state.pending = undefined
  state.end = { kind: 'nagari' }
  events.push({ type: 'nagari' })
}

export function stopSettlement(state: GameState, seat: Seat) {
  if (scoreOf(state, seat) < 7) return undefined
  return settle(settlementInput(state, seat, 'stop'))
}

export function previewStop(state: GameState, seat: Seat) {
  return stopSettlement(state, seat)?.points ?? -1
}

export function closeByForfeit(state: GameState, winner: Seat, pointValue: number): GameState {
  const next = structuredClone(state) as GameState
  next.phase = 'ended'
  next.pending = undefined
  next.end = {
    kind: 'stop',
    winner,
    settlement: settle({
      captured: [next.players[0].captured, next.players[1].captured],
      gukjinAsPi: [next.players[0].gukjinAsPi, next.players[1].gukjinAsPi],
      goCount: [next.players[0].goCount, next.players[1].goCount],
      shakeCount: next.players[0].shaken.length + next.players[1].shaken.length,
      bombCount: next.players[0].bombs + next.players[1].bombs,
      missionDone: false,
      nagariMul: next.nagariMul,
      pointValue,
      kind: 'stop',
      winner,
    }),
  }
  return next
}

export function nextRound(state: GameState): { seon: Seat; nagariMul: number } {
  if (!state.end || state.end.kind === 'nagari' || state.end.winner === undefined) {
    return { seon: state.seon, nagariMul: state.nagariMul * 2 }
  }
  return { seon: state.end.winner, nagariMul: 1 }
}

function playBonus(state: GameState, seat: Seat, id: string, events: GameEvent[]) {
  const me = state.players[seat]
  me.hand = me.hand.filter((c) => c !== id)
  addCards(state, seat, [id], events, 'bonus')
  events.push({ type: 'bonusPlay', player: seat, cardId: id })
  if (state.deck.length) {
    const drawn = state.deck.shift()!
    me.hand.push(drawn)
    events.push({ type: 'replenish', player: seat })
  }
  refreshMission(state, seat, events)
}

function playToken(state: GameState, seat: Seat, id: string, events: GameEvent[]) {
  const me = state.players[seat]
  me.hand = me.hand.filter((c) => c !== id)
  events.push({ type: 'token', player: seat })
  state.consecutivePpuk = 0
  state.ppukStreak[seat] = 0
  state.turnsPlayed[seat] += 1
  const flip = nextFlip(state, seat, events)
  if (flip && state.phase !== 'ended') processIndependent(state, seat, flip, events)
  if (state.phase === 'ended') return
  maybeSweep(state, seat, events)
  finishTurn(state, seat, events)
}

function doBomb(state: GameState, seat: Seat, month: number, events: GameEvent[]) {
  const me = state.players[seat]
  const use = handMonth(me.hand, month).slice(0, 3)
  const floorIds = floorMonth(state, month)
  me.hand = me.hand.filter((id) => !use.includes(id))
  removeFloor(state, floorIds)
  me.bombs += 1
  const tokens = [0, 1].map(() => {
    const token = `bomb:${seat}:${state.bombSeq}`
    state.bombSeq += 1
    return token
  })
  me.hand.push(...tokens)
  state.consecutivePpuk = 0
  state.ppukStreak[seat] = 0
  state.turnsPlayed[seat] += 1
  events.push({ type: 'bomb', player: seat, month, cardIds: [...use, ...floorIds], handIds: [...use], floorIds: [...floorIds] })
  addCards(state, seat, [...use, ...floorIds], events, 'bomb')
  doSteal(state, seat, 1, events)
  const flip = nextFlip(state, seat, events)
  if (flip && state.phase !== 'ended') processIndependent(state, seat, flip, events)
  if (state.phase === 'ended') return
  maybeSweep(state, seat, events)
  finishTurn(state, seat, events)
}

/** v0.5.1 중간 기권: 진행 중인 판(턴·2장 선택·고/스톱·총통)이면 차례와 관계없이 즉시 상대 기권승 */
export function forfeitGame(prev: GameState, seat: Seat): ApplyResult {
  if (prev.phase === 'ended') return { ok: false, error: '이미 끝난 판입니다' }
  const state = structuredClone(prev) as GameState
  const events: GameEvent[] = []
  const winner = (1 - seat) as Seat
  const settlement = settle({ ...settlementInput(state, winner, 'forfeit'), missionDone: false })
  state.phase = 'ended'
  state.pending = undefined
  state.chongtongQueue = []
  state.end = { kind: 'forfeit', winner, settlement }
  events.push({ type: 'forfeit', player: seat, winner, points: settlement.points })
  events.push({ type: 'win', player: winner, kind: 'forfeit' })
  return { ok: true, state, events }
}

export function applyAction(prev: GameState, seat: Seat, action: Action): ApplyResult {
  if (prev.phase === 'ended') return { ok: false, error: '이미 끝난 판입니다' }
  if (action.type === 'forfeit') return forfeitGame(prev, seat)
  const allowed = legalActions(prev, seat)
  const match = allowed.some((a) => JSON.stringify(a) === JSON.stringify(action))
  if (!match) return { ok: false, error: '지금은 그 수를 둘 수 없습니다' }

  const state = structuredClone(prev) as GameState
  const events: GameEvent[] = []
  const me = state.players[seat]

  if (action.type === 'chongtong') {
    if (action.declare) {
      const month = fourMonth(me.hand) ?? 0
      const cardIds = handMonth(me.hand, month)
      events.push({ type: 'chongtong', player: seat, month, cardIds })
      endGame(state, seat, 'chongtong', events)
    } else {
      state.chongtongQueue.shift()
      events.push({ type: 'chongtongPass', player: seat })
      if (!state.chongtongQueue.length) {
        state.phase = 'turn'
        state.turn = state.seon
      } else {
        state.turn = state.chongtongQueue[0]!
        state.phase = 'chongtong'
      }
    }
    return { ok: true, state, events }
  }

  if (action.type === 'gukjin') {
    me.gukjinAsPi = action.asPi
    events.push({ type: 'gukjin', player: seat, asPi: action.asPi })
    noteYakus(state, seat, events)
    refreshMission(state, seat, events)
    return { ok: true, state, events }
  }

  if (action.type === 'go') {
    const base = scoreOf(state, seat)
    me.goCount += 1
    me.decidedScore = base
    events.push({ type: 'go', player: seat, count: me.goCount, score: base })
    passTurn(state, seat, events)
    return { ok: true, state, events }
  }

  if (action.type === 'stop') {
    const base = scoreOf(state, seat)
    events.push({ type: 'stop', player: seat, score: base })
    endGame(state, seat, 'stop', events)
    return { ok: true, state, events }
  }

  if (action.type === 'pass') {
    events.push({ type: 'pass', player: seat })
    passTurn(state, seat, events)
    return { ok: true, state, events }
  }

  if (action.type === 'shake') {
    const ids = handMonth(me.hand, action.month)
    me.shaken.push(action.month)
    for (const id of ids) if (!me.revealed.includes(id)) me.revealed.push(id)
    events.push({ type: 'shake', player: seat, month: action.month, cardIds: ids })
    return { ok: true, state, events }
  }

  if (action.type === 'bomb') {
    doBomb(state, seat, action.month, events)
    return { ok: true, state, events }
  }

  if (action.type === 'choose') {
    const pending = state.pending
    if (!pending) return { ok: false, error: '고를 패가 없습니다' }
    const playedId = pending.playedId
    state.pending = undefined
    resolvePlay(state, seat, playedId, action.cardId, events)
    if (state.phase !== 'ended') finishTurn(state, seat, events)
    return { ok: true, state, events }
  }

  if (action.type === 'play') {
    const card = CARDS[action.cardId]
    if (card?.kind === 'bonus') {
      playBonus(state, seat, action.cardId, events)
      return { ok: true, state, events }
    }
    if (action.cardId.startsWith('bomb:')) {
      playToken(state, seat, action.cardId, events)
      return { ok: true, state, events }
    }
    me.hand = me.hand.filter((id) => id !== action.cardId)
    events.push({ type: 'play', player: seat, cardId: action.cardId })
    const matches = floorMonth(state, card!.month)
    if (matches.length === 2) {
      state.phase = 'choose'
      state.pending = { playedId: action.cardId, options: [matches[0]!, matches[1]!] }
      events.push({ type: 'choose', player: seat, cardId: action.cardId, options: [...matches] })
      return { ok: true, state, events }
    }
    resolvePlay(state, seat, action.cardId, null, events)
    if (state.phase !== 'ended') finishTurn(state, seat, events)
    return { ok: true, state, events }
  }

  return { ok: false, error: '알 수 없는 수입니다' }
}

export function conserved(state: GameState) {
  const ids = [
    ...state.players[0].hand,
    ...state.players[1].hand,
    ...state.players[0].captured,
    ...state.players[1].captured,
    ...state.floor,
    ...state.deck,
  ]
  if (state.pending) ids.push(state.pending.playedId)
  const real = ids.filter((id) => !id.startsWith('bomb:'))
  const unique = new Set(real)
  return unique.size === ALL_IDS.length && real.length === ALL_IDS.length && ALL_IDS.every((id) => unique.has(id))
}
