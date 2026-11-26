export const PLAY_LIMIT_MS = 25_000
export const CHOICE_LIMIT_MS = 10_000
export const RECONNECT_LIMIT_MS = 90_000

export function limitForPhase(phase: string) {
  return phase === 'turn' ? PLAY_LIMIT_MS : CHOICE_LIMIT_MS
}

export function registerTimeout(streak: number) {
  const next = streak + 1
  return { streak: next, auto: next >= 2 }
}

export function mayAct(deciderSeat: number | null, actor: number) {
  return deciderSeat === actor
}

/** AI 혼자 두기(또는 AI 상대 방)에서는 인간 플레이어 턴 타임아웃 자동타패를 하지 않는다. */
export function allowHumanTurnTimeout(mode: string, hasAiOpponent: boolean) {
  return mode !== 'ai' && !hasAiOpponent
}
