import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BETS, CARDS, GUKJIN_ID } from '../engine/cards'
import { goIntensity } from '../engine/score'
import type { Action, GameEvent, Seat } from '../engine/types'
import { CHARACTER_LINES, EMOTES, type Mood } from '../shared/cast'
import { audio } from './audio'
import { bannerFor, HwatuCard, Impact, monthLabel, soundFor, won } from './bits'
import { SoundIcons } from './lobby'
import { Portrait } from './characters'
import type { EmoteMsg, RoomInfo, Showdown, TablePacket } from './model'
import { Button } from './ui'
import { WuxiaEffectsEngine, preloadWuxiaArt, WUXIA_SPRITES } from './wuxia/wuxiaEffects'
import { CardPhysics } from './wuxia/cardPhysics'
import { playWuxiaForEvent, resolveWuxia, type GenericGameEvent } from './wuxia/eventAdapter'
import './wuxia/wuxiaEffects.css'

function wait(ms: number) {
  const reduce = document.body.classList.contains('calm') || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return new Promise((resolve) => window.setTimeout(resolve, reduce ? Math.min(120, ms) : ms))
}

function sortHand(ids: string[]) {
  const order = { gwang: 0, yeol: 1, tti: 2, pi: 3, bonus: 4 }
  return [...ids].sort((a, b) => {
    const ca = CARDS[a]
    const cb = CARDS[b]
    if (!ca) return 1
    if (!cb) return -1
    if (ca.month !== cb.month) return ca.month - cb.month
    return order[ca.kind] - order[cb.kind]
  })
}

function groups(ids: string[]) {
  return {
    gwang: ids.filter((id) => CARDS[id]?.kind === 'gwang'),
    yeol: ids.filter((id) => CARDS[id]?.kind === 'yeol'),
    tti: ids.filter((id) => CARDS[id]?.kind === 'tti'),
    pi: ids.filter((id) => CARDS[id]?.kind === 'pi' || CARDS[id]?.kind === 'bonus'),
  }
}

/** v0.5.1 2장 선택 팝업용 패 종류 뱃지 */
function kindTag(id: string): { text: string; tone: string } {
  const c = CARDS[id]
  if (!c) return { text: '패', tone: 'pi' }
  if (c.kind === 'gwang') return { text: c.rain ? '비광' : '광', tone: 'gwang' }
  if (c.kind === 'yeol') return { text: c.godori ? '고도리·열' : c.gukjin ? '국진·열' : '열끗', tone: 'yeol' }
  if (c.kind === 'tti') {
    const g = c.ttiGroup
    return { text: g === 'hong' ? '홍단' : g === 'cheong' ? '청단' : g === 'cho' ? '초단' : '띠', tone: g === 'hong' ? 'hong' : g === 'cheong' ? 'cheong' : g === 'cho' ? 'cho' : 'tti' }
  }
  if (c.kind === 'bonus') return { text: c.pi >= 3 ? '쓰리피' : '보너스 쌍피', tone: 'ssang' }
  return c.pi >= 2 ? { text: '쌍피', tone: 'ssang' } : { text: '피', tone: 'pi' }
}

/** v0.5.1 바닥 패 크기 자동 맞춤: 바닥 영역(가로×세로)에 모든 더미가 한 장도 안 잘리게 들어가는 최대 카드 폭 */
function fitFloorWidth(W: number, H: number, piles: { n: number; ppuk: boolean }[], max: number) {
  if (W <= 0 || H <= 0 || piles.length === 0) return max
  for (let cw = max; cw >= 18; cw -= 1) {
    const gx = Math.round(cw * 0.2)
    const gy = Math.round(cw * 0.16)
    const ch = cw * 1.63 + 6
    let rows = 1
    let x = 0
    for (const p of piles) {
      const w = (p.ppuk ? cw * (1 + 0.28 * Math.max(0, p.n - 1)) + 8 : cw * (1 + 0.42 * Math.max(0, p.n - 1))) + 4
      if (x > 0 && x + gx + w > W) { rows += 1; x = w } else x += (x > 0 ? gx : 0) + w
    }
    if (rows * ch + (rows - 1) * gy <= H) return cw
  }
  return 18
}

function lineOf(avatarId: string, key: string, fallback: string) {
  return CHARACTER_LINES[avatarId]?.[key] ?? fallback
}

function speech(ev: GameEvent, avatarId = 'bokman'): { who: Seat; text: string; mood: Mood } | null {
  switch (ev.type) {
    case 'jjok': return { who: ev.player, text: lineOf(avatarId, 'jjok', '쪽! 피 한 장 내놔.'), mood: 'cheer' }
    case 'ttadak': return { who: ev.player, text: lineOf(avatarId, 'ttadak', '따닥이다!'), mood: 'cheer' }
    case 'ppuk': return { who: ev.player, text: lineOf(avatarId, 'ppuk', ev.combo >= 2 ? '또 뻑이야?!' : '아, 뻑!'), mood: 'shock' }
    case 'ownPpuk': return { who: ev.player, text: '자뻑! 피 두 장!', mood: 'smug' }
    case 'eatPpuk': return { who: ev.player, text: '그 뻑, 내가 먹는다.', mood: 'smug' }
    case 'four': return { who: ev.player, text: '네 장 다 가져간다.', mood: 'cheer' }
    case 'sweep': return { who: ev.player, text: lineOf(avatarId, 'sweep', '바닥을 쓸어 담지!'), mood: 'cheer' }
    case 'bomb': return { who: ev.player, text: lineOf(avatarId, 'bomb', '폭탄이다!'), mood: 'angry' }
    case 'shake': return { who: ev.player, text: `${monthLabel(ev.month)}, 흔든다.`, mood: 'smug' }
    case 'go': return { who: ev.player, text: lineOf(avatarId, 'go', `${ev.count}고!`), mood: 'smug' }
    case 'stop': return { who: ev.player, text: lineOf(avatarId, 'stop', ev.auto ? '낼 패가 없어 스톱.' : '스톱!'), mood: 'happy' }
    case 'mission': return { who: ev.player, text: `${ev.title}, 됐다!`, mood: 'cheer' }
    case 'yaku': return { who: ev.player, text: `${ev.title}!`, mood: 'cheer' }
    case 'bak': return { who: ev.player, text: ev.kind === 'pi' ? '피박!' : ev.kind === 'gwang' ? '광박!' : ev.kind === 'meong' ? '멍따!' : '고박!', mood: 'cheer' }
    case 'steal': return { who: ev.from, text: ev.cardIds.length ? '내 피…!' : '피가 없어서 빚이다.', mood: ev.cardIds.length ? 'angry' : 'sad' }
    case 'chongtong': return { who: ev.player, text: '총통!', mood: 'cheer' }
    case 'firstPpuk': return { who: ev.player, text: lineOf(avatarId, 'firstPpuk', '첫뻑! +7점!'), mood: 'cheer' }
    case 'doublePpuk': return { who: ev.player, text: lineOf(avatarId, 'doublePpuk', '연뻑! +14점!'), mood: 'cheer' }
    case 'triple': return { who: ev.player, text: '세 번이야. 내 판이다!', mood: 'cheer' }
    case 'forfeit': return { who: ev.player, text: lineOf(avatarId, 'surrender', '이 판은 접겠소.'), mood: 'sad' }
    case 'nagari': return null
    default: return null
  }
}

