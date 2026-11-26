/**
 * 달빛맞고 : 강호무림 — 무공 초식 × 슬롯 잭팟 이펙트 엔진 (v0.4)
 * 기준 문서: /workspace/dalbit-matgo/art/CONCEPT.md
 * - Canvas 2D 파티클(검기 슬래시, 수묵 파동, 황금 비조 3마리, 화염/한빙/질풍, 천뢰 번개, 엽전 분수)
 * - DOM 컷인(고·도·리 3박자 붓글씨, 주홍 낙관, 팔괘 진법, 선버스트, 고 단계 내공 오라)
 * - 모든 레이어 pointer-events: none 고정 (입력·타이머 방해 금지)
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

export interface WuxiaEffectSpec {
  sub: string;
  title: string;
  seal?: string;
  badge?: string;
  accent: string;
  flash?: 'gold' | 'crimson' | 'ice' | 'jade' | 'violet';
  sunburst?: 'gold' | 'crimson' | 'ice';
  bagua?: boolean;
  shake?: 'sm' | 'md' | 'lg';
  beatChars?: string[];
  canvasFx: Array<
    | 'inkRing' | 'slashGold' | 'slashDouble' | 'slashFire' | 'slashIce'
    | 'windLeaves' | 'birds3' | 'lightning' | 'coins' | 'sparks' | 'inkMist'
  >;
  durationMs: number;
}

export const WUXIA_EFFECT_CATALOG: Record<WuxiaEventKind, WuxiaEffectSpec> = {
  kung: { sub: '', title: '', accent: '#f5c95b', shake: 'sm', canvasFx: ['inkRing'], durationMs: 360 },
  jjak: { sub: '', title: '', accent: '#fff0a8', canvasFx: ['slashGold', 'sparks'], durationMs: 360 },

  jjok: { sub: '일섬 초식', title: '쪽!', seal: '閃', badge: '피 1장 강탈', accent: '#f5c95b', flash: 'gold', shake: 'sm', canvasFx: ['slashGold', 'sparks'], durationMs: 920 },
  ttadak: { sub: '쌍검 연격', title: '따닥!', seal: '連', badge: '피 1장 강탈', accent: '#ff9d3b', flash: 'gold', shake: 'md', canvasFx: ['slashDouble', 'sparks'], durationMs: 980 },
  sweep: { sub: '일소 천하', title: '판쓸이!', seal: '掃', badge: '피 1장 강탈', accent: '#5cd6ff', flash: 'ice', shake: 'md', canvasFx: ['slashGold', 'windLeaves'], durationMs: 980 },
  four: { sub: '사방 싹쓸', title: '사방 싹쓸!', seal: '四', badge: '4장 동시 획득', accent: '#f5c95b', flash: 'gold', shake: 'md', canvasFx: ['slashDouble', 'coins'], durationMs: 1050 },

  firstPpuk: { sub: '개문 봉인', title: '초수 · 첫뻑!', seal: '封', badge: '+7점 즉금 보너스', accent: '#ff5263', flash: 'crimson', shake: 'md', canvasFx: ['inkRing', 'coins'], durationMs: 1200 },
  doublePpuk: { sub: '연환 봉인', title: '연환 · 연뻑!', seal: '連', badge: '+14점 즉금 보너스', accent: '#ff3b52', flash: 'crimson', sunburst: 'crimson', shake: 'lg', canvasFx: ['inkRing', 'lightning', 'coins'], durationMs: 1350 },
  triple: { sub: '일격 필살', title: '삼연뻑 · 즉승!', seal: '絶', badge: '즉시 승리 잭팟', accent: '#ffd86b', flash: 'gold', sunburst: 'gold', bagua: true, shake: 'lg', canvasFx: ['lightning', 'coins', 'sparks'], durationMs: 1700 },
  ownPpuk: { sub: '봉인 파쇄', title: '자뻑 먹기!', seal: '破', badge: '피 2장 강탈', accent: '#ff8a3d', flash: 'crimson', shake: 'md', canvasFx: ['slashDouble', 'sparks'], durationMs: 1000 },
  eatPpuk: { sub: '봉인 파쇄', title: '뻑 먹기!', seal: '破', badge: '피 1장 강탈', accent: '#f5c95b', flash: 'gold', shake: 'sm', canvasFx: ['slashGold', 'sparks'], durationMs: 920 },

  bomb: { sub: '팔괘 화염진', title: '폭탄!', seal: '爆', badge: '배수 ×2 · 피 강탈', accent: '#ff5238', flash: 'crimson', bagua: true, shake: 'lg', canvasFx: ['slashFire', 'sparks'], durationMs: 1300 },
  shake: { sub: '내공 개방', title: '흔들기!', seal: '震', badge: '승리 시 ×2', accent: '#f5c95b', flash: 'gold', shake: 'md', canvasFx: ['inkRing', 'sparks'], durationMs: 1050 },
  chongtong: { sub: '천명 강림', title: '천명 · 총통!', seal: '天', badge: '즉시 승리', accent: '#ffd86b', flash: 'gold', sunburst: 'gold', shake: 'lg', canvasFx: ['lightning', 'coins'], durationMs: 1650 },

  bonusPlay: { sub: '행운 엽전', title: '보너스패!', seal: '福', accent: '#ffd86b', canvasFx: ['coins', 'sparks'], durationMs: 750 },
  bonusDraw: { sub: '추가 수급', title: '보너스 추가!', seal: '福', accent: '#ffd86b', canvasFx: ['coins'], durationMs: 700 },
  gukjin: { sub: '황금 각성', title: '국진 쌍피 전환!', seal: '覺', accent: '#f5c95b', flash: 'gold', canvasFx: ['sparks', 'coins'], durationMs: 950 },
  mission: { sub: '강호 밀명 완수', title: '미션 달성!', seal: '完', badge: '배수 보너스', accent: '#ff5263', flash: 'gold', sunburst: 'gold', shake: 'md', canvasFx: ['coins', 'sparks'], durationMs: 1350 },
  nagari: { sub: '먹물 안개', title: '나가리', seal: '無', badge: '다음 판 ×2 이월', accent: '#c4cbd4', canvasFx: ['inkMist'], durationMs: 1200 },

  'yaku:godori': { sub: '비조 삼연격', title: '고·도·리!', beatChars: ['고!', '도!', '리!'], seal: '鳥', badge: '+5점 족보 완성', accent: '#ffd86b', flash: 'gold', sunburst: 'gold', shake: 'lg', canvasFx: ['birds3', 'coins', 'sparks'], durationMs: 1750 },
  'yaku:hong': { sub: '화염 비단검', title: '홍단 · 화염검!', seal: '紅', badge: '+3점 족보 완성', accent: '#ff4b5c', flash: 'crimson', sunburst: 'crimson', shake: 'md', canvasFx: ['slashFire', 'sparks'], durationMs: 1500 },
  'yaku:cheong': { sub: '한빙 일섬', title: '청단 · 한빙검!', seal: '靑', badge: '+3점 족보 완성', accent: '#5cd6ff', flash: 'ice', sunburst: 'ice', shake: 'md', canvasFx: ['slashIce', 'sparks'], durationMs: 1500 },
  'yaku:cho': { sub: '질풍 잎날', title: '초단 · 질풍엽!', seal: '草', badge: '+3점 족보 완성', accent: '#2ee59d', flash: 'jade', shake: 'md', canvasFx: ['windLeaves', 'sparks'], durationMs: 1450 },
  'yaku:sam': { sub: '광명 천뢰', title: '삼광!', seal: '光', badge: '+3점', accent: '#ffd86b', flash: 'gold', sunburst: 'gold', shake: 'md', canvasFx: ['lightning', 'sparks'], durationMs: 1500 },
  'yaku:bisam': { sub: '비광 천뢰', title: '비삼광!', seal: '光', badge: '+2점', accent: '#f5c95b', flash: 'gold', sunburst: 'gold', shake: 'md', canvasFx: ['lightning', 'sparks'], durationMs: 1450 },
  'yaku:sa': { sub: '사광 강림', title: '사광!', seal: '光', badge: '+4점', accent: '#ffe17a', flash: 'gold', sunburst: 'gold', shake: 'lg', canvasFx: ['lightning', 'coins'], durationMs: 1600 },
  'yaku:o': { sub: '천하 무쌍', title: '오광 · 천뢰!', seal: '覇', badge: '+15점 대박', accent: '#fff0a8', flash: 'gold', sunburst: 'gold', bagua: true, shake: 'lg', canvasFx: ['lightning', 'coins', 'sparks'], durationMs: 1850 },

  go: { sub: '내공 증폭', title: '고!', seal: '進', accent: '#ff9d3b', flash: 'gold', shake: 'md', canvasFx: ['inkRing', 'sparks'], durationMs: 1050 },
  stop: { sub: '일격 종결', title: '스톱!', seal: '止', accent: '#ffd86b', flash: 'gold', sunburst: 'gold', shake: 'md', canvasFx: ['slashGold', 'coins'], durationMs: 1150 },

  'bak:pi': { sub: '혈기 낙인', title: '피박! ×2', seal: '血', accent: '#ff4252', flash: 'crimson', shake: 'md', canvasFx: ['inkRing', 'sparks'], durationMs: 900 },
  'bak:gwang': { sub: '천뢰 낙인', title: '광박! ×2', seal: '雷', accent: '#ffd86b', flash: 'gold', shake: 'md', canvasFx: ['lightning', 'sparks'], durationMs: 900 },
  'bak:meong': { sub: '맹수 낙인', title: '멍따! ×2', seal: '猛', accent: '#ff9d3b', flash: 'gold', shake: 'md', canvasFx: ['slashGold', 'sparks'], durationMs: 900 },
  'bak:gobak': { sub: '역전 파쇄', title: '고박! ×2', seal: '逆', accent: '#c074ff', flash: 'violet', shake: 'lg', canvasFx: ['lightning', 'sparks'], durationMs: 1000 },
  jackpot: { sub: '강호 대승', title: '대박 정산!', seal: '勝', accent: '#ffd86b', flash: 'gold', sunburst: 'gold', shake: 'lg', canvasFx: ['coins', 'sparks'], durationMs: 1800 },
};

interface Particle {
  kind: 'coin' | 'spark' | 'leaf' | 'feather' | 'ring' | 'slash' | 'bird' | 'bolt' | 'mist';
  x: number; y: number; vx: number; vy: number;
  size: number; rot: number; vrot: number;
  alpha: number; life: number; maxLife: number;
  color: string; color2?: string;
}

export class WuxiaEffectsEngine {
  private layer: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private aura: HTMLDivElement;
  private particles: Particle[] = [];
  private raf = 0;
  private activeCutin: HTMLElement | null = null;
  private cutinTimer = 0;

  constructor(private host: HTMLElement = document.body) {
    this.layer = document.createElement('div');
    this.layer.className = 'wx-layer';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wx-canvas';
    this.aura = document.createElement('div');
    this.aura.className = 'wx-go-aura';
    this.host.append(this.aura, this.canvas, this.layer);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  setGoLevel(count: number) {
    const lv = Math.max(0, Math.min(5, Math.floor(count)));
    this.aura.className = lv > 0 ? `wx-go-aura level-${lv}` : 'wx-go-aura';
  }

  trigger(kind: WuxiaEventKind, overrides?: Partial<Pick<WuxiaEffectSpec, 'title' | 'badge' | 'sub'>>) {
    const base = WUXIA_EFFECT_CATALOG[kind];
    if (!base) return;
    const spec: WuxiaEffectSpec = { ...base, ...overrides };
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!reduced && spec.shake) {
      const cls = `wx-shake-${spec.shake}`;
      this.host.classList.remove('wx-shake-sm', 'wx-shake-md', 'wx-shake-lg');
      void this.host.offsetWidth;
      this.host.classList.add(cls);
      window.setTimeout(() => this.host.classList.remove(cls), 560);
    }

    if (spec.flash) this.spawnTemp(`wx-flash ${spec.flash}`, 440);
    if (!reduced && spec.sunburst) this.spawnTemp(`wx-sunburst ${spec.sunburst}`, spec.durationMs);
    if (!reduced && spec.bagua) this.spawnTemp('wx-bagua', 980);

    if (spec.title) this.showCutin(spec);
    if (!reduced) {
      for (const fx of spec.canvasFx) this.emitCanvasFx(fx, spec.accent);
      this.startLoop();
    }
  }

  private spawnTemp(className: string, ttlMs: number) {
    const el = document.createElement('div');
    el.className = className;
    this.layer.appendChild(el);
    window.setTimeout(() => el.remove(), ttlMs);
  }

  private showCutin(spec: WuxiaEffectSpec) {
    if (this.activeCutin) this.activeCutin.remove();
    window.clearTimeout(this.cutinTimer);

    const box = document.createElement('div');
    box.className = 'wx-cutin';
    box.style.setProperty('--wx-accent', spec.accent);

    if (spec.sub) {
      const sub = document.createElement('div');
      sub.className = 'wx-cutin-sub';
      sub.textContent = spec.sub;
      box.appendChild(sub);
    }

    const title = document.createElement('div');
    title.className = 'wx-cutin-title';
    if (spec.beatChars?.length) {
      const wrap = document.createElement('span');
      wrap.className = 'wx-beat-chars';
      for (const ch of spec.beatChars) {
        const s = document.createElement('span');
        s.className = 'wx-beat-char';
        s.textContent = ch;
        wrap.appendChild(s);
      }
      title.appendChild(wrap);
    } else {
      title.textContent = spec.title;
    }

    if (spec.seal) {
      const seal = document.createElement('span');
      seal.className = 'wx-seal';
      seal.textContent = spec.seal;
      title.appendChild(seal);
    }
    box.appendChild(title);

    if (spec.badge) {
      const badge = document.createElement('div');
      badge.className = 'wx-cutin-badge';
      badge.textContent = spec.badge;
      box.appendChild(badge);
    }

    this.layer.appendChild(box);
    this.activeCutin = box;
    this.cutinTimer = window.setTimeout(() => {
      box.remove();
      if (this.activeCutin === box) this.activeCutin = null;
    }, spec.durationMs);
  }

  private emitCanvasFx(fx: WuxiaEffectSpec['canvasFx'][number], accent: string) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w * 0.5;
    const cy = h * 0.48;

    if (fx === 'inkRing') {
      this.particles.push({ kind: 'ring', x: cx, y: cy, vx: 0, vy: 0, size: 18, rot: 0, vrot: 0, alpha: 0.95, life: 0, maxLife: 420, color: '#140b0d', color2: accent });
    } else if (fx === 'slashGold' || fx === 'slashFire' || fx === 'slashIce') {
      const c = fx === 'slashFire' ? '#ff4b5c' : fx === 'slashIce' ? '#5cd6ff' : '#ffe37d';
      this.particles.push({ kind: 'slash', x: cx, y: cy, vx: 0, vy: 0, size: Math.max(w, h) * 0.72, rot: -0.35, vrot: 0, alpha: 1, life: 0, maxLife: 380, color: c, color2: '#ffffff' });
      if (fx === 'slashFire' || fx === 'slashIce') {
        this.particles.push({ kind: 'slash', x: cx, y: cy, vx: 0, vy: 0, size: Math.max(w, h) * 0.68, rot: 0.32, vrot: 0, alpha: 0.9, life: -80, maxLife: 420, color: c, color2: '#ffffff' });
      }
    } else if (fx === 'slashDouble') {
      this.particles.push(
        { kind: 'slash', x: cx, y: cy, vx: 0, vy: 0, size: w * 0.7, rot: -0.4, vrot: 0, alpha: 1, life: 0, maxLife: 360, color: '#ffd86b', color2: '#fff' },
        { kind: 'slash', x: cx, y: cy, vx: 0, vy: 0, size: w * 0.7, rot: 0.4, vrot: 0, alpha: 1, life: -90, maxLife: 380, color: '#ff7a3d', color2: '#fff' },
      );
    } else if (fx === 'birds3') {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          kind: 'bird', x: -60 - i * 90, y: h * (0.34 + i * 0.14),
          vx: (w + 260) / 0.95, vy: -35 + i * 18,
          size: 28 + (i === 1 ? 6 : 0), rot: 0, vrot: 0, alpha: 1, life: -i * 150, maxLife: 1150, color: '#ffe078', color2: '#ff9b26',
        });
      }
      for (let i = 0; i < 24; i++) {
        this.particles.push({
          kind: 'feather', x: cx + (Math.random() - 0.5) * w * 0.6, y: cy + (Math.random() - 0.5) * h * 0.35,
          vx: 80 + Math.random() * 140, vy: -60 + Math.random() * 120,
          size: 7 + Math.random() * 6, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 6,
          alpha: 1, life: 0, maxLife: 900 + Math.random() * 500, color: '#ffd86b',
        });
      }
    } else if (fx === 'windLeaves') {
      for (let i = 0; i < 26; i++) {
        this.particles.push({
          kind: 'leaf', x: -20 + Math.random() * w * 0.3, y: h * (0.2 + Math.random() * 0.65),
          vx: 260 + Math.random() * 280, vy: -90 + Math.random() * 180,
          size: 9 + Math.random() * 7, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 8,
          alpha: 1, life: 0, maxLife: 900 + Math.random() * 450, color: '#2ee59d',
        });
      }
    } else if (fx === 'lightning') {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          kind: 'bolt', x: w * (0.25 + i * 0.25), y: 0, vx: 0, vy: h,
          size: 4, rot: 0, vrot: 0, alpha: 1, life: -i * 90, maxLife: 340, color: '#fff4b8', color2: accent,
        });
      }
    } else if (fx === 'coins') {
      for (let i = 0; i < 34; i++) {
        const ang = -Math.PI * (0.18 + Math.random() * 0.64);
        const spd = 280 + Math.random() * 380;
        this.particles.push({
          kind: 'coin', x: cx + (Math.random() - 0.5) * 80, y: h * 0.84,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          size: 10 + Math.random() * 5, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 10,
          alpha: 1, life: 0, maxLife: 1150 + Math.random() * 450, color: '#ffd86b', color2: '#b36b00',
        });
      }
    } else if (fx === 'sparks') {
      for (let i = 0; i < 28; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 120 + Math.random() * 340;
        this.particles.push({
          kind: 'spark', x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          size: 3 + Math.random() * 4, rot: 0, vrot: 0, alpha: 1, life: 0, maxLife: 520 + Math.random() * 280, color: accent,
        });
      }
    } else if (fx === 'inkMist') {
      for (let i = 0; i < 14; i++) {
        this.particles.push({
          kind: 'mist', x: cx + (Math.random() - 0.5) * w * 0.6, y: cy + (Math.random() - 0.5) * h * 0.4,
          vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 30,
          size: 48 + Math.random() * 56, rot: 0, vrot: 0, alpha: 0.45, life: 0, maxLife: 1100, color: '#1b1d24',
        });
      }
    }
  }

  private startLoop() {
    if (this.raf) return;
    let prev = performance.now();
    const tick = (now: number) => {
      const dtMs = Math.min(40, now - prev);
      const dt = dtMs / 1000;
      prev = now;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life += dtMs;
        if (p.life < 0) continue;
        if (p.life >= p.maxLife) { this.particles.splice(i, 1); continue; }
        const t = p.life / p.maxLife;
        const a = p.alpha * (1 - t);

        ctx.save();
        ctx.globalAlpha = Math.max(0, a);

        if (p.kind === 'ring') {
          const r = p.size + t * 145;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 10 * (1 - t);
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = p.color2 || '#f5c95b';
          ctx.lineWidth = 3 * (1 - t);
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.9, 0, Math.PI * 2); ctx.stroke();
        } else if (p.kind === 'slash') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          const len = p.size * Math.min(1, t * 2.8);
          const grad = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(0.5, p.color);
          grad.addColorStop(1, 'transparent');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 18 * (1 - t);
          ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
          ctx.strokeStyle = p.color2 || '#fff';
          ctx.lineWidth = 5 * (1 - t);
          ctx.beginPath(); ctx.moveTo(-len * 0.42, 0); ctx.lineTo(len * 0.42, 0); ctx.stroke();
        } else if (p.kind === 'bird') {
          p.x += p.vx * dt;
          p.y += p.vy * dt + Math.sin(p.life * 0.02) * 1.4;
          ctx.translate(p.x, p.y);
          const flap = Math.sin(p.life * 0.032) * 0.45;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color2 || '#ff9b26';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.moveTo(p.size, 0);
          ctx.quadraticCurveTo(0, -p.size * (0.7 + flap), -p.size * 0.9, -p.size * (0.25 + flap));
          ctx.lineTo(-p.size * 0.35, 0);
          ctx.lineTo(-p.size * 0.9, p.size * (0.25 - flap));
          ctx.quadraticCurveTo(0, p.size * (0.5 - flap), p.size, 0);
          ctx.fill();
        } else if (p.kind === 'coin') {
          p.vy += 680 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vrot * dt;
          ctx.translate(p.x, p.y);
          ctx.scale(Math.cos(p.rot), 1);
          ctx.fillStyle = p.color;
          ctx.strokeStyle = p.color2 || '#8a5200';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#5c3200';
          ctx.fillRect(-p.size * 0.28, -p.size * 0.28, p.size * 0.56, p.size * 0.56);
        } else if (p.kind === 'bolt') {
          ctx.strokeStyle = p.color;
          ctx.shadowColor = p.color2 || '#ffd86b';
          ctx.shadowBlur = 18;
          ctx.lineWidth = p.size * (1 - t * 0.5);
          ctx.beginPath();
          let bx = p.x, by = 0;
          ctx.moveTo(bx, by);
          for (let s = 1; s <= 7; s++) {
            bx += (Math.random() - 0.5) * 44;
            by = (p.vy / 7) * s;
            ctx.lineTo(bx, by);
          }
          ctx.stroke();
        } else if (p.kind === 'leaf' || p.kind === 'feather') {
          p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vrot * dt;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'mist') {
          p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + t * 0.6), 0, Math.PI * 2); ctx.fill();
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      if (this.particles.length > 0) {
        this.raf = requestAnimationFrame(tick);
      } else {
        this.raf = 0;
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.layer.remove();
    this.canvas.remove();
    this.aura.remove();
  }
}
