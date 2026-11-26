type Scene = 'lobby' | 'table' | 'go' | 'goHigh' | 'goMax'

const A4 = 440
function tone(semi: number) {
  return A4 * 2 ** ((semi - 9) / 12)
}

const PENTA = [0, 2, 4, 7, 9]
function degree(root: number, step: number) {
  const oct = Math.floor(step / 5)
  const semi = PENTA[((step % 5) + 5) % 5]! + oct * 12
  return tone(root + semi)
}

const MELODY: Record<Scene, number[]> = {
  lobby: [4, -1, 2, 4, -1, 5, 4, -1, 2, 0, -1, 2],
  table: [2, 4, -1, 5, 4, 2, -1, 0, 2, 4, -1, 2],
  go: [4, 5, 7, 5, 4, 2, 4, 5, 7, 9, 7, 5],
  goHigh: [4, 5, 7, 9, 7, 5, 4, 7, 9, 11, 9, 7],
  goMax: [7, 9, 11, 9, 7, 5, 7, 9, 12, 11, 9, 7],
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bgmGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private noise: AudioBuffer | null = null
  private next = 0
  private step = 0
  scene: Scene = 'lobby'
  bgmVolume = 0.55
  sfxVolume = 0.85
  bgmOn = true
  sfxOn = true
  private running = false
  private watched = false

  unlock() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!this.ctx) {
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)
      this.bgmGain = this.ctx.createGain()
      this.sfxGain = this.ctx.createGain()
      this.bgmGain.connect(this.master)
      this.sfxGain.connect(this.master)
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      this.noise = buffer
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.applyVolumes()
    this.ensureLoop()
    if (!this.watched) {
      this.watched = true
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return
        if (document.hidden) void this.ctx.suspend()
        else void this.ctx.resume()
      })
    }
  }

  private applyVolumes() {
    if (!this.bgmGain || !this.sfxGain || !this.ctx) return
    const now = this.ctx.currentTime
    this.bgmGain.gain.setTargetAtTime(this.bgmOn ? this.bgmVolume * 0.22 : 0, now, 0.05)
    this.sfxGain.gain.setTargetAtTime(this.sfxOn ? this.sfxVolume : 0, now, 0.03)
  }

  setBgmVolume(value: number) {
    this.bgmVolume = value
    this.applyVolumes()
  }

  setSfxVolume(value: number) {
    this.sfxVolume = value
    this.applyVolumes()
  }

  toggleBgm() {
    this.bgmOn = !this.bgmOn
    this.applyVolumes()
    return this.bgmOn
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn
    this.applyVolumes()
    return this.sfxOn
  }

  setScene(scene: Scene) {
    if (this.scene === scene) return
    this.scene = scene
    this.step = 0
  }

  private ensureLoop() {
    if (this.running || !this.ctx) return
    this.running = true
    this.next = this.ctx.currentTime + 0.05
    window.setInterval(() => this.pump(), 80)
  }

  private pump() {
    if (!this.ctx || !this.bgmGain) return
    const bpm = this.scene === 'goMax' ? 176 : this.scene === 'goHigh' ? 156 : this.scene === 'go' ? 132 : this.scene === 'table' ? 112 : 96
    const eighth = 60 / bpm / 2
    while (this.next < this.ctx.currentTime + 0.25) {
      this.scheduleBeat(this.next, eighth)
      this.next += eighth
      this.step = (this.step + 1) % 12
    }
  }

  private scheduleBeat(time: number, eighth: number) {
    if (!this.ctx || !this.bgmGain) return
    const beat = this.step
    const tense = this.scene === 'go' || this.scene === 'goHigh' || this.scene === 'goMax'
    const root = this.scene === 'goMax' ? 2 : this.scene === 'goHigh' ? 0 : this.scene === 'go' ? -2 : 0
    const mel = MELODY[this.scene][beat]!
    if (mel >= 0) this.pluck(time, degree(root + 12, mel), eighth * (tense ? 1.15 : 1.8), tense ? 0.18 : 0.13)
    if (beat === 0 || beat === 6) this.pluck(time, degree(root - 12, beat === 0 ? 0 : 2), eighth * 4, 0.1)
    if (tense && (beat === 4 || beat === 10)) this.pluck(time, degree(root + 24, this.scene === 'goMax' ? 7 : 4), eighth, this.scene === 'go' ? 0.07 : 0.12)
    if ((this.scene === 'goHigh' || this.scene === 'goMax') && (beat === 2 || beat === 8)) this.pluck(time, degree(root + 24, 2), eighth * 0.7, 0.09)
    if (beat === 0 || beat === 6) this.drum(time, false)
    if (beat === 3 || beat === 9 || (this.scene !== 'lobby' && this.scene !== 'table' && (beat === 2 || beat === 8 || (this.scene === 'goMax' && beat % 2 === 0)))) this.drum(time, true)
  }

  private pluck(time: number, freq: number, dur: number, gain: number) {
    if (!this.ctx || !this.bgmGain) return
    const osc = this.ctx.createOscillator()
    const filter = this.ctx.createBiquadFilter()
    const amp = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, time)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(freq * 6, time)
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, freq), time + dur)
    amp.gain.setValueAtTime(0.0001, time)
    amp.gain.exponentialRampToValueAtTime(gain, time + 0.015)
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    osc.connect(filter)
    filter.connect(amp)
    amp.connect(this.bgmGain)
    osc.start(time)
    osc.stop(time + dur + 0.02)
  }

  private drum(time: number, high: boolean) {
    if (!this.ctx || !this.bgmGain || !this.noise) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = high ? 'highpass' : 'lowpass'
    filter.frequency.value = high ? 1800 : 240
    const amp = this.ctx.createGain()
    amp.gain.setValueAtTime(high ? 0.18 : 0.34, time)
    amp.gain.exponentialRampToValueAtTime(0.0001, time + (high ? 0.06 : 0.14))
    src.connect(filter)
    filter.connect(amp)
    amp.connect(this.bgmGain)
    src.start(time)
    src.stop(time + 0.16)
    if (!high) {
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      osc.frequency.setValueAtTime(140, time)
      osc.frequency.exponentialRampToValueAtTime(55, time + 0.12)
      g.gain.setValueAtTime(0.2, time)
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14)
      osc.connect(g)
      g.connect(this.bgmGain)
      osc.start(time)
      osc.stop(time + 0.15)
    }
  }

  play(name: string) {
    if (!this.ctx || !this.sfxGain || !this.sfxOn) return
    const t = this.ctx.currentTime
    if (name === 'kung') this.thud(t)
    else if (name === 'jjak') {
      this.hit(t, 1100, 0.04, 0.62)
      this.hit(t + 0.03, 1680, 0.035, 0.48)
    }
    else if (name === 'slap') this.hit(t, 170, 0.09, 0.5)
    else if (name === 'flip') this.hit(t, 320, 0.05, 0.28)
    else if (name === 'shuffle') {
      for (let i = 0; i < 6; i++) this.hit(t + i * 0.05, 200 + i * 30, 0.04, 0.22)
    }
    else if (name === 'coin') this.chime(t, [880, 1320, 1760], 0.18)
    else if (name === 'jjok') this.chime(t, [523, 784], 0.16)
    else if (name === 'ttadak') this.chime(t, [392, 523, 784], 0.2)
    else if (name === 'ppuk') this.hit(t, 90, 0.2, 0.45)
    else if (name === 'bomb') {
      this.hit(t, 70, 0.28, 0.6)
      this.chime(t + 0.05, [220, 330], 0.2)
    }
    else if (name === 'sweep') this.chime(t, [494, 659, 880], 0.2)
    else if (name === 'shake') this.chime(t, [349, 440, 523, 698], 0.16)
    else if (name === 'go' || name === 'go1') this.chime(t, [523, 659, 784], 0.16)
    else if (name === 'go2') {
      this.hit(t, 150, 0.12, 0.55)
      this.chime(t, [440, 554, 698, 880], 0.18)
    }
    else if (name === 'go3') {
      this.hit(t, 96, 0.24, 0.75)
      this.chime(t, [392, 523, 784, 1046], 0.24)
    }
    else if (name === 'go4' || name === 'go5') {
      this.hit(t, 58, 0.34, 0.95)
      this.chime(t, [262, 392, 523, 784, 1046, 1318], 0.28)
    }
    else if (name.startsWith('yaku')) this.chime(t, name.includes('godori') ? [740, 988, 1175, 1568] : name.includes('o') || name.includes('sa') ? [262, 392, 523, 784, 1046] : [523, 659, 880, 1175], 0.22)
    else if (name === 'stop') this.chime(t, [784, 659, 523], 0.24)
    else if (name === 'mission') this.chime(t, [659, 880, 1175], 0.22)
    else if (name === 'bak') this.chime(t, [311, 415, 622], 0.24)
    else if (name === 'win') this.chime(t, [523, 659, 784, 1046], 0.28)
    else if (name === 'lose') this.chime(t, [392, 311, 247], 0.3)
    else if (name === 'nagari') this.chime(t, [440, 370, 294], 0.28)
    else if (name === 'chongtong') this.chime(t, [262, 392, 523, 784, 1046], 0.2)
    else if (name === 'tick') this.hit(t, 880, 0.05, 0.28)
    else if (name === 'stamp' || name === 'seal') {
      this.hit(t, 90, 0.12, 0.7)
      this.hit(t + 0.04, 180, 0.08, 0.4)
    }
    else if (name === 'slash') {
      this.hit(t, 1400, 0.08, 0.35)
      this.hit(t + 0.02, 420, 0.1, 0.4)
    }
    else if (name === 'flame') this.chime(t, [220, 330, 494, 740], 0.22)
    else if (name === 'frost') this.chime(t, [880, 1175, 1568, 2093], 0.2)
    else if (name === 'wind') this.chime(t, [392, 523, 784, 1046], 0.18)
    else if (name === 'bagua') {
      this.hit(t, 55, 0.32, 0.9)
      this.chime(t + 0.04, [196, 294, 392], 0.24)
    }
    else if (name === 'birds') {
      this.chime(t, [988, 1318, 1760], 0.16)
      this.hit(t + 0.25, 1568, 0.05, 0.3)
      this.hit(t + 0.5, 1976, 0.05, 0.3)
    }
    else if (name === 'jackpot') {
      this.chime(t, [523, 659, 784, 1046, 1318, 1568], 0.28)
      for (let i = 0; i < 8; i++) this.hit(t + i * 0.045, 1200 + i * 90, 0.03, 0.22)
    }
  }

  private thud(time: number) {
    if (!this.ctx || !this.sfxGain) return
    const osc = this.ctx.createOscillator()
    const filter = this.ctx.createBiquadFilter()
    const amp = this.ctx.createGain()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(480, time)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(196, time)
    osc.frequency.exponentialRampToValueAtTime(62, time + 0.16)
    amp.gain.setValueAtTime(0.9, time)
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.2)
    osc.connect(filter)
    filter.connect(amp)
    amp.connect(this.sfxGain)
    osc.start(time)
    osc.stop(time + 0.22)
    const mid = this.ctx.createOscillator()
    const midAmp = this.ctx.createGain()
    mid.frequency.setValueAtTime(260, time)
    midAmp.gain.setValueAtTime(0.42, time)
    midAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.07)
    mid.connect(midAmp)
    midAmp.connect(this.sfxGain)
    mid.start(time)
    mid.stop(time + 0.08)
  }

  private hit(time: number, freq: number, dur: number, gain: number) {
    if (!this.ctx || !this.sfxGain || !this.noise) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 900
    const amp = this.ctx.createGain()
    amp.gain.setValueAtTime(gain, time)
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    src.connect(filter)
    filter.connect(amp)
    amp.connect(this.sfxGain)
    src.start(time)
    src.stop(time + dur)
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, time)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), time + dur)
    g.gain.setValueAtTime(gain * 0.7, time)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    osc.connect(g)
    g.connect(this.sfxGain)
    osc.start(time)
    osc.stop(time + dur + 0.02)
  }

  private chime(time: number, freqs: number[], dur: number) {
    freqs.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      osc.type = i % 2 ? 'triangle' : 'sine'
      osc.frequency.value = freq
      const start = time + i * 0.045
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(g)
      g.connect(this.sfxGain)
      osc.start(start)
      osc.stop(start + dur + 0.02)
    })
  }
}

export const audio = new AudioEngine()
