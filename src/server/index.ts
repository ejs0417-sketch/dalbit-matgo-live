import { createServer } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { WebSocket, WebSocketServer } from 'ws'
import { chooseAiAction, timeoutAction } from '../engine/ai'
import { limitForPhase, mayAct, RECONNECT_LIMIT_MS, registerTimeout } from '../engine/clock'
import { ALL_IDS, BETS, CARDS } from '../engine/cards'
import { applyAction, closeByForfeit, createGame, decider, nextRound } from '../engine/game'
import { makeRng } from '../engine/rng'
import { rechargeGuard } from '../engine/score'
import type { Action, GameEvent, GameState, Seat } from '../engine/types'
import { viewFor } from '../engine/view'
import { AVATARS } from '../shared/cast'

function projectRoot() {
  const candidates = [process.cwd()]
  try {
    const url = import.meta.url
    if (typeof url === 'string' && url.startsWith('file:')) {
      const here = path.dirname(fileURLToPath(url))
      candidates.unshift(path.resolve(here, '../..'), path.resolve(here, '..'), here)
    }
  } catch {
    candidates.push(path.resolve(process.cwd(), '..'))
  }
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')) || fs.existsSync(path.join(dir, 'dist', 'index.html'))) ?? process.cwd()
}
const ROOT = projectRoot()
const PORT = Number(process.env.PORT) || 47231
const BET_VALUES = new Set<number>(BETS.map((b) => b.value))
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

interface Session {
  token: string
  nickname: string
  avatarId: string
  money: number
  ws?: WebSocket
  roomCode?: string
  seat?: Seat
  lastRechargeAt?: number
}

interface SeatSlot {
  token: string | null
  nickname: string
  avatarId: string
  connected: boolean
  ai: boolean
  money: number
}

interface Showdown {
  nagari: boolean
  forfeit: boolean
  title: string
  subtitle: string
  winner?: Seat
  base: number
  goBonus: number
  factors: { id: string; label: string; mul: number }[]
  points: number
  money: number
  paid: number
  pointValue: number
  details: { label: string; points: number }[]
}

interface Room {
  code: string
  mode: 'pvp' | 'ai'
  bet: number
  seonRule: 'night' | 'random'
  seats: [SeatSlot, SeatSlot]
  status: 'lobby' | 'night' | 'play'
  game?: GameState
  ready: [boolean, boolean]
  nagariMul: number
  seon: Seat
  games: number
  showdown?: Showdown
  aiTimer?: ReturnType<typeof setTimeout>
  nightTimer?: ReturnType<typeof setTimeout>
  forfeitTimer?: ReturnType<typeof setTimeout>
  turnTimer?: ReturnType<typeof setTimeout>
  nightToken: number
  auto: [boolean, boolean]
  timeouts: [number, number]
  deadlineAt?: number
  clockSeat?: Seat
  clockLimit?: number
  awaitingReady?: boolean
  armedAt?: number
  forfeitAt?: number
  notice?: string
}

const sessions = new Map<string, Session>()
const rooms = new Map<string, Room>()
const sockets = new Map<WebSocket, string>()

function emptySeat(ai = false): SeatSlot {
  return { token: null, nickname: ai ? '달빛 도사' : '', avatarId: ai ? 'hwang' : 'bokman', connected: ai, ai, money: ai ? 5_000_000 : 0 }
}

function makeToken() {
  return crypto.randomUUID().replace(/-/g, '')
}

function makeCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return rooms.has(code) ? makeCode() : code
}

function send(ws: WebSocket | undefined, payload: unknown) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload))
}

function sessionOf(ws: WebSocket) {
  const token = sockets.get(ws)
  return token ? sessions.get(token) : undefined
}

function cleanName(value: unknown) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 10)
  return text || '나그네'
}

function cleanAvatar(value: unknown) {
  const id = String(value ?? '')
  return AVATARS.some((a) => a.id === id) ? id : 'bokman'
}

function cleanBet(value: unknown) {
  const n = Number(value)
  return BET_VALUES.has(n) ? n : 1000
}

function roomOf(session: Session) {
  return session.roomCode ? rooms.get(session.roomCode) : undefined
}

function seatMoney(room: Room, seat: Seat) {
  const slot = room.seats[seat]
  if (slot.ai) return slot.money
  const session = slot.token ? sessions.get(slot.token) : undefined
  return session?.money ?? slot.money
}

