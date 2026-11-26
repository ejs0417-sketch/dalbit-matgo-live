import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './wuxia.css'
import './v05-mat.css'
import { preloadWuxiaArt } from './wuxia/wuxiaEffects'

// v0.5: 로비 진입 즉시 웹툰 VFX 일러스트 프리로드 (컷인 발동 시 지연 0)
preloadWuxiaArt()

createRoot(document.getElementById('root')!).render(<App />)
