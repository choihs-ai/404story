/* ==========================================================================
   404호 소각로 — 절차적 사운드 (Web Audio API, 외부 오디오 파일 없음)
   window.Sfx 로 노출된다. 첫 사용자 입력에서 Sfx.init() 을 호출해야 소리가 난다(iOS 제한).
   ========================================================================== */
(function () {
  'use strict';

  let ctx = null;
  let master, comp, muffle, sfxBus, ambBus, fireBus;
  const buf = {};
  let muted = false;
  let volume = 0.8;
  let muffleBase = 0;      // 0~1, 기억 상실로 먹먹해지는 정도
  let lastType = 0;
  let mood = null;         // { name, nodes, gain }
  let hum = null;
  let fire = null;
  let fireLevel = 0.3;
  let crackleTimer = null;

  const MOOD_ALIAS = { neutral: 'office', normal: 'office', work: 'office', sad: 'sad', melancholy: 'sad', calm: 'calm', tense: 'tense', dread: 'dread', horror: 'dread', fear: 'dread', warm: 'warm', hope: 'warm', tender: 'warm', silence: 'silence', none: 'silence', office: 'office' };

  // 각 무드: 드론 보이스 [주파수, 파형, 음량], 로우패스, LFO 속도, 추가 노이즈 [종류, 음량, 컷오프], 펄스 [주파수, 음량, 주기]
  const MOODS = {
    office:  { voices: [[60, 'sine', 0.025], [120, 'sine', 0.012], [180, 'triangle', 0.004]], lp: 600, lfo: 0.05, noise: ['pink', 0.012, 900] },
    calm:    { voices: [[110, 'sine', 0.05], [164.81, 'sine', 0.035], [220, 'triangle', 0.012]], lp: 900, lfo: 0.07 },
    tense:   { voices: [[55, 'sawtooth', 0.028], [55.7, 'sawtooth', 0.028], [82.4, 'sawtooth', 0.012]], lp: 380, lfo: 0.12, pulse: [880, 0.008, 1.7] },
    dread:   { voices: [[41.2, 'sine', 0.09], [43.65, 'sine', 0.07], [61.7, 'triangle', 0.02]], lp: 260, lfo: 0.05, noise: ['brown', 0.06, 220] },
    warm:    { voices: [[130.81, 'triangle', 0.03], [164.81, 'triangle', 0.025], [196, 'sine', 0.03], [261.63, 'sine', 0.012]], lp: 1500, lfo: 0.09 },
    sad:     { voices: [[110, 'sine', 0.045], [130.81, 'sine', 0.03], [164.81, 'sine', 0.025], [55, 'sine', 0.03]], lp: 800, lfo: 0.06 },
    silence: null
  };

  function now() { return ctx.currentTime; }

  function makeNoise(type, secs) {
    const len = Math.floor(ctx.sampleRate * secs);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    if (type === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') { // Paul Kellet
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else { // brown
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return b;
  }

  function noise(type, loop) {
    const s = ctx.createBufferSource();
    s.buffer = buf[type || 'white'];
    s.loop = !!loop;
    return s;
  }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; }
  function filt(type, f, q) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; return x; }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }

  /** 짧은 엔벨로프: 0 → peak (attack) → 0 (decay) */
  function pluck(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** 노이즈 한 방 */
  function burst(t, type, ftype, f, q, peak, attack, decay, out) {
    const n = noise(type);
    const fl = filt(ftype, f, q);
    const g = gain(0);
    n.connect(fl); fl.connect(g); g.connect(out || sfxBus);
    pluck(g, t, peak, attack, decay);
    const off = Math.random() * (n.buffer.duration - attack - decay - 0.1);
    n.start(t, Math.max(0, off), attack + decay + 0.05);
    return { n, fl, g };
  }

  /** 톤 한 방 */
  function tone(t, type, f, peak, attack, decay, out, fEnd) {
    const o = osc(type, f);
    const g = gain(0);
    o.connect(g); g.connect(out || sfxBus);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + attack + decay);
    pluck(g, t, peak, attack, decay);
    o.start(t); o.stop(t + attack + decay + 0.05);
    return o;
  }

  // ───────────────────────── 초기화 ─────────────────────────
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    master = gain(muted ? 0 : volume);
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    muffle = filt('lowpass', 20000, 0.7);
    sfxBus = gain(1); ambBus = gain(0.55); fireBus = gain(1);
    sfxBus.connect(muffle); ambBus.connect(muffle); fireBus.connect(muffle);
    muffle.connect(comp); comp.connect(master); master.connect(ctx.destination);
    buf.white = makeNoise('white', 2);
    buf.pink = makeNoise('pink', 4);
    buf.brown = makeNoise('brown', 4);
    startFire();
    setMuffle(muffleBase);
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    return true;
  }

  // ───────────────────────── 효과음 ─────────────────────────
  /** 타자기/대사 출력 틱. heavy=true 면 최후의 타이핑용 묵직한 타건음 */
  function type(heavy) {
    if (!ctx) return;
    const t = now();
    if (!heavy && t - lastType < 0.028) return;
    lastType = t;
    const k = heavy ? 1.7 : 0.8;
    burst(t, 'white', 'bandpass', 2600 + Math.random() * 2200, 1.4, 0.22 * k, 0.002, 0.028);
    tone(t, 'square', 170 + Math.random() * 70, 0.035 * k, 0.001, 0.022);
    if (heavy) {
      burst(t + 0.004, 'white', 'highpass', 5200, 0.8, 0.12, 0.001, 0.04);
      tone(t, 'sine', 95, 0.25, 0.002, 0.09, null, 55);
    }
  }

  /** 타자기 줄바꿈 벨 */
  function bell() {
    if (!ctx) return;
    const t = now();
    tone(t, 'sine', 2093, 0.12, 0.002, 1.1);
    tone(t, 'sine', 3136, 0.06, 0.002, 0.7);
    tone(t, 'sine', 4186, 0.02, 0.002, 0.4);
  }

  /** 도장 찍는 둔탁한 소리 */
  function stamp() {
    if (!ctx) return;
    const t = now();
    tone(t, 'sine', 160, 0.9, 0.003, 0.28, null, 42);
    burst(t, 'white', 'lowpass', 1100, 0.7, 0.55, 0.002, 0.07);
    burst(t + 0.008, 'white', 'bandpass', 3600, 2, 0.16, 0.001, 0.03);
    tone(t + 0.01, 'triangle', 320, 0.1, 0.001, 0.06, null, 180);
  }

  /** 판독기 투입: 딸깍 + 모터 + 삑 */
  function insert() {
    if (!ctx) return;
    const t = now();
    tone(t, 'square', 1100, 0.08, 0.001, 0.012);
    burst(t, 'white', 'bandpass', 1800, 3, 0.25, 0.001, 0.03);
    const o = osc('sawtooth', 210); const lp = filt('lowpass', 900, 2); const g = gain(0);
    o.connect(lp); lp.connect(g); g.connect(sfxBus);
    o.frequency.linearRampToValueAtTime(340, t + 0.32);
    g.gain.setValueAtTime(0.0001, t + 0.04); g.gain.linearRampToValueAtTime(0.06, t + 0.08); g.gain.linearRampToValueAtTime(0.0001, t + 0.34);
    o.start(t + 0.04); o.stop(t + 0.4);
    tone(t + 0.42, 'sine', 1320, 0.08, 0.004, 0.09);
    tone(t + 0.55, 'sine', 1760, 0.06, 0.004, 0.08);
  }

  /** 짧은 삑 (UI) */
  function beep(f, d) {
    if (!ctx) return;
    tone(now(), 'sine', f || 880, 0.05, 0.003, d || 0.06);
  }

  /** 버튼 클릭 */
  function click() {
    if (!ctx) return;
    const t = now();
    tone(t, 'sine', 620, 0.05, 0.001, 0.02);
    burst(t, 'white', 'highpass', 3000, 0.7, 0.05, 0.001, 0.01);
  }

  /** 거부 버저 */
  function deny() {
    if (!ctx) return;
    const t = now();
    const lp = filt('lowpass', 900, 0.8); lp.connect(sfxBus);
    tone(t, 'square', 110, 0.09, 0.005, 0.32, lp);
    tone(t, 'square', 116.5, 0.09, 0.005, 0.32, lp);
  }

  /** 종이 넘기는 소리 */
  function paper() {
    if (!ctx) return;
    const t = now();
    const b = burst(t, 'white', 'bandpass', 1800, 0.9, 0.18, 0.02, 0.14);
    b.fl.frequency.linearRampToValueAtTime(3600, t + 0.15);
  }

  /** 서랍에 숨기기: 미끄러짐 + 쿵 + 걸쇠 */
  function drawer() {
    if (!ctx) return;
    const t = now();
    const b = burst(t, 'pink', 'bandpass', 320, 1.6, 0.5, 0.05, 0.34);
    b.fl.frequency.exponentialRampToValueAtTime(900, t + 0.36);
    tone(t + 0.38, 'sine', 120, 0.55, 0.003, 0.16, null, 55);
    burst(t + 0.38, 'white', 'lowpass', 700, 0.7, 0.3, 0.002, 0.06);
    tone(t + 0.52, 'square', 2400, 0.03, 0.001, 0.015);
  }

  /** 소각: 화르륵 + 저음 굉음 + 타닥 */
  function burn() {
    if (!ctx) return;
    const t = now();
    const n = noise('pink'); const lp = filt('lowpass', 250, 0.9); const g = gain(0);
    n.connect(lp); lp.connect(g); g.connect(sfxBus);
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.exponentialRampToValueAtTime(3800, t + 0.35);
    lp.frequency.exponentialRampToValueAtTime(700, t + 2.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    n.start(t, Math.random(), 2.6);
    const r = noise('brown'); const rl = filt('lowpass', 160, 0.7); const rg = gain(0);
    r.connect(rl); rl.connect(rg); rg.connect(sfxBus);
    rg.gain.setValueAtTime(0.0001, t); rg.gain.exponentialRampToValueAtTime(0.9, t + 0.2); rg.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    r.start(t, Math.random(), 2.9);
    for (let i = 0; i < 38; i++) {
      const ct = t + 0.1 + Math.random() * 2.3;
      burst(ct, 'white', 'bandpass', 1500 + Math.random() * 4500, 3, 0.05 + Math.random() * 0.25, 0.001, 0.008 + Math.random() * 0.02);
    }
  }

  /** 글리치 (디지털 파열음) */
  function glitch(strength) {
    if (!ctx) return;
    const s = strength == null ? 1 : strength;
    const t = now();
    const n = Math.round(8 + 10 * s);
    for (let i = 0; i < n; i++) {
      const ct = t + i * 0.022 + Math.random() * 0.01;
      tone(ct, Math.random() < 0.5 ? 'square' : 'sawtooth', 80 + Math.random() * 3800, 0.07 * s, 0.001, 0.015 + Math.random() * 0.02);
      if (Math.random() < 0.4) burst(ct, 'white', 'highpass', 4000, 0.7, 0.08 * s, 0.001, 0.02);
    }
  }

  /** 검게 칠하는 마커 소리 (수첩 문장 소거) */
  function scribble(dur) {
    if (!ctx) return;
    const d = dur || 0.6;
    const t = now();
    const n = noise('white'); const bp = filt('bandpass', 1700, 1.1); const g = gain(0);
    const lfo = osc('square', 13 + Math.random() * 5); const lg = gain(0.09);
    lfo.connect(lg); lg.connect(g.gain);
    n.connect(bp); bp.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(0.1, t); g.gain.setValueAtTime(0.1, t + d - 0.05); g.gain.linearRampToValueAtTime(0, t + d);
    n.start(t, Math.random(), d + 0.1); lfo.start(t); lfo.stop(t + d + 0.1);
  }

  /** 노크 (민원 창구 유리) */
  function knock() {
    if (!ctx) return;
    const t = now();
    [0, 0.18, 0.36].forEach(dt => {
      tone(t + dt, 'sine', 210, 0.45, 0.002, 0.12, null, 140);
      burst(t + dt, 'white', 'bandpass', 2400, 2, 0.12, 0.001, 0.03);
    });
  }

  /** 창구 호출 벨 */
  function chime() {
    if (!ctx) return;
    const t = now();
    tone(t, 'sine', 988, 0.12, 0.003, 0.9);
    tone(t + 0.22, 'sine', 784, 0.12, 0.003, 1.1);
  }

  /** 휙 (글자가 소각로로 빨려 들어감) */
  function whoosh() {
    if (!ctx) return;
    const t = now();
    const b = burst(t, 'pink', 'bandpass', 400, 1.2, 0.5, 0.18, 0.4);
    b.fl.frequency.exponentialRampToValueAtTime(3000, t + 0.5);
  }

  /** 심장 박동 */
  function heartbeat() {
    if (!ctx) return;
    const t = now();
    tone(t, 'sine', 62, 0.6, 0.01, 0.16, null, 40);
    tone(t + 0.26, 'sine', 56, 0.45, 0.01, 0.2, null, 38);
  }

  const NAMED = { type: () => type(false), key: () => type(true), typewriter: () => type(true), bell, stamp, insert, beep: () => beep(), click, deny, paper, drawer, burn, glitch: () => glitch(1), scribble: () => scribble(0.7), knock, chime, whoosh, heartbeat };
  function play(name) {
    const f = NAMED[name];
    if (f) f(); else console.warn('[Sfx] 알 수 없는 효과음:', name);
  }

  // ───────────────────────── 소각로 앰비언스 ─────────────────────────
  function startFire() {
    const a = noise('brown', true); const b = noise('pink', true);
    const lp = filt('lowpass', 420, 0.6); const g = gain(0);
    const bg = gain(0.25);
    a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g); g.connect(fireBus);
    a.start(); b.start();
    fire = { g, lp };
    setFire(fireLevel);
    crackleTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const chance = 0.15 + fireLevel * 0.6;
      if (Math.random() < chance) {
        burst(now(), 'white', 'bandpass', 1800 + Math.random() * 4000, 3, 0.02 + fireLevel * 0.08 * Math.random(), 0.001, 0.008 + Math.random() * 0.015, fireBus);
      }
    }, 70);
  }
  function setFire(level) {
    fireLevel = Math.max(0, Math.min(1, level));
    if (!ctx || !fire) return;
    const t = now();
    fire.g.gain.setTargetAtTime(0.04 + fireLevel * 0.2, t, 0.5);
    fire.lp.frequency.setTargetAtTime(260 + fireLevel * 700, t, 0.5);
  }

  // ───────────────────────── 판독기 험 ─────────────────────────
  function setHum(on) {
    if (!ctx) return;
    const t = now();
    if (on && !hum) {
      const g = gain(0);
      const o1 = osc('sine', 50); const o2 = osc('sine', 100);
      const g2 = gain(0.5);
      const w = noise('white', true); const bp = filt('bandpass', 7800, 8); const wg = gain(0.12);
      o1.connect(g); o2.connect(g2); g2.connect(g); w.connect(bp); bp.connect(wg); wg.connect(g);
      g.connect(sfxBus);
      o1.start(); o2.start(); w.start();
      g.gain.setTargetAtTime(0.03, t, 0.2);
      hum = { g, nodes: [o1, o2, w] };
    } else if (!on && hum) {
      const h = hum; hum = null;
      h.g.gain.setTargetAtTime(0, t, 0.15);
      setTimeout(() => h.nodes.forEach(n => { try { n.stop(); } catch (e) { /* 이미 정지 */ } }), 900);
    }
  }

  // ───────────────────────── 무드 앰비언트 ─────────────────────────
  function setMood(name) {
    if (name == null) return;
    const key = MOOD_ALIAS[name] || (MOODS.hasOwnProperty(name) ? name : null);
    if (!key) { console.warn('[Sfx] 알 수 없는 bgmMood:', name, '(사용 가능: office, calm, tense, dread, warm, sad, silence)'); return; }
    if (mood && mood.name === key) return;
    if (!ctx) { mood = { name: key, pending: true }; return; }
    const t = now();
    if (mood && mood.gain) {
      const old = mood;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setTargetAtTime(0, t, 0.8);
      setTimeout(() => old.nodes.forEach(n => { try { n.stop(); } catch (e) { /* 정지됨 */ } }), 4000);
    }
    const def = MOODS[key];
    if (!def) { mood = { name: key, nodes: [], gain: null }; return; }
    const g = gain(0);
    const lp = filt('lowpass', def.lp, 0.8);
    lp.connect(g); g.connect(ambBus);
    const nodes = [];
    def.voices.forEach(([f, ty, v]) => {
      const o = osc(ty, f); const vg = gain(v);
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(vg); vg.connect(lp); o.start(); nodes.push(o);
    });
    const lfo = osc('sine', def.lfo); const lfoG = gain(def.lp * 0.35);
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start(); nodes.push(lfo);
    if (def.noise) {
      const [nt, nv, nf] = def.noise;
      const n = noise(nt, true); const nl = filt('lowpass', nf, 0.7); const ng = gain(nv);
      n.connect(nl); nl.connect(ng); ng.connect(g); n.start(); nodes.push(n);
    }
    if (def.pulse) {
      const [pf, pv, pr] = def.pulse;
      const p = osc('sine', pf); const pg = gain(0);
      const pl = osc('sine', 1 / pr); const plg = gain(pv);
      pl.connect(plg); plg.connect(pg.gain); p.connect(pg); pg.connect(g);
      p.start(); pl.start(); nodes.push(p, pl);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 2.5);
    mood = { name: key, nodes, gain: g };
  }

  // ───────────────────────── 먹먹함 (로우패스) ─────────────────────────
  function cutoffFor(level) { return Math.max(380, 20000 * Math.pow(0.035, level)); }
  function setMuffle(level) {
    muffleBase = Math.max(0, Math.min(1, level));
    if (!ctx) return;
    muffle.frequency.setTargetAtTime(cutoffFor(muffleBase), now(), 0.6);
  }
  /** 자기 기억을 태운 순간: 확 먹먹해졌다가 새 기준점으로 돌아온다 */
  function muffleDip() {
    if (!ctx) return;
    const t = now();
    muffle.frequency.cancelScheduledValues(t);
    muffle.frequency.setTargetAtTime(240, t, 0.05);
    muffle.frequency.setTargetAtTime(cutoffFor(muffleBase), t + 1.2, 1.1);
    const g = master.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime((muted ? 0 : volume) * 0.45, t, 0.05);
    g.setTargetAtTime(muted ? 0 : volume, t + 1.0, 0.8);
  }

  // ───────────────────────── 볼륨 ─────────────────────────
  function setMuted(m) {
    muted = !!m;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : volume, now(), 0.05);
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (ctx && !muted) master.gain.setTargetAtTime(volume, now(), 0.05);
  }

  window.Sfx = {
    init() {
      const ok = init();
      if (ok && mood && mood.pending) { const n = mood.name; mood = null; setMood(n); }
      return ok;
    },
    get ready() { return !!ctx; },
    get muted() { return muted; },
    play, type, bell, stamp, insert, beep, click, deny, paper, drawer, burn, glitch, scribble, knock, chime, whoosh, heartbeat,
    setFire, setHum, setMood, setMuffle, muffleDip, setMuted, setVolume,
    get volume() { return volume; },
    MOODS: Object.keys(MOODS),
    SFX: Object.keys(NAMED)
  };
})();