function setSeatMoney(room: Room, seat: Seat, money: number) {
  const slot = room.seats[seat]
  slot.money = money
  if (!slot.ai && slot.token) {
    const session = sessions.get(slot.token)
    if (session) session.money = money
  }
}

function publicRoom(room: Room, seat?: Seat) {
  return {
    code: room.code,
    mode: room.mode,
    bet: room.bet,
    seonRule: room.seonRule,
    status: room.status,
    nagariMul: room.nagariMul,
    games: room.games,
    host: 0 as Seat,
    you: seat,
    seats: room.seats.map((slot, index) => ({
      seat: index as Seat,
      nickname: slot.nickname,
      avatarId: slot.avatarId,
      connected: slot.connected,
      ai: slot.ai,
      money: seatMoney(room, index as Seat),
      ready: room.ready[index],
      filled: Boolean(slot.token) || slot.ai,
      auto: room.auto[index],
      timeouts: room.timeouts[index],
    })),
    clock: room.deadlineAt && room.clockSeat !== undefined
      ? { seat: room.clockSeat, deadlineAt: room.deadlineAt, limitMs: room.clockLimit ?? 0, serverNow: Date.now() }
      : null,
    reconnectUntil: room.forfeitAt ?? null,
    disconnectedSeat: room.forfeitAt
      ? (([0, 1] as const).find((seat) => !room.seats[seat].connected && !room.seats[seat].ai) ?? null)
      : null,
    notice: room.notice ?? null,
    serverNow: Date.now(),
  }
}

function listRooms() {
  return [...rooms.values()]
    .filter((room) => room.mode === 'pvp' && room.status === 'lobby' && room.seats.some((s) => !s.token && !s.ai))
    .map((room) => ({
      code: room.code,
      bet: room.bet,
      host: room.seats[0].nickname,
      avatarId: room.seats[0].avatarId,
      seonRule: room.seonRule,
    }))
}

function broadcastRooms() {
  const payload = { type: 'rooms', rooms: listRooms() }
  for (const session of sessions.values()) {
    if (!session.roomCode) send(session.ws, payload)
  }
}

function pushRoom(room: Room, events: GameEvent[] = []) {
  for (const seat of [0, 1] as const) {
    const slot = room.seats[seat]
    if (!slot.token) continue
    const session = sessions.get(slot.token)
    if (!session?.ws) continue
    const message: Record<string, unknown> = {
      type: 'table',
      room: publicRoom(room, seat),
      you: { nickname: session.nickname, avatarId: session.avatarId, money: session.money },
    }
    if (room.game) {
      message.view = viewFor(room.game, seat)
      message.events = events
    }
    if (room.showdown) message.showdown = room.showdown
    send(session.ws, message)
  }
}

function clearTurnTimers(room: Room) {
  if (room.aiTimer) clearTimeout(room.aiTimer)
  if (room.turnTimer) clearTimeout(room.turnTimer)
  room.aiTimer = undefined
  room.turnTimer = undefined
  room.awaitingReady = false
}

function clearTimers(room: Room) {
  clearTurnTimers(room)
  if (room.nightTimer) clearTimeout(room.nightTimer)
  if (room.forfeitTimer) clearTimeout(room.forfeitTimer)
  room.nightTimer = undefined
  room.forfeitTimer = undefined
  room.forfeitAt = undefined
  room.deadlineAt = undefined
}

function pushSync(room: Room) {
  for (const seat of [0, 1] as const) {
    const slot = room.seats[seat]
    if (!slot.token) continue
    const session = sessions.get(slot.token)
    send(session?.ws, { type: 'sync', room: publicRoom(room, seat), notice: room.notice ?? null })
  }
  room.notice = undefined
}

