import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './wuxia.css'
import './v05-mat.css'
import './v051-fit.css'
import { preloadWuxiaArt } from './wuxia/wuxiaEffects'

// v0.5.1: 실기기 실효 뷰포트 높이 (주소창·하단 바·노치 제외) → --app-h / --app-w
// dvh 미지원 브라우저(구형 iOS Safari 등)에서도 visualViewport 기준으로 화면 안에 딱 맞춘다
function syncViewport() {
  const vv = window.visualViewport
  const h = Math.round(Math.min(window.innerHeight, vv?.height ?? window.innerHeight))
  const w = Math.round(Math.min(window.innerWidth, vv?.width ?? window.innerWidth))
  const root = document.documentElement
  root.style.setProperty('--app-h', `${h}px`)
  root.style.setProperty('--app-w', `${w}px`)
}
syncViewport()
window.addEventListener('resize', syncViewport)
window.addEventListener('orientationchange', () => window.setTimeout(syncViewport, 250))
window.visualViewport?.addEventListener('resize', syncViewport)

// v0.5: 로비 진입 즉시 웹툰 VFX 일러스트 프리로드 (컷인 발동 시 지연 0)
preloadWuxiaArt()

createRoot(document.getElementById('root')!).render(<App />)
