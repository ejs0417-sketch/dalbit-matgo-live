/**
 * 달빛맞고 : 강호무림 — 무협 × 슬롯 잭팟 Web Audio 엔진 (v0.4)
 * 기준 문서: /workspace/dalbit-matgo/art/CONCEPT.md
 * - WuxiaEventKind 34종 + 기본/UI/선뽑기 사운드 1:1 매핑
 * - 모바일 iOS/Android 첫 터치 오디오 잠금 해제 & visibilitychange 자동 일시정지/복구
 * - 폰 스피커에서도 묵직하게 들리는 중저음(110~180Hz) 보강 타격 + 검기·대북·빙결·비조·엽전 잭팟
 */

export type BgmScene = 'lobby' | 'table' | 'go' | 'goHigh' | 'goMax';

export type WuxiaSfxKind =
  | 'kung' | 'jjak' | 'slap' | 'flip' | 'shuffle'
  | 'coin' | 'tick' | 'stamp' | 'steal' | 'ppuk'
  | 'seonPick' | 'seonWin' | 'win' | 'lose'
  | 'jjok' | 'ttadak' | 'sweep' | 'four'
  | 'firstPpuk' | 'doublePpuk' | 'triple' | 'ownPpuk' | 'eatPpuk'
  | 'bomb' | 'shake' | 'chongtong'
  | 'bonusPlay' | 'bonusDraw' | 'gukjin' | 'mission' | 'nagari'
  | 'yaku:godori' | 'yaku:hong' | 'yaku:cheong' | 'yaku:cho'
  | 'yaku:sam' | 'yaku:bisam' | 'yaku:sa' | 'yaku:o'
  | 'go' | 'go1' | 'go2' | 'go3' | 'go4' | 'go5' | 'stop'
  | 'bak' | 'bak:pi' | 'bak:gwang' | 'bak:meong' | 'bak:gobak'
  | 'jackpot';

// 동양 5음계(D minor pentatonic: D, F, G, A, C)
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];
const PATTERNS: Record<BgmScene, number[]> = {
  lobby:  [0, -1, 2, -1, 3, -1, 4, -1, 3, -1, 2, -1],
  table:  [0, -1, 3, 2,  4, -1, 3, 2,  0, -1, 2, 3],
  go:     [0, 3,  4, 5,  3, 4,  5, 7,  4, 3,  2, 3],
  goHigh: [0, 4,  5, 7,  5, 4,  7, 5,  4, 5,  3, 4],
  goMax:  [0, 5,  7, 5,  7, 4,  7, 5,  7, 4,  5, 7],
};

function noteFreq(semitoneOffset: number, scaleIdx: number): number {
  const baseMidi = 50 + semitoneOffset + PENTA[scaleIdx % PENTA.length];
  return 440 * Math.pow(2, (baseMidi - 69) / 12);
}