function actFor(room: Room, seat: Seat, timedOut: boolean) {
  if (!room.game || room.showdown || decider(room.game) !== seat) return
  const slot = room.seats[seat]
  if (timedOut) {
    const next = registerTimeout(room.timeouts[seat])
    room.timeouts[seat] = next.streak
    if (next.auto && !room.auto[seat]) {
      room.auto[seat] = true
      room.notice = '시간이 두 번 지나 자동치기로 바꿨습니다.'
    } else {
      room.notice = '시간이 지나 자동으로 냈습니다.'
    }
  }
  let guard = 0
  while (room.game && !room.showdown && decider(room.game) === seat && guard++ < 4) {
    const action = slot.ai ? chooseAiAction(room.game, seat) : timeoutAction(room.game, seat)
    const result = applyAction(room.game, seat, action)
    if (!result.ok) break
    room.game = result.state
    if (room.game.phase === 'ended') applyPayout(room)
    payInstant(room, result.events)
    pushRoom(room, result.events)
    room.notice = undefined
  }
  armTurn(room)
}

function payInstant(room: Room, events: GameEvent[]) {
  for (const ev of events) {
    if (ev.type !== 'firstPpuk' && ev.type !== 'doublePpuk') continue
    const winner = ev.player
    const loser = (1 - winner) as Seat
    const due = ev.points * room.bet
    const bank = seatMoney(room, loser)
    const paid = Math.min(Math.max(0, bank), due)
    setSeatMoney(room, loser, bank - paid)
    setSeatMoney(room, winner, seatMoney(room, winner) + paid)
  }
}

function releaseTurn(room: Room, who: Seat) {
  if (!room.awaitingReady || !room.game || room.showdown || decider(room.game) !== who) return
  room.awaitingReady = false
  const slot = room.seats[who]
  if (slot.ai || room.auto[who]) actFor(room, who, false)
  else beginClock(room, who)
}

function beginClock(room: Room, seat: Seat) {
  if (!room.game || room.showdown || decider(room.game) !== seat) return
  const limit = limitForPhase(room.game.phase)
  room.clockSeat = seat
  room.clockLimit = limit
  room.deadlineAt = Date.now() + limit
  room.awaitingReady = false
  pushSync(room)
  room.turnTimer = setTimeout(() => actFor(room, seat, true), limit)
}

function armTurn(room: Room) {
  clearTurnTimers(room)
  room.deadlineAt = undefined
  if (!room.game || room.showdown || room.game.phase === 'ended') {
    pushSync(room)
    return
  }
  const who = decider(room.game)
  if (who === null) return
  const slot = room.seats[who]
  room.awaitingReady = true
  room.armedAt = Date.now()
  room.clockSeat = who
  if (!slot.connected && !slot.ai) {
    pushSync(room)
    return
  }
  const aiLike = slot.ai || room.auto[who]
  room.turnTimer = setTimeout(() => releaseTurn(room, who), aiLike ? 1800 : 12_000)
  pushSync(room)
}

function titleFor(kind: string) {
  if (kind === 'chongtong') return '총통'
  if (kind === 'triplePpuk') return '삼연뻑'
  if (kind === 'nagari') return '나가리'
  return '스톱'
}

function applyPayout(room: Room) {
  if (!room.game?.end || room.showdown) return
  const end = room.game.end
  if (end.kind === 'nagari' || !end.settlement || end.winner === undefined) {
    room.showdown = {
      nagari: true,
      forfeit: false,
      title: '나가리',
      subtitle: `승부가 나지 않았습니다. 다음 판 배수는 ×${room.nagariMul * 2}`,
      base: 0,
      goBonus: 0,
      factors: [],
      points: 0,
      money: 0,
      paid: 0,
      pointValue: room.bet,
      details: [],
    }
    return
  }
  const bill = end.settlement
  const loser = bill.loser
  const bank = seatMoney(room, loser)
  const paid = Math.min(bank, bill.money)
  setSeatMoney(room, loser, bank - paid)
  setSeatMoney(room, bill.winner, seatMoney(room, bill.winner) + paid)
  room.showdown = {
    nagari: false,
    forfeit: false,
    title: titleFor(end.kind),
    subtitle: end.kind === 'chongtong' ? '같은 달 네 장으로 판을 닫았습니다' : end.kind === 'triplePpuk' ? '뻑이 세 번 이어졌습니다' : '점수를 확정했습니다',
    winner: bill.winner,
    base: bill.base,
    goBonus: bill.goBonus,
    factors: bill.factors,
    points: bill.points,
    money: bill.money,
    paid,
    pointValue: bill.pointValue,
    details: bill.breakdown.details,
  }
}

