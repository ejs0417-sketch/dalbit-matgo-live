export function lockLandscape() {
  const root = document.documentElement
  try {
    if (!document.fullscreenElement && root.requestFullscreen) {
      void root.requestFullscreen().catch(() => undefined)
    }
  } catch {
    /* 전체화면을 거절한 브라우저는 그대로 둔다 */
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> }
    if (orientation.lock) void orientation.lock('landscape').catch(() => undefined)
  } catch {
    /* iOS Safari는 방향 잠금을 지원하지 않는다 */
  }
}
