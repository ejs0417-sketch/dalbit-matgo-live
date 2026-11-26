import { dealSeonPool, isDaytimeKst, judgeSeon } from './seon'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyAi, chooseAiAction } from './ai'
import { ALL_IDS, CARDS, CARD_LIST } from './cards'
import {
  applyAction,
  closeByForfeit,
  conserved,
  createGame,
  decider,
  legalActions,
  nextRound,
  sandbox,
  type ApplyResult,
} from './game'
import { limitForPhase, mayAct, PLAY_LIMIT_MS, CHOICE_LIMIT_MS, registerTimeout, allowHumanTurnTimeout } from './clock'
import { timeoutAction } from './ai'
import { breakdown, goIntensity, goMultiplier, listYakus, recharge, rechargeGuard, RECHARGE_AMOUNT, RECHARGE_COOLDOWN_MS, MONEY_CAP, settle, type SettlementInput } from './score'
import { viewFor } from './view'
import type { GameState, Seat } from './types'

function must(result: ApplyResult) {
  if (!result.ok) throw new Error(result.error)
  return result
}

function play(state: GameState, seat: Seat, cardId: string) {
  return must(applyAction(state, seat, { type: 'play', cardId }))
}

const GWANGS = ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm11-gwang', 'm12-gwang']
const HONG = ['m01-tti', 'm02-tti', 'm03-tti']
const CHEONG = ['m06-tti', 'm09-tti', 'm10-tti']
const CHO = ['m04-tti', 'm05-tti', 'm07-tti']
const GODORI = ['m02-yeol', 'm04-yeol', 'm08-yeol']

function baseInput(over: Partial<SettlementInput> = {}): SettlementInput {
  return {
    captured: [[], []],
    gukjinAsPi: [false, false],
    goCount: [0, 0],
    shakeCount: 0,
    bombCount: 0,
    missionDone: false,
    nagariMul: 1,
    pointValue: 1000,
    kind: 'stop',
    winner: 0,
    ...over,
  }
}

describe('패 구성', () => {
  it('48장 화투와 보너스 2장, 광·열·띠·피 장수가 맞다', () => {
    expect(CARD_LIST).toHaveLength(50)
    expect(new Set(ALL_IDS).size).toBe(50)
    const count = (kind: string) => CARD_LIST.filter((c) => c.kind === kind).length
    expect(count('gwang')).toBe(5)
    expect(count('yeol')).toBe(9)
    expect(count('tti')).toBe(10)
    expect(count('pi')).toBe(24)
    expect(count('bonus')).toBe(2)
    expect(CARDS['m11-ssang']?.pi).toBe(2)
    expect(CARDS['m12-ssang']?.pi).toBe(2)
    expect(CARDS['bonus-ssang']?.pi).toBe(2)
    expect(CARDS['bonus-sam']?.pi).toBe(3)
    expect(CARDS['m12-gwang']?.rain).toBe(true)
    expect(CARDS['m09-yeol']?.gukjin).toBe(true)
    expect(GODORI.every((id) => CARDS[id]?.godori)).toBe(true)
  })

  it('카드 그림 파일이 전부 로컬에 있다', () => {
    const root = path.resolve('public/cards')
    for (const card of CARD_LIST) {
      expect(fs.existsSync(path.join(root, `${card.id}.svg`)), card.id).toBe(true)
    }
    expect(fs.existsSync(path.join(root, 'back.svg'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'bomb.svg'))).toBe(true)
  })
})

describe('족보', () => {
  it('삼광·비삼광·사광·오광', () => {
    expect(breakdown(['m01-gwang', 'm03-gwang', 'm08-gwang'], false)).toMatchObject({ gwangName: '삼광', gwangPoints: 3, total: 3 })
    expect(breakdown(['m01-gwang', 'm03-gwang', 'm12-gwang'], false)).toMatchObject({ gwangName: '비삼광', gwangPoints: 2, total: 2 })
    expect(breakdown(GWANGS.slice(0, 4), false)).toMatchObject({ gwangName: '사광', gwangPoints: 4 })
    expect(breakdown(GWANGS, false)).toMatchObject({ gwangName: '오광', gwangPoints: 15, total: 15 })
    expect(breakdown(['m01-gwang', 'm12-gwang'], false).gwangPoints).toBe(0)
  })

  it('열끗, 고도리, 띠, 단, 피', () => {
    const yeols = ['m02-yeol', 'm04-yeol', 'm05-yeol', 'm06-yeol', 'm07-yeol']
    expect(breakdown(yeols, false)).toMatchObject({ yeolPoints: 1, godori: false, total: 1 })
    expect(breakdown([...yeols, 'm08-yeol'], false)).toMatchObject({ yeolPoints: 2, godori: true, total: 7 })
    expect(breakdown(GODORI, false)).toMatchObject({ yeolPoints: 0, godori: true, total: 5 })
    expect(breakdown([...HONG, 'm06-tti', 'm12-tti'], false)).toMatchObject({ ttiPoints: 1, hong: true, total: 4 })
    expect(breakdown(CHEONG, false).total).toBe(3)
    expect(breakdown(CHO, false).total).toBe(3)
    expect(breakdown(Array.from({ length: 10 }, (_, i) => CARD_LIST.filter((c) => c.kind === 'pi' && c.pi === 1)[i]!.id), false)).toMatchObject({
      piCount: 10,
      piPoints: 1,
    })
    const singles = CARD_LIST.filter((c) => c.kind === 'pi' && c.pi === 1).slice(0, 8).map((c) => c.id)
    expect(breakdown([...singles, 'm11-ssang'], false).piCount).toBe(10)
    expect(breakdown([...singles, 'bonus-sam'], false)).toMatchObject({ piCount: 11, piPoints: 2 })
  })

  it('국진은 열끗 또는 쌍피로 전환된다', () => {
    const captured = ['m09-yeol', 'm02-yeol', 'm04-yeol', 'm05-yeol', 'm06-yeol', ...CARD_LIST.filter((c) => c.pi === 1).slice(0, 9).map((c) => c.id)]
    const asYeol = breakdown(captured, false)
    const asPi = breakdown(captured, true)
    expect(asYeol.yeolCount).toBe(5)
    expect(asYeol.yeolPoints).toBe(1)
    expect(asYeol.piCount).toBe(9)
    expect(asPi.yeolCount).toBe(4)
    expect(asPi.yeolPoints).toBe(0)
    expect(asPi.piCount).toBe(11)
    expect(asPi.piPoints).toBe(2)
    expect(asPi.total).toBeGreaterThan(asYeol.total)
  })
})

