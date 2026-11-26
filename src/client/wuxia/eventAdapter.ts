import type { WuxiaEffectsEngine, WuxiaEventKind } from './wuxiaEffects';
import { WUXIA_EFFECT_CATALOG } from './wuxiaEffects';

export interface GenericGameEvent {
  type: string;
  id?: string;
  kind?: string;
  combo?: number;
  count?: number;
  title?: string;
  firstTurn?: boolean;
  [k: string]: unknown;
}

const SPECIAL_PPUK_TYPES = new Set(['firstPpuk', 'doublePpuk', 'triple']);

export interface WuxiaResolved {
  /** 같은 배치에 특수 뻑(firstPpuk/doublePpuk/triple)이 있어 일반 ppuk 연출·사운드·배너를 통째로 스킵해야 함 */
  suppressed: boolean;
  kind: WuxiaEventKind | null;
  overrides?: { title?: string; badge?: string; sub?: string };
  /** 붓글씨 컷인(타이틀)이 뜨는지 여부 — 뜨면 기존 Impact 배너는 띄우지 않는다(이중 컷인 방지) */
  cutin: boolean;
  /** 이펙트와 1:1 매칭되는 wuxiaAudio SFX 키 */
  sfx: string | null;
}

export function hasSpecialPpuk(batch?: GenericGameEvent[]): boolean {
  return !!batch?.some((e) => SPECIAL_PPUK_TYPES.has(e.type));
}

/** 서버 GameEvent 1건을 무협 초식 kind로 해석 (부작용 없음) */
export function resolveWuxia(ev: GenericGameEvent, sameBatchEvents?: GenericGameEvent[]): WuxiaResolved {
  let kind: WuxiaEventKind | null = null;
  let overrides: { title?: string; badge?: string; sub?: string } | undefined;
  let sfx: string | null = null;

  switch (ev.type) {
    case 'play': kind = 'kung'; break;
    case 'flip': kind = 'jjak'; sfx = 'flip'; break;
    case 'jjok': kind = 'jjok'; break;
    case 'ttadak': kind = 'ttadak'; break;
    case 'sweep': kind = 'sweep'; break;
    case 'four': kind = 'four'; break;
    case 'firstPpuk': kind = 'firstPpuk'; break;
    case 'doublePpuk': kind = 'doublePpuk'; break;
    case 'triple': kind = 'triple'; break;
    case 'ppuk': {
      // 서버는 첫뻑·연뻑·삼연뻑 시 ppuk + firstPpuk/doublePpuk/triple을 같은 배치로 보낸다.
      // 특수 뻑이 같이 오면 일반 ppuk은 연출·사운드·배너 전부 스킵 → 컷인 1회만 발동.
      if (hasSpecialPpuk(sameBatchEvents)) return { suppressed: true, kind: null, cutin: false, sfx: null };
      // 일반 뻑만 처리
      kind = 'kung';
      sfx = 'ppuk';
      overrides = { sub: '봉인', title: '뻑!', badge: '바닥 3장 봉인' };
      break;
    }
    case 'ownPpuk': kind = 'ownPpuk'; break;
    case 'eatPpuk': kind = 'eatPpuk'; break;
    case 'bomb': kind = 'bomb'; break;
    case 'shake': kind = 'shake'; break;
    case 'chongtong': kind = 'chongtong'; break;
    case 'bonusPlay': kind = 'bonusPlay'; break;
    case 'bonusDraw': kind = 'bonusDraw'; break;
    case 'gukjin': kind = 'gukjin'; break;
    case 'mission':
      kind = 'mission';
      if (ev.title) overrides = { badge: String(ev.title) };
      break;
    case 'nagari': kind = 'nagari'; break;
    case 'yaku': {
      const yid = String(ev.id || '');
      const mapped = `yaku:${yid}` as WuxiaEventKind;
      if (mapped in WUXIA_EFFECT_CATALOG) kind = mapped;
      break;
    }
    case 'go': {
      const c = Number(ev.count ?? 1);
      kind = 'go';
      sfx = `go${Math.max(1, Math.min(5, c))}`;
      overrides = {
        title: `${c}고!`,
        badge: c >= 3 ? `배수 ×${1 << (c - 2)} · 내공 폭주` : `+${c}점 · 내공 증폭`,
      };
      break;
    }
    case 'stop': kind = 'stop'; break;
    case 'bak': {
      const raw = String(ev.kind || '');
      const bk = `bak:${raw === 'go' ? 'gobak' : raw}` as WuxiaEventKind;
      if (bk in WUXIA_EFFECT_CATALOG) kind = bk;
      break;
    }
    case 'win': kind = 'jackpot'; break;
    default: break;
  }

  if (!kind) return { suppressed: false, kind: null, cutin: false, sfx: null };
  const title = overrides?.title ?? WUXIA_EFFECT_CATALOG[kind].title;
  return { suppressed: false, kind, overrides, cutin: !!title, sfx: sfx ?? kind };
}

/**
 * 서버 GameEvent 1건을 무협 초식·슬롯 이펙트로 발동하고 권장 연출 대기시간(ms)을 반환.
 * sameBatchEvents를 넘기면 동일 배치에 firstPpuk/doublePpuk/triple이 있을 때 일반 ppuk 중복 발동을 자동 스킵.
 */
export function playWuxiaForEvent(
  engine: WuxiaEffectsEngine,
  ev: GenericGameEvent,
  sameBatchEvents?: GenericGameEvent[],
): number {
  const r = resolveWuxia(ev, sameBatchEvents);
  if (ev.type === 'go') engine.setGoLevel(Number(ev.count ?? 1));
  if (!r.kind) return 0;
  engine.trigger(r.kind, r.overrides);
  return WUXIA_EFFECT_CATALOG[r.kind].durationMs;
}
