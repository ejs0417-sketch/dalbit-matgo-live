/**
 * 달빛맞고 : 강호무림 — 《화산귀환》풍 무협 웹툰 VFX 엔진 (v0.5)
 *
 * v0.4의 Canvas 도형(원·사각형·삼각형) 파티클은 전부 폐기했다.
 * 모든 이펙트는 실제로 그린 일러스트 스프라이트(/art/fx/*.webp, 검은 배경 RGB → mix-blend-mode: screen)를
 * 웹툰 연출 문법으로 합성한다:
 *   - 사선 액션 컷 패널(clip-path 대각선 프레임) + 먹 테두리
 *   - 암전 + 집중선(스피드라인)
 *   - 매화 꽃잎 폭풍(화산귀환 시그니처, fx-plum-storm.webp)
 *   - 거친 붓글씨 의성어(서걱! · 콰광! · 파아앙! …)
 * 모든 레이어는 pointer-events: none 고정 (입력·타이머 방해 금지).
 */

export type WuxiaEventKind =
  | 'kung' | 'jjak'
  | 'jjok' | 'ttadak' | 'sweep' | 'four'
  | 'firstPpuk' | 'doublePpuk' | 'triple' | 'ownPpuk' | 'eatPpuk'
  | 'bomb' | 'shake' | 'chongtong'
  | 'bonusPlay' | 'bonusDraw' | 'gukjin' | 'mission' | 'nagari'
  | 'yaku:godori' | 'yaku:hong' | 'yaku:cheong' | 'yaku:cho'
  | 'yaku:sam' | 'yaku:bisam' | 'yaku:sa' | 'yaku:o'
  | 'go' | 'stop'
  | 'bak:pi' | 'bak:gwang' | 'bak:meong' | 'bak:gobak'
  | 'jackpot';

/** 실제 그린 일러스트 스프라이트 (검은 배경 → screen 합성) */
export type WuxiaSprite =
  | 'godori-birds' | 'slash' | 'flame-dragon' | 'frost-wave'
  | 'thunder-gwang' | 'seal-burst' | 'coin-jackpot' | 'plum-storm' | 'impact' | 'speedlines';

/** 스프라이트 모션 문법 */
export type WuxiaMotion = 'sweep' | 'slash' | 'roar' | 'wave' | 'strike' | 'stamp' | 'fountain' | 'pop';

export const WUXIA_SPRITES: Record<WuxiaSprite, string> = {
  // v0.5: 《화산귀환》 웹툰 일러스트(art/vfx) 우선
  'godori-birds': '/art/vfx/fx-bird.webp',
  slash: '/art/vfx/fx-slash.webp',
  'flame-dragon': '/art/vfx/fx-flame.webp',
  'frost-wave': '/art/vfx/fx-ice.webp',
  'thunder-gwang': '/art/vfx/fx-lightning.webp',
  'seal-burst': '/art/vfx/fx-bomb.webp',
  'coin-jackpot': '/art/vfx/fx-coin.webp',
  speedlines: '/art/vfx/fx-speedlines.webp',
  'plum-storm': '/art/fx/fx-plum-storm.webp',
  impact: '/art/fx/fx-impact.webp',
};

export const WUXIA_PRELOAD_URLS = ['/art/table-mat.webp', '/art/vfx/mat-bg.webp', ...Object.values(WUXIA_SPRITES)];

const preloaded: HTMLImageElement[] = [];
/** 로비/대국 진입 시 호출 — 컷인 발동 순간 디코딩 지연·깜빡임 0 */
export function preloadWuxiaArt() {
  if (preloaded.length || typeof Image === 'undefined') return;
  for (const src of WUXIA_PRELOAD_URLS) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    void img.decode?.().catch(() => undefined);
    preloaded.push(img);
  }
}