describe('고와 박, 정산', () => {
  it('고 배수', () => {
    expect(goMultiplier(1)).toBe(1)
    expect(goMultiplier(2)).toBe(1)
    expect(goMultiplier(3)).toBe(2)
    expect(goMultiplier(4)).toBe(4)
    expect(goMultiplier(5)).toBe(8)
    expect(goMultiplier(6)).toBe(16)
    const captured: [string[], string[]] = [GWANGS.slice(0, 3), ['m11-gwang']]
    const one = settle(baseInput({ captured, goCount: [1, 0] }))
    expect(one.base).toBe(3)
    expect(one.goBonus).toBe(1)
    expect(one.subtotal).toBe(4)
    expect(one.totalMul).toBe(1)
    const three = settle(baseInput({ captured, goCount: [3, 0] }))
    expect(three.subtotal).toBe(6)
    expect(three.factors.find((f) => f.id === 'go')?.mul).toBe(2)
    expect(three.points).toBe(12)
    const five = settle(baseInput({ captured, goCount: [5, 0] }))
    expect(five.points).toBe((3 + 5) * 8)
  })

  it('피박·광박·멍박·고박·흔들기·폭탄·미션·나가리가 곱해진다', () => {
    const pi = CARD_LIST.filter((c) => c.pi === 1).map((c) => c.id)
    const winner = [...GWANGS.slice(0, 3), ...HONG, ...pi.slice(0, 10)]
    const loser = [...pi.slice(10, 15), 'm11-gwang']
    const bill = settle(
      baseInput({
        captured: [winner, loser],
        goCount: [3, 1],
        shakeCount: 2,
        bombCount: 1,
        missionDone: true,
        nagariMul: 2,
      }),
    )
    expect(bill.base).toBe(7)
    expect(bill.subtotal).toBe(10)
    expect(bill.factors.map((f) => f.id)).toEqual(['go', 'shake', 'bomb', 'mission', 'pi', 'gobak', 'nagari'])
    expect(bill.totalMul).toBe(2 * 4 * 2 * 2 * 2 * 2 * 2)
    expect(bill.points).toBe(10 * bill.totalMul)
    expect(bill.money).toBe(bill.points * 1000)

    const noPi = settle(baseInput({ captured: [winner, []] }))
    expect(noPi.factors.some((f) => f.id === 'pi')).toBe(false)
    const eight = settle(baseInput({ captured: [winner, pi.slice(10, 18)] }))
    expect(eight.factors.some((f) => f.id === 'pi')).toBe(false)

    const gwang = settle(baseInput({ captured: [GWANGS.slice(0, 3), pi.slice(0, 1)] }))
    expect(gwang.factors.some((f) => f.id === 'gwang')).toBe(true)
    const noGwangScore = settle(baseInput({ captured: [GWANGS.slice(0, 2), []] }))
    expect(noGwangScore.factors.some((f) => f.id === 'gwang')).toBe(false)
    const loserHasGwang = settle(baseInput({ captured: [GWANGS.slice(0, 3), ['m11-gwang']] }))
    expect(loserHasGwang.factors.some((f) => f.id === 'gwang')).toBe(false)

    const yeol7 = ['m02-yeol', 'm04-yeol', 'm05-yeol', 'm06-yeol', 'm07-yeol', 'm08-yeol', 'm10-yeol']
    expect(settle(baseInput({ captured: [yeol7, []] })).factors.some((f) => f.id === 'meong')).toBe(true)
    expect(settle(baseInput({ captured: [yeol7.slice(0, 6), []] })).factors.some((f) => f.id === 'meong')).toBe(false)
  })

  it('총통은 10점이고 다른 박은 붙지 않으며 나가리만 곱한다', () => {
    const bill = settle(
      baseInput({
        kind: 'chongtong',
        nagariMul: 4,
        captured: [GWANGS, []],
        shakeCount: 2,
        missionDone: true,
      }),
    )
    expect(bill.base).toBe(10)
    expect(bill.points).toBe(40)
    expect(bill.factors.map((f) => f.id)).toEqual(['nagari'])
  })

  it('삼연뻑은 최소 7점에 보너스 배수가 붙는다', () => {
    const bill = settle(baseInput({ kind: 'triplePpuk', captured: [[], []] }))
    expect(bill.base).toBe(7)
    expect(bill.factors.some((f) => f.id === 'triple' && f.mul === 2)).toBe(true)
    expect(bill.points).toBe(14)
  })
})