function forfeit(room: Room, winner: Seat) {
  if (room.showdown || !room.game || room.game.phase === 'ended') return
  const loser = (1 - winner) as Seat
  const mul = room.game.nagariMul
  const points = 7 * mul
  const money = points * room.bet
  const bank = seatMoney(room, loser)
  const paid = Math.min(bank, money)
  setSeatMoney(room, loser, bank - paid)
  setSeatMoney(room, winner, seatMoney(room, winner) + paid)
  room.game = closeByForfeit(room.game, winner, room.bet)
  room.showdown = {
    nagari: false,
    forfeit: true,
    title: '기권',
    subtitle: '접속이 끊긴 쪽이 판을 양보했습니다',
    winner,
    base: 7,
    goBonus: 0,
    factors: mul > 1 ? [{ id: 'nagari', label: '나가리', mul }] : [],
    points,
    money,
    paid,
    pointValue: room.bet,
    details: [{ label: '기권', points: 7 }],
  }
  pushRoom(room, [{ type: 'win', player: winner, kind: 'stop' }])
}

function armForfeit(room: Room) {
  if (room.forfeitTimer) clearTimeout(room.forfeitTimer)
  if (room.status !== 'play' || room.showdown) return
  const alive = ([0, 1] as const).find((seat) => room.seats[seat].connected && !room.seats[seat].ai)
  const gone = ([0, 1] as const).find((seat) => !room.seats[seat].connected && !room.seats[seat].ai)
  if (alive === undefined || gone === undefined) {
    room.forfeitAt = undefined
    return
  }
  room.forfeitAt = Date.now() + RECONNECT_LIMIT_MS
  room.forfeitTimer = setTimeout(() => forfeit(room, alive), RECONNECT_LIMIT_MS)
}

function startRound(room: Room) {
  room.showdown = undefined
  room.ready = [false, false]
  const { state, events } = createGame({
    seon: room.seon,
    nagariMul: room.nagariMul,
    pointValue: room.bet,
    seed: Math.floor(Math.random() * 1_000_000_000) + 1,
  })
  room.game = state
  room.status = 'play'
  room.games += 1
  room.timeouts = [0, 0]
  room.deadlineAt = undefined
  pushRoom(room, events)
  armTurn(room)
}

function nightSteps(seed: number) {
  const rng = makeRng(seed)
  const pool = ALL_IDS.filter((id) => (CARDS[id]?.month ?? 0) > 0)
  const steps: { a: string; b: string }[] = []
  for (let i = 0; i < 6; i++) {
    const a = pool[Math.floor(rng.next() * pool.length)]!
    const b = pool[Math.floor(rng.next() * pool.length)]!
    steps.push({ a, b })
    const ma = CARDS[a]!.month
    const mb = CARDS[b]!.month
    if (ma !== mb) return { steps, seon: (ma > mb ? 0 : 1) as Seat }
  }
  return { steps, seon: 0 as Seat }
}

function openRound(room: Room) {
  clearTimers(room)
  if (room.games === 0 && room.seonRule === 'night') {
    const night = nightSteps(Math.floor(Math.random() * 1e9) + 3)
    room.seon = night.seon
    room.status = 'night'
    room.nightToken += 1
    const token = room.nightToken
    pushRoom(room)
    for (const seat of [0, 1] as const) {
      const slot = room.seats[seat]
      if (!slot.token) continue
      send(sessions.get(slot.token)?.ws, { type: 'night', steps: night.steps, seon: night.seon, you: seat })
    }
    room.nightTimer = setTimeout(() => {
      if (room.nightToken !== token) return
      startRound(room)
    }, night.steps.length * 1300 + 500)
    return
  }
  if (room.games === 0 && room.seonRule === 'random') room.seon = Math.random() < 0.5 ? 0 : 1
  startRound(room)
}

function sit(room: Room, session: Session, seat: Seat) {
  const slot = room.seats[seat]
  slot.token = session.token
  slot.nickname = session.nickname
  slot.avatarId = session.avatarId
  slot.connected = true
  slot.money = session.money
  session.roomCode = room.code
  session.seat = seat
}

