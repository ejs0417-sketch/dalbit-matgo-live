export type Seat = 0 | 1
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
export type CardKind = 'gwang' | 'yeol' | 'tti' | 'pi' | 'bonus'
export type TtiGroup = 'hong' | 'cheong' | 'cho' | 'plain'
export type EndKind = 'stop' | 'chongtong' | 'triplePpuk' | 'nagari'

export interface CardDef {
  id: string
  month: Month | 0
  kind: CardKind
  name: string
  short: string
  pi: number
  ttiGroup?: TtiGroup
  godori?: boolean
  gukjin?: boolean
  rain?: boolean
  image: string
}

export interface PlayerState {
  hand: string[]
  captured: string[]
  shaken: number[]
  bombs: number
  goCount: number
  decidedScore: number
  gukjinAsPi: boolean
  piDebt: number
  revealed: string[]
  yakuSeen: string[]
}

export interface Ppuk {
  month: number
  owner: Seat
  cards: string[]
}

export type Mission =
  | { id: string; kind: 'hongdan'; title: string; desc: string }
  | { id: string; kind: 'cheongdan'; title: string; desc: string }
  | { id: string; kind: 'chodan'; title: string; desc: string }
  | { id: string; kind: 'godori'; title: string; desc: string }
  | { id: string; kind: 'gwang'; count: number; title: string; desc: string }
  | { id: string; kind: 'yeol'; count: number; title: string; desc: string }
  | { id: string; kind: 'tti'; count: number; title: string; desc: string }
  | { id: string; kind: 'ssang'; count: number; title: string; desc: string }
  | { id: string; kind: 'cards'; cardIds: string[]; title: string; desc: string }
  | { id: string; kind: 'month'; month: number; count: number; title: string; desc: string }

export type Phase = 'chongtong' | 'turn' | 'choose' | 'goStop' | 'ended'

export interface PendingChoice {
  playedId: string
  options: string[]
}

export interface ScoreDetail {
  label: string
  points: number
}

export interface ScoreBreakdown {
  total: number
  gwangPoints: number
  gwangName?: string
  gwangCount: number
  yeolPoints: number
  yeolCount: number
  godori: boolean
  ttiPoints: number
  ttiCount: number
  hong: boolean
  cheong: boolean
  cho: boolean
  piPoints: number
  piCount: number
  details: ScoreDetail[]
}

export interface SettlementFactor {
  id: string
  label: string
  mul: number
}

export interface Settlement {
  winner: Seat
  loser: Seat
  kind: Exclude<EndKind, 'nagari'>
  base: number
  goCount: number
  goBonus: number
  subtotal: number
  factors: SettlementFactor[]
  totalMul: number
  points: number
  pointValue: number
  money: number
  piWinner: number
  piLoser: number
  breakdown: ScoreBreakdown
}

export interface GameEnd {
  kind: EndKind
  winner?: Seat
  settlement?: Settlement
}

export interface GameState {
  players: [PlayerState, PlayerState]
  turn: Seat
  seon: Seat
  floor: string[]
  deck: string[]
  ppuks: Ppuk[]
  phase: Phase
  chongtongQueue: Seat[]
  pending?: PendingChoice
  consecutivePpuk: number
  ppukStreak: [number, number]
  turnsPlayed: [number, number]
  nagariMul: number
  pointValue: number
  mission: Mission
  missionDone: [boolean, boolean]
  rngState: number
  bombSeq: number
  end?: GameEnd
}

export type Action =
  | { type: 'chongtong'; declare: boolean }
  | { type: 'shake'; month: number }
  | { type: 'bomb'; month: number }
  | { type: 'play'; cardId: string }
  | { type: 'choose'; cardId: string }
  | { type: 'gukjin'; asPi: boolean }
  | { type: 'go' }
  | { type: 'stop' }
  | { type: 'pass' }

export type GameEvent =
  | { type: 'deal' }
  | { type: 'floorBonus'; player: Seat; cardIds: string[] }
  | { type: 'chongtong'; player: Seat; month: number; cardIds: string[] }
  | { type: 'chongtongPass'; player: Seat }
  | { type: 'shake'; player: Seat; month: number; cardIds: string[] }
  | { type: 'bomb'; player: Seat; month: number; cardIds: string[]; handIds?: string[]; floorIds?: string[] }
  | { type: 'play'; player: Seat; cardId: string }
  | { type: 'token'; player: Seat }
  | { type: 'bonusPlay'; player: Seat; cardId: string }
  | { type: 'replenish'; player: Seat }
  | { type: 'bonusDraw'; player: Seat; cardId: string }
  | { type: 'flip'; cardId: string }
  | { type: 'choose'; player: Seat; cardId: string; options: string[] }
  | { type: 'capture'; player: Seat; cardIds: string[]; reason: string }
  | { type: 'debtPay'; player: Seat; to: Seat; cardIds: string[] }
  | { type: 'drop'; player: Seat; cardId: string }
  | { type: 'jjok'; player: Seat }
  | { type: 'ppuk'; player: Seat; month: number; combo: number; cardIds?: string[] }
  | { type: 'firstPpuk'; player: Seat; points: 7 }
  | { type: 'doublePpuk'; player: Seat; points: 14 }
  | { type: 'ownPpuk'; player: Seat; month: number }
  | { type: 'eatPpuk'; player: Seat; month: number }
  | { type: 'ttadak'; player: Seat }
  | { type: 'four'; player: Seat; month: number }
  | { type: 'sweep'; player: Seat }
  | { type: 'steal'; player: Seat; from: Seat; cardIds: string[]; debt: number }
  | { type: 'go'; player: Seat; count: number; score: number }
  | { type: 'stop'; player: Seat; score: number; auto?: boolean }
  | { type: 'pass'; player: Seat }
  | { type: 'offer'; player: Seat; score: number }
  | { type: 'gukjin'; player: Seat; asPi: boolean }
  | { type: 'mission'; player: Seat; title: string }
  | { type: 'yaku'; player: Seat; id: 'godori' | 'hong' | 'cheong' | 'cho' | 'sam' | 'bisam' | 'sa' | 'o'; title: string; cardIds: string[] }
  | { type: 'triple'; player: Seat }
  | { type: 'bak'; kind: 'pi' | 'gwang' | 'meong' | 'gobak'; player: Seat }
  | { type: 'nagari' }
  | { type: 'win'; player: Seat; kind: EndKind }

export interface PublicView {
  you: Seat
  seon: Seat
  turn: Seat
  decider: Seat | null
  phase: Phase
  yourHand: string[]
  opponentHandCount: number
  opponentRevealed: string[]
  floor: string[]
  ppuks: { month: number; owner: Seat; cards?: string[] }[]
  yourCapture: string[]
  opponentCapture: string[]
  deckCount: number
  youScore: ScoreBreakdown
  oppScore: ScoreBreakdown
  yourGo: number
  oppGo: number
  yourGukjin: boolean
  oppGukjin: boolean
  yourPiDebt: number
  oppPiDebt: number
  yourShaken: number[]
  oppShaken: number[]
  yourBombs: number
  oppBombs: number
  shakeMul: number
  bombMul: number
  nagariMul: number
  consecutivePpuk: number
  mission: Mission
  missionYou: boolean
  missionOpp: boolean
  missionProgress: { current: number; target: number }
  pending?: { player: Seat; playedId: string; options: string[] }
  legal: Action[]
  pointValue: number
  stopPreview?: Settlement
  end?: GameEnd
}