describe('진행 규칙', () => {
  it('쪽은 두 장을 가져가고 피를 한 장 뺏는다', () => {
    const state = sandbox()
    state.floor = ['m08-pi1']
    state.players[0].hand = ['m05-yeol', 'm03-pi1']
    state.players[1].hand = ['m04-pi1']
    state.players[1].captured = ['m01-pi1', 'm02-pi1']
    state.deck = ['m05-pi1', 'm06-pi1']
    const next = play(state, 0, 'm05-yeol')
    expect(next.events.some((e) => e.type === 'jjok')).toBe(true)
    expect(next.state.players[0].captured).toEqual(expect.arrayContaining(['m05-yeol', 'm05-pi1', 'm01-pi1']))
    expect(next.state.players[1].captured).toEqual(['m02-pi1'])
    expect(next.state.floor).toContain('m08-pi1')
  })

  it('뻑은 세 장을 바닥에 묶고, 자뻑은 피 2장, 남의 뻑은 피 1장', () => {
    const state = sandbox()
    state.floor = ['m01-pi1', 'm08-pi1']
    state.players[0].hand = ['m01-pi2', 'm02-pi1']
    state.players[1].hand = ['m04-pi1']
    state.players[1].captured = ['m03-pi1']
    state.deck = ['m01-tti', 'm06-pi1']
    const ppuk = play(state, 0, 'm01-pi2')
    expect(ppuk.events.some((e) => e.type === 'ppuk')).toBe(true)
    expect(ppuk.state.floor).toEqual(expect.arrayContaining(['m01-pi1', 'm01-pi2', 'm01-tti']))
    expect(ppuk.state.players[0].captured).not.toEqual(expect.arrayContaining(['m01-tti']))
    expect(ppuk.state.ppuks[0]).toMatchObject({ month: 1, owner: 0 })
    expect(ppuk.state.consecutivePpuk).toBe(1)
    expect(ppuk.events.some((e) => e.type === 'steal')).toBe(false)

    const own = sandbox()
    own.turn = 0
    own.floor = ['m01-pi1', 'm01-pi2', 'm01-tti', 'm08-pi1']
    own.ppuks = [{ month: 1, owner: 0, cards: ['m01-pi1', 'm01-pi2', 'm01-tti'] }]
    own.players[0].hand = ['m01-gwang']
    own.players[1].hand = ['m04-pi1']
    own.players[1].captured = ['m02-pi1', 'm03-pi1', 'm05-pi1']
    own.deck = ['m06-pi1']
    const eaten = play(own, 0, 'm01-gwang')
    expect(eaten.events.some((e) => e.type === 'ownPpuk')).toBe(true)
    const steal = eaten.events.find((e) => e.type === 'steal')
    expect(steal && steal.type === 'steal' ? steal.cardIds : []).toHaveLength(2)
    expect(eaten.state.players[1].captured).toEqual(['m05-pi1'])

    const theirs = sandbox()
    theirs.floor = ['m01-pi1', 'm01-pi2', 'm01-tti', 'm08-pi1']
    theirs.ppuks = [{ month: 1, owner: 1, cards: ['m01-pi1', 'm01-pi2', 'm01-tti'] }]
    theirs.players[0].hand = ['m01-gwang']
    theirs.players[1].hand = ['m04-pi1']
    theirs.players[1].captured = ['m02-pi1', 'm03-pi1']
    theirs.deck = ['m06-pi1']
    const eat = play(theirs, 0, 'm01-gwang')
    expect(eat.events.some((e) => e.type === 'eatPpuk')).toBe(true)
    const one = eat.events.find((e) => e.type === 'steal')
    expect(one && one.type === 'steal' ? one.cardIds : []).toHaveLength(1)
  })

  it('3연뻑이면 그 사람이 즉시 이긴다', () => {
    const state = sandbox()
    state.floor = ['m01-pi1', 'm02-pi1', 'm03-pi1']
    state.players[0].hand = ['m01-pi2', 'm03-pi2', 'm04-pi1']
    state.players[1].hand = ['m02-pi2', 'm05-pi1']
    state.deck = ['m01-tti', 'm02-tti', 'm03-tti', 'm06-pi1']
    let cur = play(state, 0, 'm01-pi2')
    expect(cur.state.consecutivePpuk).toBe(1)
    expect(cur.state.turn).toBe(1)
    cur = play(cur.state, 1, 'm02-pi2')
    expect(cur.state.consecutivePpuk).toBe(2)
    cur = play(cur.state, 0, 'm03-pi2')
    expect(cur.state.phase).toBe('ended')
    expect(cur.state.end).toMatchObject({ kind: 'triplePpuk', winner: 0 })
    expect(cur.events.some((e) => e.type === 'triple')).toBe(true)
    expect(cur.state.end?.settlement?.points).toBe(14)
  })

  it('첫 턴 뻑은 7점, 같은 사람의 2연속 뻑은 14점 즉금 이벤트다', () => {
    const state = sandbox()
    state.floor = ['m01-pi1', 'm04-pi1', 'm08-pi1']
    state.players[0].hand = ['m01-pi2', 'm04-pi2', 'm09-pi1']
    state.players[1].hand = ['m07-pi1', 'm05-pi1']
    state.deck = ['m01-tti', 'm06-pi1', 'm04-tti', 'm09-pi2']
    const first = play(state, 0, 'm01-pi2')
    expect(first.events.some((e) => e.type === 'firstPpuk' && e.points === 7)).toBe(true)
    expect(first.state.ppukStreak[0]).toBe(1)
    expect(first.state.turnsPlayed[0]).toBe(1)
    const gap = play(first.state, 1, 'm07-pi1')
    expect(gap.events.some((e) => e.type === 'ppuk')).toBe(false)
    const second = play(gap.state, 0, 'm04-pi2')
    expect(second.events.some((e) => e.type === 'doublePpuk' && e.points === 14)).toBe(true)
    expect(second.state.ppukStreak[0]).toBe(2)
    expect(second.events.some((e) => e.type === 'triple')).toBe(false)
  })

  it('따닥은 네 장을 가져가고 피를 뺏으며, 뒤집힌 패가 다르면 고른 패만 가져간다', () => {
    const tt = sandbox()
    tt.floor = ['m06-pi1', 'm06-pi2', 'm08-pi1']
    tt.players[0].hand = ['m06-yeol']
    tt.players[1].hand = ['m04-pi1']
    tt.players[1].captured = ['m01-pi1', 'm02-pi1']
    tt.deck = ['m06-tti']
    const choosing = play(tt, 0, 'm06-yeol')
    expect(choosing.state.phase).toBe('choose')
    expect(choosing.state.deck).toHaveLength(1)
    const done = must(applyAction(choosing.state, 0, { type: 'choose', cardId: 'm06-pi1' }))
    expect(done.events.some((e) => e.type === 'ttadak')).toBe(true)
    expect(done.state.players[0].captured).toEqual(expect.arrayContaining(['m06-yeol', 'm06-pi1', 'm06-pi2', 'm06-tti']))
    expect(done.state.floor).toEqual(['m08-pi1'])
    expect(done.state.players[1].captured).toHaveLength(1)

    const pick = sandbox()
    pick.floor = ['m06-pi1', 'm06-yeol']
    pick.players[0].hand = ['m06-pi2', 'm03-pi1']
    pick.players[1].hand = ['m04-pi1']
    pick.deck = ['m01-pi1', 'm02-pi1']
    const mid = play(pick, 0, 'm06-pi2')
    const chosen = must(applyAction(mid.state, 0, { type: 'choose', cardId: 'm06-yeol' }))
    expect(chosen.state.players[0].captured).toEqual(expect.arrayContaining(['m06-pi2', 'm06-yeol']))
    expect(chosen.state.players[0].captured).not.toContain('m06-pi1')
    expect(chosen.state.floor).toEqual(expect.arrayContaining(['m06-pi1', 'm01-pi1']))
  })

  it('바닥의 같은 달 세 장을 먹으면 피를 한 장 뺏는다', () => {
    const state = sandbox()
    state.floor = ['m04-pi1', 'm04-pi2', 'm04-tti', 'm08-pi1']
    state.players[0].hand = ['m04-yeol']
    state.players[1].hand = ['m05-pi1']
    state.players[1].captured = ['m01-pi1']
    state.deck = ['m02-pi1']
    const next = play(state, 0, 'm04-yeol')
    expect(next.events.some((e) => e.type === 'four')).toBe(true)
    expect(next.state.players[0].captured).toEqual(expect.arrayContaining(['m04-yeol', 'm04-tti', 'm01-pi1']))
  })

  it('판을 쓸면 피를 뺏지만 마지막 턴은 빼 준다', () => {
    const sweep = sandbox()
    sweep.floor = ['m08-pi1']
    sweep.players[0].hand = ['m08-pi2', 'm03-pi1']
    sweep.players[1].hand = ['m04-pi1']
    sweep.players[1].captured = ['m01-pi1']
    sweep.deck = []
    const next = play(sweep, 0, 'm08-pi2')
    expect(next.events.some((e) => e.type === 'sweep')).toBe(true)
    expect(next.state.players[0].captured).toContain('m01-pi1')

    const last = sandbox()
    last.floor = ['m08-pi1']
    last.players[0].hand = ['m08-pi2']
    last.players[1].hand = []
    last.players[1].captured = ['m01-pi1']
    last.deck = []
    last.players[0].captured = [...GWANGS]
    const end = play(last, 0, 'm08-pi2')
    expect(end.events.some((e) => e.type === 'sweep')).toBe(false)
    expect(end.state.end?.kind).toBe('stop')
    expect(end.state.players[1].captured).toContain('m01-pi1')
  })

  it('흔들기 두 번은 ×4, 폭탄은 피 1장과 빈 패 두 장 그리고 ×2', () => {
    const shaken = sandbox()
    shaken.players[0].captured = [...GWANGS]
    shaken.players[0].hand = ['m02-yeol', 'm02-tti', 'm02-pi1', 'm04-yeol', 'm04-tti', 'm04-pi1', 'm08-pi1']
    shaken.players[1].hand = ['m05-pi1']
    shaken.floor = ['m07-pi1']
    shaken.deck = ['m06-pi1']
    let cur = must(applyAction(shaken, 0, { type: 'shake', month: 2 }))
    cur = must(applyAction(cur.state, 0, { type: 'shake', month: 4 }))
    expect(cur.state.players[0].revealed).toEqual(expect.arrayContaining(['m02-yeol', 'm04-yeol']))
    cur = play(cur.state, 0, 'm08-pi1')
    expect(cur.state.phase).toBe('goStop')
    cur = must(applyAction(cur.state, 0, { type: 'stop' }))
    expect(cur.state.end?.settlement?.factors.find((f) => f.id === 'shake')?.mul).toBe(4)

    const bombed = sandbox()
    bombed.players[0].captured = [...GWANGS]
    bombed.players[0].hand = ['m04-yeol', 'm04-tti', 'm04-pi1', 'm03-pi1']
    bombed.players[1].hand = ['m05-pi1']
    bombed.players[1].captured = ['m01-pi1']
    bombed.floor = ['m04-pi2', 'm08-pi1']
    bombed.deck = ['m06-pi1']
    const after = must(applyAction(bombed, 0, { type: 'bomb', month: 4 }))
    expect(after.events.some((e) => e.type === 'bomb')).toBe(true)
    expect(after.state.players[0].hand.filter((id) => id.startsWith('bomb:'))).toHaveLength(2)
    expect(after.state.players[0].captured).toContain('m01-pi1')
    expect(after.state.players[0].bombs).toBe(1)
    expect(after.state.phase).toBe('goStop')
    const stopped = must(applyAction(after.state, 0, { type: 'stop' }))
    expect(stopped.state.end?.settlement?.factors.find((f) => f.id === 'bomb')?.mul).toBe(2)

    const tokenState = after.state
    if (tokenState.phase !== 'goStop') throw new Error('bomb should offer go')
    const passed = must(applyAction(tokenState, 0, { type: 'go' }))
    expect(passed.state.players[1].hand.length).toBeGreaterThan(0)
  })

  it('폭탄 패는 뒤집기만 하는 턴이다', () => {
    const state = sandbox()
    state.players[0].hand = ['bomb:0:1', 'm03-pi1']
    state.players[1].hand = ['m04-pi1']
    state.floor = ['m08-pi1', 'm06-pi1']
    state.deck = ['m06-pi2']
    const next = play(state, 0, 'bomb:0:1')
    expect(next.events.some((e) => e.type === 'token')).toBe(true)
    expect(next.state.players[0].captured).toEqual(expect.arrayContaining(['m06-pi1', 'm06-pi2']))
    expect(next.state.deck).toHaveLength(0)
  })

  it('바닥에 깔린 보너스는 선이 가져가고, 손패 보너스는 내고 한 장 보충한 뒤 턴을 이어 간다', () => {
    const deck = [...ALL_IDS]
    const move = (id: string, index: number) => {
      const from = deck.indexOf(id)
      deck.splice(from, 1)
      deck.splice(index, 0, id)
    }
    move('bonus-ssang', 20)
    move('bonus-sam', 28)
    const dealt = createGame({ deck, seon: 1, seed: 3, mission: { id: 'cup', kind: 'cards', cardIds: ['m12-yeol'], title: '제비', desc: '제비' } })
    expect(dealt.state.players[1].captured).toEqual(expect.arrayContaining(['bonus-ssang', 'bonus-sam']))
    expect(dealt.state.floor).toHaveLength(8)
    expect(dealt.state.floor.some((id) => CARDS[id]?.kind === 'bonus')).toBe(false)
    expect(conserved(dealt.state)).toBe(true)

    const hand = sandbox()
    hand.mission = { id: 'birds', kind: 'cards', cardIds: ['m02-yeol', 'm08-yeol'], title: '새 두 마리', desc: '매조와 기러기' }
    hand.players[0].hand = ['bonus-ssang', 'm04-pi1']
    hand.players[1].hand = ['m05-pi1']
    hand.deck = ['m09-yeol', 'm02-pi1']
    hand.floor = ['m08-pi1']
    const cont = play(hand, 0, 'bonus-ssang')
    expect(cont.state.phase).toBe('turn')
    expect(cont.state.turn).toBe(0)
    expect(cont.state.players[0].captured).toContain('bonus-ssang')
    expect(cont.state.players[0].hand).toContain('m09-yeol')
    expect(cont.events.some((e) => e.type === 'replenish')).toBe(true)
    expect(JSON.stringify(cont.events)).not.toContain('m09-yeol')
    const hidden = viewFor(cont.state, 1)
    expect(JSON.stringify(hidden)).not.toContain('m09-yeol')
    expect(hidden.opponentHandCount).toBe(2)
  })

  it('총통을 선언하면 10점으로 이기고, 아니면 계속한다', () => {
    const quad = ALL_IDS.filter((id) => CARDS[id]?.month === 1)
    const rest = ALL_IDS.filter((id) => CARDS[id]?.month !== 1)
    const byMonth = new Map<number, string[]>()
    for (const id of rest) {
      const month = CARDS[id]!.month
      const pile = byMonth.get(month) ?? []
      pile.push(id)
      byMonth.set(month, pile)
    }
    const spread: string[] = []
    const months = [...byMonth.keys()]
    while (spread.length < rest.length) {
      for (const month of months) {
        const pile = byMonth.get(month)!
        if (pile.length) spread.push(pile.shift()!)
      }
    }
    const deck = [...quad, ...spread]
    const dealt = createGame({ deck, seon: 0, seed: 9 })
    expect(dealt.state.phase).toBe('chongtong')
    const won = must(applyAction(dealt.state, 0, { type: 'chongtong', declare: true }))
    expect(won.state.end).toMatchObject({ kind: 'chongtong', winner: 0 })
    expect(won.state.end?.settlement?.points).toBe(10)

    const cont = must(applyAction(dealt.state, 0, { type: 'chongtong', declare: false }))
    expect(cont.state.phase).toBe('turn')
    expect(cont.state.players[0].hand.filter((id) => id.startsWith('m01-'))).toHaveLength(4)
  })

  it('7점 미만은 멈출 수 없고, 7점 이상에서 고·스톱과 고박이 된다', () => {
    const poor = sandbox()
    poor.players[0].hand = ['m01-pi1']
    poor.players[1].hand = ['m02-pi1']
    poor.deck = []
    expect(legalActions(poor, 0).some((a) => a.type === 'stop' || a.type === 'go')).toBe(false)
    expect(applyAction(poor, 0, { type: 'stop' }).ok).toBe(false)

    const state = sandbox()
    state.players[0].captured = [...GWANGS]
    state.players[0].hand = ['m04-pi1']
    state.players[1].captured = [...HONG, ...CHEONG, ...CHO]
    state.players[1].hand = ['m02-pi1']
    state.floor = ['m07-pi1']
    state.deck = []
    const offered = play(state, 0, 'm04-pi1')
    expect(offered.state.phase).toBe('goStop')
    expect(offered.state.end).toBeUndefined()
    const went = must(applyAction(offered.state, 0, { type: 'go' }))
    expect(went.state.players[0].goCount).toBe(1)
    expect(went.state.turn).toBe(1)
    const back = play(went.state, 1, 'm02-pi1')
    expect(back.state.end?.winner).toBe(1)
    expect(back.state.end?.settlement?.factors.some((f) => f.id === 'gobak')).toBe(true)
    expect(back.events.some((e) => e.type === 'bak' && e.kind === 'gobak')).toBe(true)
  })

  it('피가 없으면 빚으로 남았다가 나중에 갚는다', () => {
    const state = sandbox()
    state.floor = ['m01-pi1', 'm06-pi2']
    state.players[0].hand = ['m05-yeol', 'm03-pi1']
    state.players[1].hand = ['m06-pi1']
    state.players[1].captured = ['m02-tti']
    state.deck = ['m05-pi1', 'm07-pi1']
    const jj = play(state, 0, 'm05-yeol')
    expect(jj.state.players[1].piDebt).toBe(1)
    const paid = play(jj.state, 1, 'm06-pi1')
    expect(paid.state.players[1].piDebt).toBe(0)
    const moved = paid.state.players[0].captured.some((id) => id === 'm06-pi1' || id === 'm06-pi2')
    expect(moved).toBe(true)
  })

  it('국진 전환과 미션 성공이 점수와 배수에 반영된다', () => {
    const state = sandbox()
    state.mission = { id: 'hong', kind: 'hongdan', title: '홍단', desc: '홍단' }
    const singles = CARD_LIST.filter((c) => c.pi === 1).slice(0, 9).map((c) => c.id)
    state.players[0].captured = ['m09-yeol', 'm02-yeol', 'm04-yeol', 'm05-yeol', 'm06-yeol', ...singles, ...HONG]
    state.players[0].hand = ['m08-pi1', 'm03-pi2']
    state.players[1].hand = ['m07-pi2']
    state.floor = ['m10-pi1']
    state.deck = ['m10-pi2']
    const toggled = must(applyAction(state, 0, { type: 'gukjin', asPi: true }))
    expect(toggled.state.players[0].gukjinAsPi).toBe(true)
    expect(breakdown(toggled.state.players[0].captured, true).piCount).toBe(11)
    expect(toggled.events.some((e) => e.type === 'mission')).toBe(true)
    const after = play(toggled.state, 0, 'm08-pi1')
    expect(after.state.missionDone[0]).toBe(true)
    expect(after.state.phase).toBe('goStop')
    const stopped = must(applyAction(after.state, 0, { type: 'stop' }))
    expect(stopped.state.end?.settlement?.factors.some((f) => f.id === 'mission')).toBe(true)
  })

  it('승자 없이 끝나면 나가리고 선과 배수가 유지·누적된다', () => {
    const state = sandbox()
    state.seon = 1
    state.turn = 1
    state.nagariMul = 2
    state.players[1].hand = ['m01-pi1']
    state.players[0].hand = ['m02-pi1']
    state.floor = ['m03-pi1']
    state.deck = []
    const first = play(state, 1, 'm01-pi1')
    const done = play(first.state, 0, 'm02-pi1')
    expect(done.state.end?.kind).toBe('nagari')
    expect(nextRound(done.state)).toEqual({ seon: 1, nagariMul: 4 })
  })

  it('보너스 패를 뒤집는 사이에도 쪽·뻑 판정은 이어진다', () => {
    const state = sandbox()
    state.floor = ['m01-pi1', 'm08-pi1']
    state.players[0].hand = ['m01-pi2', 'm03-pi1']
    state.players[1].hand = ['m04-pi1']
    state.deck = ['bonus-ssang', 'm01-tti']
    const next = play(state, 0, 'm01-pi2')
    expect(next.state.players[0].captured).toContain('bonus-ssang')
    expect(next.events.some((e) => e.type === 'ppuk')).toBe(true)
    expect(next.state.deck).toHaveLength(0)
  })

  it('상대 패와 덱 순서는 공개 상태에 없다', () => {
    const { state } = createGame({ seed: 42, pointValue: 5000 })
    expect(conserved(state)).toBe(true)
    expect(state.players[0].hand).toHaveLength(10)
    expect(state.players[1].hand).toHaveLength(10)
    expect(state.floor.length + state.players[0].captured.length).toBeGreaterThanOrEqual(8)
    for (const seat of [0, 1] as const) {
      const view = viewFor(state, seat)
      const blob = JSON.stringify(view)
      expect(blob).not.toContain(state.deck.slice(0, 4).join(','))
      expect(view).not.toHaveProperty('deck')
      const hidden = state.players[(1 - seat) as Seat].hand.filter((id) => !view.opponentRevealed.includes(id))
      expect(view.yourHand.some((id) => hidden.includes(id))).toBe(false)
      expect(view.opponentHandCount).toBe(10)
    }
  })
})

