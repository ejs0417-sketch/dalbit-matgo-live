import { useEffect, useState, type ReactNode } from 'react'
import { BookOpen, Music, Music2, Volume2, VolumeX, X } from 'lucide-react'
import { BETS, cardBack, cardImage, CARDS } from '../engine/cards'
import { AVATARS, avatarById } from '../shared/cast'
import { audio } from './audio'
import { HwatuCard, won } from './bits'
import { Portrait } from './characters'
import { RulesDialog } from './ui'
import type { NightMsg, RoomInfo, RoomSummary, SeonReveal } from './model'

function useAudioTick() {
  const [, bump] = useState(0)
  useEffect(() => {
    const on = () => bump((n) => n + 1)
    window.addEventListener('dalbit-audio', on)
    return () => window.removeEventListener('dalbit-audio', on)
  }, [])
  return () => window.dispatchEvent(new Event('dalbit-audio'))
}

export function SoundIcons({ rules = true }: { rules?: boolean }) {
  const force = useAudioTick()
  return (
    <div className="wx-icons">
      <button type="button" className="wx-icon" aria-label={`배경음 ${audio.bgmOn ? '켜짐' : '꺼짐'}`} onClick={() => { audio.unlock(); audio.toggleBgm(); force() }}>
        {audio.bgmOn ? <Music size={18} /> : <Music2 size={18} style={{ opacity: 0.4 }} />}
        <small>BGM</small>
      </button>
      <button type="button" className="wx-icon" aria-label={`효과음 ${audio.sfxOn ? '켜짐' : '꺼짐'}`} onClick={() => { audio.unlock(); audio.toggleSfx(); force() }}>
        {audio.sfxOn ? <Volume2 size={18} /> : <VolumeX size={18} style={{ opacity: 0.4 }} />}
        <small>SFX</small>
      </button>
      {rules && (
        <RulesDialog trigger={<button type="button" className="wx-icon" aria-label="규칙"><BookOpen size={18} /><small>규칙</small></button>} />
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="wx-modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="wx-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" className="wx-close" aria-label="닫기" onClick={onClose}><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

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
  const [pop, setPop] = useState<'profile' | 'code' | null>(null)
  const me = avatarById(avatarId)
  return (
    <div className="wx-lobby">
      <header className="wx-hud">
        <button type="button" className="wx-me" onClick={() => setPop('profile')} aria-label="프로필 · 캐릭터 변경">
          <span className="wx-avatar"><Portrait id={avatarId} mood="happy" /></span>
          <span className="wx-me-text">
            <b>{nickname || me.name}</b>
            <em className="wx-coin">{won(money)}원</em>
          </span>
        </button>
        <button type="button" className="wx-charge" onClick={() => { audio.unlock(); onRecharge() }}>+충전</button>
        <SoundIcons />
      </header>
      <div className="wx-emblem">
        <img src="/art/title-emblem.webp" alt="달빛맞고" draggable={false} />
      </div>
      <section className="wx-controls">
        <div className="wx-chips" role="radiogroup" aria-label="점당 금액">
          <span className="wx-chip-label">점당</span>
          {BETS.map((b) => (
            <button key={b.value} type="button" role="radio" aria-checked={bet === b.value} className={`wx-chip${bet === b.value ? ' on' : ''}`} onClick={() => setBet(b.value)}>
              {b.label}
            </button>
          ))}
        </div>
        <div className="wx-seg" role="radiogroup" aria-label="첫 판 선 방식">
          <button type="button" role="radio" aria-checked={rule === 'night'} className={rule === 'night' ? 'on' : ''} onClick={() => setRule('night')}>낮일밤장 직접 뽑기</button>
          <button type="button" role="radio" aria-checked={rule === 'random'} className={rule === 'random' ? 'on' : ''} onClick={() => setRule('random')}>랜덤 선</button>
        </div>
        <div className="wx-buttons">
          <button type="button" className="wx-btn3d gold" onClick={() => { audio.unlock(); onAi(bet, rule) }}><span>혼자 두기</span></button>
          <button type="button" className="wx-btn3d crimson" onClick={() => { audio.unlock(); onCreate(bet, rule) }}><span>방 만들기</span></button>
          <button type="button" className="wx-btn3d jade" onClick={() => { audio.unlock(); setPop('code') }}><span>코드 입장</span></button>
        </div>
      </section>

      {pop === 'profile' && (
        <Modal title="강호 협객 정보" onClose={() => setPop(null)}>
          <label className="wx-field">
            <span>닉네임</span>
            <input value={nickname} maxLength={10} onChange={(e) => onNick(e.target.value)} placeholder="이름을 적어 주세요" />
          </label>
          <div className="wx-cast" role="listbox" aria-label="캐릭터">
            {AVATARS.map((a) => (
              <button key={a.id} type="button" role="option" aria-selected={a.id === avatarId} className={a.id === avatarId ? 'on' : ''} onClick={() => onAvatar(a.id)}>
                <Portrait id={a.id} mood={a.id === avatarId ? 'happy' : 'idle'} />
                <b>{a.name}</b>
              </button>
            ))}
          </div>
          <p className="wx-blurb">{me.title} · {me.blurb}</p>
          <button type="button" className="wx-btn3d gold small" onClick={() => setPop(null)}><span>확인</span></button>
        </Modal>
      )}
      {pop === 'code' && (
        <Modal title="코드 입장" onClose={() => setPop(null)}>
          <form className="wx-join" onSubmit={(e) => { e.preventDefault(); audio.unlock(); if (code.trim()) { onJoin(code); setPop(null) } }}>
            <input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="방 코드 6자리" maxLength={6} aria-label="방 코드" />
            <button type="submit" className="wx-btn3d gold small"><span>입장</span></button>
          </form>
          <button type="button" className="wx-btn3d jade small" onClick={() => { audio.unlock(); onQuick(bet); setPop(null) }}><span>빈 방 빠른 입장</span></button>
          {rooms.length > 0 && (
            <ul className="wx-rooms">
              {rooms.slice(0, 6).map((room) => (
                <li key={room.code}>
                  <span className="wx-avatar sm"><Portrait id={room.avatarId} mood="idle" /></span>
                  <div><b>{room.host}</b><small>{room.code} · 점당 {won(room.bet)}원</small></div>
                  <button type="button" className="wx-chip on" onClick={() => { audio.unlock(); onJoin(room.code); setPop(null) }}>들어가기</button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
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
  const host = room.seats.find((s) => s.seat === 0)
  const guest = room.seats.find((s) => s.seat === 1)
  const you = room.seats.find((s) => s.seat === room.you)
  const opp = room.seats.find((s) => s.seat !== room.you)
  const isHost = room.you === 0
  const link = `${location.origin}/?room=${room.code}`
  const card = (seat: typeof host, label: string) => (
    <article className={`wx-seat${seat?.ready ? ' ready' : ''}${seat?.seat === room.you ? ' mine' : ''}`} data-seat={label}>
      {seat?.filled ? <span className="wx-avatar lg"><Portrait id={seat.avatarId} mood={seat.ready ? 'happy' : 'idle'} /></span> : <span className="wx-avatar lg empty">?</span>}
      <div className="wx-seat-text">
        <small>{label}{seat?.seat === room.you ? ' · 나' : ''}</small>
        <b>{seat?.filled ? seat.nickname : '기다리는 중'}</b>
        <em className="wx-coin">{seat?.filled ? `${won(seat.money)}원` : '초대 링크를 보내세요'}</em>
      </div>
      <span className={`wx-ready${seat?.ready ? ' on' : ''}`}>{seat?.ready ? '준비 완료' : seat?.filled ? '대기' : '빈 자리'}</span>
    </article>
  )
  return (
    <div className="wx-wait">
      <header className="wx-wait-top">
        <div className="wx-code"><small>방 코드</small><strong>{room.code}</strong></div>
        <button
          type="button"
          className="wx-chip on wx-invite"
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => setCopied(false))
          }}
        >
          {copied ? '복사 완료' : '초대 링크 복사'}
        </button>
        <SoundIcons rules={false} />
        <button type="button" className="wx-chip wx-leave" onClick={onLeave}>나가기</button>
      </header>
      <section className="wx-seats">
        {card(host, '방장')}
        <div className="wx-vs" aria-hidden>VS</div>
        {card(guest, '도전자')}
      </section>
      <footer className="wx-wait-bottom">
        <div className="wx-chips" role="radiogroup" aria-label="점당 금액">
          <span className="wx-chip-label">점당</span>
          {BETS.map((b) => (
            <button key={b.value} type="button" disabled={!isHost} className={`wx-chip${room.bet === b.value ? ' on' : ''}`} onClick={() => onBet(b.value)}>{b.label}</button>
          ))}
        </div>
        <div className="wx-seg" role="radiogroup" aria-label="선 방식">
          <button type="button" disabled={!isHost || room.games > 0} className={room.seonRule === 'night' ? 'on' : ''} onClick={() => onRule('night')}>낮일밤장</button>
          <button type="button" disabled={!isHost || room.games > 0} className={room.seonRule === 'random' ? 'on' : ''} onClick={() => onRule('random')}>랜덤</button>
        </div>
        <button type="button" className="wx-btn3d gold wx-readybtn" disabled={!opp?.filled || you?.ready} onClick={onReady}>
          <span>{you?.ready ? '상대 대기 중' : opp?.ready ? '시작' : '준비'}</span>
        </button>
      </footer>
    </div>
  )
}

/** 낮일밤장 직접 뽑기: 뒤집힌 패 중 1장을 직접 고른다. */
export function SeonPick({ room, reveal, onPick }: { room: RoomInfo; reveal: SeonReveal | null; onPick: (index: number) => void }) {
  const draw = room.seonDraw
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [])
  if (!draw) return null
  const me = room.you ?? 0
  const other = (1 - me) as 0 | 1
  const mine = room.seats.find((s) => s.seat === me)
  const opp = room.seats.find((s) => s.seat === other)
  const live = reveal && reveal.round === draw.round ? reveal : null
  const picks = live ? live.picks : draw.picks
  const skew = (room.serverNow ?? Date.now()) - Date.now()
  const left = Math.max(0, Math.ceil((draw.deadlineAt - (now + skew)) / 1000))
  const cardAt = (index: number) => {
    if (!live) return null
    if (picks[0] === index) return live.a
    if (picks[1] === index) return live.b
    return null
  }
  const myCard = live ? (me === 0 ? live.a : live.b) : null
  const oppCard = live ? (me === 0 ? live.b : live.a) : null
  const monthOf = (id: string | null) => (id ? CARDS[id]?.month ?? 0 : 0)
  const result = live
    ? live.tie
      ? `같은 ${monthOf(myCard)}월! 다시 뽑습니다`
      : live.seon === me ? '당신이 선입니다!' : '상대가 선입니다'
    : picks[me] === null ? `뒤집힌 패 한 장을 직접 고르세요 · ${left}초` : '상대가 고르는 중…'
  return (
    <div className="wx-seon">
      <p className="wx-seon-rule">{draw.isDay ? '☀ 낮일 — 작은 달을 잡은 쪽이 선' : '☾ 밤장 — 큰 달을 잡은 쪽이 선'}{draw.round > 1 ? ` · ${draw.round}번째 뽑기` : ''}</p>
      <div className="wx-seon-row">
        <div className="wx-seon-who">
          <span className="wx-avatar"><Portrait id={mine?.avatarId ?? 'bokman'} mood={live && !live.tie ? (live.seon === me ? 'cheer' : 'sad') : 'think'} /></span>
          <b>{mine?.nickname ?? '나'}</b>
          {myCard && <em>{monthOf(myCard)}월</em>}
        </div>
        <div className="wx-seon-cards" data-count={draw.count}>
          {Array.from({ length: draw.count }, (_, index) => {
            const id = cardAt(index)
            const owner = picks[0] === index ? 0 : picks[1] === index ? 1 : null
            const can = !live && picks[me] === null && owner === null
            return (
              <button
                key={`${draw.round}-${index}`}
                type="button"
                className={`wx-seon-card${id ? ' flipped' : ''}${owner === me ? ' mine' : owner === other ? ' theirs' : ''}`}
                disabled={!can}
                data-index={index}
                style={{ ['--i' as string]: String(index) }}
                aria-label={`${index + 1}번 패${id ? ` ${monthOf(id)}월` : ''}`}
                onClick={() => { audio.unlock(); audio.play('flip'); onPick(index) }}
              >
                <span className="face back"><img src={cardBack()} alt="" draggable={false} /></span>
                <span className="face front">{id && <img src={cardImage(id)} alt="" draggable={false} />}</span>
                {owner !== null && <i>{owner === me ? '나' : '상대'}</i>}
              </button>
            )
          })}
        </div>
        <div className="wx-seon-who">
          <span className="wx-avatar"><Portrait id={opp?.avatarId ?? 'hwang'} mood="think" /></span>
          <b>{opp?.nickname || '상대'}</b>
          {oppCard && <em>{monthOf(oppCard)}월</em>}
        </div>
      </div>
      <p className={`wx-seon-result${live && !live.tie ? ' done' : ''}`}>{result}</p>
    </div>
  )
}

export function NightCut({ night, room }: { night: NightMsg; room: RoomInfo }) {
  const last = night.steps[night.steps.length - 1]
  const me = room.seats.find((s) => s.seat === room.you)
  const opp = room.seats.find((s) => s.seat !== room.you)
  return (
    <div className="wx-seon">
      <div className="wx-seon-row">
        <div className="wx-seon-who"><Portrait id={me?.avatarId ?? 'bokman'} mood="think" /><b>{me?.nickname}</b>{last && <HwatuCard id={room.you === 0 ? last.a : last.b} />}</div>
        <div className="wx-seon-who"><Portrait id={opp?.avatarId ?? 'hwang'} mood="think" /><b>{opp?.nickname || '상대'}</b>{last && <HwatuCard id={room.you === 0 ? last.b : last.a} />}</div>
      </div>
      <p className="wx-seon-result done">{night.seon === room.you ? '당신이 선입니다' : '상대가 선입니다'}</p>
    </div>
  )
}