function release(session: Session, intentional: boolean) {
  const room = roomOf(session)
  if (!room || session.seat === undefined) {
    session.roomCode = undefined
    session.seat = undefined
    return
  }
  const seat = session.seat
  const slot = room.seats[seat]
  if (room.status === 'lobby' || room.status === 'night') {
    slot.token = null
    slot.connected = false
    slot.nickname = ''
    room.ready[seat] = false
    session.roomCode = undefined
    session.seat = undefined
    if (room.seats.every((s) => !s.token)) {
      clearTimers(room)
      rooms.delete(room.code)
    } else if (intentional && seat === 0 && room.mode === 'pvp') {
      const other = room.seats[1]
      if (other.token) {
        const guest = sessions.get(other.token)
        if (guest) {
          guest.roomCode = undefined
          guest.seat = undefined
          send(guest.ws, { type: 'error', message: '방장이 방을 닫았습니다.' })
          send(guest.ws, { type: 'lobby' })
        }
      }
      clearTimers(room)
      rooms.delete(room.code)
    } else {
      pushRoom(room)
    }
    broadcastRooms()
    return
  }
  slot.connected = false
  if (intentional) {
    const winner = (1 - seat) as Seat
    if (!room.showdown && room.game && room.game.phase !== 'ended') forfeit(room, winner)
    slot.token = null
    session.roomCode = undefined
    session.seat = undefined
    if (room.seats.every((s) => !s.token)) {
      clearTimers(room)
      rooms.delete(room.code)
    }
  } else {
    armForfeit(room)
    pushRoom(room)
  }
}

function createRoom(session: Session, bet: number, seonRule: 'night' | 'random', mode: 'pvp' | 'ai') {
  if (session.roomCode) release(session, true)
  const room: Room = {
    code: makeCode(),
    mode,
    bet,
    seonRule,
    seats: [emptySeat(false), emptySeat(mode === 'ai')],
    status: 'lobby',
    ready: [false, false],
    nagariMul: 1,
    seon: 0,
    games: 0,
    nightToken: 0,
    auto: [false, false],
    timeouts: [0, 0],
  }
  if (mode === 'ai') {
    const taken = new Set([session.avatarId])
    const pick = AVATARS.find((a) => !taken.has(a.id)) ?? AVATARS[7]
    room.seats[1].nickname = '달빛 도사'
    room.seats[1].avatarId = pick.id
    room.seats[1].ai = true
    room.seats[1].connected = true
  }
  rooms.set(room.code, room)
  sit(room, session, 0)
  broadcastRooms()
  pushRoom(room)
}

function joinRoom(session: Session, code: string) {
  const room = rooms.get(code.toUpperCase())
  if (!room || room.mode !== 'pvp') return '방을 찾을 수 없습니다.'
  if (session.roomCode === room.code) {
    pushRoom(room)
    return
  }
  if (room.status !== 'lobby') return '이미 시작된 방입니다.'
  const seat = room.seats.findIndex((s) => !s.token && !s.ai)
  if (seat < 0) return '방이 가득 찼습니다.'
  if (session.roomCode) release(session, true)
  sit(room, session, seat as Seat)
  broadcastRooms()
  pushRoom(room)
}

function tryStart(room: Room) {
  const filled = room.seats.every((s) => s.token || s.ai)
  if (!filled) return
  if (room.mode === 'ai' || (room.ready[0] && room.ready[1])) openRound(room)
}

function onAction(session: Session, action: Action) {
  const room = roomOf(session)
  if (!room?.game || session.seat === undefined) return
  if (room.showdown) return
  if (!mayAct(decider(room.game), session.seat)) {
    send(session.ws, { type: 'error', message: '지금은 당신 차례가 아닙니다.' })
    return
  }
  clearTurnTimers(room)
  room.timeouts[session.seat] = 0
  const result = applyAction(room.game, session.seat, action)
  if (!result.ok) {
    send(session.ws, { type: 'error', message: result.error })
    armTurn(room)
    return
  }
  room.game = result.state
  if (room.game.phase === 'ended') applyPayout(room)
  payInstant(room, result.events)
  pushRoom(room, result.events)
  armTurn(room)
}

function rematch(room: Room) {
  if (!room.game?.end) return
  const next = nextRound(room.game)
  room.seon = next.seon
  room.nagariMul = next.nagariMul
  room.game = undefined
  room.showdown = undefined
  room.status = 'lobby'
  openRound(room)
}

