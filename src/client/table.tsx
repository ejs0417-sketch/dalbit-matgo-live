import { useEffect, useRef, useState } from 'react'
import { BETS, CARDS, GUKJIN_ID } from '../engine/cards'
import { goIntensity } from '../engine/score'
import type { Action, GameEvent, Seat } from '../engine/types'
import { CHARACTER_LINES, EMOTES, type Mood } from '../shared/cast'
import { audio } from './audio'
import { bannerFor, HwatuCard, Impact, monthLabel, soundFor, SoundBar, won } from './bits'
import { Portrait } from './characters'
import type { EmoteMsg, RoomInfo, Showdown, TablePacket } from './model'
import { Button } from './ui'

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
    case 'triple': return { who: ev.player, text: '세 번이야. 내 판이다!', mood: 'cheer' }
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
  useEffect(() => {
    if (step <= stamped.current) return
    if (step >= 2 && step < 2 + showdown.factors.length) audio.play('stamp')
    stamped.current = step
  }, [step, showdown.factors.length])
  useEffect(() => {
    audio.play(showdown.nagari ? 'nagari' : showdown.winner === you ? 'win' : 'lose')
    const timer = window.setInterval(() => setStep((s) => s + 1), 480)
    return () => window.clearInterval(timer)
  }, [showdown, you])
  const goOn = step >= 1
  const shownBase = showdown.base + (goOn ? showdown.goBonus : 0)
  let mul = 1
  showdown.factors.forEach((factor, index) => {
    if (step >= index + 2) mul *= factor.mul
  })
  const points = shownBase * mul
  const moneyOn = step >= showdown.factors.length + 2
  const counted = useCount(showdown.paid, moneyOn && !showdown.nagari)
  const win = showdown.winner === you
  return (
    <div className="bill">
      {moneyOn && !showdown.nagari && (
        <div className="coins" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} style={{ left: `${6 + ((i * 7) % 88)}%`, animationDelay: `${i * 0.06}s` }} />
          ))}
        </div>
      )}
      <p className="eyebrow">{showdown.nagari ? '무승부' : win ? '승리' : '패배'}</p>
      <h2>{showdown.title}</h2>
      <p>{showdown.subtitle}</p>
      {!showdown.nagari && (
        <ol>
          <li className={step >= 0 ? 'on' : ''}>기본 점수 <b>{showdown.base}점</b></li>
          {showdown.goBonus > 0 && <li className={goOn ? 'on' : ''}>고 보너스 <b>+{showdown.goBonus}</b></li>}
          {showdown.factors.map((factor, index) => (
            <li key={factor.id} className={step >= index + 2 ? 'on' : ''}>{factor.label} <b>×{factor.mul}</b></li>
          ))}
          <li className={moneyOn ? 'on' : ''}>점수 <b>{points}점</b></li>
          <li className={moneyOn ? 'on' : ''}>받은 돈 <b>{won(counted)}원</b></li>
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
      <div className="actions">
        <Button size="lg" variant="ink" onClick={onRecharge}>무료 충전 +100만</Button>
        <Button size="lg" onClick={onRematch}>{oppReady ? '상대가 기다리는 중 · 한 판 더' : '한 판 더'}</Button>
        <Button size="lg" variant="ghost" onClick={onLeave}>나가기</Button>
      </div>
    </div>
  )
}

function Pile({ title, ids, extra }: { title: string; ids: string[]; extra?: string }) {
  return (
    <div className="pile">
      <header><b>{title}</b><span>{extra ?? `${ids.length}`}</span></header>
      <div>
        {ids.map((id) => <HwatuCard key={id} id={id} mini />)}
      </div>
    </div>
  )
}

