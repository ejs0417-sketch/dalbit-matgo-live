import { missionProgress } from './missions'
import { decider, legalActions, stopSettlement } from './game'
import { breakdown } from './score'
import type { GameState, PublicView, Seat } from './types'

export function viewFor(state: GameState, seat: Seat): PublicView {
  const opp = (1 - seat) as Seat
  const me = state.players[seat]
  const them = state.players[opp]
  const who = decider(state)
  const youScore = breakdown(me.captured, me.gukjinAsPi)
  const view: PublicView = {
    you: seat,
    seon: state.seon,
    turn: state.turn,
    decider: who,
    phase: state.phase,
    yourHand: [...me.hand],
    opponentHandCount: them.hand.length,
    opponentRevealed: them.revealed.filter((id) => them.hand.includes(id)),
    floor: [...state.floor],
    ppuks: state.ppuks.map((p) => ({ month: p.month, owner: p.owner, cards: [...p.cards] })),
    yourCapture: [...me.captured],
    opponentCapture: [...them.captured],
    deckCount: state.deck.length,
    youScore,
    oppScore: breakdown(them.captured, them.gukjinAsPi),
    yourGo: me.goCount,
    oppGo: them.goCount,
    yourGukjin: me.gukjinAsPi,
    oppGukjin: them.gukjinAsPi,
    yourPiDebt: me.piDebt,
    oppPiDebt: them.piDebt,
    yourShaken: [...me.shaken],
    oppShaken: [...them.shaken],
    yourBombs: me.bombs,
    oppBombs: them.bombs,
    shakeMul: 2 ** (me.shaken.length + them.shaken.length),
    bombMul: 2 ** (me.bombs + them.bombs),
    nagariMul: state.nagariMul,
    consecutivePpuk: state.consecutivePpuk,
    mission: state.mission,
    missionYou: state.missionDone[seat],
    missionOpp: state.missionDone[opp],
    missionProgress: missionProgress(state.mission, me.captured, me.gukjinAsPi),
    legal: who === seat ? legalActions(state, seat) : [],
    pointValue: state.pointValue,
    end: state.end ? structuredClone(state.end) : undefined,
  }
  if (state.pending) {
    view.pending = { player: state.turn, playedId: state.pending.playedId, options: [...state.pending.options] }
  }
  if (state.phase === 'goStop' && who === seat) {
    const preview = stopSettlement(state, seat)
    if (preview) view.stopPreview = preview
  }
  return view
}
