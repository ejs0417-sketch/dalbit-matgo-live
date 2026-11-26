export const PLAY_LIMIT_MS = 15_000
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