function Captures({ ids, piCount, gukjin }: { ids: string[]; piCount: number; gukjin: boolean }) {
  const g = groups(ids)
  return (
    <div className="captures">
      <Pile title="광" ids={g.gwang} />
      <Pile title="열" ids={g.yeol} extra={gukjin ? '국진 쌍피' : undefined} />
      <Pile title="띠" ids={g.tti} />
      <Pile title="피" ids={g.pi} extra={`${piCount}`} />
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
  const [ghost, setGhost] = useState<{ id: string; from: string } | null>(null)
  const [bubble, setBubble] = useState<{ who: Seat; text: string; mood: Mood } | null>(null)
  const [hit, setHit] = useState<'kung' | 'jjak' | null>(null)
  const [tick, setTick] = useState(Date.now())
  const [focusMonth, setFocusMonth] = useState<number | null>(null)
  const [openPile, setOpenPile] = useState<'you' | 'opp' | null>(null)
  const [emoteOpen, setEmoteOpen] = useState(false)
  const warned = useRef(-1)

  useEffect(() => {
    if (seen.current.has(packet.id)) return
    seen.current.add(packet.id)
    let cancel = false
    void (async () => {
      setReady(false)
      let playedId = ''
      for (const ev of packet.events) {
        if (cancel) return
        const banner = bannerFor(ev)
        const sound = soundFor(ev)
        const skipKung = ev.type === 'drop' && ev.cardId === playedId
        if (sound && !skipKung) audio.play(sound)
        if (ev.type === 'play') {
          playedId = ev.cardId
          setHit('kung')
        } else if (ev.type === 'drop' && !skipKung) setHit('kung')
        else if (ev.type === 'capture' || ev.type === 'jjok' || ev.type === 'ttadak' || ev.type === 'four') setHit('jjak')
        if (ev.type === 'go') {
          const tier = goIntensity(ev.count)
          audio.setScene(tier >= 5 ? 'goMax' : tier >= 4 ? 'goHigh' : tier >= 3 ? 'go' : 'table')
        }
        if (banner) {
          setImpact(banner)
          setNonce((n) => n + 1)
          setShake(true)
        }
        const speaker = room.seats.find((seat) => 'player' in ev && seat.seat === (ev as { player?: number }).player)
        const said = speech(ev, speaker?.avatarId ?? 'bokman')
        if (said) setBubble(said)
        if (ev.type === 'play') setGhost({ id: ev.cardId, from: ev.player === view.you ? 'you' : 'opp' })
        if (ev.type === 'flip') setGhost({ id: ev.cardId, from: 'deck' })
        if (ev.type === 'capture' && ev.cardIds[0]) setGhost({ id: ev.cardIds[0], from: 'floor' })
        const tier = ev.type === 'go' ? goIntensity(ev.count) : 0
        const long = ev.type === 'yaku' ? 1500 : tier >= 4 ? 1300 : tier === 3 ? 1100 : banner ? 920 : ev.type === 'deal' ? 620 : 280
        await wait(long)
        if (cancel) return
        setGhost(null)
        setHit(null)
        if (banner) {
          setImpact(null)
          setShake(false)
        }
      }
      if (!cancel) {
        setReady(true)
        if (view.decider === view.you && view.phase !== 'ended') onArmed()
      }
    })()
    return () => {
      cancel = true
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
  const yourTurn = ready && view.decider === view.you && !packet.showdown
  const floorMonths = new Set(view.floor.map((id) => CARDS[id]?.month ?? 0).filter((month) => month > 0))
  const ppukMonths = new Set(view.ppuks.map((p) => p.month))
  const playable = new Set(view.legal.flatMap((a) => (a.type === 'play' ? [a.cardId] : [])))
  const choices = new Set(view.legal.flatMap((a) => (a.type === 'choose' ? [a.cardId] : [])))
  const shakes = view.legal.filter((a) => a.type === 'shake')
  const bombs = view.legal.filter((a) => a.type === 'bomb')
  const hand = sortHand(view.yourHand)
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

  return (
    <div className={`stage${shake || hit === 'kung' ? ' rumble' : ''}${hit === 'jjak' ? ' snap' : ''}${aura}${goLevel >= 4 ? ' quake' : ''}`}>
      {hit && <div className={`shock shock-${hit}`} />}
      <header className="topbar slim">
        <div className="brand">달빛맞고</div>
        <div className="stat">
          {room.nagariMul > 1 && <em>나가리 ×{room.nagariMul}</em>}
          <span>점당 {won(room.bet)}원</span>
          {view.consecutivePpuk > 0 && <span>연속 뻑 {view.consecutivePpuk}</span>}
          <button type="button" className={mine?.auto ? 'auto on' : 'auto'} onClick={() => onAuto(!mine?.auto)}>
            {mine?.auto ? '자동치기 켜짐' : '자동치기'}
          </button>
        </div>
        <SoundBar />
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
                  <strong>{view.oppScore.total}점 {view.oppGo > 0 ? `· ${view.oppGo}고` : ''}</strong>
                </div>
                {bubble?.who !== view.you && bubble && <p className="bubble">{bubble.text}</p>}
              </div>
              <button type="button" className="badges" onClick={() => setOpenPile(openPile === 'opp' ? null : 'opp')}>
                <span>광 {groups(view.opponentCapture).gwang.length}</span>
                <span>열 {groups(view.opponentCapture).yeol.length}</span>
                <span>띠 {groups(view.opponentCapture).tti.length}</span>
                <span>피 {view.oppScore.piCount}</span>
              </button>
              <div className="hand opp">
                {view.opponentRevealed.map((id) => <HwatuCard key={id} id={id} mini />)}
                {Array.from({ length: Math.max(0, view.opponentHandCount - view.opponentRevealed.length) }, (_, i) => (
                  <HwatuCard key={`b${i}`} back mini />
                ))}
              </div>
              {openPile === 'opp' && <Captures ids={view.opponentCapture} piCount={view.oppScore.piCount} gukjin={view.oppGukjin} />}
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
                <button type="button" className="deck" aria-label={`더미 ${view.deckCount}장`}>
                  <HwatuCard back />
                  <HwatuCard back />
                  <span>{view.deckCount}</span>
                </button>
                <div className="floor">
                  {view.floor.map((id) => {
                    const month = CARDS[id]?.month ?? 0
                    return (
                      <HwatuCard
                        key={id}
                        id={id}
                        hot={focusMonth !== null && month === focusMonth}
                        pick={choices.has(id)}
                        label={ppukMonths.has(month) ? '뻑' : undefined}
                        onClick={choices.has(id) && yourTurn ? () => onAction({ type: 'choose', cardId: id }) : undefined}
                      />
                    )
                  })}
                  {view.pending && <HwatuCard id={view.pending.playedId} hot />}
                  {view.floor.length === 0 && !view.pending && <p className="floor-empty">바닥이 비었습니다</p>}
                </div>
              </div>
              {yourTurn && choices.size > 0 && <p className="hint">가져갈 패를 고르세요</p>}
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

            <aside className="side">
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
                  <strong>{view.youScore.total}점 {view.yourGo > 0 ? `· ${view.yourGo}고` : ''}</strong>
                </div>
                {bubble?.who === view.you && <p className="bubble">{bubble.text}</p>}
              </div>
              <button type="button" className="badges" onClick={() => setOpenPile(openPile === 'you' ? null : 'you')}>
                <span>광 {groups(view.yourCapture).gwang.length}</span>
                <span>열 {groups(view.yourCapture).yeol.length}</span>
                <span>띠 {groups(view.yourCapture).tti.length}</span>
                <span>피 {view.youScore.piCount}</span>
              </button>
              {openPile === 'you' && <Captures ids={view.yourCapture} piCount={view.youScore.piCount} gukjin={view.yourGukjin} />}
              <button
                type="button"
                className={document.body.classList.contains('calm') ? 'auto on' : 'auto'}
                onClick={() => {
                  const next = !document.body.classList.contains('calm')
                  document.body.classList.toggle('calm', next)
                  localStorage.setItem('dalbit-calm', next ? '1' : '0')
                }}
              >
                연출 약하게
              </button>
              <div className="dock">
                <button type="button" className="charge" onClick={onRecharge}>충전</button>
              </div>
            </aside>
          </div>

          <div className={`player bottom${view.decider === view.you ? ' live-seat' : ''}`}>
            <div className="hand you">
              {hand.map((id) => {
                const month = CARDS[id]?.month ?? 0
                return (
                  <HwatuCard
                    key={id}
                    id={id}
                    hot={Boolean(month && floorMonths.has(month))}
                    onClick={yourTurn && playable.has(id) ? () => { setFocusMonth(null); onAction({ type: 'play', cardId: id }) } : undefined}
                    onFocusMonth={month ? () => setFocusMonth(month) : undefined}
                    onBlurMonth={() => setFocusMonth(null)}
                  />
                )
              })}
            </div>
          </div>
          {ghost && (
            <div className={`ghost from-${ghost.from}`}>
              <HwatuCard id={ghost.id} />
            </div>
          )}
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