function welcome(session: Session) {
  send(session.ws, {
    type: 'welcome',
    token: session.token,
    nickname: session.nickname,
    avatarId: session.avatarId,
    money: session.money,
  })
  const room = roomOf(session)
  if (room && session.seat !== undefined) {
    room.seats[session.seat].connected = true
    room.seats[session.seat].nickname = session.nickname
    room.seats[session.seat].avatarId = session.avatarId
    if (room.forfeitTimer && room.seats.every((s) => s.connected || s.ai)) {
      clearTimeout(room.forfeitTimer)
      room.forfeitTimer = undefined
      room.forfeitAt = undefined
    }
    pushRoom(room)
    armTurn(room)
  } else {
    send(session.ws, { type: 'rooms', rooms: listRooms() })
  }
}

function onMessage(ws: WebSocket, raw: string) {
  const session = sessionOf(ws)
  if (!session) return
  let msg: Record<string, unknown>
  try {
    msg = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return
  }
  if (msg.type === 'profile') {
    session.nickname = cleanName(msg.nickname)
    session.avatarId = cleanAvatar(msg.avatarId)
    const room = roomOf(session)
    if (room && session.seat !== undefined && !room.seats[session.seat].ai) {
      room.seats[session.seat].nickname = session.nickname
      room.seats[session.seat].avatarId = session.avatarId
      pushRoom(room)
    }
    welcome(session)
    return
  }
  if (msg.type === 'list') {
    send(ws, { type: 'rooms', rooms: listRooms() })
    return
  }
  if (msg.type === 'create') {
    createRoom(session, cleanBet(msg.bet), msg.seonRule === 'random' ? 'random' : 'night', 'pvp')
    return
  }
  if (msg.type === 'ai') {
    createRoom(session, cleanBet(msg.bet), msg.seonRule === 'random' ? 'random' : 'night', 'ai')
    const room = roomOf(session)
    if (room) {
      room.ready = [true, true]
      openRound(room)
    }
    return
  }
  if (msg.type === 'join') {
    const error = joinRoom(session, String(msg.code ?? ''))
    if (error) send(ws, { type: 'error', message: error })
    return
  }
  if (msg.type === 'quick') {
    const open = [...rooms.values()].find((room) => room.mode === 'pvp' && room.status === 'lobby' && room.seats.some((s) => !s.token))
    if (open) {
      const error = joinRoom(session, open.code)
      if (error) send(ws, { type: 'error', message: error })
    } else {
      createRoom(session, cleanBet(msg.bet), 'night', 'pvp')
    }
    return
  }
  if (msg.type === 'bet' || msg.type === 'seonRule') {
    const room = roomOf(session)
    if (!room || session.seat !== 0) return
    if (room.status === 'play' && !room.showdown) return
    if (msg.type === 'bet') room.bet = cleanBet(msg.bet)
    if (msg.type === 'seonRule') room.seonRule = msg.seonRule === 'random' ? 'random' : 'night'
    pushRoom(room)
    broadcastRooms()
    return
  }
  if (msg.type === 'ready') {
    const room = roomOf(session)
    if (!room || session.seat === undefined || room.status !== 'lobby') return
    room.ready[session.seat] = true
    pushRoom(room)
    tryStart(room)
    return
  }
  if (msg.type === 'action' && msg.action && typeof msg.action === 'object') {
    onAction(session, msg.action as Action)
    return
  }
  if (msg.type === 'emote') {
    const room = roomOf(session)
    if (!room || session.seat === undefined) return
    const id = String(msg.id ?? '')
    for (const seat of [0, 1] as const) {
      const slot = room.seats[seat]
      if (!slot.token) continue
      send(sessions.get(slot.token)?.ws, { type: 'emote', seat: session.seat, id })
    }
    return
  }
  if (msg.type === 'rematch') {
    const room = roomOf(session)
    if (!room || session.seat === undefined || !room.showdown) return
    room.ready[session.seat] = true
    if (room.mode === 'ai') room.ready[1] = true
    pushRoom(room)
    if (room.ready[0] && room.ready[1]) rematch(room)
    return
  }
  if (msg.type === 'ping') {
    send(ws, { type: 'pong', t: Date.now() })
    return
  }
  if (msg.type === 'pong') return
  if (msg.type === 'recharge') {
    const roomNow = roomOf(session)
    const inPlay = Boolean(roomNow && roomNow.status === 'play' && roomNow.game && roomNow.game.phase !== 'ended' && !roomNow.showdown)
    const guard = rechargeGuard(session.money, session.lastRechargeAt ?? 0, Date.now(), inPlay)
    if (!guard.ok) {
      send(ws, { type: 'error', message: guard.message })
      return
    }
    session.money = guard.money
    session.lastRechargeAt = Date.now()
    const room = roomOf(session)
    if (room && session.seat !== undefined) room.seats[session.seat].money = session.money
    send(ws, { type: 'recharged', money: session.money, gained: guard.gained })
    if (room) pushSync(room)
    return
  }
  if (msg.type === 'auto' && session.seat !== undefined) {
    const room = roomOf(session)
    if (!room) return
    room.auto[session.seat] = Boolean(msg.on)
    if (!msg.on) room.timeouts[session.seat] = 0
    if (room.game && decider(room.game) === session.seat && !room.showdown) {
      clearTurnTimers(room)
      if (room.auto[session.seat]) room.aiTimer = setTimeout(() => actFor(room, session.seat!, false), 280)
      else beginClock(room, session.seat)
    } else pushSync(room)
    return
  }
  if (msg.type === 'ready_turn' && session.seat !== undefined) {
    const room = roomOf(session)
    const who = room?.game ? decider(room.game) : null
    if (!room?.game || !room.awaitingReady || who === null) return
    if (room.turnTimer) clearTimeout(room.turnTimer)
    const aiLike = room.seats[who].ai || room.auto[who]
    const elapsed = Date.now() - (room.armedAt ?? 0)
    const wait = aiLike ? Math.max(0, 1800 - elapsed) : 0
    room.turnTimer = setTimeout(() => releaseTurn(room, who), wait)
    return
  }
  if (msg.type === 'leave') {
    release(session, true)
    send(ws, { type: 'lobby' })
    send(ws, { type: 'rooms', rooms: listRooms() })
  }
}

