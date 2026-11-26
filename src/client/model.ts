import type { GameEvent, PublicView, Seat } from '../engine/types'

export interface SeatInfo {
  seat: Seat
  nickname: string
  avatarId: string
  connected: boolean
  ai: boolean
  money: number
  ready: boolean
  filled: boolean
  auto?: boolean
  timeouts?: number
}

export interface TurnClock {
  seat: Seat
  deadlineAt: number
  limitMs: number
  serverNow: number
}

export interface RoomInfo {
  code: string
  mode: 'pvp' | 'ai'
  bet: number
  seonRule: 'night' | 'random'
  status: 'lobby' | 'night' | 'play'
  nagariMul: number
  games: number
  you?: Seat
  seats: SeatInfo[]
  clock?: TurnClock | null
  reconnectUntil?: number | null
  disconnectedSeat?: Seat | null
  notice?: string | null
  serverNow?: number
}

export interface RoomSummary {
  code: string
  bet: number
  host: string
  avatarId: string
  seonRule: 'night' | 'random'
}

export interface Showdown {
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

export interface NightMsg {
  steps: { a: string; b: string }[]
  seon: Seat
  you: Seat
}

export interface TablePacket {
  id: number
  view: PublicView
  events: GameEvent[]
  showdown?: Showdown
}

export interface EmoteMsg {
  seat: Seat
  id: string
  nonce: number
}