function useCount(target: number, run: boolean) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!run) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1100)
      setValue(Math.round(target * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    audio.play('coin')
    const coins = window.setInterval(() => audio.play('coin'), 220)
    const stop = window.setTimeout(() => window.clearInterval(coins), 1100)
    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(coins)
      window.clearTimeout(stop)
    }
  }, [target, run])
  return value
}

function Bill({
  showdown,
  you,
  oppReady,
  onRematch,
  onLeave,
  onBet,
  host,
  bet,
  purse,
  broke,
  onRecharge,
}: {
  showdown: Showdown
  you: Seat
  oppReady: boolean
  host: boolean
  bet: number
  onRematch: () => void
  onLeave: () => void
  onBet: (bet: number) => void
  purse: number
  broke: boolean
  onRecharge: () => void
}) {
  const [step, setStep] = useState(0)
  const stamped = useRef(-1)
  const win = showdown.winner === you
  useEffect(() => {
    if (step <= stamped.current) return
    if (step >= 2 && step < 2 + showdown.factors.length) {
      audio.play('seal')
      audio.play('coin')
    }
    // 대박 팡파레는 본인이 정상 승리했을 때만. 기권·패배 화면에서는 절대 재생하지 않는다.
    if (step === showdown.factors.length + 2 && win && !showdown.forfeit) audio.play('jackpot')
    stamped.current = step
  }, [step, showdown.factors.length, win, showdown.forfeit])
  useEffect(() => {
    // 기권 정산은 이미 이벤트 루프에서 surrender() 징을 1회 울렸으므로 win/lose를 겹치지 않게 생략한다.
    if (!showdown.forfeit) {
      audio.play(showdown.nagari ? 'nagari' : win ? 'win' : 'lose')
    }
    const timer = window.setInterval(() => setStep((s) => s + 1), 350)
    return () => window.clearInterval(timer)
  }, [showdown, you, win])
  const goOn = step >= 1
  const shownBase = showdown.base + (goOn ? showdown.goBonus : 0)
  let mul = 1
  showdown.factors.forEach((factor, index) => {
    if (step >= index + 2) mul *= factor.mul
  })
  const points = shownBase * mul
  const moneyOn = step >= showdown.factors.length + 2
  const counted = useCount(showdown.paid, moneyOn && !showdown.nagari)
  return (
    <div className="bill">
      {moneyOn && !showdown.nagari && win && !showdown.forfeit && (
        <div className="coins wx-coin-art" aria-hidden>
          {/* v0.5: 노란 CSS 원 대신 실제 그린 엽전 일러스트 분수 */}
          <img className="c0" src={WUXIA_SPRITES['coin-jackpot']} alt="" draggable={false} />
          <img className="c1" src={WUXIA_SPRITES['coin-jackpot']} alt="" draggable={false} />
          <img className="c2" src={WUXIA_SPRITES['coin-jackpot']} alt="" draggable={false} />
        </div>
      )}
      <div className="bill-hero">
        <p className="eyebrow">{showdown.nagari ? '무승부' : win ? '승리' : '패배'}</p>
        <h2>{showdown.forfeit && showdown.forfeitBy !== undefined ? (win ? '기권승' : '기권패') : showdown.title}</h2>
        <p className="bill-sub">{showdown.forfeit && showdown.forfeitBy !== undefined ? (win ? '상대가 중간에 기권했습니다 · max(7점, 내 점수)로 정산' : '중간에 기권했습니다 · max(7점, 상대 점수)로 정산') : showdown.subtitle}</p>
        {!showdown.nagari && showdown.factors.length > 0 && (
          <div className="bill-stamps" aria-label="배수 도장">
            {showdown.factors.map((factor, index) => (
              <span key={factor.id} className={`${step >= index + 2 ? 'on stamp' : ''} bak-${factor.id}`}>{factor.label} <b>×{factor.mul}</b></span>
            ))}
          </div>
        )}
        {!showdown.nagari && (
          <p className={`bill-payout${moneyOn ? ' on' : ''}`}>
            <b>{won(counted)}원</b>
            <span>{points}점</span>
          </p>
        )}
      </div>
      <div className="bill-side">
        <div className="bill-body">
          {!showdown.nagari && (
            <ol>
              <li className={step >= 0 ? 'on' : ''}>기본 점수 <b>{showdown.base}점</b></li>
              {showdown.goBonus > 0 && <li className={goOn ? 'on' : ''}>고 보너스 <b>+{showdown.goBonus}</b></li>}
              {showdown.factors.map((factor, index) => (
                <li key={factor.id} className={`${step >= index + 2 ? 'on stamp' : ''} bak-${factor.id}`}>{factor.label} <b>×{factor.mul}</b></li>
              ))}
              <li className={moneyOn ? 'on' : ''}>점수 <b>{points}점</b></li>
              <li className={moneyOn ? 'on' : ''}>{win ? '받은 돈' : '잃은 돈'} <b>{won(counted)}원</b></li>
            </ol>
          )}
          {showdown.details.length > 0 && (
            <p className="details">{showdown.details.map((d) => `${d.label} ${d.points}`).join(' · ')}</p>
          )}
          {showdown.money > showdown.paid && !showdown.nagari && <p>상대가 가진 금액만큼 정산했습니다.</p>}
          {host && (
            <div className="bets slim">
              {BETS.map((b) => (
                <button key={b.value} type="button" className={bet === b.value ? 'on' : ''} onClick={() => onBet(b.value)}>점당 {b.label}</button>
              ))}
            </div>
          )}
          <p>보유 {won(purse)}원</p>
          {broke && <p>보유금이 점당 금액보다 적습니다. 무료 충전으로 이어서 두세요.</p>}
        </div>
        <div className="actions">
          <Button size="lg" variant="ink" onClick={onRecharge}>무료 충전 +100만</Button>
          <Button size="lg" onClick={onRematch}>{oppReady ? '상대가 기다리는 중 · 한 판 더' : '한 판 더'}</Button>
          <Button size="lg" variant="ghost" onClick={onLeave}>나가기</Button>
        </div>
      </div>
    </div>
  )
}