async function main() {
  const app = express()
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size })
  })
  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws' })

  if (process.env.NODE_ENV === 'production') {
    const dist = path.join(ROOT, 'dist')
    const year = {
      immutable: true,
      maxAge: 31_536_000_000,
      setHeaders(res: express.Response) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      },
    }
    app.use('/cards', express.static(path.join(dist, 'cards'), year))
    app.use('/assets', express.static(path.join(dist, 'assets'), year))
    app.use('/art', express.static(path.join(dist, 'art'), year))
    app.use(express.static(dist))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/ws')) return next()
      res.sendFile(path.join(dist, 'index.html'))
    })
  } else {
    const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<typeof import('vite')>
    const { createServer: createVite } = await load('vite')
    const vite = await createVite({
      root: ROOT,
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  }

  wss.on('connection', (ws) => {
    ws.on('message', (buf) => {
      const text = buf.toString()
      if (!sockets.has(ws)) {
        let hello: Record<string, unknown> = {}
        try {
          hello = JSON.parse(text) as Record<string, unknown>
        } catch {
          ws.close()
          return
        }
        if (hello.type !== 'hello') {
          ws.close()
          return
        }
        const token = typeof hello.token === 'string' && sessions.has(hello.token) ? hello.token : makeToken()
        let session = sessions.get(token)
        if (!session) {
          session = { token, nickname: cleanName(hello.nickname), avatarId: cleanAvatar(hello.avatarId), money: 1_000_000 }
          sessions.set(token, session)
        } else {
          if (hello.nickname) session.nickname = cleanName(hello.nickname)
          if (hello.avatarId) session.avatarId = cleanAvatar(hello.avatarId)
          if (session.ws && session.ws !== ws) session.ws.close()
        }
        session.ws = ws
        sockets.set(ws, token)
        welcome(session)
        return
      }
      onMessage(ws, text)
    })
    ws.on('close', () => {
      const token = sockets.get(ws)
      sockets.delete(ws)
      if (!token) return
      const session = sessions.get(token)
      if (!session || session.ws !== ws) return
      session.ws = undefined
      const room = roomOf(session)
      if (room && session.seat !== undefined) {
        room.seats[session.seat].connected = false
        armForfeit(room)
        pushRoom(room)
      }
    })
  })

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.ping()
        client.send(JSON.stringify({ type: 'ping', t: Date.now() }))
      }
    }
  }, 25_000)
  server.on('close', () => clearInterval(heartbeat))

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`달빛맞고 http://127.0.0.1:${PORT}`)
  })
}

void main()
