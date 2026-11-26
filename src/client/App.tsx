import { useEffect, useRef, useState } from 'react'
import type { Action } from '../engine/types'
import { avatarById, AVATARS } from '../shared/cast'
import { audio } from './audio'
import { Lobby, NightCut, RoomWait, SeonPick } from './lobby'
import { lockLandscape } from './orient'
import { won } from './bits'
import type { EmoteMsg, NightMsg, RoomInfo, RoomSummary, SeonReveal, TablePacket } from './model'
import { Table } from './table'

function PurseToast({ from, to, onDone }: { from: number; to: number; onDone: () => void }) {
  const [value, setValue] = useState(from)
  useEffect(() => {
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900)
      setValue(Math.round(from + (to - from) * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const coins = window.setInterval(() => audio.play('coin'), 160)
    const stop = window.setTimeout(() => {
      window.clearInterval(coins)
      onDone()
    }, 2200)
    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(coins)
      window.clearTimeout(stop)
    }
  }, [from, to])
  return <div className="toast purse">무료 충전 +1,000,000원 · 보유 {won(value)}원</div>
}

interface Me {
  nickname: string
  avatarId: string
  money: number
  token: string
}

export function App() {
  const [live, setLive] = useState(false)
  const [me, setMe] = useState<Me>({
    nickname: localStorage.getItem('dalbit-nick') || '김복만',
    avatarId: localStorage.getItem('dalbit-avatar') || 'bokman',
    money: 1_000_000,
    token: localStorage.getItem('dalbit-token') || '',
  })
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [packet, setPacket] = useState<TablePacket | null>(null)
  const [night, setNight] = useState<NightMsg | null>(null)
  const [reveal, setReveal] = useState<SeonReveal | null>(null)
  const [emote, setEmote] = useState<EmoteMsg | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pursePop, setPursePop] = useState<{ from: number; to: number; nonce: number } | null>(null)
  const [portrait, setPortrait] = useState(false)
  const [allowPortrait, setAllowPortrait] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const meRef = useRef(me)
  const roomRef = useRef<RoomInfo | null>(null)
  const seq = useRef(0)
  const emoteSeq = useRef(0)
  const ignoreTable = useRef(false)
  meRef.current = me
  roomRef.current = room

  function send(payload: unknown) {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }

  useEffect(() => {
    let stopped = false
    let retry = 0
    const open = () => {
      if (stopped) return
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${location.host}/ws`)
      wsRef.current = ws
      ws.onopen = () => {
        const profile = meRef.current
        ws.send(JSON.stringify({
          type: 'hello',
          token: profile.token || undefined,
          nickname: profile.nickname,
          avatarId: profile.avatarId,
        }))
      }
      ws.onmessage = (event) => {
        lastRx = Date.now()
        const msg = JSON.parse(String(event.data)) as Record<string, unknown>
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', t: msg.t }))
          return
        }
        if (msg.type === 'pong') return
        if (msg.type === 'welcome') {
          const next = {
            token: String(msg.token),
            nickname: String(msg.nickname),
            avatarId: String(msg.avatarId),
            money: Number(msg.money),
          }
          localStorage.setItem('dalbit-token', next.token)
          setMe(next)
          setLive(true)
          const code = new URLSearchParams(location.search).get('room')
          if (code && roomRef.current?.code !== code.toUpperCase()) send({ type: 'join', code })
        } else if (msg.type === 'recharged') {
          const money = Number(msg.money)
          const from = meRef.current.money
          setMe((prev) => ({ ...prev, money }))
          setPursePop({ from, to: money, nonce: Date.now() })
          audio.unlock()
          audio.play('coin')
        } else if (msg.type === 'sync') {
          const info = msg.room as RoomInfo
          setRoom(info)
          if (info.notice) {
            setNotice(info.notice)
            window.setTimeout(() => setNotice(''), 2800)
          }
          const mine = info.seats.find((s) => s.seat === info.you)
          if (mine) setMe((prev) => ({ ...prev, money: mine.money }))
        } else if (msg.type === 'rooms') {
          setRooms(msg.rooms as RoomSummary[])
        } else if (msg.type === 'error') {
          setError(String(msg.message ?? '오류'))
          window.setTimeout(() => setError(''), 3200)
        } else if (msg.type === 'lobby') {
          ignoreTable.current = false
          setRoom(null)
          setPacket(null)
          setNight(null)
          setReveal(null)
        } else if (msg.type === 'seon_draw') {
          setReveal(null)
          setRoom((prev) => prev ? { ...prev, status: 'night', seonDraw: { round: Number(msg.round), isDay: Boolean(msg.isDay), count: Number(msg.count), picks: msg.picks as [number | null, number | null], deadlineAt: Number(msg.deadlineAt), resolved: null } } : prev)
        } else if (msg.type === 'seon_reveal') {
          setReveal({ round: Number(msg.round), isDay: Boolean(msg.isDay), a: String(msg.a), b: String(msg.b), picks: msg.picks as [number | null, number | null], seon: msg.seon === null ? null : (msg.seon as 0 | 1), tie: Boolean(msg.tie) })
          audio.play('flip')
        } else if (msg.type === 'night') {
          if (roomRef.current?.seonDraw) return
          setNight({ steps: msg.steps as NightMsg['steps'], seon: msg.seon as 0 | 1, you: msg.you as 0 | 1 })
        } else if (msg.type === 'emote') {
          emoteSeq.current += 1
          setEmote({ seat: msg.seat as 0 | 1, id: String(msg.id), nonce: emoteSeq.current })
        } else if (msg.type === 'table') {
          if (ignoreTable.current) return
          const info = msg.room as RoomInfo
          setRoom(info)
          if (msg.you && typeof msg.you === 'object') {
            const you = msg.you as { money?: number }
            if (typeof you.money === 'number') setMe((prev) => ({ ...prev, money: you.money as number }))
          }
          if (msg.view) {
            setNight(null)
            setReveal(null)
            seq.current += 1
            setPacket({
              id: seq.current,
              view: msg.view as TablePacket['view'],
              events: (msg.events as TablePacket['events']) ?? [],
              showdown: msg.showdown as TablePacket['showdown'],
            })
          } else {
            setPacket(null)
          }
        }
      }
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null
        retry = window.setTimeout(open, 1200)
      }
    }
    let lastRx = Date.now()
    open()
    const beat = window.setInterval(() => {
      const socket = wsRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      if (Date.now() - lastRx > 45_000) {
        socket.close()
        return
      }
      socket.send(JSON.stringify({ type: 'ping', t: Date.now() }))
    }, 25_000)
    // 첫 터치/클릭/키 입력에서 AudioContext.resume() 언락 (iOS Safari 무음 방지)
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('touchend', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    const orient = window.matchMedia('(orientation: portrait) and (max-width: 900px)')
    const syncOrient = () => setPortrait(orient.matches)
    syncOrient()
    orient.addEventListener('change', syncOrient)
    if (localStorage.getItem('dalbit-calm') === '1') document.body.classList.add('calm')
    return () => {
      stopped = true
      window.clearInterval(beat)
      window.clearTimeout(retry)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchend', unlock)
      window.removeEventListener('keydown', unlock)
      orient.removeEventListener('change', syncOrient)
      wsRef.current?.close()
    }
  }, [])

  useEffect(() => {
    const level = packet ? Math.max(packet.view.yourGo, packet.view.oppGo) : 0
    if (!room || room.status === 'lobby' || !packet) audio.setScene('lobby')
    else audio.setGoLevel(level)
  }, [room, packet])

  function updateNick(nickname: string) {
    setMe((prev) => ({ ...prev, nickname }))
    localStorage.setItem('dalbit-nick', nickname)
    send({ type: 'profile', nickname, avatarId: me.avatarId })
  }
  function updateAvatar(avatarId: string) {
    const names = new Set([...AVATARS.map((a) => a.name), '나그네', ''])
    const nickname = names.has(me.nickname) ? avatarById(avatarId).name : me.nickname
    setMe((prev) => ({ ...prev, avatarId, nickname }))
    localStorage.setItem('dalbit-avatar', avatarId)
    localStorage.setItem('dalbit-nick', nickname)
    send({ type: 'profile', nickname, avatarId })
  }
  function leave() {
    ignoreTable.current = true
    send({ type: 'leave' })
    setRoom(null)
    setPacket(null)
    setNight(null)
    history.replaceState(null, '', location.pathname)
  }
  function go(payload: unknown) {
    lockLandscape()
    ignoreTable.current = false
    audio.unlock()
    send(payload)
  }

  function recharge() {
    audio.unlock()
    send({ type: 'recharge' })
  }
  const toast = (
    <>
      {error && <div className="toast">{error}</div>}
      {notice && <div className="toast notice">{notice}</div>}
      {pursePop && <PurseToast key={pursePop.nonce} from={pursePop.from} to={pursePop.to} onDone={() => setPursePop(null)} />}
    </>
  )
  if (!live) {
    return <div className="boot">패를 섞는 중입니다</div>
  }
  if (packet && room) {
    return (
      <>
        {toast}
        {portrait && !allowPortrait && (
          <div className="rotate-gate">
            <div className="rotate-card">
              <div className="phone-turn" aria-hidden />
              <h2>가로로 돌려주세요</h2>
              <p>가로 화면으로 돌리면 바로 시작됩니다.</p>
              <button type="button" onClick={() => setAllowPortrait(true)}>이대로 보기</button>
            </div>
          </div>
        )}
        <Table
          room={room}
          packet={packet}
          emote={emote}
          onAction={(action: Action) => { audio.unlock(); send({ type: 'action', action }) }}
          onEmote={(id) => { audio.unlock(); send({ type: 'emote', id }) }}
          onRematch={() => send({ type: 'rematch' })}
          onLeave={leave}
          onBet={(bet) => send({ type: 'bet', bet })}
          onRecharge={recharge}
          onAuto={(on) => send({ type: 'auto', on })}
          onArmed={() => send({ type: 'ready_turn' })}
        />
      </>
    )
  }
  if (room && room.status === 'night' && room.seonDraw) {
    return (
      <>
        {toast}
        <SeonPick room={room} reveal={reveal} onPick={(index) => send({ type: 'pick_seon', index })} />
      </>
    )
  }
  if (night && room) {
    return (
      <>
        {toast}
        <NightCut night={night} room={room} />
      </>
    )
  }
  if (room) {
    return (
      <>
        {toast}
        <RoomWait
          room={room}
          onReady={() => { lockLandscape(); send({ type: 'ready' }) }}
          onLeave={leave}
          onBet={(bet) => send({ type: 'bet', bet })}
          onRule={(seonRule) => send({ type: 'seonRule', seonRule })}
        />
      </>
    )
  }
  return (
    <>
      {toast}
      <Lobby
        nickname={me.nickname}
        avatarId={me.avatarId}
        money={me.money}
        rooms={rooms}
        onNick={updateNick}
        onAvatar={updateAvatar}
        onAi={(bet, seonRule) => go({ type: 'ai', bet, seonRule })}
        onCreate={(bet, seonRule) => go({ type: 'create', bet, seonRule })}
        onQuick={(bet) => go({ type: 'quick', bet })}
        onJoin={(code) => go({ type: 'join', code })}
        onRecharge={recharge}
      />
    </>
  )
}