export interface WuxiaEffectSpec {
  sub: string;
  title: string;
  seal?: string;
  badge?: string;
  accent: string;
  /** 메인 일러스트 */
  sprite?: WuxiaSprite;
  motion?: WuxiaMotion;
  /** 사선 액션 컷 패널에 담을지(대형 컷인) */
  panel?: boolean;
  /** 암전 + 집중선 */
  speedlines?: boolean;
  /** 매화 꽃잎 폭풍 */
  petals?: boolean;
  /** 붓글씨 의성어 */
  onomatopoeia?: string;
  shake?: 'sm' | 'md' | 'lg';
  beatChars?: string[];
  durationMs: number;
}

export const WUXIA_EFFECT_CATALOG: Record<WuxiaEventKind, WuxiaEffectSpec> = {
  kung: { sub: '', title: '', accent: '#f5c95b', shake: 'sm', durationMs: 320 },
  jjak: { sub: '', title: '', accent: '#fff0a8', durationMs: 320 },

  jjok: { sub: '매화 일섬', title: '쪽!', seal: '閃', badge: '피 1장 강탈', accent: '#ffb3c8', sprite: 'slash', motion: 'slash', petals: true, onomatopoeia: '서걱!', shake: 'sm', durationMs: 1000 },
  ttadak: { sub: '매화 쌍검', title: '따닥!', seal: '連', badge: '피 1장 강탈', accent: '#ff9d3b', sprite: 'slash', motion: 'slash', petals: true, onomatopoeia: '서걱 서걱!', shake: 'md', durationMs: 1050 },
  sweep: { sub: '일소 천하', title: '판쓸이!', seal: '掃', badge: '피 1장 강탈', accent: '#ffd0dc', sprite: 'slash', motion: 'slash', panel: true, speedlines: true, petals: true, onomatopoeia: '쐐애액!', shake: 'md', durationMs: 1150 },
  four: { sub: '사방 싹쓸', title: '사방 싹쓸!', seal: '四', badge: '4장 동시 획득', accent: '#f5c95b', sprite: 'slash', motion: 'slash', petals: true, onomatopoeia: '촤악!', shake: 'md', durationMs: 1100 },

  firstPpuk: { sub: '개문 봉인', title: '초수 · 첫뻑!', seal: '封', badge: '+7점 즉금 보너스', accent: '#ff5263', sprite: 'seal-burst', motion: 'stamp', panel: true, speedlines: true, onomatopoeia: '쾅!', shake: 'md', durationMs: 1300 },
  doublePpuk: { sub: '연환 봉인', title: '연환 · 연뻑!', seal: '連', badge: '+14점 즉금 보너스', accent: '#ff3b52', sprite: 'seal-burst', motion: 'stamp', panel: true, speedlines: true, petals: true, onomatopoeia: '쾅! 쾅!', shake: 'lg', durationMs: 1450 },
  triple: { sub: '일격 필살', title: '삼연뻑 · 즉승!', seal: '絶', badge: '즉시 승리 잭팟', accent: '#ffd86b', sprite: 'seal-burst', motion: 'stamp', panel: true, speedlines: true, petals: true, onomatopoeia: '콰광!', shake: 'lg', durationMs: 1800 },
  ownPpuk: { sub: '봉인 파쇄', title: '자뻑 먹기!', seal: '破', badge: '피 2장 강탈', accent: '#ff8a3d', sprite: 'slash', motion: 'slash', petals: true, onomatopoeia: '파삭!', shake: 'md', durationMs: 1050 },
  eatPpuk: { sub: '봉인 파쇄', title: '뻑 먹기!', seal: '破', badge: '피 1장 강탈', accent: '#f5c95b', sprite: 'slash', motion: 'slash', petals: true, onomatopoeia: '파삭!', shake: 'sm', durationMs: 1000 },

  bomb: { sub: '팔괘 화염진', title: '폭탄!', seal: '爆', badge: '배수 ×2 · 피 강탈', accent: '#ff5238', sprite: 'seal-burst', motion: 'roar', panel: true, speedlines: true, onomatopoeia: '콰광!', shake: 'lg', durationMs: 1400 },
  shake: { sub: '내공 개방', title: '흔들기!', seal: '震', badge: '승리 시 ×2', accent: '#ff7a3d', sprite: 'flame-dragon', motion: 'roar', onomatopoeia: '우우웅!', shake: 'lg', durationMs: 1150 },
  chongtong: { sub: '천명 강림', title: '천명 · 총통!', seal: '天', badge: '즉시 승리', accent: '#ffd86b', sprite: 'thunder-gwang', motion: 'strike', panel: true, speedlines: true, onomatopoeia: '콰르릉!', shake: 'lg', durationMs: 1700 },

  bonusPlay: { sub: '행운 엽전', title: '보너스패!', seal: '福', accent: '#ffd86b', sprite: 'coin-jackpot', motion: 'fountain', onomatopoeia: '차르륵!', durationMs: 900 },
  bonusDraw: { sub: '추가 수급', title: '보너스 추가!', seal: '福', accent: '#ffd86b', sprite: 'coin-jackpot', motion: 'fountain', onomatopoeia: '차르륵!', durationMs: 850 },
  gukjin: { sub: '황금 각성', title: '국진 쌍피 전환!', seal: '覺', accent: '#f5c95b', sprite: 'impact', motion: 'pop', durationMs: 950 },
  mission: { sub: '강호 밀명 완수', title: '미션 달성!', seal: '完', badge: '배수 보너스', accent: '#ffd86b', sprite: 'coin-jackpot', motion: 'fountain', panel: true, petals: true, onomatopoeia: '파아앙!', shake: 'md', durationMs: 1400 },
  nagari: { sub: '먹물 안개', title: '나가리', seal: '無', badge: '다음 판 ×2 이월', accent: '#c4cbd4', speedlines: true, durationMs: 1200 },

  'yaku:godori': { sub: '비조 삼연격', title: '고·도·리!', beatChars: ['고!', '도!', '리!'], seal: '鳥', badge: '+5점 족보 완성', accent: '#ffd86b', sprite: 'godori-birds', motion: 'sweep', speedlines: true, petals: true, onomatopoeia: '파아앙!', shake: 'lg', durationMs: 1900 },
  'yaku:hong': { sub: '홍염 화룡검', title: '홍단 · 화룡검!', seal: '紅', badge: '+3점 족보 완성', accent: '#ff4b5c', sprite: 'flame-dragon', motion: 'roar', panel: true, speedlines: true, petals: true, onomatopoeia: '화르륵!', shake: 'lg', durationMs: 1600 },
  'yaku:cheong': { sub: '한빙 일섬', title: '청단 · 한빙검!', seal: '靑', badge: '+3점 족보 완성', accent: '#7fe3ff', sprite: 'frost-wave', motion: 'wave', panel: true, speedlines: true, onomatopoeia: '쩌저정!', shake: 'md', durationMs: 1600 },
  'yaku:cho': { sub: '질풍 매화검', title: '초단 · 질풍검!', seal: '草', badge: '+3점 족보 완성', accent: '#ff9fbf', sprite: 'slash', motion: 'slash', panel: true, speedlines: true, petals: true, onomatopoeia: '쐐애액!', shake: 'md', durationMs: 1500 },
  'yaku:sam': { sub: '광명 천뢰', title: '삼광!', seal: '光', badge: '+3점', accent: '#ffd86b', sprite: 'thunder-gwang', motion: 'strike', panel: true, speedlines: true, onomatopoeia: '콰르릉!', shake: 'md', durationMs: 1550 },
  'yaku:bisam': { sub: '비광 천뢰', title: '비삼광!', seal: '光', badge: '+2점', accent: '#f5c95b', sprite: 'thunder-gwang', motion: 'strike', panel: true, speedlines: true, onomatopoeia: '콰르릉!', shake: 'md', durationMs: 1500 },
  'yaku:sa': { sub: '사광 강림', title: '사광!', seal: '光', badge: '+4점', accent: '#ffe17a', sprite: 'thunder-gwang', motion: 'strike', panel: true, speedlines: true, onomatopoeia: '콰광!', shake: 'lg', durationMs: 1650 },
  'yaku:o': { sub: '천하 무쌍', title: '오광 · 천뢰!', seal: '覇', badge: '+15점 대박', accent: '#fff0a8', sprite: 'thunder-gwang', motion: 'strike', panel: true, speedlines: true, petals: true, onomatopoeia: '콰과광!', shake: 'lg', durationMs: 1900 },

  go: { sub: '내공 증폭', title: '고!', seal: '進', accent: '#ff9d3b', sprite: 'impact', motion: 'pop', speedlines: true, onomatopoeia: '우웅!', shake: 'md', durationMs: 1100 },
  stop: { sub: '일격 종결', title: '스톱!', seal: '止', accent: '#ffd86b', sprite: 'slash', motion: 'slash', panel: true, petals: true, onomatopoeia: '서걱!', shake: 'md', durationMs: 1200 },

  'bak:pi': { sub: '혈기 낙인', title: '피박! ×2', seal: '血', accent: '#ff4252', sprite: 'seal-burst', motion: 'stamp', onomatopoeia: '쾅!', shake: 'md', durationMs: 1000 },
  'bak:gwang': { sub: '천뢰 낙인', title: '광박! ×2', seal: '雷', accent: '#ffd86b', sprite: 'thunder-gwang', motion: 'strike', onomatopoeia: '콰릉!', shake: 'md', durationMs: 1000 },
  'bak:meong': { sub: '맹수 낙인', title: '멍따! ×2', seal: '猛', accent: '#ff9d3b', sprite: 'seal-burst', motion: 'stamp', onomatopoeia: '쾅!', shake: 'md', durationMs: 1000 },
  'bak:gobak': { sub: '역전 파쇄', title: '고박! ×2', seal: '逆', accent: '#c074ff', sprite: 'seal-burst', motion: 'stamp', onomatopoeia: '쾅!', shake: 'lg', durationMs: 1050 },
  jackpot: { sub: '강호 대승', title: '대박 정산!', seal: '勝', accent: '#ffd86b', sprite: 'coin-jackpot', motion: 'fountain', panel: true, speedlines: true, petals: true, onomatopoeia: '파아앙!', shake: 'lg', durationMs: 1900 },
};