function CaptureStrip({ ids, piCount, gukjin, side }: { ids: string[]; piCount: number; gukjin: boolean; side: 'you' | 'opp' }) {
  const g = groups(ids)
  const rows: { key: string; title: string; ids: string[]; count: string }[] = [
    { key: 'gwang', title: '광', ids: g.gwang, count: `${g.gwang.length}` },
    { key: 'yeol', title: '열', ids: g.yeol, count: gukjin ? `${g.yeol.length}·국진피` : `${g.yeol.length}` },
    { key: 'tti', title: '띠', ids: g.tti, count: `${g.tti.length}` },
    { key: 'pi', title: '피', ids: g.pi, count: `${piCount}` },
  ]
  return (
    <div className={`wx-caps wx-caps-${side}`} data-captures={side} aria-label={side === 'you' ? '내가 먹은 패' : '상대가 먹은 패'}>
      {rows.map((row) => (
        <div key={row.key} className={`wx-cap-row cap-${row.key}${row.ids.length ? ' has' : ''}`}>
          <b>{row.title}</b>
          <div className="wx-cap-stack" style={{ ['--d' as string]: String(Math.max(1, row.ids.length - 1)) }}>
            {row.ids.map((id) => <HwatuCard key={id} id={id} mini />)}
          </div>
          <span>{row.count}</span>
        </div>
      ))}
    </div>
  )
}