export class WuxiaAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextBeat = 0;
  private step = 0;
  private scene: BgmScene = 'lobby';
  private bgmVolume = 0.55;
  private sfxVolume = 0.88;
  private bgmOn = true;
  private sfxOn = true;
  private watched = false;

  unlock(): void {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.92;
      this.master.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain.connect(this.master);
      this.sfxGain.connect(this.master);

      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.applyVolumes();
    this.ensureLoop();
    if (!this.watched) {
      this.watched = true;
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      });
    }
  }

  applyVolumes(): void {
    if (!this.ctx || !this.bgmGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.bgmGain.gain.setTargetAtTime(this.bgmOn ? this.bgmVolume * 0.22 : 0, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.sfxOn ? this.sfxVolume : 0, now, 0.03);
  }

  setBgmVolume(v: number): void { this.bgmVolume = Math.max(0, Math.min(1, v)); this.applyVolumes(); }
  setSfxVolume(v: number): void { this.sfxVolume = Math.max(0, Math.min(1, v)); this.applyVolumes(); }
  toggleBgm(): boolean { this.bgmOn = !this.bgmOn; this.applyVolumes(); return this.bgmOn; }
  toggleSfx(): boolean { this.sfxOn = !this.sfxOn; this.applyVolumes(); return this.sfxOn; }
  setScene(s: BgmScene): void { if (this.scene !== s) { this.scene = s; this.step = 0; } }
  setGoLevel(goCount: number): void {
    if (goCount >= 4) this.setScene('goMax');
    else if (goCount === 3) this.setScene('goHigh');
    else if (goCount >= 1) this.setScene('go');
    else this.setScene('table');
  }

  private ensureLoop(): void {
    if (this.timer !== null || !this.ctx) return;
    this.nextBeat = this.ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.pump(), 80);
  }

  private pump(): void {
    if (!this.ctx || !this.bgmGain || this.ctx.state !== 'running') return;
    const bpm =
      this.scene === 'goMax' ? 176 :
      this.scene === 'goHigh' ? 156 :
      this.scene === 'go' ? 132 :
      this.scene === 'table' ? 112 : 94;
    const stepDur = 60 / bpm / 2;
    while (this.nextBeat < this.ctx.currentTime + 0.24) {
      this.scheduleBeat(this.nextBeat, stepDur);
      this.nextBeat += stepDur;
      this.step = (this.step + 1) % 12;
    }
  }

  private scheduleBeat(t: number, d: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const a = this.step;
    const isGo = this.scene === 'go' || this.scene === 'goHigh' || this.scene === 'goMax';
    const shift = this.scene === 'goMax' ? 2 : this.scene === 'goHigh' ? 0 : this.scene === 'go' ? -2 : 0;
    const note = PATTERNS[this.scene][a];
    if (note >= 0) this.pluck(t, noteFreq(shift + 12, note), d * (isGo ? 1.15 : 1.8), isGo ? 0.18 : 0.13);
    if (a === 0 || a === 6) this.pluck(t, noteFreq(shift - 12, a === 0 ? 0 : 2), d * 4, 0.11);
    if (isGo && (a === 4 || a === 10)) this.pluck(t, noteFreq(shift + 24, this.scene === 'goMax' ? 7 : 4), d, this.scene === 'go' ? 0.08 : 0.13);
    if ((this.scene === 'goHigh' || this.scene === 'goMax') && (a === 2 || a === 8)) {
      this.pluck(t, noteFreq(shift + 24, 2), d * 0.7, 0.09);
    }
    if (a === 0 || a === 6) this.drum(t, false);
    if (a === 3 || a === 9 || (isGo && (a === 2 || a === 8 || (this.scene === 'goMax' && a % 2 === 0)))) {
      this.drum(t, true);
    }
  }

  private pluck(t: number, freq: number, dur: number, vol: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(freq * 5.5, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(180, freq), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(flt); flt.connect(gain); gain.connect(this.bgmGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  private drum(t: number, high: boolean): void {
    if (!this.ctx || !this.bgmGain || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const flt = this.ctx.createBiquadFilter();
    flt.type = high ? 'highpass' : 'lowpass';
    flt.frequency.value = high ? 1850 : 260;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(high ? 0.18 : 0.34, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (high ? 0.06 : 0.14));
    src.connect(flt); flt.connect(gain); gain.connect(this.bgmGain);
    src.start(t); src.stop(t + 0.16);
    if (!high) {
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.frequency.setValueAtTime(145, t);
      osc.frequency.exponentialRampToValueAtTime(56, t + 0.12);
      og.gain.setValueAtTime(0.22, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(og); og.connect(this.bgmGain);
      osc.start(t); osc.stop(t + 0.15);
    }
  }

  play(kind: WuxiaSfxKind | string): void {
    if (!this.ctx || !this.sfxGain || !this.sfxOn) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime;

    switch (kind) {
      case 'kung': this.taiko(t, 150, 0.22, 0.85); break;
      case 'jjak': this.slash(t, 2600, 0.09, 0.52); this.hit(t, 1280, 0.04, 0.62); break;
      case 'slap': this.hit(t, 180, 0.09, 0.5); break;
      case 'flip': this.hit(t, 340, 0.05, 0.3); break;
      case 'shuffle':
        for (let i = 0; i < 6; i++) this.hit(t + i * 0.045, 220 + i * 32, 0.04, 0.22);
        break;
      case 'tick': this.hit(t, 920, 0.04, 0.28); break;
      case 'stamp': this.taiko(t, 125, 0.14, 0.65); break;
      case 'coin': this.coinShower(t, 3, 0.055); break;
      case 'steal': this.slash(t, 1800, 0.1, 0.35); this.chime(t + 0.04, [659, 880], 0.12); break;
      case 'seonPick': this.hit(t, 420, 0.06, 0.4); break;
      case 'seonWin': this.taiko(t, 130, 0.2, 0.6); this.chime(t + 0.05, [523, 659, 784, 1046], 0.22); break;

      case 'jjok': this.slash(t, 2400, 0.14, 0.55); this.chime(t + 0.04, [587, 880], 0.16); break;
      case 'ttadak':
        this.slash(t, 2200, 0.12, 0.5);
        this.slash(t + 0.1, 3000, 0.14, 0.6);
        this.chime(t + 0.08, [440, 587, 880], 0.2);
        break;
      case 'sweep': this.slash(t, 1400, 0.22, 0.55); this.chime(t + 0.06, [523, 659, 880, 1175], 0.22); break;
      case 'four': this.slash(t, 2600, 0.16, 0.6); this.coinShower(t + 0.05, 5, 0.05); break;

      case 'ppuk': this.taiko(t, 105, 0.22, 0.55); break;
      case 'firstPpuk': this.taiko(t, 110, 0.28, 0.85); this.coinShower(t + 0.12, 4, 0.055); break;
      case 'doublePpuk':
        this.taiko(t, 115, 0.24, 0.85);
        this.taiko(t + 0.16, 95, 0.32, 0.95);
        this.coinShower(t + 0.22, 6, 0.05);
        break;
      case 'triple':
        this.taiko(t, 110, 0.2, 0.85);
        this.taiko(t + 0.14, 95, 0.22, 0.9);
        this.gong(t + 0.26, 0.85);
        this.coinShower(t + 0.28, 10, 0.045);
        break;
      case 'ownPpuk': this.slash(t, 2000, 0.15, 0.6); this.taiko(t + 0.05, 130, 0.2, 0.7); break;
      case 'eatPpuk': this.slash(t, 2200, 0.12, 0.5); this.chime(t + 0.04, [523, 784], 0.16); break;

      case 'bomb':
        this.taiko(t, 82, 0.36, 0.95);
        this.slash(t + 0.04, 900, 0.28, 0.7);
        this.gong(t + 0.08, 0.6);
        break;
      case 'shake': this.taiko(t, 125, 0.2, 0.65); this.chime(t + 0.04, [392, 523, 659, 784], 0.18); break;
      case 'chongtong':
        this.gong(t, 0.85);
        this.coinShower(t + 0.08, 10, 0.045);
        this.chime(t + 0.1, [523, 659, 784, 1046, 1318], 0.28);
        break;

      case 'bonusPlay':
      case 'bonusDraw': this.coinShower(t, 3, 0.045); break;
      case 'gukjin': this.chime(t, [587, 880, 1175], 0.24); this.gong(t + 0.06, 0.35); break;
      case 'mission': this.taiko(t, 140, 0.18, 0.65); this.chime(t + 0.05, [659, 880, 1175, 1318], 0.24); break;
      case 'nagari': this.gong(t, 0.55); this.chime(t + 0.08, [440, 392, 330], 0.28); break;

      // 족보 필살기
      case 'yaku:godori':
        // 고! · 도! · 리! 3연타 대북 + 비조 날갯짓 휘파람
        this.taiko(t, 135, 0.18, 0.8);
        this.taiko(t + 0.24, 145, 0.18, 0.85);
        this.taiko(t + 0.48, 120, 0.28, 0.95);
        this.birdCall(t + 0.18);
        this.birdCall(t + 0.42);
        this.chime(t + 0.5, [740, 988, 1175, 1568], 0.24);
        break;
      case 'yaku:hong':
        this.slash(t, 750, 0.3, 0.72);
        this.taiko(t + 0.04, 115, 0.28, 0.85);
        this.chime(t + 0.08, [440, 587, 880, 1175], 0.24);
        break;
      case 'yaku:cheong':
        this.slash(t, 3400, 0.2, 0.6);
        this.chime(t + 0.03, [1318, 1568, 2093, 2637], 0.22);
        break;
      case 'yaku:cho':
        this.slash(t, 1600, 0.24, 0.55);
        this.chime(t + 0.05, [523, 659, 784, 1046], 0.22);
        break;
      case 'yaku:sam':
      case 'yaku:bisam':
      case 'yaku:sa':
      case 'yaku:o':
        this.slash(t, 1100, 0.28, 0.75);
        this.gong(t + 0.04, 0.8);
        this.chime(t + 0.1, [392, 523, 784, 1046, 1568], 0.28);
        break;

      case 'go':
      case 'go1': this.taiko(t, 140, 0.16, 0.65); this.chime(t + 0.03, [523, 659, 784], 0.18); break;
      case 'go2': this.taiko(t, 130, 0.2, 0.75); this.chime(t + 0.04, [440, 587, 784, 988], 0.2); break;
      case 'go3': this.taiko(t, 110, 0.26, 0.88); this.slash(t + 0.04, 2200, 0.15, 0.55); this.chime(t + 0.06, [392, 523, 784, 1046], 0.24); break;
      case 'go4':
      case 'go5': this.taiko(t, 92, 0.34, 0.96); this.gong(t + 0.05, 0.75); this.chime(t + 0.08, [294, 440, 587, 880, 1175, 1480], 0.28); break;
      case 'stop': this.taiko(t, 120, 0.22, 0.75); this.chime(t + 0.05, [784, 659, 523], 0.24); break;

      // 박 낙인 연쇄
      case 'bak':
      case 'bak:pi': this.taiko(t, 100, 0.28, 0.9); this.chime(t + 0.04, [311, 415], 0.22); break;
      case 'bak:gwang': this.slash(t, 1200, 0.26, 0.8); this.taiko(t + 0.03, 95, 0.3, 0.92); break;
      case 'bak:meong': this.taiko(t, 115, 0.24, 0.82); this.chime(t + 0.05, [370, 494], 0.2); break;
      case 'bak:gobak': this.taiko(t, 78, 0.38, 0.98); this.gong(t + 0.05, 0.9); break;

      case 'jackpot':
        // 슬롯 롤링 틱 + 금화 분수 샤워 + 잭팟 팡파레
        for (let i = 0; i < 8; i++) this.hit(t + i * 0.045, 760 + i * 70, 0.035, 0.26);
        this.gong(t + 0.36, 0.85);
        this.coinShower(t + 0.38, 12, 0.045);
        this.chime(t + 0.4, [523, 659, 784, 1046, 1318, 1568], 0.3);
        break;
      case 'win': this.chime(t, [523, 659, 784, 1046], 0.28); this.coinShower(t + 0.08, 6, 0.05); break;
      case 'lose': this.gong(t, 0.45); this.chime(t + 0.06, [392, 311, 247], 0.3); break;
      default:
        if (kind.startsWith('yaku')) this.chime(t, [523, 659, 880, 1175], 0.22);
        else if (kind.startsWith('bak')) this.taiko(t, 100, 0.26, 0.85);
        break;
    }
  }

  // 폰 스피커에서도 묵직하게 들리는 중저음 대북 타격
  private taiko(t: number, startHz: number, dur: number, vol: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startHz, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(46, startHz * 0.38), t + dur);
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(520, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(flt); flt.connect(gain); gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
    // 어택 클릭 (폰 스피커 존재감)
    this.hit(t, startHz * 1.6, 0.05, vol * 0.5);
  }

  // 검기 일섬 / 화염 / 질풍 노이즈 스윕
  private slash(t: number, centerHz: number, dur: number, vol: number): void {
    if (!this.ctx || !this.sfxGain || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.Q.value = 2.4;
    flt.frequency.setValueAtTime(centerHz * 1.6, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(240, centerHz * 0.35), t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(gain); gain.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // 무협 징(Gong) 여운
  private gong(t: number, vol: number): void {
    if (!this.ctx || !this.sfxGain) return;
    [196, 293, 415, 587].forEach((hz, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(hz, t);
      osc.frequency.exponentialRampToValueAtTime(hz * 0.96, t + 0.7);
      gain.gain.setValueAtTime(vol * (0.28 / (idx + 1)), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.75);
    });
  }

  // 고도리 황금 비조 울음/날갯짓
  private birdCall(t: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, t);
    osc.frequency.exponentialRampToValueAtTime(2480, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.16);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.24, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.2);
  }

  // 슬롯 엽전 쏟아지는 소리
  private coinShower(t: number, count: number, spacing: number): void {
    for (let i = 0; i < count; i++) {
      const f = 1318 + ((i * 237) % 900);
      this.chime(t + i * spacing, [f, f * 1.5], 0.09);
    }
  }

  private hit(t: number, freq: number, dur: number, vol: number): void {
    if (!this.ctx || !this.sfxGain || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = Math.min(4000, freq * 1.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.01);

    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(44, freq * 0.4), t + dur);
    og.gain.setValueAtTime(vol * 0.65, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(og); og.connect(this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.015);
  }

  private chime(t: number, freqs: number[], dur: number): void {
    if (!this.ctx || !this.sfxGain) return;
    freqs.forEach((hz, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const start = t + idx * 0.045;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(start); osc.stop(start + dur + 0.02);
    });
  }

  /** v0.5 물리 SFX용: 컨텍스트 현재 시각 (언락 전·음소거면 null) */
  private now(): number | null {
    if (!this.ctx || !this.sfxGain || !this.sfxOn) return null;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx.currentTime;
  }

  // ── 실물 화투패 타격·가져오기·피 뺏기·뻑 포개기·폭탄 3장 동시 투하 SFX ──
  /** 바닥에 패를 "찰싹! 딱!" 내려치는 소리 */
  playCardSlap(): void {
    const t = this.now();
    if (t === null) return;
    this.hit(t, 360, 0.055, 0.72);
    this.hit(t + 0.012, 1180, 0.032, 0.52);
  }

  /** 바닥 패와 딱 맞물려 부딪히는 화투 "딱!" 소리 */
  playCardClack(): void {
    const t = this.now();
    if (t === null) return;
    this.hit(t, 1680, 0.028, 0.68);
    this.hit(t + 0.018, 860, 0.045, 0.55);
  }

  /** 먹은 패를 내 쪽으로 쓱 쓸어 가져오는 소리 */
  playCaptureSweep(): void {
    const t = this.now();
    if (t === null) return;
    this.hit(t, 2200, 0.09, 0.26);
    this.hit(t + 0.07, 1450, 0.04, 0.34);
  }

  /** 상대방 먹은 피를 빼앗아 오는 "휘익- 딱!" 소리 */
  playStealPi(): void {
    const t = this.now();
    if (t === null) return;
    this.slash(t, 2100, 0.09, 0.5);
    this.hit(t + 0.085, 1520, 0.04, 0.62);
    this.chime(t + 0.09, [880, 1320], 0.11);
  }

  /** 뻑! 바닥에 3장이 포개지며 묵직하게 박히는 소리 */
  playPpukStack(): void {
    const t = this.now();
    if (t === null) return;
    this.hit(t, 1280, 0.03, 0.5);
    this.hit(t + 0.065, 920, 0.04, 0.55);
    this.taiko(t + 0.13, 108, 0.28, 0.85);
  }

  /** 폭탄 3장 동시 연타("탁! 탁! 탁!") + 팔괘 폭발음 */
  playBombTripleSlam(): void {
    const t = this.now();
    if (t === null) return;
    this.hit(t, 1520, 0.032, 0.65);
    this.hit(t + 0.055, 1680, 0.032, 0.72);
    this.hit(t + 0.11, 1860, 0.036, 0.8);
    this.taiko(t + 0.14, 96, 0.38, 0.96);
    this.gong(t + 0.16, 0.75);
  }
}
