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
      className={`hwatu${def?.kind === 'bonus' ? ' bonus' : ''}${mini ? ' mini' : ''}${hot ? ' hot' : ''}${pick ? ' pick' : ''}${onClick ? ' live' : ''}`}
      style={{ ['--tilt' as string]: `${id && !mini ? tiltOf(id) : 0}deg` }}
      data-card={id && !back ? id : undefined}
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
  fx?: 'slash' | 'seal' | 'bagua' | 'godori' | 'flame' | 'frost' | 'wind' | 'jackpot' | 'aura'
}

export function bannerFor(ev: GameEvent): BannerSpec | null {
  switch (ev.type) {
    case 'jjok': return { title: '쪽!', kicker: '일섬', theme: 'slash', fx: 'slash' }
    case 'ttadak': return { title: '따닥!', kicker: '연격', theme: 'slash', fx: 'slash' }
    case 'sweep': return { title: '쓸!', kicker: '일소', theme: 'slash', fx: 'slash' }
    case 'four': return { title: '싹쓸!', kicker: '일소', theme: 'slash', fx: 'slash' }
    case 'ppuk': return { title: ev.combo >= 3 ? '삼연뻑!' : ev.combo === 2 ? '연뻑!' : '뻑!', kicker: ev.combo >= 3 ? '즉승' : ev.combo === 2 ? '연환' : '봉인', theme: 'purple', fx: ev.combo >= 3 ? 'jackpot' : 'seal' }
    case 'firstPpuk': return { title: '첫뻑!', kicker: '초수 · +7점', theme: 'purple', fx: 'jackpot' }
    case 'doublePpuk': return { title: '연뻑!', kicker: '연환 · +14점', theme: 'purple', fx: 'jackpot' }
    case 'ownPpuk': return { title: '자뻑!', kicker: '봉인 파쇄', theme: 'red', fx: 'seal' }
    case 'eatPpuk': return { title: '뻑먹기!', kicker: '봉인 파쇄', theme: 'gold', fx: 'seal' }
    case 'triple': return { title: '삼연뻑 · 즉승!', kicker: '천지개벽', theme: 'storm', fx: 'jackpot' }
    case 'bomb': return { title: '폭탄!', kicker: '팔괘 진법', theme: 'red', fx: 'bagua' }
    case 'shake': return { title: '흔들기!', kicker: monthLabel(ev.month), theme: 'gold', fx: 'bagua' }
    case 'chongtong': return { title: '총통!', kicker: '네 장 즉승', theme: 'storm', fx: 'jackpot' }
    case 'go': {
      const tier = goIntensity(ev.count)
      const theme = tier === 1 ? 'gold' : tier === 2 ? 'ember' : tier === 3 ? 'fire' : 'storm'
      return { title: `${ev.count}고`, kicker: tier >= 3 ? `내공 ×${2 ** (ev.count - 2)}` : '내공', theme, tier, fx: tier >= 3 ? 'jackpot' : 'aura' }
    }
    case 'stop': return { title: '스톱!', kicker: '승부', theme: 'gold', fx: 'seal' }
    case 'yaku': {
      const map = {
        godori: { title: '고도리!', kicker: '+5점', theme: 'gold', fx: 'godori' as const },
        hong: { title: '홍단!', kicker: '+3점', theme: 'red', fx: 'flame' as const },
        cheong: { title: '청단!', kicker: '+3점', theme: 'blue', fx: 'frost' as const },
        cho: { title: '초단!', kicker: '+3점', theme: 'green', fx: 'wind' as const },
        sam: { title: '삼광!', kicker: '천뢰', theme: 'storm', fx: 'jackpot' as const },
        bisam: { title: '비삼광!', kicker: '천뢰', theme: 'storm', fx: 'jackpot' as const },
        sa: { title: '사광!', kicker: '천뢰', theme: 'storm', fx: 'jackpot' as const },
        o: { title: '오광!', kicker: '천뢰', theme: 'storm', fx: 'jackpot' as const },
      }
      const hit = map[ev.id]
      return { ...hit, yaku: ev.id, cards: ev.cardIds }
    }
    case 'mission': return { title: '미션!', kicker: ev.title, theme: 'green', fx: 'jackpot' }
    case 'bak': {
      const title = ev.kind === 'pi' ? '피박!' : ev.kind === 'gwang' ? '광박!' : ev.kind === 'meong' ? '멍박!' : '고박!'
      const theme = ev.kind === 'pi' ? 'red' : ev.kind === 'gwang' ? 'gold' : ev.kind === 'gobak' ? 'purple' : 'night'
      return { title, kicker: '×2', theme, fx: 'seal' }
    }
    case 'nagari': return { title: '나가리', kicker: '다음 판 ×2', theme: 'night', fx: 'seal' }
    case 'floorBonus': return { title: '보너스패!', kicker: '쌍피 · 쓰리피', theme: 'gold', fx: 'jackpot' }
    case 'bonusPlay':
    case 'bonusDraw': return { title: '보너스!', kicker: ev.type === 'bonusPlay' ? '손패' : '더미', theme: 'gold', fx: 'jackpot' }
    case 'steal': return { title: '피 빼기!', kicker: ev.cardIds.length ? `${ev.cardIds.length}장` : '빚', theme: 'gold', fx: 'slash' }
    case 'gukjin': return { title: '국진!', kicker: ev.asPi ? '쌍피' : '열끗', theme: 'gold', fx: 'seal' }
    default: return null
  }
}