export function Table({
  room,
  packet,
  emote,
  onAction,
  onEmote,
  onRematch,
  onLeave,
  onBet,
  onRecharge,
  onAuto,
  onArmed,
}: {
  room: RoomInfo
  packet: TablePacket
  emote: EmoteMsg | null
  onAction: (action: Action) => void
  onEmote: (id: string) => void
  onRematch: () => void
  onLeave: () => void
  onBet: (bet: number) => void
  onRecharge: () => void
  onAuto: (on: boolean) => void
  onArmed: () => void
}) {
  const { view } = packet
  const seen = useRef(new Set<number>())
  const [ready, setReady] = useState(false)
  const [impact, setImpact] = useState<ReturnType<typeof bannerFor>>(null)
  const [nonce, setNonce] = useState(0)
  const [shake, setShake] = useState(false)
  const [hidden, setHidden] = useState<string[]>([])
  const stageRef = useRef<HTMLDivElement | null>(null)
  const phys = useRef<CardPhysics | null>(null)
  const [bubble, setBubble] = useState<{ who: Seat; text: string; mood: Mood } | null>(null)
  const bubbleTimer = useRef(0)
  const prevPhaseRef = useRef(view.phase)
  const hadShowdownRef = useRef(!!packet.showdown)
  const prevGamesRef = useRef(room.games)

  const clearBubbles = () => {
    if (bubbleTimer.current) {
      window.clearTimeout(bubbleTimer.current)
      bubbleTimer.current = 0
    }
    setBubble(null)
  }

  // 새 판(한 판 더) 시작 시 이전 판 기권/대사 말풍선이 바닥에 남지 않게 즉시 초기화
  useEffect(() => {
    const leftOver = prevPhaseRef.current === 'ended' && (view.phase === 'chongtong' || view.phase === 'turn' || view.phase === 'choose' || view.phase === 'goStop')
    const newGame = prevGamesRef.current !== room.games
    prevPhaseRef.current = view.phase
    prevGamesRef.current = room.games
    if (leftOver || newGame) clearBubbles()
  }, [view.phase, room.games])

  useEffect(() => {
    if (hadShowdownRef.current && !packet.showdown) clearBubbles()
    hadShowdownRef.current = !!packet.showdown
  }, [packet.showdown])
  const [, setHit] = useState<'kung' | 'jjak' | null>(null)
  const [tick, setTick] = useState(Date.now())
  const [focusMonth, setFocusMonth] = useState<number | null>(null)
  const [emoteOpen, setEmoteOpen] = useState(false)
  const warned = useRef(-1)
  const fx = useRef<WuxiaEffectsEngine | null>(null)
  const floorRef = useRef<HTMLDivElement | null>(null)
  const [floorCw, setFloorCw] = useState<number | null>(null)
  const scoreRef = useRef<{ you: number; opp: number } | null>(null)
  const [qaChoose, setQaChoose] = useState<{ playedId: string; options: string[] } | null>(null)
  const chooseOpenRef = useRef(false)
  const [confirmForfeit, setConfirmForfeit] = useState(false)

  // v0.5: 실물 화투 물리 모션 엔진 (DOM 좌표 기반 오버레이 비행, pointer-events: none)
  useEffect(() => {
    preloadWuxiaArt()
    const p = new CardPhysics(() => stageRef.current)
    phys.current = p
    const onResize = () => p.snapshot()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      p.destroy()
      if (phys.current === p) phys.current = null
    }
  }, [])

  // 연출 배치가 끝나면 현재 카드 좌표를 기억 (다음 배치의 출발 좌표)
  useEffect(() => {
    if (!ready) return
    const id = requestAnimationFrame(() => phys.current?.snapshot())
    return () => cancelAnimationFrame(id)
  }, [ready, packet.id])

  // v0.4.2: 무협 초식 이펙트 엔진 (모든 레이어 pointer-events: none)
  useEffect(() => {
    const engine = new WuxiaEffectsEngine(document.body)
    fx.current = engine
    // QA 훅: 실서버 검증 스크립트가 컷인을 직접 재생해 볼 수 있게 노출 (읽기 전용 연출 엔진)
    ;(window as unknown as { __dalbitFx?: WuxiaEffectsEngine }).__dalbitFx = engine
    return () => {
      engine.destroy()
      if (fx.current === engine) fx.current = null
    }
  }, [])

  useEffect(() => {
    const level = Math.max(view.yourGo, view.oppGo)
    fx.current?.setGoLevel(level)
  }, [view.yourGo, view.oppGo])

  useEffect(() => {
    if (seen.current.has(packet.id)) return
    seen.current.add(packet.id)
    let cancel = false
    if (packet.events.some((ev) => ev.type === 'deal')) {
      if (bubbleTimer.current) {
        window.clearTimeout(bubbleTimer.current)
        bubbleTimer.current = 0
      }
      setBubble(null)
    }
    void (async () => {
      setReady(false)
      let playedId = ''
      const batch = packet.events as unknown as GenericGameEvent[]
      // v0.5: 이번 배치에서 날아올 카드는 착지 전까지 바닥/먹은 패 줄에서 숨김
      const incoming = new Set<string>()
      for (const ev of packet.events) {
        if (ev.type === 'play' || ev.type === 'flip' || ev.type === 'bonusPlay' || ev.type === 'bonusDraw') incoming.add(ev.cardId)
        if (ev.type === 'bomb') (ev.handIds ?? ev.cardIds).forEach((id) => incoming.add(id))
        if (ev.type === 'capture' || ev.type === 'steal' || ev.type === 'debtPay') ev.cardIds.forEach((id) => incoming.add(id))
      }
      const physics = phys.current
      const reveal = (ids: string[]) => setHidden((h) => h.filter((x) => !ids.includes(x)))
      setHidden(physics && packet.events.length ? [...incoming] : [])
      if (physics && packet.events.length) physics.beginBatch()
      const sideOf = (seat: number): 'you' | 'opp' => (seat === view.you ? 'you' : 'opp')
      for (const ev of packet.events) {
        if (cancel) return
        const gev = ev as unknown as GenericGameEvent
        const wx = resolveWuxia(gev, batch, { you: view.you })
        // 첫뻑·연뻑·삼연뻑과 같은 배치의 일반 ppuk은 컷인·사운드·배너 모두 스킵 (중복 발동 방지)
        if (wx.suppressed) continue
        const wxMs = fx.current ? playWuxiaForEvent(fx.current, gev, batch, { you: view.you }) : 0
        // 무협 붓글씨 컷인이 뜨는 이벤트는 기존 Impact 배너를 띄우지 않는다 (이중 컷인 방지)
        // v0.5: 피 뺏기는 실제 카드 비행으로 보여주므로 텍스트 배너 생략
        const banner = wx.cutin || (phys.current && (ev.type === 'steal' || ev.type === 'debtPay')) ? null : bannerFor(ev)
        const sound = soundFor(ev)
        const skipKung = ev.type === 'drop' && ev.cardId === playedId
        const physical = physics && (ev.type === 'play' || ev.type === 'flip' || ev.type === 'capture' || ev.type === 'steal' || ev.type === 'debtPay' || ev.type === 'bomb' || ev.type === 'bonusPlay' || ev.type === 'drop')
        if (sound && !skipKung && !physical) audio.play(sound)
        if (ev.type === 'play') {
          playedId = ev.cardId
          setHit('kung')
        } else if (ev.type === 'drop' && !skipKung) setHit('kung')
        else if (ev.type === 'capture' || ev.type === 'jjok' || ev.type === 'ttadak' || ev.type === 'four') setHit('jjak')
        if (ev.type === 'go') audio.setGoLevel(goIntensity(ev.count))
        if (ev.type === 'forfeit') audio.surrender()
        if (banner) {
          setImpact(banner)
          setNonce((n) => n + 1)
          setShake(true)
        }
        if (ev.type === 'deal') {
          if (bubbleTimer.current) {
            window.clearTimeout(bubbleTimer.current)
            bubbleTimer.current = 0
          }
          setBubble(null)
        }
        const speaker = room.seats.find((seat) => 'player' in ev && seat.seat === (ev as { player?: number }).player)
        const said = speech(ev, speaker?.avatarId ?? 'bokman')
        if (said) setBubble(said)
        // ── v0.5 실물 화투 물리 모션 ──
        let physMs = 0
        if (physics) {
          const t0 = performance.now()
          if (ev.type === 'play' || ev.type === 'bonusPlay') {
            const id = ev.cardId
            await physics.slam(id, sideOf(ev.player), (stack) => { audio.physics(stack ? 'attach' : 'slap'); reveal([id]) })
          } else if (ev.type === 'flip') {
            const id = ev.cardId
            await physics.slam(id, 'deck', (stack) => { audio.physics(stack ? 'attach' : 'slap'); reveal([id]) })
          } else if (ev.type === 'bomb') {
            const hand = ev.handIds ?? ev.cardIds.filter((id) => CARDS[id]?.month === ev.month).slice(0, 3)
            const floorIds = ev.floorIds ?? ev.cardIds.filter((id) => !hand.includes(id))
            audio.physics('bombTriple')
            await physics.bombTriple(hand, floorIds, sideOf(ev.player))
            reveal(hand)
          } else if (ev.type === 'capture') {
            audio.physics('sweep')
            await physics.captureSweep(ev.cardIds, sideOf(ev.player))
            reveal(ev.cardIds)
          } else if ((ev.type === 'steal' || ev.type === 'debtPay') && ev.cardIds.length) {
            const toSeat = ev.type === 'steal' ? ev.player : ev.to
            const fromSeat = ev.type === 'steal' ? ev.from : ev.player
            audio.physics('steal')
            await physics.stealPi(ev.cardIds, sideOf(fromSeat), sideOf(toSeat))
            reveal(ev.cardIds)
          } else if (ev.type === 'ppuk') {
            audio.physics('ppukStack')
            physics.ppukStack(ev.month)
          }
          physMs = performance.now() - t0
          if (cancel) return
        }
        const tier = ev.type === 'go' ? goIntensity(ev.count) : 0
        const base = ev.type === 'yaku' ? 1500 : tier >= 4 ? 1300 : tier === 3 ? 1100 : banner ? 920 : ev.type === 'deal' ? 620 : 280
        const physicalBase = physMs > 0 ? 90 : base
        const long = wx.cutin ? Math.max(physicalBase, Math.min(wxMs, 1900) - physMs) : physicalBase
        await wait(long)
        if (cancel) return
        setHit(null)
        if (banner) {
          setImpact(null)
          setShake(false)
        }
      }
      if (!cancel) {
        physics?.clearPins()
        setHidden([])
        setReady(true)
        // v0.5: 연출이 끝났음을 서버에 알림 (내 차례 → 시계 시작, AI 차례 → 즉시 진행; 상대 PvP 차례는 서버가 무시)
        if (view.phase !== 'ended') onArmed()
      }
    })()
    return () => {
      cancel = true
      // 연출 도중 새 패킷이 오면 남은 배너·핀·숨김을 즉시 정리 (화면에 배너가 남는 문제 방지)
      setImpact(null)
      setShake(false)
      phys.current?.clearPins()
    }
  }, [packet.id, view.you])

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!emote) return
    const found = EMOTES.find((item) => item.id === emote.id)
    if (!found) return
    setBubble({ who: emote.seat, text: found.text, mood: found.mood })
  }, [emote])

  const you = room.seats.find((s) => s.seat === view.you)
  const opp = room.seats.find((s) => s.seat !== view.you)
  const [forced, setForced] = useState(false)
  useEffect(() => {
    setForced(false)
    // 대형 컷인·카드 비행이 길어져도 입력이 막히지 않게 3.4초 뒤 강제 활성 + 서버에 준비 신호
    const timer = window.setTimeout(() => {
      setForced(true)
      if (view.decider === view.you && view.phase !== 'ended') onArmed()
    }, 3400)
    return () => window.clearTimeout(timer)
  }, [packet.id])
  const yourTurn = (ready || forced) && view.decider === view.you && !packet.showdown
  const ppukMonths = new Set(view.ppuks.map((p) => p.month))
  // v0.5: 같은 월 바닥패는 실제 화투판처럼 포개서 한 더미로 (뻑은 3장 부채꼴 스택)
  const floorPiles = (() => {
    const ids = [...view.floor, ...(view.pending && !view.floor.includes(view.pending.playedId) ? [view.pending.playedId] : [])]
    const piles: { key: string; month: number; ids: string[] }[] = []
    for (const id of ids) {
      const month = CARDS[id]?.month ?? 0
      const found = month > 0 ? piles.find((p) => p.month === month) : undefined
      if (found) found.ids.push(id)
      else piles.push({ key: `p-${id}`, month, ids: [id] })
    }
    // 뻑 더미는 서버가 준 포개진 순서(view.ppuks.cards) 그대로
    for (const p of view.ppuks) {
      const pile = piles.find((x) => x.month === p.month)
      if (pile && p.cards?.length) {
        const order = p.cards.filter((id) => pile.ids.includes(id))
        pile.ids = [...order, ...pile.ids.filter((id) => !order.includes(id))]
      }
    }
    return piles
  })()
  const playable = new Set(view.legal.flatMap((a) => (a.type === 'play' ? [a.cardId] : [])))
  const choices = new Set(view.legal.flatMap((a) => (a.type === 'choose' ? [a.cardId] : [])))
  const shakes = view.legal.filter((a) => a.type === 'shake')
  const bombs = view.legal.filter((a) => a.type === 'bomb')
  const hand = sortHand(view.yourHand)
  // v0.5.1 내 손패 ↔ 바닥 먹을 패 표시 (내 차례·패 낼 차례일 때만)
  const floorCount = new Map<number, number>()
  for (const id of view.floor) {
    const m = CARDS[id]?.month ?? 0
    if (m > 0) floorCount.set(m, (floorCount.get(m) ?? 0) + 1)
  }
  const handCount = new Map<number, number>()
  for (const id of view.yourHand) {
    const m = CARDS[id]?.month ?? 0
    if (m > 0) handCount.set(m, (handCount.get(m) ?? 0) + 1)
  }
  const bombMonths = new Set(bombs.flatMap((a) => (a.type === 'bomb' ? [a.month] : [])))
  const canMark = yourTurn && view.phase === 'turn'
  const matchOf = (id: string): { cls: string; badge: string; title: string } | null => {
    if (!canMark || !playable.has(id)) return null
    const c = CARDS[id]
    if (!c) return null
    if (c.kind === 'bonus') return { cls: 'matchable matchable-bonus', badge: '+', title: '보너스' }
    const f = floorCount.get(c.month) ?? 0
    if (!f) return null
    if (bombMonths.has(c.month) || ((handCount.get(c.month) ?? 0) >= 3 && f >= 1)) return { cls: 'matchable matchable-bomb', badge: '폭', title: '폭탄' }
    if (f === 2) return { cls: 'matchable matchable-multi', badge: '2', title: '2택' }
    return { cls: 'matchable', badge: '', title: '먹기' }
  }
  const matchMonths = new Set<number>(hand.filter((id) => matchOf(id) && CARDS[id]?.kind !== 'bonus').map((id) => CARDS[id]?.month ?? 0))
  // v0.5.1 2장 중 고르기 중앙 팝업
  const chooseOpen = Boolean(yourTurn && view.phase === 'choose' && view.pending && view.pending.player === view.you && choices.size > 0)
  const choosePanel = chooseOpen && view.pending
    ? { playedId: view.pending.playedId, options: view.pending.options.filter((id) => choices.has(id)), preview: false }
    : qaChoose ? { ...qaChoose, preview: true } : null
  const quad = (() => {
    const map = new Map<number, string[]>()
    for (const id of view.yourHand) {
      const month = CARDS[id]?.month
      if (!month) continue
      map.set(month, [...(map.get(month) ?? []), id])
    }
    for (const [month, ids] of map) if (ids.length >= 4) return { month, ids }
    return null
  })()
  const showBill = ready && packet.showdown
  const moodFor = (seat: Seat): Mood => {
    if (showBill && packet.showdown && !packet.showdown.nagari) {
      return packet.showdown.winner === seat ? 'cheer' : 'sad'
    }
    if (bubble?.who === seat) return bubble.mood
    if (view.decider === seat && view.phase === 'goStop') return 'think'
    return 'idle'
  }

  const goLevel = Math.max(view.yourGo, view.oppGo)
  const aura = goLevel >= 5 ? ' aura-5' : goLevel >= 4 ? ' aura-4' : goLevel >= 3 ? ' aura-3' : ''
  const skewRef = useRef(0)
  const stamp = room.serverNow ?? 0
  useEffect(() => {
    if (stamp) skewRef.current = stamp - Date.now()
  }, [stamp, room.clock?.deadlineAt])
  const clock = room.clock
  const remain = clock ? Math.max(0, clock.deadlineAt - (tick + skewRef.current)) : 0
  const reconnectLeft = room.reconnectUntil ? Math.max(0, room.reconnectUntil - (tick + skewRef.current)) : 0
  const mine = room.seats.find((s) => s.seat === room.you)
  const second = Math.ceil(remain / 1000)
  if (clock && clock.seat === view.you && second > 0 && second <= 5 && second !== warned.current) {
    warned.current = second
    audio.play('tick')
  }
  if (!clock) warned.current = -1

  // v0.5.1 점수 날 때마다 효과음 (연출 배치가 끝나 화면 점수가 바뀌는 순간)
  useEffect(() => {
    if (!ready) return
    const now = { you: view.youScore.total, opp: view.oppScore.total }
    const prev = scoreRef.current
    scoreRef.current = now
    if (!prev) return
    if (now.you > prev.you) audio.scoreUp(now.you, true)
    if (now.opp > prev.opp) window.setTimeout(() => audio.scoreUp(now.opp, false), now.you > prev.you ? 200 : 0)
  }, [ready, packet.id, view.youScore.total, view.oppScore.total])

  // v0.5.1 2장 선택 팝업 열릴 때 UI 클릭음
  const choosePanelOpen = Boolean(choosePanel)
  useEffect(() => {
    if (choosePanelOpen && !chooseOpenRef.current) audio.uiClick()
    chooseOpenRef.current = choosePanelOpen
  }, [choosePanelOpen])

  // v0.5.1 QA 훅: 실서버 검증에서 2장 선택 팝업 모양만 미리보기 (액션 전송 없음)
  useEffect(() => {
    const w = window as unknown as { __dalbitQa?: Record<string, unknown> }
    w.__dalbitQa = {
      ...(w.__dalbitQa ?? {}),
      previewChoose: (options?: string[]) => {
        const ids = options && options.length === 2 ? options : ['m08-yeol', 'm08-pi1']
        setQaChoose({ playedId: ids[0], options: ids })
      },
      closeChoose: () => setQaChoose(null),
    }
  }, [])

  // v0.5.1 바닥 패 크기 자동 맞춤 (좁은 실기기 높이에서도 바닥 패가 미션·손패와 안 겹치고 안 잘림)
  const pileKey = floorPiles.map((p) => `${p.month}:${p.ids.length}:${p.month > 0 && ppukMonths.has(p.month) ? 1 : 0}`).join(',')
  useLayoutEffect(() => {
    const el = floorRef.current
    if (!el) return
    const run = () => {
      const row = el.parentElement
      const H = (row?.clientHeight ?? el.clientHeight) - 8
      const W = el.clientWidth - 8
      const max = Math.max(30, Math.min(64, Math.floor((window.innerHeight || 400) * 0.14)))
      const piles = floorPiles.map((p) => ({ n: p.ids.length, ppuk: p.month > 0 && ppukMonths.has(p.month) }))
      const cw = fitFloorWidth(W, H, piles, max)
      setFloorCw((old) => (old === cw ? old : cw))
    }
    run()
    const ro = new ResizeObserver(run)
    ro.observe(el)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [pileKey])

  return (
    <div ref={stageRef} className={`stage v05-mat${shake ? ' rumble' : ''}${aura}${goLevel >= 4 ? ' quake' : ''}`}>
      {hidden.length > 0 && (
        <style>{hidden.map((id) => `.stage .floor [data-card="${id}"], .stage .wx-caps [data-card="${id}"]`).join(',') + '{visibility:hidden!important}'}</style>
      )}
      <header className="topbar slim">
        <div className="brand">달빛맞고</div>
        <div className="stat">
          {room.nagariMul > 1 && <em>나가리 ×{room.nagariMul}</em>}
          <span>점당 {won(room.bet)}원</span>
          {view.consecutivePpuk > 0 && <span>연속 뻑 {view.consecutivePpuk}</span>}
          <button type="button" className={mine?.auto ? 'auto on' : 'auto'} onClick={() => onAuto(!mine?.auto)}>
            {mine?.auto ? '자동치기 켜짐' : '자동치기'}
          </button>
          {view.phase !== 'ended' && !packet.showdown && (
            <button type="button" className="auto forfeit-btn" onClick={() => { audio.uiClick(); setConfirmForfeit(true) }}>
              기권
            </button>
          )}
          <button
            type="button"
            className={document.body.classList.contains('calm') ? 'auto on' : 'auto'}
            onClick={() => {
              const next = !document.body.classList.contains('calm')
              document.body.classList.toggle('calm', next)
              localStorage.setItem('dalbit-calm', next ? '1' : '0')
            }}
          >
            연출↓
          </button>
        </div>
        <SoundIcons />
      </header>
      <div className="shell">
        <div className={`felt${aura}`}>
          <div className="board">
            <div className={`player top${view.decider === (view.you === 0 ? 1 : 0) ? ' live-seat' : ''}`}>
              <div className="who">
                <Portrait id={opp?.avatarId ?? 'hwang'} mood={moodFor((view.you === 0 ? 1 : 0) as Seat)} />
                <div>
                  <b>{opp?.nickname || '상대'}</b>
                  <span>{opp?.connected ? `${won(opp.money)}원` : '접속이 끊겼습니다'}</span>
                  <strong className="wx-score" data-score="opp">{view.oppScore.total}<small>점</small>{view.oppGo > 0 && <em className="wx-go">{view.oppGo}고</em>}</strong>
                </div>
                {bubble?.who !== view.you && bubble && <p className="bubble">{bubble.text}</p>}
              </div>
              {(view.oppScore.piCount > 0 && view.oppScore.piCount <= 7 && view.youScore.total >= 7) && <em className="warn">상대 피박 위기</em>}
              <CaptureStrip ids={view.opponentCapture} piCount={view.oppScore.piCount} gukjin={view.oppGukjin} side="opp" />
              <div className="hand opp">
                {view.opponentRevealed.map((id) => <HwatuCard key={id} id={id} mini />)}
                {Array.from({ length: Math.max(0, view.opponentHandCount - view.opponentRevealed.length) }, (_, i) => (
                  <HwatuCard key={`b${i}`} back mini />
                ))}
              </div>
            </div>

            <div className="middle">
              {clock && (
                <div className={`timer${remain < 3000 ? ' danger' : ''}`}>
                  <span>{clock.seat === view.you ? '내 차례' : '상대 차례'} {Math.ceil(remain / 1000)}초</span>
                  <i style={{ width: `${Math.min(100, (remain / Math.max(1, clock.limitMs)) * 100)}%` }} />
                </div>
              )}
              {room.disconnectedSeat !== null && room.disconnectedSeat !== undefined && room.reconnectUntil && (
                <div className="reconnect">상대 재접속 대기 {Math.ceil(reconnectLeft / 1000)}초</div>
              )}
              <div className={`mission${view.missionYou || view.missionOpp ? ' done' : ''}`}>
                <em>미션</em>
                <b>{view.mission.title}</b>
                <span>{view.mission.desc}</span>
                <i>{view.missionProgress.current}/{view.missionProgress.target}</i>
              </div>
              <div className="center-row">
                <button type="button" className="deck" aria-label={`더미 ${view.deckCount}장`} data-layers={Math.min(6, Math.max(1, Math.ceil(view.deckCount / 4)))}>
                  {Array.from({ length: Math.min(6, Math.max(1, Math.ceil(view.deckCount / 4))) }, (_, i) => (
                    <HwatuCard key={i} back />
                  ))}
                  <span>{view.deckCount}</span>
                </button>
                <div
                  ref={floorRef}
                  className="floor"
                  data-dense={floorPiles.length >= 9 ? '1' : undefined}
                  style={floorCw ? { ['--cw' as string]: `${floorCw}px` } : undefined}
                >
                  {floorPiles.map((pile) => {
                    const ppuk = pile.month > 0 && ppukMonths.has(pile.month)
                    return (
                      <div
                        key={pile.key}
                        className={`pile${ppuk ? ' ppuk-stack' : ''}${pile.ids.length > 1 ? ' paired' : ''}`}
                        data-month={pile.month || undefined}
                        data-n={pile.ids.length}
                      >
                        {pile.ids.map((id, i) => (
                          <HwatuCard
                            key={id}
                            id={id}
                            hot={(focusMonth !== null && pile.month === focusMonth) || id === view.pending?.playedId}
                            extra={matchMonths.has(pile.month) && !choices.has(id) ? 'floor-match-hint' : undefined}
                            pick={choices.has(id)}
                            onClick={choices.has(id) && yourTurn ? () => onAction({ type: 'choose', cardId: id }) : undefined}
                            label={ppuk && i === pile.ids.length - 1 ? '뻑' : undefined}
                          />
                        ))}
                      </div>
                    )
                  })}
                  {view.floor.length === 0 && !view.pending && <p className="floor-empty">바닥이 비었습니다</p>}
                </div>
              </div>
              {view.phase === 'goStop' && view.decider !== view.you && <p className="hint">상대가 고와 스톱을 저울질합니다</p>}
              {(shakes.length > 0 || bombs.length > 0) && yourTurn && (
                <div className="specials">
                  {shakes.map((a) => a.type === 'shake' && (
                    <Button key={a.month} size="sm" variant="ink" onClick={() => onAction(a)}>{monthLabel(a.month)} 흔들기</Button>
                  ))}
                  {bombs.map((a) => a.type === 'bomb' && (
                    <Button key={a.month} size="sm" variant="crimson" onClick={() => onAction(a)}>{monthLabel(a.month)} 폭탄</Button>
                  ))}
                </div>
              )}
            </div>

            <aside className={`side${view.decider === view.you ? ' live-seat' : ''}`}>
              <div className="emote-slot">
                <button
                  type="button"
                  className="emote-toggle"
                  aria-expanded={emoteOpen}
                  onClick={() => setEmoteOpen((open) => !open)}
                >
                  이모트
                </button>
                {emoteOpen && (
                  <div className="emote-pop" role="menu">
                    {EMOTES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => { setEmoteOpen(false); onEmote(item.id) }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="who">
                <Portrait id={you?.avatarId ?? 'bokman'} mood={moodFor(view.you)} />
                <div>
                  <b>{you?.nickname}</b>
                  <span>{won(you?.money ?? 0)}원 {view.yourPiDebt > 0 ? `· 피 빚 ${view.yourPiDebt}` : ''}</span>
                  <strong className="wx-score" data-score="you">{view.youScore.total}<small>점</small>{view.yourGo > 0 && <em className="wx-go">{view.yourGo}고</em>}</strong>
                </div>
                {bubble?.who === view.you && <p className="bubble">{bubble.text}</p>}
              </div>
              {(view.youScore.piCount > 0 && view.youScore.piCount <= 7 && view.oppScore.total >= 7) && <em className="warn">피박 주의</em>}
              {(view.oppScore.gwangCount >= 3 && view.youScore.gwangCount === 0) && <em className="warn gold">광박 주의</em>}
              <CaptureStrip ids={view.yourCapture} piCount={view.youScore.piCount} gukjin={view.yourGukjin} side="you" />
              <div className="dock">
                <button type="button" className="charge" onClick={onRecharge}>충전</button>
              </div>
            </aside>
          </div>

          <div className={`player bottom${view.decider === view.you ? ' live-seat' : ''}`}>
            <div className="hand you">
              {hand.map((id) => {
                const month = CARDS[id]?.month ?? 0
                const match = matchOf(id)
                return (
                  <HwatuCard
                    key={id}
                    id={id}
                    extra={match?.cls}
                    badge={match?.badge}
                    badgeTitle={match?.title}
                    onClick={yourTurn && playable.has(id) ? () => { setFocusMonth(null); onAction({ type: 'play', cardId: id }) } : undefined}
                    onFocusMonth={month ? () => setFocusMonth(month) : undefined}
                    onBlurMonth={() => setFocusMonth(null)}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <Impact spec={impact} nonce={nonce} />

      {yourTurn && view.phase === 'chongtong' && quad && (
        <div className="modal">
          <div className="sheet">
            <p className="eyebrow">같은 달 네 장</p>
            <h2>{monthLabel(quad.month)} 총통</h2>
            <p>지금 선언하면 10점으로 이 판을 가져옵니다. 계속하면 그냥 치고 나갑니다.</p>
            <div className="hand you">{quad.ids.map((id) => <HwatuCard key={id} id={id} />)}</div>
            <div className="actions">
              <Button size="lg" onClick={() => onAction({ type: 'chongtong', declare: true })}>총통 선언</Button>
              <Button size="lg" variant="ghost" onClick={() => onAction({ type: 'chongtong', declare: false })}>계속하기</Button>
            </div>
          </div>
        </div>
      )}

      {choosePanel && (
        <div className="modal wx-choose-modal" role="dialog" aria-modal="true" aria-label="먹을 패를 선택하세요">
          <div className="sheet wx-choose-sheet">
            <p className="eyebrow">같은 달 두 장</p>
            <h2>먹을 패를 선택하세요</h2>
            <p className="wx-choose-played">
              {CARDS[choosePanel.playedId] ? `${monthLabel(CARDS[choosePanel.playedId].month)} ${CARDS[choosePanel.playedId].name} — 짝이 되는 두 장 중 하나를 가져갑니다` : '짝이 되는 두 장 중 하나를 가져갑니다'}
            </p>
            <div className="wx-choose-cards">
              {choosePanel.options.map((id) => {
                const tag = kindTag(id)
                return (
                  <button
                    key={id}
                    type="button"
                    className={`wx-choose-btn tone-${tag.tone}`}
                    data-choose={id}
                    onClick={() => {
                      audio.physics('clack')
                      if (choosePanel.preview) setQaChoose(null)
                      else onAction({ type: 'choose', cardId: id })
                    }}
                  >
                    <HwatuCard id={id} />
                    <span className={`wx-choose-tag tone-${tag.tone}`}>{tag.text}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {confirmForfeit && view.phase !== 'ended' && !packet.showdown && (
        <div className="modal wx-forfeit-modal" role="dialog" aria-modal="true" aria-label="기권 확인">
          <div className="sheet wx-forfeit-sheet">
            <p className="eyebrow">중간 기권</p>
            <h2>이번 판을 기권하시겠습니까?</h2>
            <p>기권패로 정산됩니다. 상대에게 <b>max(7점, 상대 현재 {view.oppScore.total}점) = {Math.max(7, view.oppScore.total)}점</b> × 점당 {won(room.bet)}원을 지급합니다.</p>
            <div className="actions">
              <Button size="lg" variant="crimson" onClick={() => { setConfirmForfeit(false); onAction({ type: 'forfeit' }) }}>기권하기</Button>
              <Button size="lg" variant="ghost" onClick={() => setConfirmForfeit(false)}>계속 두기</Button>
            </div>
          </div>
        </div>
      )}

      {yourTurn && view.phase === 'goStop' && (
        <div className="modal">
          <div className="sheet">
            <p className="eyebrow">7점 이상</p>
            <h2>{view.youScore.total}점</h2>
            <p>{view.youScore.details.map((d) => `${d.label} ${d.points}`).join(' · ') || '점수'}</p>
            {view.stopPreview && (
              <p className="preview">지금 스톱하면 <b>{view.stopPreview.points}점</b> · {won(view.stopPreview.money)}원
                {view.stopPreview.factors.length > 0 && ` (${view.stopPreview.factors.map((f) => f.label).join(' ')})`}
              </p>
            )}
            <div className="actions">
              {view.legal.some((a) => a.type === 'go') && <Button size="lg" variant="crimson" onClick={() => onAction({ type: 'go' })}>고</Button>}
              {view.legal.some((a) => a.type === 'stop') && <Button size="lg" onClick={() => onAction({ type: 'stop' })}>스톱</Button>}
              {view.legal.some((a) => a.type === 'pass') && <Button size="lg" variant="ghost" onClick={() => onAction({ type: 'pass' })}>넘긴다</Button>}
              {view.legal.some((a) => a.type === 'gukjin') && (
                <Button size="lg" variant="ink" onClick={() => onAction({ type: 'gukjin', asPi: !view.yourGukjin })}>
                  국진을 {view.yourGukjin ? '열끗으로' : '쌍피로'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {yourTurn && view.phase === 'turn' && view.yourCapture.includes(GUKJIN_ID) && view.legal.some((a) => a.type === 'gukjin') && (
        <button type="button" className="gukjin-fab" onClick={() => onAction({ type: 'gukjin', asPi: !view.yourGukjin })}>
          국진 {view.yourGukjin ? '쌍피' : '열끗'}
        </button>
      )}

      {showBill && packet.showdown && (
        <div className="modal">
          <Bill
            showdown={packet.showdown}
            you={view.you}
            oppReady={Boolean(opp?.ready)}
            host={room.you === 0}
            bet={room.bet}
            purse={you?.money ?? 0}
            broke={(you?.money ?? 0) < room.bet}
            onRecharge={onRecharge}
            onRematch={onRematch}
            onLeave={onLeave}
            onBet={onBet}
          />
        </div>
      )}
    </div>
  )
}