function el(className: string, parent?: HTMLElement): HTMLDivElement {
  const d = document.createElement('div');
  d.className = className;
  parent?.appendChild(d);
  return d;
}

function spriteImg(sprite: WuxiaSprite, className: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = WUXIA_SPRITES[sprite];
  img.alt = '';
  img.draggable = false;
  img.decoding = 'sync';
  img.className = className;
  return img;
}

export class WuxiaEffectsEngine {
  private layer: HTMLDivElement;
  private aura: HTMLDivElement;
  private active: HTMLElement[] = [];
  private timers: number[] = [];

  constructor(private host: HTMLElement = document.body) {
    preloadWuxiaArt();
    this.aura = el('wx-go-aura');
    this.layer = el('wx-layer');
    this.host.append(this.aura, this.layer);
  }

  setGoLevel(count: number) {
    const lv = Math.max(0, Math.min(5, Math.floor(count)));
    this.aura.className = lv > 0 ? `wx-go-aura level-${lv}` : 'wx-go-aura';
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private clearActive() {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    for (const n of this.active) n.remove();
    this.active = [];
  }

  trigger(kind: WuxiaEventKind, overrides?: Partial<Pick<WuxiaEffectSpec, 'title' | 'badge' | 'sub'>>) {
    const base = WUXIA_EFFECT_CATALOG[kind];
    if (!base) return;
    const spec: WuxiaEffectSpec = { ...base, ...overrides };
    const reduced = document.body.classList.contains('calm') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!reduced && spec.shake) {
      const cls = `wx-shake-${spec.shake}`;
      this.host.classList.remove('wx-shake-sm', 'wx-shake-md', 'wx-shake-lg');
      void this.host.offsetWidth;
      this.host.classList.add(cls);
      window.setTimeout(() => this.host.classList.remove(cls), 560);
    }

    // 소형 타패 이벤트(kung/jjak)는 보드 쪽 물리 연출이 담당 — 오버레이 없음
    if (!spec.title && !spec.sprite) return;

    this.clearActive();
    const root = el(`wx-scene motion-${spec.motion ?? 'none'}${spec.panel ? ' has-panel' : ''}${reduced ? ' reduced' : ''}`);
    root.style.setProperty('--wx-accent', spec.accent);
    root.style.setProperty('--wx-dur', `${spec.durationMs}ms`);
    root.dataset.kind = kind;
    this.layer.appendChild(root);
    this.active.push(root);

    if (spec.speedlines || spec.panel) el('wx-dim', root);
    if (spec.speedlines && !reduced) {
      el('wx-speedlines', root);
      root.appendChild(spriteImg('speedlines', 'wx-sprite free wx-speed-art'));
    }

    if (spec.sprite) {
      if (spec.panel) {
        // 사선 웹툰 액션 컷: 먹 테두리 프레임 + 안쪽 패널에 일러스트 screen 합성
        const frame = el('wx-panel-frame', root);
        const panel = el('wx-panel', frame);
        panel.appendChild(spriteImg(spec.sprite, 'wx-sprite in-panel'));
        if (spec.petals && !reduced) panel.appendChild(spriteImg('plum-storm', 'wx-petals in-panel'));
      }
      if (spec.motion === 'fountain') {
        for (let i = 0; i < 3; i++) {
          const img = spriteImg('coin-jackpot', `wx-sprite free fountain f${i}`);
          root.appendChild(img);
        }
      } else if (!spec.panel || spec.motion === 'sweep') {
        root.appendChild(spriteImg(spec.sprite, `wx-sprite free m-${spec.motion ?? 'pop'}`));
      }
      if (!spec.panel && spec.motion !== 'fountain' && spec.motion !== 'pop') {
        root.appendChild(spriteImg('impact', 'wx-sprite free m-impact'));
      }
    }

    if (spec.petals && !reduced) {
      root.appendChild(spriteImg('plum-storm', 'wx-petals free p0'));
      root.appendChild(spriteImg('plum-storm', 'wx-petals free p1'));
    }

    if (spec.beatChars?.length) {
      // 고! · 도! · 리! 3박자 사선 컷
      spec.beatChars.forEach((ch, i) => {
        const beat = el(`wx-beat b${i}`, root);
        const inner = el('wx-beat-panel', beat);
        inner.appendChild(spriteImg(spec.sprite ?? 'godori-birds', 'wx-beat-art'));
        const t = el('wx-beat-text', inner);
        t.textContent = ch;
      });
    }

    if (spec.onomatopoeia) {
      const sfx = el('wx-sfx', root);
      sfx.textContent = spec.onomatopoeia;
    }

    if (spec.title) this.showCaption(spec, root);

    this.later(() => {
      root.remove();
      this.active = this.active.filter((n) => n !== root);
    }, spec.durationMs + 120);
  }

  private showCaption(spec: WuxiaEffectSpec, root: HTMLElement) {
    const box = el('wx-cutin', root);
    if (spec.sub) el('wx-cutin-sub', box).textContent = spec.sub;
    const title = el('wx-cutin-title', box);
    title.textContent = spec.title;
    if (spec.seal) {
      const seal = document.createElement('span');
      seal.className = 'wx-seal';
      seal.textContent = spec.seal;
      title.appendChild(seal);
    }
    if (spec.badge) el('wx-cutin-badge', box).textContent = spec.badge;
  }

  destroy() {
    this.clearActive();
    this.layer.remove();
    this.aura.remove();
  }
}