describe('족보 연출과 충전, 시간 제한', () => {
  it('고도리·단·광을 처음 완성할 때만 족보 이벤트가 난다', () => {
    expect(listYakus(['m02-yeol', 'm04-yeol', 'm08-yeol'], false).map((hit) => hit.id)).toEqual(['godori'])
    expect(listYakus(HONG, false).map((hit) => hit.id)).toEqual(['hong'])
    expect(listYakus(CHEONG, false).map((hit) => hit.id)).toEqual(['cheong'])
    expect(listYakus(CHO, false).map((hit) => hit.id)).toEqual(['cho'])
    expect(listYakus(GWANGS.slice(0, 3), false)[0]).toMatchObject({ id: 'sam', title: '삼광' })
    expect(listYakus(['m01-gwang', 'm03-gwang', 'm12-gwang'], false)[0]?.id).toBe('bisam')
    expect(listYakus(GWANGS.slice(0, 4), false)[0]?.id).toBe('sa')
    expect(listYakus(GWANGS, false)[0]?.id).toBe('o')

    const state = sandbox()
    state.players[0].captured = ['m02-yeol', 'm04-yeol']
    state.players[0].hand = ['m08-pi1', 'm03-pi2']
    state.players[1].hand = ['m05-pi1']
    state.floor = ['m08-yeol', 'm01-pi1']
    state.deck = ['m06-pi1']
    const made = play(state, 0, 'm08-pi1')
    const yakus = made.events.filter((event) => event.type === 'yaku')
    expect(yakus).toEqual([expect.objectContaining({ type: 'yaku', id: 'godori', player: 0 })])
    const again = play(made.state, 1, 'm05-pi1')
    expect(again.events.some((event) => event.type === 'yaku' && event.id === 'godori')).toBe(false)
  })

  it('무료 충전은 100만 원을 더하고, 쿨다운·상한·대국 중에는 막는다', () => {
    expect(RECHARGE_AMOUNT).toBe(1_000_000)
    expect(RECHARGE_COOLDOWN_MS).toBe(10_000)
    expect(recharge(1_000_000)).toBe(2_000_000)
    expect(recharge(0)).toBe(1_000_000)
    expect(recharge(MONEY_CAP)).toBe(MONEY_CAP)
    expect(rechargeGuard(0, 0, 1_000).ok).toBe(true)
    expect(rechargeGuard(1_000, 5_000, 8_000).ok).toBe(false)
    expect(rechargeGuard(1_000, 5_000, 20_000).ok).toBe(true)
    expect(rechargeGuard(MONEY_CAP, 0, 99_000).ok).toBe(false)
    const playing = rechargeGuard(0, 0, 1_000, true)
    expect(playing.ok).toBe(false)
    if (!playing.ok) expect(playing.message).toContain('대국 중')
  })

  it('비차례 입력은 거절되고, 기권 종료 뒤에는 재대국 선을 정할 수 있다', () => {
    expect(mayAct(1, 0)).toBe(false)
    expect(mayAct(0, 0)).toBe(true)
    let cleared = false
    const actor = 0
    const deciderSeat = 1
    if (mayAct(deciderSeat, actor)) cleared = true
    expect(cleared).toBe(false)
    const state = sandbox()
    state.nagariMul = 4
    const closed = closeByForfeit(state, 1, 1000)
    expect(closed.phase).toBe('ended')
    expect(closed.end?.kind).toBe('stop')
    expect(closed.end?.winner).toBe(1)
    expect(nextRound(closed)).toEqual({ seon: 1, nagariMul: 1 })
  })

  it('패자의 국진을 쌍피로 보면 피박을 피한다', () => {
    const pi = CARD_LIST.filter((card) => card.pi === 1).map((card) => card.id)
    const winner = [...pi.slice(0, 10), ...HONG, ...GWANGS.slice(0, 3)]
    const escape = settle(baseInput({ captured: [winner, [...pi.slice(10, 16), 'm09-yeol']], gukjinAsPi: [false, false] }))
    expect(escape.piLoser).toBe(8)
    expect(escape.factors.some((factor) => factor.id === 'pi')).toBe(false)
    const still = settle(baseInput({ captured: [winner, [...pi.slice(10, 15), 'm09-yeol']], gukjinAsPi: [false, false] }))
    expect(still.piLoser).toBe(5)
    expect(still.factors.some((factor) => factor.id === 'pi')).toBe(true)
    const zero = settle(baseInput({ captured: [winner, ['m09-yeol']], gukjinAsPi: [false, false] }))
    expect(zero.piLoser).toBe(0)
    expect(zero.factors.some((factor) => factor.id === 'pi')).toBe(false)
  })

  it('고 단계와 턴 제한, 타임아웃 두 번이면 자동이다', () => {
    expect(goIntensity(1)).toBe(1)
    expect(goIntensity(2)).toBe(2)
    expect(goIntensity(3)).toBe(3)
    expect(goIntensity(4)).toBe(4)
    expect(goIntensity(6)).toBe(5)
    expect(PLAY_LIMIT_MS).toBe(25_000)
    expect(limitForPhase('turn')).toBe(PLAY_LIMIT_MS)
    expect(limitForPhase('goStop')).toBe(CHOICE_LIMIT_MS)
    expect(limitForPhase('choose')).toBe(CHOICE_LIMIT_MS)
    expect(registerTimeout(0)).toEqual({ streak: 1, auto: false })
    expect(registerTimeout(1)).toEqual({ streak: 2, auto: true })
    expect(allowHumanTurnTimeout('ai', false)).toBe(false)
    expect(allowHumanTurnTimeout('pvp', true)).toBe(false)
    expect(allowHumanTurnTimeout('pvp', false)).toBe(true)

    const state = sandbox()
    state.phase = 'goStop'
    state.players[0].captured = [...GWANGS]
    state.players[0].hand = ['m02-pi1']
    state.players[1].hand = ['m04-pi1']
    expect(timeoutAction(state, 0)).toEqual({ type: 'stop' })

    const choice = sandbox()
    choice.phase = 'choose'
    choice.pending = { playedId: 'm06-pi2', options: ['m06-pi1', 'm06-yeol'] }
    choice.players[0].hand = ['m03-pi1']
    choice.players[1].hand = ['m04-pi1']
    const picked = timeoutAction(choice, 0)
    expect(picked.type).toBe('choose')
    if (picked.type === 'choose') expect(['m06-pi1', 'm06-yeol']).toContain(picked.cardId)
  })
})

