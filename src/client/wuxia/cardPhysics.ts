/**
 * 달빛맞고 v0.5 — 실물 화투패 물리 모션 엔진 (DOM 좌표 기반 오버레이 비행 레이어)
 * (effects/v05/cardPhysics.ts 의 animateSlamToFloor / animateCaptureSweep / animateStealPi / animateBombTripleSlam 통합본)
 *
 *  1) Slam      : 손패/패산 → 목표 바닥패 좌표로 포물선 비행 → "딱!" 내려찍기(50ms 히트스톱) + 담요 진동 + 타격 섬광
 *  2) Capture   : 맞춘 바닥패 + 낸 패가 실제 바닥 좌표에서 먹은 사람의 먹은 패 줄(광/열/띠/피)로 날아가 꽂힘
 *  3) Steal     : 상대 피 더미 좌표에서 피 카드가 뽑혀 포물선으로 내 피 더미에 꽂힘 (반대도 동일)
 *  4) Ppuk      : 같은 월 3장 포개진 스택이 탁-탁-쿵 내려앉음
 *  5) Bomb      : 손패 같은 월 3장이 부채꼴로 0/45/90ms 간격 3연타로 바닥패 위에 꽂힘
 *
 * 서버가 패킷을 보낼 때 DOM은 이미 최종 상태이므로, 직전 상태의 카드 좌표(lastRects)를 기억해 두었다가
 * 이번 배치에서 바닥에서 사라진 카드는 원래 자리에 "핀(pin)" 복제본으로 붙여 두고, 비행이 끝나면 걷어낸다.
 * 모든 레이어는 pointer-events: none.
 */
import { CARDS, cardImage } from '../../engine/cards'

type Rect = { left: number; top: number; width: number; height: number }

