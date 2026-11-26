import { WUXIA_AVATARS, WUXIA_CHARACTER_LINES } from './wuxiaCast'

export interface Avatar {
  id: string
  name: string
  title: string
  blurb: string
  skin: string
  hair: string
  cloth: string
  accent: string
  /** v0.4.2 무림 고수 초상화 (/art/avatars/<id>.webp) */
  portrait?: string
  prop: 'glasses' | 'perm' | 'cap' | 'pin' | 'straw' | 'long' | 'band' | 'beard'
}

const BASE_AVATARS: Avatar[] = [
  { id: 'bokman', name: '김복만', title: '판돈의 제왕', blurb: '선글라스 너머로 패를 읽는다', skin: '#e7b48a', hair: '#2a241f', cloth: '#9d1c28', accent: '#e6c15a', prop: 'glasses' },
  { id: 'sunja', name: '박순자', title: '꽃무늬 할매', blurb: '웃으며 피를 걷어 간다', skin: '#efc2a4', hair: '#6b3a78', cloth: '#d4558a', accent: '#f2d26b', prop: 'perm' },
  { id: 'gang', name: '한강', title: '밤거리 선수', blurb: '모자를 눌러쓰고 고를 외친다', skin: '#e0aa7a', hair: '#1c1a19', cloth: '#24324a', accent: '#7eb0d8', prop: 'cap' },
  { id: 'miseon', name: '최미선', title: '붉은 저고리', blurb: '단정한 손에 광이 모인다', skin: '#f0c3a8', hair: '#3a241c', cloth: '#b4232c', accent: '#f4e1a8', prop: 'pin' },
  { id: 'jangsu', name: '이장수', title: '밀짚 청년', blurb: '해맑게 웃다 판을 쓸어 담는다', skin: '#e8b98a', hair: '#5a3a22', cloth: '#3d7a45', accent: '#f0d78a', prop: 'straw' },
  { id: 'hye', name: '독고혜', title: '차가운 눈', blurb: '말없이 따닥을 맞춘다', skin: '#f2cbb4', hair: '#141414', cloth: '#2c2140', accent: '#d7c4f2', prop: 'long' },
  { id: 'dalho', name: '달호', title: '들뜬 머리띠', blurb: '쪽만 나면 자리를 들썩인다', skin: '#efbf90', hair: '#c47a2c', cloth: '#e07a2f', accent: '#ffe08a', prop: 'band' },
  { id: 'hwang', name: '황금손', title: '백발 도사', blurb: '수염을 쓰다듬고 스톱을 부른다', skin: '#e6bea0', hair: '#f4f1ea', cloth: '#27406e', accent: '#e6c15a', prop: 'beard' },
]

// v0.4.2: 「강호무림」 무림 칭호·초상화 적용 (ID 호환 유지)
export const AVATARS: Avatar[] = BASE_AVATARS.map((a) => {
  const w = WUXIA_AVATARS.find((x) => x.id === a.id)
  return w ? { ...a, name: w.name, title: w.title, blurb: w.blurb, accent: w.accent, portrait: w.portrait } : a
})

export const EMOTES = [
  { id: 'hi', label: '인사', text: '잘 부탁해.', mood: 'happy' },
  { id: 'lol', label: 'ㅋㅋ', text: 'ㅋㅋㅋㅋ 이거 실화냐!', mood: 'happy' },
  { id: 'clap', label: '박수', text: '잘한다, 잘해!', mood: 'cheer' },
  { id: 'good', label: '최고', text: '이 맛이지!', mood: 'smug' },
  { id: 'wow', label: '놀람', text: '아니, 이걸 지금?', mood: 'shock' },
  { id: 'taunt', label: '도발', text: '그 패, 내 거야.', mood: 'smug' },
  { id: 'angry', label: '화남', text: '아, 이 판 진짜!', mood: 'angry' },
  { id: 'cry', label: '눈물', text: '피가… 피가 없어.', mood: 'sad' },
] as const