describe('AI 대국', () => {
  it('여러 판을 규칙 위반 없이 끝낸다', () => {
    for (let seed = 1; seed <= 24; seed++) {
      let state = createGame({ seed, pointValue: 1000, nagariMul: seed % 3 === 0 ? 2 : 1 }).state
      expect(conserved(state)).toBe(true)
      let guard = 0
      while (state.phase !== 'ended' && guard++ < 300) {
        const seat = (state.phase === 'chongtong' ? state.chongtongQueue[0] : state.turn) as Seat
        const action = chooseAiAction(state, seat)
        const legal = legalActions(state, seat)
        expect(legal.some((a) => JSON.stringify(a) === JSON.stringify(action))).toBe(true)
        const next = applyAction(state, seat, action)
        expect(next.ok, !next.ok ? next.error : '').toBe(true)
        if (!next.ok) break
        state = next.state
        expect(conserved(state)).toBe(true)
      }
      expect(state.phase).toBe('ended')
      if (state.end?.settlement) {
        expect(state.end.settlement.points).toBeGreaterThan(0)
        expect(state.end.settlement.money).toBe(state.end.settlement.points * state.pointValue)
      }
    }
  })

  it('AI 수는 항상 적용된다', () => {
    const { state } = createGame({ seed: 7 })
    const seat = state.turn
    expect(applyAi(state, seat).ok).toBe(true)
  })
})