const reduced = () =>
  document.body.classList.contains('calm') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function center(r: Rect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
function toRect(d: DOMRect): Rect {
  return { left: d.left, top: d.top, width: d.width, height: d.height }
}
function sized(r: Rect, w: number, h: number): Rect {
  const c = center(r)
  return { left: c.x - w / 2, top: c.y - h / 2, width: w, height: h }
}

export class CardPhysics {
  private layer: HTMLDivElement
  private pins = new Map<string, HTMLElement>()
  private lastRects = new Map<string, Rect>()
  private floorCard = { w: 44, h: 70 }

  constructor(private stage: () => HTMLElement | null) {
    this.layer = document.createElement('div')
    this.layer.className = 'wx-fly-layer'
    document.body.appendChild(this.layer)
  }

  destroy() {
    this.layer.remove()
    this.pins.clear()
  }

  private q(sel: string): HTMLElement | null {
    return (this.stage() ?? document).querySelector(sel) as HTMLElement | null
  }

  private cardEl(id: string, scope = ''): HTMLElement | null {
    return this.q(`${scope} [data-card="${id}"]`)
  }

  /** 애니메이션 배치가 끝날 때마다 현재 카드 좌표를 기억 */
  snapshot() {
    const root = this.stage()
    if (!root) return
    this.rememberFloor()
    this.lastRects.clear()
    root.querySelectorAll<HTMLElement>('.floor [data-card], .hand.you [data-card]').forEach((n) => {
      const id = n.dataset.card
      if (id) this.lastRects.set(id, toRect(n.getBoundingClientRect()))
    })
    const any = root.querySelector<HTMLElement>('.floor .hwatu')
    if (any) {
      const r = any.getBoundingClientRect()
      if (r.width > 10) this.floorCard = { w: r.width, h: r.height }
    }
  }

  /** 배치 시작: 직전에 바닥에 있었는데 지금 DOM에서 사라진 카드(이번 배치에 먹힌 카드)를 원래 자리에 핀 고정 */
  beginBatch() {
    this.clearPins()
    for (const [id, rect] of this.lastRects) {
      if (this.cardEl(id, '.floor')) continue
      if (this.cardEl(id, '.hand.you')) continue
      // 손패였던 카드는 핀 대상 아님 (바닥에서 사라진 카드만)
      if (!this.wasFloor.has(id)) continue
      this.pin(id, rect, 0)
    }
  }
  private wasFloor = new Set<string>()
  rememberFloor() {
    this.wasFloor = new Set(
      Array.from((this.stage() ?? document).querySelectorAll<HTMLElement>('.floor [data-card]')).map((n) => n.dataset.card ?? ''),
    )
  }

  clearPins() {
    for (const p of this.pins.values()) p.remove()
    this.pins.clear()
  }

  private makeCard(id: string, r: Rect, cls = 'wx-fly-card'): HTMLDivElement {
    const el = document.createElement('div')
    el.className = cls
    el.style.left = `${r.left}px`
    el.style.top = `${r.top}px`
    el.style.width = `${r.width}px`
    el.style.height = `${r.height}px`
    const img = document.createElement('img')
    img.src = cardImage(id)
    img.alt = ''
    img.draggable = false
    el.appendChild(img)
    this.layer.appendChild(el)
    return el
  }

  private pin(id: string, r: Rect, angle: number) {
    this.pins.get(id)?.remove()
    const el = this.makeCard(id, r, 'wx-fly-card pinned')
    el.style.transform = `rotate(${angle}deg)`
    this.pins.set(id, el)
  }

  /** 카드의 현재 출발 좌표 (핀 → 직전 좌표 → 지금 DOM) */
  private rectOf(id: string): Rect | null {
    const p = this.pins.get(id)
    if (p) return toRect(p.getBoundingClientRect())
    const now = this.cardEl(id)
    if (now) {
      const r = now.getBoundingClientRect()
      if (r.width > 4) return toRect(r)
    }
    return this.lastRects.get(id) ?? null
  }

  /** 낸 패가 꽂힐 목표: 같은 월의 바닥패(핀 포함) → 지금 바닥에 놓인 자기 자리 → 바닥 중앙 */
  private targetFor(id: string): { rect: Rect; stack: boolean } {
    const month = CARDS[id]?.month
    if (month) {
      for (const [pid, el] of this.pins) {
        if (pid !== id && CARDS[pid]?.month === month) return { rect: toRect(el.getBoundingClientRect()), stack: true }
      }
      const pile = this.q(`.floor .pile[data-month="${month}"]`)
      if (pile) {
        const cards = pile.querySelectorAll<HTMLElement>('[data-card]')
        const other = Array.from(cards).find((c) => c.dataset.card !== id)
        const own = Array.from(cards).find((c) => c.dataset.card === id)
        if (own) return { rect: toRect(own.getBoundingClientRect()), stack: false }
        if (other) return { rect: toRect(other.getBoundingClientRect()), stack: true }
      }
    }
    const floor = this.q('.floor')
    const r = floor ? toRect(floor.getBoundingClientRect()) : { left: innerWidth / 2 - 22, top: innerHeight / 2 - 35, width: 44, height: 70 }
    return { rect: sized(r, this.floorCard.w, this.floorCard.h), stack: false }
  }

  private sourceFor(id: string, from: 'you' | 'opp' | 'deck'): Rect {
    const { w, h } = this.floorCard
    if (from === 'you') {
      const last = this.lastRects.get(id)
      if (last) return last
      const hand = this.q('.hand.you')
      if (hand) return sized(toRect(hand.getBoundingClientRect()), w, h)
      return { left: innerWidth / 2 - w / 2, top: innerHeight - h, width: w, height: h }
    }
    if (from === 'opp') {
      const hand = this.q('.hand.opp') ?? this.q('.player.top')
      if (hand) return sized(toRect(hand.getBoundingClientRect()), w * 0.6, h * 0.6)
      return { left: innerWidth / 2, top: 0, width: w, height: h }
    }
    const deck = this.q('.deck')
    if (deck) return sized(toRect(deck.getBoundingClientRect()), w, h)
    return { left: innerWidth / 2, top: innerHeight / 2, width: w, height: h }
  }

  private capRow(side: 'you' | 'opp', id: string): Rect {
    const kind = CARDS[id]?.kind
    const row = kind === 'gwang' ? 'gwang' : kind === 'yeol' ? 'yeol' : kind === 'tti' ? 'tti' : 'pi'
    const el = this.q(`[data-captures="${side}"] .cap-${row} .wx-cap-stack`) ?? this.q(`[data-captures="${side}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      // 줄의 오른쪽 끝(새 카드가 꽂히는 자리)
      return { left: r.right - 18, top: r.top + r.height / 2 - 13, width: 16, height: 26 }
    }
    return { left: side === 'you' ? innerWidth - 60 : 40, top: side === 'you' ? innerHeight * 0.7 : 40, width: 16, height: 26 }
  }

  private thump(at: Rect, big = false) {
    const stage = this.stage()
    const felt = stage?.querySelector<HTMLElement>('.felt')
    if (felt) {
      const flip = felt.dataset.thump === 'a' ? 'b' : 'a'
      felt.dataset.thump = flip
      felt.classList.remove('thump-a', 'thump-b', 'thump-big')
      void felt.offsetWidth
      felt.classList.add(`thump-${flip}`)
      if (big) felt.classList.add('thump-big')
    }
    // 착지 지점 타격 섬광 (그려진 fx-impact 일러스트) + 먹 파문
    const c = center(at)
    const size = Math.max(at.width, at.height) * (big ? 3.4 : 2.4)
    const flash = document.createElement('img')
    flash.src = '/art/fx/fx-impact.webp'
    flash.alt = ''
    flash.className = `wx-slam-flash${big ? ' big' : ''}`
    flash.style.left = `${c.x - size / 2}px`
    flash.style.top = `${c.y - size / 2}px`
    flash.style.width = `${size}px`
    flash.style.height = `${size}px`
    this.layer.appendChild(flash)
    const ring = document.createElement('div')
    ring.className = 'wx-slam-ripple'
    ring.style.left = `${c.x}px`
    ring.style.top = `${c.y}px`
    this.layer.appendChild(ring)
    window.setTimeout(() => { flash.remove(); ring.remove() }, 520)
  }

  /** 공통: 포물선 비행. slam이면 착지 순간 scale .95 → 1 + 50ms 히트스톱 */
  private fly(id: string, from: Rect, to: Rect, o: { ms: number; delay?: number; arc: number; slam?: boolean; a0?: number; a1?: number; peak?: number; back?: boolean }) {
    return new Promise<HTMLDivElement>((resolve) => {
      const el = this.makeCard(o.back ? '' : id, to, 'wx-fly-card flying')
      if (o.back) (el.firstChild as HTMLImageElement).src = '/cards/back.svg'
      const f = center(from)
      const t = center(to)
      const dx = f.x - t.x
      const dy = f.y - t.y
      const s0 = from.width / Math.max(1, to.width)
      const a0 = o.a0 ?? -8
      const a1 = o.a1 ?? 0
      const peak = o.peak ?? (o.slam ? 1.22 : 1.12)
      if (reduced()) {
        window.setTimeout(() => resolve(el), Math.min(80, o.ms))
        return
      }
      const kf: Keyframe[] = o.slam
        ? [
            { transform: `translate(${dx}px, ${dy}px) scale(${s0}) rotate(${a0}deg)`, boxShadow: '0 4px 8px rgba(0,0,0,.5)', offset: 0 },
            { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - o.arc}px) scale(${peak}) rotate(${a0 * 0.4}deg)`, boxShadow: '0 34px 30px rgba(0,0,0,.55)', offset: 0.55 },
            { transform: `translate(0, 0) scale(.95) rotate(${a1}deg)`, boxShadow: '0 1px 2px rgba(0,0,0,.9)', filter: 'brightness(1.35)', offset: 0.78, easing: 'steps(1, end)' },
            // 50ms 히트스톱 (0.78 ~ 0.9 구간 정지)
            { transform: `translate(0, 0) scale(.95) rotate(${a1}deg)`, boxShadow: '0 1px 2px rgba(0,0,0,.9)', filter: 'brightness(1.35)', offset: 0.9 },
            { transform: `translate(0, 0) scale(1) rotate(${a1}deg)`, boxShadow: '0 3px 6px rgba(0,0,0,.55)', filter: 'brightness(1)', offset: 1 },
          ]
        : [
            { transform: `translate(${dx}px, ${dy}px) scale(${s0}) rotate(${a0}deg)`, offset: 0 },
            { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - o.arc}px) scale(${peak}) rotate(${(a0 + a1) / 2}deg)`, boxShadow: '0 22px 22px rgba(0,0,0,.5)', offset: 0.5 },
            { transform: `translate(0, 0) scale(1) rotate(${a1}deg)`, boxShadow: '0 1px 2px rgba(0,0,0,.6)', offset: 1 },
          ]
      const anim = el.animate(kf, {
        duration: o.ms,
        delay: o.delay ?? 0,
        easing: o.slam ? 'cubic-bezier(.3,.7,.35,1)' : 'cubic-bezier(.4,.1,.3,1)',
        fill: 'both',
      })
      anim.onfinish = () => resolve(el)
      anim.oncancel = () => resolve(el)
    })
  }

  /** (1) 바닥에 때리기 — 손패/상대손/패산에서 목표 바닥패 위로 "딱!" */
  async slam(id: string, from: 'you' | 'opp' | 'deck', onLand?: (stack: boolean) => void) {
    const src = this.sourceFor(id, from)
    const { rect, stack } = this.targetFor(id)
    const land: Rect = stack ? { ...rect, left: rect.left + rect.width * 0.3, top: rect.top - rect.height * 0.08 } : rect
    const angle = stack ? 9 : 0
    const el = await this.fly(id, src, land, { ms: from === 'deck' ? 300 : 280, arc: from === 'opp' ? 18 : 46, slam: true, a0: from === 'you' ? -10 : 10, a1: angle, peak: 1.22 })
    this.thump(land)
    onLand?.(stack)
    // 자석처럼 살짝 어긋난 각도로 "딱!" 붙은 상태로 핀 고정 (capture 때 쓸려감)
    el.remove()
    if (!this.cardEl(id, '.floor')) this.pin(id, land, angle)
  }

  /** (5) 폭탄 3장 동시 투하 — 부채꼴 0/45/90ms 3연타 */
  async bombTriple(handIds: string[], floorIds: string[], fromSeat: 'you' | 'opp', onHit?: (i: number) => void) {
    const target = floorIds.map((f) => this.rectOf(f)).find(Boolean) ?? this.targetFor(handIds[0] ?? '').rect
    const fan = [-14, 0, 14]
    const tasks = handIds.slice(0, 3).map(async (id, i) => {
      const src = this.sourceFor(id, fromSeat)
      const from: Rect = { ...src, left: src.left + (i - 1) * src.width * 0.7 }
      const land: Rect = { ...target, left: target.left + (i - 1) * target.width * 0.32, top: target.top - i * 2 }
      const el = await this.fly(id, from, land, { ms: 300, delay: i * 45, arc: 70, slam: true, a0: fan[i] * 1.6, a1: fan[i] * 0.6, peak: 1.34 })
      this.thump(land, i === 2)
      onHit?.(i)
      el.remove()
      this.pin(id, land, fan[i] * 0.6)
    })
    await Promise.all(tasks)
  }

  /** (2) 먹은 패 가져오기 — 실제 바닥 좌표에서 먹은 패 줄로 비행 */
  async captureSweep(ids: string[], side: 'you' | 'opp') {
    const tasks = ids.map(async (id, i) => {
      const from = this.rectOf(id)
      this.pins.get(id)?.remove()
      this.pins.delete(id)
      if (!from) return
      const to = this.capRow(side, id)
      const el = await this.fly(id, from, to, { ms: 360, delay: i * 55, arc: 26, a0: 0, a1: 0, peak: 1.1 })
      el.classList.add('landed')
      window.setTimeout(() => el.remove(), 60)
    })
    await Promise.all(tasks)
  }

  /** (3) 상대방 피 빼서 오기 — 피 더미 → 피 더미 포물선 */
  async stealPi(ids: string[], fromSide: 'you' | 'opp', toSide: 'you' | 'opp') {
    const tasks = ids.map(async (id, i) => {
      const src = this.q(`[data-captures="${fromSide}"] .cap-pi .wx-cap-stack`)
      const r = src ? src.getBoundingClientRect() : null
      const from: Rect = r ? { left: r.right - 18, top: r.top + r.height / 2 - 13, width: 16, height: 26 } : this.capRow(fromSide, id)
      const to = this.capRow(toSide, id)
      const big: Rect = sized(to, this.floorCard.w * 0.62, this.floorCard.h * 0.62)
      const el = await this.fly(id, from, big, { ms: 520, delay: i * 110, arc: Math.max(60, Math.abs(center(from).y - center(to).y) * 0.6 + 50), a0: -18, a1: 6, peak: 2.4 })
      const shrink = el.animate([{ transform: 'scale(1) rotate(6deg)' }, { transform: `scale(${16 / big.width}) rotate(0deg)`, opacity: 0.9 }], { duration: 120, fill: 'forwards', easing: 'ease-in' })
      await new Promise((res) => { shrink.onfinish = res; shrink.oncancel = res })
      el.remove()
    })
    await Promise.all(tasks)
  }

  /** (4) 뻑 — 같은 월 3장 포개짐 */
  ppukStack(month: number) {
    const pile = this.q(`.floor .pile[data-month="${month}"]`)
    if (!pile) return
    pile.classList.remove('ppuk-drop')
    void pile.offsetWidth
    pile.classList.add('ppuk-drop')
    this.thump(toRect(pile.getBoundingClientRect()), true)
  }
}
