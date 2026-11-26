import { useEffect, useState } from 'react'
import { CARDS, cardBack, cardImage, MONTH_NAME } from '../engine/cards'
import { goIntensity } from '../engine/score'
import type { GameEvent } from '../engine/types'
import { audio } from './audio'

export function won(n: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.round(n)))
}

export function tiltOf(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 15
  return h - 7
}

export function HwatuCard({
  id,
  back = false,
  hot = false,
  mini = false,
  pick = false,
  label,
  onClick,
  onFocusMonth,
  onBlurMonth,
}: {
  id?: string
  back?: boolean
  hot?: boolean
  mini?: boolean
  pick?: boolean
  label?: string
  onClick?: () => void
  onFocusMonth?: () => void
  onBlurMonth?: () => void
}) {
  const def = id ? CARDS[id] : undefined
  const src = back || !id ? cardBack() : cardImage(id)
  const alt = back ? '화투 뒷면' : def?.name ?? '폭탄패'
  return (
    <div
      className={`hwatu${mini ? ' mini' : ''}${hot ? ' hot' : ''}${pick ? ' pick' : ''}${onClick ? ' live' : ''}`}
      style={{ ['--tilt' as string]: `${id && !mini ? tiltOf(id) : 0}deg` }}
      onClick={onClick}
      onPointerDown={onFocusMonth}
      onPointerEnter={onFocusMonth}
      onPointerLeave={onBlurMonth}
      onPointerUp={onBlurMonth}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
    >
      <img src={src} alt={alt} draggable={false} />
      {def && !back && (
        <span className={`pip kind-${def.kind}`}>
          {def.month ? <i className="mo">{def.month}</i> : null}
          <b>{def.short}</b>
        </span>
      )}
      {def && def.pi >= 2 && !back && <span className="ssang">{def.pi >= 3 ? '삼' : '쌍'}</span>}
      {label && <span className="flag">{label}</span>}
    </div>
  )
}

export function SoundBar() {
  const [, bump] = useState(0)
  useEffect(() => {
    const on = () => bump((n) => n + 1)
    window.addEventListener('dalbit-audio', on)
    return () => window.removeEventListener('dalbit-audio', on)
  }, [])
  return (
    <div className="soundbar">
      <button type="button" onClick={() => { audio.unlock(); audio.toggleBgm(); force() }} aria-label="배경음">
        배경음 {audio.bgmOn ? '켜짐' : '꺼짐'}
      </button>
      <input
        aria-label="배경음 크기"
        type="range"
        min={0}
        max={1}
        step={0.01}
        defaultValue={audio.bgmVolume}
        onChange={(e) => { audio.unlock(); audio.setBgmVolume(Number(e.target.value)) }}
      />
      <button type="button" onClick={() => { audio.unlock(); audio.toggleSfx(); force() }} aria-label="효과음">
        효과음 {audio.sfxOn ? '켜짐' : '꺼짐'}
      </button>
      <input
        aria-label="효과음 크기"
        type="range"
        min={0}
        max={1}
        step={0.01}
        defaultValue={audio.sfxVolume}
        onChange={(e) => { audio.unlock(); audio.setSfxVolume(Number(e.target.value)) }}
      />
    </div>
  )
}

function force() {
  window.dispatchEvent(new Event('dalbit-audio'))
}

export function monthLabel(month: number) {
  return `${month}월 ${MONTH_NAME[month] ?? ''}`
}

export interface BannerSpec {
  title: string
  kicker?: string
  theme: string
  tier?: number
  yaku?: string
  cards?: string[]
}

