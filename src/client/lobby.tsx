import { useEffect, useState } from 'react'
import { BETS, cardImage } from '../engine/cards'
import { AVATARS, avatarById } from '../shared/cast'
import { audio } from './audio'
import { HwatuCard, SoundBar, won } from './bits'
import { Portrait } from './characters'
import { Button, Input, RulesDialog } from './ui'
import type { NightMsg, RoomInfo, RoomSummary } from './model'

const FAN = ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm12-gwang', 'm02-yeol', 'm09-yeol', 'm11-ssang']

export function Lobby({
  nickname,
  avatarId,
  money,
  rooms,
  onNick,
  onAvatar,
  onAi,
  onCreate,
  onQuick,
  onJoin,
  onRecharge,
}: {
  nickname: string
  avatarId: string
  money: number
  rooms: RoomSummary[]
  onNick: (v: string) => void
  onAvatar: (id: string) => void
  onAi: (bet: number, seonRule: 'night' | 'random') => void
  onCreate: (bet: number, seonRule: 'night' | 'random') => void
  onQuick: (bet: number) => void
  onJoin: (code: string) => void
  onRecharge: () => void
}) {
  const [bet, setBet] = useState(1000)
  const [rule, setRule] = useState<'night' | 'random'>('night')
  const [code, setCode] = useState('')
  const me = avatarById(avatarId)
  return (
    <div className="lobby">
      <header className="topbar">
        <div className="brand">달빛맞고</div>
        <div className="top-actions">
          <RulesDialog trigger={<Button variant="ghost" size="sm">규칙</Button>} />
          <SoundBar />
        </div>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">두 사람이 마주 앉는 정통 맞고</p>
          <h1>달빛맞고</h1>
          <p>쪽과 따닥, 흔드는 손, 고를 외치는 밤. 화투 50장으로 승부를 겨루세요.</p>
          <div className="fan" aria-hidden>
            {FAN.map((id, i) => (
              <img key={id} src={cardImage(id)} alt="" style={{ ['--i' as string]: String(i) }} />
            ))}
          </div>
        </div>
        <div className="identity">
          <Portrait id={avatarId} mood="happy" />
          <div>
            <strong>{me.name}</strong>
            <em>{me.title}</em>
            <p>{me.blurb}</p>
            <div className="money">보유 {won(money)}원</div>
            <Button size="sm" variant="ink" onClick={() => { audio.unlock(); onRecharge() }}>무료 충전 +100만</Button>
          </div>
        </div>
      </section>
      <section className="setup">
        <div className="lobby-card lobby-left">
          <div className="lobby-profile">
            <Portrait id={avatarId} mood="happy" />
            <div>
              <strong>{me.name}</strong>
              <em>{me.title}</em>
              <div className="money">보유 {won(money)}원</div>
              <Button size="sm" variant="ink" onClick={() => { audio.unlock(); onRecharge() }}>무료 충전 +100만</Button>
            </div>
          </div>
          <label className="nick">
            닉네임
            <Input value={nickname} maxLength={10} onChange={(e) => onNick(e.target.value)} placeholder="이름을 적어 주세요" />
          </label>
          <div className="cast" role="listbox" aria-label="캐릭터">
            {AVATARS.map((a) => (
              <button key={a.id} type="button" className={a.id === avatarId ? 'on' : ''} onClick={() => onAvatar(a.id)}>
                <Portrait id={a.id} mood={a.id === avatarId ? 'happy' : 'idle'} />
                <b>{a.name}</b>
                <span>{a.title}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="lobby-card lobby-right">
          <div className="bets" role="radiogroup" aria-label="점당 금액">
            {BETS.map((b) => (
              <button key={b.value} type="button" className={bet === b.value ? 'on' : ''} onClick={() => setBet(b.value)}>
                점당 {b.label}
              </button>
            ))}
          </div>
          <div className="rulesel">
            <button type="button" className={rule === 'night' ? 'on' : ''} onClick={() => setRule('night')}>첫 판 밤일낮</button>
            <button type="button" className={rule === 'random' ? 'on' : ''} onClick={() => setRule('random')}>첫 판 랜덤 선</button>
          </div>
          <div className="actions">
            <Button size="lg" onClick={() => { audio.unlock(); onAi(bet, rule) }}>혼자 두기</Button>
            <Button size="lg" variant="crimson" onClick={() => { audio.unlock(); onCreate(bet, rule) }}>방 만들기</Button>
            <Button size="lg" variant="ink" onClick={() => { audio.unlock(); onQuick(bet) }}>빠른 입장</Button>
          </div>
          <form className="join" onSubmit={(e) => { e.preventDefault(); audio.unlock(); onJoin(code) }}>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="방 코드" maxLength={6} />
            <Button type="submit" variant="ghost">입장</Button>
          </form>
        </div>
      </section>
      <section className="roomlist">
        <h2>열린 방</h2>
        {rooms.length === 0 && <p className="empty">아직 기다리는 방이 없습니다. 직접 만들고 코드를 건네 보세요.</p>}
        <ul>
          {rooms.map((room) => (
            <li key={room.code}>
              <Portrait id={room.avatarId} mood="idle" />
              <div>
                <b>{room.host}</b>
                <span>{room.code} · 점당 {won(room.bet)}원 · {room.seonRule === 'night' ? '밤일낮' : '랜덤 선'}</span>
              </div>
              <Button size="sm" onClick={() => { audio.unlock(); onJoin(room.code) }}>들어가기</Button>
            </li>
          ))}
        </ul>
      </section>
      <footer>화투 그림은 위키미디어 공용의 한국 화투 SVG를 사용합니다. CC BY-SA 4.0 · Louie Mantia, Marcus Richert, Spenĉjo</footer>
    </div>
  )
}

export function RoomWait({
  room,
  onReady,
  onLeave,
  onBet,
  onRule,
}: {
  room: RoomInfo
  onReady: () => void
  onLeave: () => void
  onBet: (bet: number) => void
  onRule: (rule: 'night' | 'random') => void
}) {
  const [copied, setCopied] = useState(false)
  const you = room.seats.find((s) => s.seat === room.you)
  const opp = room.seats.find((s) => s.seat !== room.you)
  const link = `${location.origin}/?room=${room.code}`
  return (
    <div className="lobby room-wait">
      <header className="topbar">
        <div className="brand">대기실</div>
        <SoundBar />
      </header>
      <div className="wait-grid">
        <article className="seat-card">
          <Portrait id={you?.avatarId ?? 'bokman'} mood="happy" />
          <h2>{you?.nickname}</h2>
          <p>나 · {won(you?.money ?? 0)}원</p>
          {you?.ready && <em>준비 완료</em>}
        </article>
        <article className="seat-card invite">
          <p className="eyebrow">친구에게 이 코드를 건네세요</p>
          <strong className="code">{room.code}</strong>
          <Input readOnly value={link} aria-label="초대 링크" />
          <Button
            variant="ink"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => setCopied(false))
            }}
          >
            {copied ? '링크를 복사했습니다' : '초대 링크 복사'}
          </Button>
        </article>
        <article className="seat-card">
          {opp?.filled ? <Portrait id={opp.avatarId} mood="idle" /> : <div className="empty-seat">빈 자리</div>}
          <h2>{opp?.filled ? opp.nickname : '기다리는 중'}</h2>
          <p>{opp?.filled ? `${won(opp.money)}원` : '상대가 들어오면 준비를 누르세요'}</p>
          {opp?.ready && <em>준비 완료</em>}
        </article>
      </div>
      {room.you === 0 && (
        <div className="setup compact">
          <div className="bets">
            {BETS.map((b) => (
              <button key={b.value} type="button" className={room.bet === b.value ? 'on' : ''} onClick={() => onBet(b.value)}>점당 {b.label}</button>
            ))}
          </div>
          {room.games === 0 && (
            <div className="rulesel">
              <button type="button" className={room.seonRule === 'night' ? 'on' : ''} onClick={() => onRule('night')}>밤일낮</button>
              <button type="button" className={room.seonRule === 'random' ? 'on' : ''} onClick={() => onRule('random')}>랜덤 선</button>
            </div>
          )}
        </div>
      )}
      <div className="actions">
        <Button size="lg" disabled={!opp?.filled || you?.ready} onClick={onReady}>{you?.ready ? '상대를 기다리는 중' : '준비'}</Button>
        <Button size="lg" variant="ghost" onClick={onLeave}>나가기</Button>
      </div>
    </div>
  )
}