export function soundFor(ev: GameEvent): string | null {
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
    case 'steal':
      return 'steal'
    case 'floorBonus':
      return 'bonusPlay'
    case 'win':
      return 'jackpot'
    case 'yaku':
      return `yaku:${ev.id}`
    case 'bak':
      return `bak:${ev.kind}`
    case 'go':
      return `go${Math.max(1, Math.min(5, goIntensity(ev.count)))}`
    case 'ppuk':
    case 'jjok':
    case 'ttadak':
    case 'four':
    case 'sweep':
    case 'ownPpuk':
    case 'eatPpuk':
    case 'gukjin':
    case 'stop':
    case 'nagari':
    case 'firstPpuk':
    case 'doublePpuk':
    case 'triple':
    case 'chongtong':
    case 'mission':
    case 'bonusPlay':
    case 'bonusDraw':
    case 'bomb':
    case 'shake':
      return ev.type
    default:
      return null
  }
}

export function Impact({ spec, nonce }: { spec: BannerSpec | null; nonce: number }) {
  if (!spec) return null
  const fx = spec.fx ?? 'seal'
  const jackpot = fx === 'jackpot' || fx === 'godori' || (spec.tier ?? 0) >= 3
  return (
    <div className={`impact theme-${spec.theme} tier-${spec.tier ?? 0} yaku-${spec.yaku ?? 'none'} fx-${fx}`} key={nonce}>
      {jackpot && <div className="sunburst" />}
      {jackpot && <div className="coin-rain" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ ['--i' as string]: String(i) }} />)}</div>}
      {(fx === 'slash' || fx === 'frost' || fx === 'flame' || fx === 'wind') && <div className={`slash slash-${fx}`} />}
      {(fx === 'bagua' || fx === 'jackpot') && <div className="bagua" />}
      {(spec.tier ?? 0) >= 3 && <div className="aura-ring" />}
      {fx === 'godori' && (
        <div className="godori-fly" aria-hidden>
          <b>고!</b><b>도!</b><b>리!</b>
          <i className="bird" /><i className="bird" /><i className="bird" />
        </div>
      )}
      <div className="impact-copy">
        {spec.kicker && <small>{spec.kicker}</small>}
        <strong>{spec.title}</strong>
        <em className="seal-mark">쾅</em>
      </div>
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} className="spark" style={{ ['--i' as string]: String(i) }} />
      ))}
    </div>
  )
}
