import type { CardDef, Month } from './types'

export const MONTH_NAME: Record<number, string> = {
  1: '송학',
  2: '매조',
  3: '벚꽃',
  4: '흑싸리',
  5: '난초',
  6: '모란',
  7: '홍싸리',
  8: '공산',
  9: '국화',
  10: '단풍',
  11: '오동',
  12: '비',
}

function idOf(month: number, suffix: string) {
  return `m${String(month).padStart(2, '0')}-${suffix}`
}

function face(
  month: Month,
  suffix: string,
  kind: CardDef['kind'],
  name: string,
  short: string,
  extra: Partial<CardDef> = {},
): CardDef {
  const id = idOf(month, suffix)
  return {
    id,
    month,
    kind,
    name,
    short,
    pi: kind === 'pi' ? 1 : 0,
    image: `/cards/${id}.svg`,
    ...extra,
  }
}

export const CARD_LIST: CardDef[] = [
  face(1, 'gwang', 'gwang', '송학 광', '광'),
  face(1, 'tti', 'tti', '송학 홍단', '홍', { ttiGroup: 'hong' }),
  face(1, 'pi1', 'pi', '송학 피', '피'),
  face(1, 'pi2', 'pi', '송학 피', '피'),

  face(2, 'yeol', 'yeol', '매조 열끗', '열', { godori: true }),
  face(2, 'tti', 'tti', '매조 홍단', '홍', { ttiGroup: 'hong' }),
  face(2, 'pi1', 'pi', '매조 피', '피'),
  face(2, 'pi2', 'pi', '매조 피', '피'),

  face(3, 'gwang', 'gwang', '벚꽃 광', '광'),
  face(3, 'tti', 'tti', '벚꽃 홍단', '홍', { ttiGroup: 'hong' }),
  face(3, 'pi1', 'pi', '벚꽃 피', '피'),
  face(3, 'pi2', 'pi', '벚꽃 피', '피'),

  face(4, 'yeol', 'yeol', '흑싸리 열끗', '열', { godori: true }),
  face(4, 'tti', 'tti', '흑싸리 초단', '초', { ttiGroup: 'cho' }),
  face(4, 'pi1', 'pi', '흑싸리 피', '피'),
  face(4, 'pi2', 'pi', '흑싸리 피', '피'),

  face(5, 'yeol', 'yeol', '난초 다리', '열'),
  face(5, 'tti', 'tti', '난초 초단', '초', { ttiGroup: 'cho' }),
  face(5, 'pi1', 'pi', '난초 피', '피'),
  face(5, 'pi2', 'pi', '난초 피', '피'),

  face(6, 'yeol', 'yeol', '모란 나비', '열'),
  face(6, 'tti', 'tti', '모란 청단', '청', { ttiGroup: 'cheong' }),
  face(6, 'pi1', 'pi', '모란 피', '피'),
  face(6, 'pi2', 'pi', '모란 피', '피'),

  face(7, 'yeol', 'yeol', '홍싸리 멧돼지', '열'),
  face(7, 'tti', 'tti', '홍싸리 초단', '초', { ttiGroup: 'cho' }),
  face(7, 'pi1', 'pi', '홍싸리 피', '피'),
  face(7, 'pi2', 'pi', '홍싸리 피', '피'),

  face(8, 'gwang', 'gwang', '공산 광', '광'),
  face(8, 'yeol', 'yeol', '공산 기러기', '열', { godori: true }),
  face(8, 'pi1', 'pi', '공산 피', '피'),
  face(8, 'pi2', 'pi', '공산 피', '피'),

  face(9, 'yeol', 'yeol', '국진', '국', { gukjin: true }),
  face(9, 'tti', 'tti', '국화 청단', '청', { ttiGroup: 'cheong' }),
  face(9, 'pi1', 'pi', '국화 피', '피'),
  face(9, 'pi2', 'pi', '국화 피', '피'),

  face(10, 'yeol', 'yeol', '단풍 사슴', '열'),
  face(10, 'tti', 'tti', '단풍 청단', '청', { ttiGroup: 'cheong' }),
  face(10, 'pi1', 'pi', '단풍 피', '피'),
  face(10, 'pi2', 'pi', '단풍 피', '피'),

  face(11, 'gwang', 'gwang', '오동 광', '광'),
  face(11, 'ssang', 'pi', '오동 쌍피', '쌍', { pi: 2 }),
  face(11, 'pi1', 'pi', '오동 피', '피'),
  face(11, 'pi2', 'pi', '오동 피', '피'),

  face(12, 'gwang', 'gwang', '비광', '비', { rain: true }),
  face(12, 'yeol', 'yeol', '비 제비', '열'),
  face(12, 'tti', 'tti', '비 띠', '띠', { ttiGroup: 'plain' }),
  face(12, 'ssang', 'pi', '비 쌍피', '쌍', { pi: 2 }),

  {
    id: 'bonus-ssang',
    month: 0,
    kind: 'bonus',
    name: '쌍피 보너스',
    short: '쌍',
    pi: 2,
    image: '/cards/bonus-ssang.svg',
  },
  {
    id: 'bonus-sam',
    month: 0,
    kind: 'bonus',
    name: '쓰리피 보너스',
    short: '삼',
    pi: 3,
    image: '/cards/bonus-sam.svg',
  },
]

export const CARDS: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]))
export const ALL_IDS = CARD_LIST.map((c) => c.id)

export const GODORI_IDS = ['m02-yeol', 'm04-yeol', 'm08-yeol']
export const HONG_IDS = ['m01-tti', 'm02-tti', 'm03-tti']
export const CHEONG_IDS = ['m06-tti', 'm09-tti', 'm10-tti']
export const CHO_IDS = ['m04-tti', 'm05-tti', 'm07-tti']
export const GUKJIN_ID = 'm09-yeol'

export function isBombToken(id: string) {
  return id.startsWith('bomb:')
}

export function cardImage(id: string) {
  if (isBombToken(id)) return '/cards/bomb.svg'
  return CARDS[id]?.image ?? '/cards/back.svg'
}

export function cardBack() {
  return '/cards/back.svg'
}

export function isPiLike(id: string) {
  const c = CARDS[id]
  return !!c && (c.kind === 'pi' || c.kind === 'bonus')
}

export function handMonth(ids: string[], month: number) {
  return ids.filter((id) => CARDS[id]?.month === month)
}

export const BETS = [
  { value: 1000, label: '1천' },
  { value: 5000, label: '5천' },
  { value: 10000, label: '1만' },
  { value: 50000, label: '5만' },
  { value: 100000, label: '10만' },
] as const
