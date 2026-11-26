/**
 * 달빛맞고 v0.4.2 — 오디오 파사드
 * 실제 사운드는 아트·사운드 팀의 WuxiaAudioEngine(34종 무협/슬롯 SFX + 5음계 BGM)이 담당한다.
 * 기존 호출부(audio.play/unlock/toggleBgm/...)와 상단 BGM·SFX 음소거 토글 상태를 그대로 유지한다.
 */
import { WuxiaAudioEngine, type BgmScene } from './wuxia/wuxiaAudio'

// v0.4.1 이하 구형 사운드 키 → wuxiaAudio 키
const LEGACY: Record<string, string> = {
  slash: 'jjak',
  seal: 'stamp',
  bagua: 'bomb',
  birds: 'yaku:godori',
  flame: 'yaku:hong',
  frost: 'yaku:cheong',
  wind: 'yaku:cho',
  aura: 'go1',
}

class AudioFacade {
  private engine = new WuxiaAudioEngine()
  bgmOn = true
  sfxOn = true
  bgmVolume = 0.55
  sfxVolume = 0.88
  private unlocked = false

  /** 첫 터치/클릭에서 AudioContext 생성·resume (iOS Safari 무음 방지). visibilitychange 일시정지/복구는 엔진 내장 */
  unlock() {
    this.engine.unlock()
    this.unlocked = true
  }

  get ready() {
    return this.unlocked
  }

  play(name: string) {
    if (!this.sfxOn) return
    this.engine.play(LEGACY[name] ?? name)
  }

  setScene(scene: BgmScene) {
    this.engine.setScene(scene)
  }

  /** 고 횟수에 따라 3~5고 BGM 긴장감 가속 */
  setGoLevel(goCount: number) {
    this.engine.setGoLevel(goCount)
  }

  setBgmVolume(v: number) {
    this.bgmVolume = v
    this.engine.setBgmVolume(v)
  }

  setSfxVolume(v: number) {
    this.sfxVolume = v
    this.engine.setSfxVolume(v)
  }

  toggleBgm() {
    this.bgmOn = this.engine.toggleBgm()
    this.persist()
    return this.bgmOn
  }

  toggleSfx() {
    this.sfxOn = this.engine.toggleSfx()
    this.persist()
    return this.sfxOn
  }

  private persist() {
    try {
      localStorage.setItem('dalbit-bgm', this.bgmOn ? '1' : '0')
      localStorage.setItem('dalbit-sfx', this.sfxOn ? '1' : '0')
    } catch { /* ignore */ }
    window.dispatchEvent(new Event('dalbit-audio'))
  }

  restore() {
    try {
      if (localStorage.getItem('dalbit-bgm') === '0' && this.bgmOn) this.bgmOn = this.engine.toggleBgm()
      if (localStorage.getItem('dalbit-sfx') === '0' && this.sfxOn) this.sfxOn = this.engine.toggleSfx()
    } catch { /* ignore */ }
  }
}

export const audio = new AudioFacade()
audio.restore()