describe('낮일밤장 선 뽑기 (KST)', () => {
  it('KST 낮(06~18시)은 작은 월, 밤(18~06시)은 큰 월이 선이 되고 동월은 tie다', () => {
    // 2026-11-26 10:00 KST (01:00 UTC) -> 낮
    expect(isDaytimeKst(Date.UTC(2026, 10, 26, 1, 0, 0))).toBe(true)
    // 2026-11-26 21:00 KST (12:00 UTC) -> 밤
    expect(isDaytimeKst(Date.UTC(2026, 10, 26, 12, 0, 0))).toBe(false)
    expect(judgeSeon('m01-gwang', 'm12-gwang', true)).toBe(0)
    expect(judgeSeon('m01-gwang', 'm12-gwang', false)).toBe(1)
    expect(judgeSeon('m03-gwang', 'm03-pi1', true)).toBe('tie')
    const pool = dealSeonPool(42)
    expect(pool).toHaveLength(6)
    expect(new Set(pool).size).toBe(6)
  })
})

describe('v0.5 물리 연출 페이로드', () => {
  it('뻑 이벤트와 view.ppuks에 포개진 3장 cardIds가 실린다', async () => {
    const { viewFor } = await import('./view')
    const state = sandbox()
    state.floor = ['m01-pi1', 'm08-pi1']
    state.players[0].hand = ['m01-pi2', 'm02-pi1']
    state.players[1].hand = ['m04-pi1']
    state.deck = ['m01-tti', 'm06-pi1']
    const r = must(applyAction(state, 0, { type: 'play', cardId: 'm01-pi2' }))
    const ev = r.events.find((e) => e.type === 'ppuk')
    expect(ev && ev.type === 'ppuk' ? [...(ev.cardIds ?? [])].sort() : []).toEqual(['m01-pi1', 'm01-pi2', 'm01-tti'])
    const v = viewFor(r.state, 1)
    expect([...(v.ppuks[0].cards ?? [])].sort()).toEqual(['m01-pi1', 'm01-pi2', 'm01-tti'])
  })

  it('폭탄 이벤트는 손에서 내는 3장(handIds)과 바닥 목표패(floorIds)를 분리한다', () => {
    const s = sandbox()
    s.players[0].hand = ['m04-yeol', 'm04-tti', 'm04-pi1', 'm03-pi1']
    s.players[1].hand = ['m05-pi1']
    s.floor = ['m04-pi2', 'm08-pi1']
    s.deck = ['m06-pi1']
    const r = must(applyAction(s, 0, { type: 'bomb', month: 4 }))
    const ev = r.events.find((e) => e.type === 'bomb')
    if (!ev || ev.type !== 'bomb') throw new Error('bomb event missing')
    expect(ev.handIds).toEqual(['m04-yeol', 'm04-tti', 'm04-pi1'])
    expect(ev.floorIds).toEqual(['m04-pi2'])
    expect(ev.cardIds).toEqual([...ev.handIds!, ...ev.floorIds!])
  })
})