export function NightCut({ night, room }: { night: NightMsg; room: RoomInfo }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    let n = 0
    audio.play('flip')
    const timer = window.setInterval(() => {
      n += 1
      if (n >= night.steps.length) {
        window.clearInterval(timer)
        return
      }
      audio.play('flip')
      setIndex(n)
    }, 1300)
    return () => window.clearInterval(timer)
  }, [night])
  const step = night.steps[Math.min(index, night.steps.length - 1)]
  const done = index >= night.steps.length - 1
  const me = room.seats.find((s) => s.seat === room.you)
  const opp = room.seats.find((s) => s.seat !== room.you)
  return (
    <div className="night">
      <p className="eyebrow">밤일낮 · 높은 달을 집은 쪽이 선</p>
      <h1>누가 먼저 낼까</h1>
      <div className="night-row">
        <div>
          <Portrait id={me?.avatarId ?? 'bokman'} mood="think" />
          <b>{me?.nickname}</b>
          {step && <HwatuCard id={room.you === 0 ? step.a : step.b} />}
        </div>
        <div>
          <Portrait id={opp?.avatarId ?? 'hwang'} mood="think" />
          <b>{opp?.nickname || '상대'}</b>
          {step && <HwatuCard id={room.you === 0 ? step.b : step.a} />}
        </div>
      </div>
      {done && <p className="night-result">{night.seon === room.you ? '당신이 선입니다' : '상대가 선입니다'}</p>}
    </div>
  )
}