export type Mood = 'idle' | 'happy' | 'angry' | 'shock' | 'smug' | 'sad' | 'cheer' | 'think'

export function avatarById(id: string) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}

const BASE_LINES: Record<string, Record<string, string>> = {
  bokman: { jjok: '쪽. 피는 내 거다.', ttadak: '따닥. 계산 끝.', ppuk: '뻑이라니, 재수 없군.', go: '고. 판은 아직이다.', stop: '스톱. 여기까지다.', win: '역시 판돈은 내 쪽이지.', lose: '오늘은 운이 없군.', sweep: '바닥은 비웠다.', bomb: '폭탄이다. 피해라.' },
  sunja: { jjok: '아이고 쪽이야, 피 내놔.', ttadak: '따닥따닥, 할머니가 먹는다.', ppuk: '에이 뻑, 속상해라.', go: '고고, 한 판 더 보자.', stop: '스톱. 이만 하면 됐지.', win: '호호, 용돈 들어왔구나.', lose: '아이고, 피 한 장 없네.', sweep: '쓸어 담아야지.', bomb: '폭탄이라니, 깜짝이야.' },
  gang: { jjok: '쪽! 그 피, 이리 줘.', ttadak: '따닥. 오늘 손맛 좋네.', ppuk: '뻑? 웃기시네.', go: '고. 더 간다.', stop: '스톱. 이 정도면 충분해.', win: '밤거리는 내 판이지.', lose: '치사하게 먹었네.', sweep: '바닥 청소 완료.', bomb: '폭탄 던진다!' },
  miseon: { jjok: '쪽이에요. 피 한 장 주세요.', ttadak: '따닥, 네 장 다 제 거예요.', ppuk: '뻑이라니… 미안해요.', go: '고 할게요. 조금만 더.', stop: '스톱. 이만 받을게요.', win: '광이 모이니 기쁘네요.', lose: '다음 판에 만회할게요.', sweep: '바닥을 비웠어요.', bomb: '폭탄은 조심히 둘게요.' },
  jangsu: { jjok: '쪽이다! 피 내놔라!', ttadak: '따닥! 시원하다!', ppuk: '아 뻑, 허허.', go: '고! 아직 배고프다!', stop: '스톱! 배불렀다!', win: '해 뜰 때까지 이기네.', lose: '논두렁에서 넘어졌네.', sweep: '쓸어 담는 맛이 이거지.', bomb: '폭탄! 논에 불 났다!' },
  hye: { jjok: '쪽.', ttadak: '따닥. 예정대로.', ppuk: '…뻑.', go: '고.', stop: '스톱.', win: '계산은 맞았다.', lose: '다음엔 안 진다.', sweep: '비었다.', bomb: '폭탄.' },
  dalho: { jjok: '쪽! 쪽! 피 내놔!', ttadak: '따닥이다! 대박!', ppuk: '뻑이야? 에이!', go: '고고고! 더 가자!', stop: '스톱! 이겼지?', win: '야호! 내가 이겼다!', lose: '으앙, 피가 없어.', sweep: '다 쓸었다!', bomb: '폭탄 던진다, 비켜!' },
  hwang: { jjok: '쪽이구나. 피 한 장이면 된다.', ttadak: '따닥. 오랜만에 시원하군.', ppuk: '뻑도 공부의 하나다.', go: '고. 서두를 것 없다.', stop: '스톱. 욕심은 여기까지.', win: '도사는 판을 읽는다.', lose: '진 판도 스승이다.', sweep: '바닥을 비우는 것도 기술.', bomb: '폭탄은 한 번에 정리하지.' },
}

// v0.4.2: 무협 대사 세트 우선 적용 (없는 키는 기존 대사 유지)
export const CHARACTER_LINES: Record<string, Record<string, string>> = Object.fromEntries(
  Object.keys({ ...BASE_LINES, ...WUXIA_CHARACTER_LINES }).map((id) => [id, { ...BASE_LINES[id], ...WUXIA_CHARACTER_LINES[id] }]),
)