describe('v0.5.1 중간 기권 (forfeit)', () => {
  it('상대 차례·고/스톱 중에도 기권하면 즉시 상대 기권승, max(7, 상대 점수) × 점당 정산, 중복 기권은 거절', () => {
    const { state } = createGame({ seed: 7 })
    const quitter: Seat = decider(state) === 0 ? 1 : 0 // 차례가 아닌 쪽이 기권
    const res = applyAction(state, quitter, { type: 'forfeit' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const winner = (1 - quitter) as Seat
    expect(res.state.phase).toBe('ended')
    expect(res.state.end?.kind).toBe('forfeit')
    expect(res.state.end?.winner).toBe(winner)
    const bill = res.state.end?.settlement
    expect(bill?.points).toBe(Math.max(7, breakdown(state.players[winner].captured, state.players[winner].gukjinAsPi).total))
    expect(bill?.money).toBe((bill?.points ?? 0) * state.pointValue)
    expect(bill?.factors).toEqual([])
    expect(res.events.some((e) => e.type === 'forfeit' && e.player === quitter && e.winner === winner)).toBe(true)
    expect(applyAction(res.state, winner, { type: 'forfeit' }).ok).toBe(false)
    expect(nextRound(res.state).seon).toBe(winner)

    // 상대가 이미 7점을 넘겼으면 그 점수로 정산 (고/스톱 선택 중 기권)
    const big = structuredClone(state) as GameState
    const gwangs = CARD_LIST.filter((c) => c.kind === 'gwang').map((c) => c.id)
    big.players[0].captured = [...gwangs]
    big.players[0].hand = big.players[0].hand.filter((id) => !gwangs.includes(id))
    big.players[1].hand = big.players[1].hand.filter((id) => !gwangs.includes(id))
    big.floor = big.floor.filter((id) => !gwangs.includes(id))
    big.deck = big.deck.filter((id) => !gwangs.includes(id))
    big.phase = 'goStop'
    big.turn = 0
    const score = breakdown(big.players[0].captured, false).total
    expect(score).toBeGreaterThan(7)
    const r2 = applyAction(big, 1, { type: 'forfeit' })
    expect(r2.ok && r2.state.end?.settlement?.points).toBe(score)
  })
})
