export interface WuxiaAvatarMeta {
  id: string
  name: string
  title: string
  blurb: string
  portrait: string
  accent: string
}

export const WUXIA_AVATARS: WuxiaAvatarMeta[] = [
  { id: 'bokman', name: '복만맹주', title: '천하패왕', blurb: '금테 갓 너머로 상대 패를 꿰뚫는다', portrait: '/art/avatars/bokman.webp', accent: '#f3c969' },
  { id: 'sunja', name: '순자노모', title: '매화종사', blurb: '온화한 미소 속에 피를 거둬들인다', portrait: '/art/avatars/sunja.webp', accent: '#d89ce6' },
  { id: 'gang', name: '흑야한강', title: '월하검객', blurb: '삿갓 아래 서늘한 눈빛으로 고를 외친다', portrait: '/art/avatars/gang.webp', accent: '#7eb0d8' },
  { id: 'miseon', name: '홍련미선', title: '단홍협녀', blurb: '우아한 손끝에 오광이 모여든다', portrait: '/art/avatars/miseon.webp', accent: '#f4a89e' },
  { id: 'jangsu', name: '청풍장수', title: '청풍소협', blurb: '호쾌하게 웃으며 판을 쓸어 담는다', portrait: '/art/avatars/jangsu.webp', accent: '#7bd89e' },
  { id: 'hye', name: '독고혜', title: '설화검희', blurb: '말없이 일격에 따닥을 꿰뚫는다', portrait: '/art/avatars/hye.webp', accent: '#b7a6f7' },
  { id: 'dalho', name: '화염달호', title: '적염권사', blurb: '쪽 한 번에 강호가 들썩인다', portrait: '/art/avatars/dalho.webp', accent: '#ff9b54' },
  { id: 'hwang', name: '황금선인', title: '백발도사', blurb: '금부채를 접으며 스톱을 선고한다', portrait: '/art/avatars/hwang.webp', accent: '#f3c969' },
]

export const WUXIA_CHARACTER_LINES: Record<string, Record<string, string>> = {
  bokman: { jjok: '일섬 쪽! 피를 내놓거라.', ttadak: '연환 따닥! 승부는 끝났다.', ppuk: '허, 뻑이라니.', firstPpuk: '초수 첫뻑! +7점 받겠다.', doublePpuk: '연환 연뻑! +14점이다.', go: '고! 천하를 취하겠다.', stop: '스톱. 이만 거두지.', win: '강호의 판돈은 내 것이다.', lose: '오늘은 검을 접겠다.', sweep: '판쓸! 바닥을 비웠다.', bomb: '팔괘 폭탄! 피할 곳 없다.' },
  sunja: { jjok: '호호, 쪽이구나. 피 한 장 다오.', ttadak: '따닥! 노모의 솜씨란다.', ppuk: '어이쿠, 뻑이 났네.', firstPpuk: '첫뻑! +7점 감사히 받으마.', doublePpuk: '연뻑이라니! +14점이구나.', go: '고! 한 수 더 보자꾸나.', stop: '스톱. 이만하면 넉넉하다.', win: '호호, 오늘 기세가 좋구나.', lose: '아이고, 다음 판에 보자.', sweep: '말끔히 쓸어 담았구나.', bomb: '폭탄이다, 조심하거라.' },
  gang: { jjok: '쪽. 그 피는 내 몫이다.', ttadak: '따닥. 그림자처럼 베었다.', ppuk: '뻑… 방심했군.', firstPpuk: '첫뻑. +7점 챙긴다.', doublePpuk: '연뻑. +14점이다.', go: '고. 밤은 아직 깊다.', stop: '스톱. 여기서 끝낸다.', win: '달빛 아래 내 승부였다.', lose: '칼날이 무뎠군.', sweep: '바닥, 흔적도 없이 비웠다.', bomb: '폭탄. 판을 뒤집는다.' },
  miseon: { jjok: '쪽이에요. 피 한 장 받을게요.', ttadak: '따닥! 네 장 모두 제 것이네요.', ppuk: '어머, 뻑이 나버렸네요.', firstPpuk: '첫뻑! +7점 기분 좋네요.', doublePpuk: '연뻑! +14점까지 이어졌어요.', go: '고! 조금 더 나아갈게요.', stop: '스톱. 아름답게 마무리할게요.', win: '홍련처럼 화려한 승리네요.', lose: '다음 수에서 되갚을게요.', sweep: '바닥을 단정히 비웠어요.', bomb: '폭탄이에요, 비켜 서세요.' },
  jangsu: { jjok: '쪽이다! 피 한 장 이리 내!', ttadak: '따닥! 바람처럼 시원하다!', ppuk: '으악, 뻑이네! 허허!', firstPpuk: '첫뻑! 시작부터 +7점!', doublePpuk: '연뻑 대박! +14점이다!', go: '고! 청풍은 멈추지 않는다!', stop: '스톱! 이만하면 대승이지!', win: '하하! 강호가 다 내 판이다!', lose: '허허, 한 수 배웠다!', sweep: '판쓸! 싹 다 쓸어 담았다!', bomb: '폭탄 나간다! 꽉 잡아라!' },
  hye: { jjok: '쪽.', ttadak: '따닥. 예정된 일격.', ppuk: '…뻑.', firstPpuk: '첫뻑. +7점.', doublePpuk: '연뻑. +14점.', go: '고.', stop: '스톱.', win: '수읽기는 완벽했다.', lose: '다음엔 빈틈없다.', sweep: '바닥, 소멸.', bomb: '폭탄. 부서져라.' },
  dalho: { jjok: '쪽! 쪽! 화끈하게 피 내놔!', ttadak: '따닥이다! 불붙었다!', ppuk: '크윽, 뻑이라니!', firstPpuk: '첫뻑! +7점 터졌다!', doublePpuk: '연뻑! +14점 미쳤다!', go: '고고고! 끝까지 간다!', stop: '스톱! 제대로 한 방 먹였지!', win: '으하하! 강호 최강이다!', lose: '으악, 다음 판엔 안 진다!', sweep: '싹쓸이! 불태웠다!', bomb: '화염 폭탄 투하!' },
  hwang: { jjok: '쪽이로군. 피 한 장이면 족하다.', ttadak: '따닥. 절묘한 수로다.', ppuk: '뻑 또한 도의 일부니라.', firstPpuk: '첫뻑이구나. +7점을 얻는다.', doublePpuk: '연뻑이라… +14점이로다.', go: '고. 아직 때가 남았다.', stop: '스톱. 과유불급이니라.', win: '도사는 이미 판을 읽었노라.', lose: '패배도 좋은 가르침이지.', sweep: '허공처럼 바닥을 비웠노라.', bomb: '팔괘 폭탄으로 정리하마.' },
}