export function bannerFor(ev: GameEvent): BannerSpec | null {
  switch (ev.type) {
    case 'jjok': return { title: '쪽', kicker: '피 한 장', theme: 'gold' }
    case 'ttadak': return { title: '따닥', kicker: '네 장', theme: 'red' }
    case 'ppuk': return { title: ev.combo >= 3 ? '삼연뻑' : ev.combo === 2 ? '연뻑' : '뻑', theme: 'purple' }
    case 'ownPpuk': return { title: '자뻑', kicker: '피 두 장', theme: 'red' }
    case 'eatPpuk': return { title: '뻑 먹기', theme: 'gold' }
    case 'four': return { title: '싹쓸', kicker: '피 한 장', theme: 'gold' }
    case 'sweep': return { title: '쓸', kicker: '판쓸이', theme: 'green' }
    case 'bomb': return { title: '폭탄', theme: 'red' }
    case 'shake': return { title: '흔들기', kicker: monthLabel(ev.month), theme: 'gold' }
    case 'go': {
      const tier = goIntensity(ev.count)
      const theme = tier === 1 ? 'gold' : tier === 2 ? 'ember' : tier === 3 ? 'fire' : 'storm'
      return { title: `${ev.count}고`, kicker: tier >= 3 ? `배수 ×${2 ** (ev.count - 2)}` : '고', theme, tier }
    }
    case 'yaku':
      return {
        title: ev.title,
        kicker: ev.id === 'godori' ? '새 세 마리' : ev.id === 'hong' ? '붉은 띠' : ev.id === 'cheong' ? '푸른 띠' : ev.id === 'cho' ? '풀 띠' : '광',
        theme: ev.id === 'godori' ? 'gold' : ev.id === 'hong' ? 'red' : ev.id === 'cheong' ? 'blue' : ev.id === 'cho' ? 'green' : 'storm',
        yaku: ev.id,
        cards: ev.cardIds,
      }
    case 'stop': return { title: '스톱', theme: 'gold' }
    case 'mission': return { title: '미션 성공', kicker: ev.title, theme: 'green' }
    case 'bak': return { title: ev.kind === 'pi' ? '피박' : ev.kind === 'gwang' ? '광박' : ev.kind === 'meong' ? '멍박' : '고박', kicker: '두 배', theme: 'red' }
    case 'triple': return { title: '삼연뻑', kicker: '즉시 승리', theme: 'purple' }
    case 'nagari': return { title: '나가리', theme: 'night' }
    case 'chongtong': return { title: '총통', kicker: '10점', theme: 'gold' }
    case 'floorBonus': return { title: '보너스', kicker: '선이 가져갑니다', theme: 'gold' }
    default: return null
  }
}

export function soundFor(ev: GameEvent) {
  switch (ev.type) {
    case 'play':
    case 'drop':
      return 'kung'
    case 'capture':
      return 'jjak'
    case 'flip':
    case 'token':
      return 'flip'
    case 'deal':
      return 'shuffle'
    case 'jjok':
      return 'jjok'
    case 'ttadak':
    case 'four':
      return 'ttadak'
    case 'ppuk':
      return 'ppuk'
    case 'bomb':
      return 'bomb'
    case 'sweep':
      return 'sweep'
    case 'shake':
      return 'shake'
    case 'go':
      return `go${goIntensity(ev.count)}`
    case 'yaku':
      return `yaku-${ev.id}`
    case 'stop':
      return 'stop'
    case 'mission':
      return 'mission'
    case 'bak':
      return 'bak'
    case 'nagari':
      return 'nagari'
    case 'chongtong':
      return 'chongtong'
    case 'steal':
    case 'bonusPlay':
    case 'bonusDraw':
    case 'floorBonus':
      return 'coin'
    default:
      return null
  }
}

export function Impact({ spec, nonce }: { spec: BannerSpec | null; nonce: number }) {
  if (!spec) return null
  const sparks = (spec.tier ?? 0) >= 5 ? 42 : (spec.tier ?? 0) >= 4 ? 34 : (spec.tier ?? 0) >= 3 ? 26 : spec.yaku ? 24 : 16
  return (
    <div className={`impact theme-${spec.theme} tier-${spec.tier ?? 0} yaku-${spec.yaku ?? 'none'}`} key={nonce}>
      {(spec.tier ?? 0) >= 3 && <div className="flash" />}
      {(spec.tier ?? 0) >= 4 && <div className="storm" />}
      {spec.yaku === 'godori' && <div className="birds" aria-hidden />}
      <div className="impact-copy">
        {spec.kicker && <small>{spec.kicker}</small>}
        <strong>{spec.title}</strong>
      </div>
      {spec.cards && spec.cards.length > 0 && (
        <div className="impact-cards">
          {spec.cards.map((id) => (
            <HwatuCard key={id} id={id} />
          ))}
        </div>
      )}
      {Array.from({ length: sparks }, (_, i) => (
        <i key={i} className="spark" style={{ ['--i' as string]: String(i) }} />
      ))}
    </div>
  )
}
