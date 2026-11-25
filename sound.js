// 사기경마 배경음악·효과음
// 외부 음원 없이 Web Audio로 직접 연주하는 자작곡이에요.
// 배경음악: 어둡고 웅장한 SF 전략게임풍(D단조, 110BPM, 32마디 4구간 반복)이 끊김 없이 흘러요.
// 경주 중에는 같은 곡 위에 말발굽 리듬이 겹쳐져요.
(function () {
  let ctx = null, comp = null, master = null, bgmBus = null, sfxBus = null;
  let on = true, vol = 0.9, bgmOn = false, race = false, duck = false;
  let step = 0, nextTime = 0, unlockedAt = 0;
  const BPM = 110, DT = 60 / BPM / 4; // 16분음표
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = on ? vol : 0;
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0.9;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1.0;
    const makeup = ctx.createGain(); makeup.gain.value = 2.4;
    const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.1;
    bgmBus.connect(comp); sfxBus.connect(comp); comp.connect(makeup); makeup.connect(limiter); limiter.connect(master); master.connect(ctx.destination);
  }
  const ready = () => !!ctx && ctx.state === 'running';

  // ── 악기 ──
  function osc(midi, t, dur, type, gain, bus, opt = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(opt.freq || mtof(midi), t);
    if (opt.detune) o.detune.value = opt.detune;
    if (opt.slideTo) o.frequency.exponentialRampToValueAtTime(opt.slideTo, t + dur);
    const a = opt.attack || 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opt.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(opt.lp, t); if (opt.lpTo) f.frequency.exponentialRampToValueAtTime(opt.lpTo, t + dur); f.Q.value = opt.q || 0.8; o.connect(f); node = f; }
    node.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  let nb = null;
  function noise(t, dur, gain, freq, q, bus, type) {
    if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nb; s.loop = true; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function kick(t, gain, bus) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + 0.25);
  }
  function snare(t, gain, bus) { noise(t, 0.16, gain, 1900, 0.6, bus); osc(0, t, 0.08, 'triangle', gain * 0.6, bus, { freq: 190 }); }
  function hat(t, gain, bus) { noise(t, 0.035, gain, 9000, 0.7, bus, 'highpass'); }
  function tom(t, f, gain, bus) { osc(0, t, 0.3, 'sine', gain, bus, { freq: f, slideTo: f * 0.55 }); }

  // ── 배경음악 (32마디 = 8마디 × 4구간) ──
  // 코드 진행: Dm Dm Bb C | Dm Dm Gm A
  const CH = { Dm: [50, 53, 57, 62], Bb: [46, 50, 53, 58], C: [48, 52, 55, 60], Gm: [43, 50, 55, 58], A: [45, 49, 52, 57] };
  const ROOT = { Dm: 38, Bb: 34, C: 36, Gm: 31, A: 33 };
  const PROG = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'];
  // 리드 멜로디 [마디][16분 위치] = 음
  const LEAD = [
    { 0: 74, 6: 76, 8: 77, 12: 76 }, { 0: 74, 4: 69, 8: 72, 12: 74 },
    { 0: 77, 6: 74, 8: 70, 12: 74 }, { 0: 72, 4: 76, 8: 79, 12: 76 },
    { 0: 81, 6: 79, 8: 77, 12: 76 }, { 0: 77, 4: 74, 8: 69 },
    { 0: 70, 4: 74, 8: 79, 12: 77 }, { 0: 76, 4: 73, 8: 69 }
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2];

  function playStep(s, t) {
    const bar = Math.floor(s / 16) % 32, k = s % 16, sec = Math.floor(bar / 8), pb = bar % 8;
    const name = PROG[pb], ch = CH[name], root = ROOT[name], B = bgmBus;

    // 패드: 마디마다 길게 깔리는 화음 (톱니파 + 저역통과 필터)
    if (k === 0) ch.forEach((m, i) => {
      osc(m, t, DT * 16 * 1.05, 'sawtooth', 0.028, B, { attack: 0.35, lp: 700 + (sec === 3 ? 900 : 300), lpTo: 1400, detune: i % 2 ? 7 : -7 });
    });
    // 베이스: 8분음표로 꾸준히 (옥타브 왕복)
    if (k % 2 === 0) osc(root + ((k / 2) % 4 === 2 ? 12 : 0), t, DT * 1.8, 'sawtooth', 0.11, B, { lp: 420, q: 2 });

    // 드럼: 구간마다 다르게
    if (sec === 0) { if (k === 0 || k === 8) kick(t, 0.45, B); if (k % 4 === 2) hat(t, 0.03, B); }
    if (sec === 1 || sec === 2) {
      if (k === 0 || k === 8 || k === 10) kick(t, 0.5, B);
      if (k === 4 || k === 12) snare(t, 0.2, B);
      if (k % 2 === 0) hat(t, k % 4 === 2 ? 0.05 : 0.03, B);
    }
    if (sec === 3) {
      if (k === 0) kick(t, 0.5, B);
      if (pb >= 6 && k % 2 === 0) snare(t, 0.06 + k * 0.006, B); // 다음 구간으로 쌓아 올리기
      if (pb < 6 && (k === 12 || k === 14)) tom(t, k === 12 ? 160 : 120, 0.25, B);
    }
    // 아르페지오: 2·4구간
    if (sec === 1 || sec === 3) osc(ch[ARP[k]] + 12, t, DT * 1.4, 'square', 0.022, B, { lp: 2600 });
    // 리드 멜로디: 3구간
    if (sec === 2 && LEAD[pb][k]) {
      const m = LEAD[pb][k], d = pb === 7 && k === 8 ? DT * 8 : DT * 5;
      osc(m, t, d, 'sawtooth', 0.05, B, { lp: 2200, detune: -5 });
      osc(m, t, d, 'square', 0.03, B, { lp: 1800, detune: 6 });
    }
    // 경주 중: 말발굽(다그닥) 리듬과 하이햇을 겹침
    if (race) {
      const b = k % 4;
      if (b < 3) { noise(t, 0.05, b === 2 ? 0.16 : 0.1, b === 2 ? 650 : 1300, 1.3, sfxBus); osc(0, t, 0.04, 'sine', 0.07, sfxBus, { freq: b === 2 ? 520 : 820, slideTo: 300 }); }
      hat(t, 0.035, sfxBus);
    }
  }

  setInterval(() => {
    if (!ready() || !bgmOn) return;
    if (nextTime < ctx.currentTime - 0.25) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.15) { playStep(step, nextTime); nextTime += DT; step++; }
  }, 25);

  function setBus(bus, v) { if (bus) bus.gain.setTargetAtTime(v, ctx.currentTime, 0.15); }

  const api = {
    // 브라우저는 클릭·터치가 있어야 소리를 낼 수 있어요
    unlock() {
      if (!ready()) unlockedAt = Date.now();
      init(); if (!ctx) return;
      if (ctx.state !== 'running') ctx.resume().then(() => { nextTime = ctx.currentTime + 0.05; });
      try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
    },
    isReady: ready,
    justUnlocked: () => Date.now() - unlockedAt < 1500,
    setOn(v) { on = v; if (master) master.gain.setTargetAtTime(on ? vol : 0, ctx.currentTime, 0.05); },
    isOn: () => on,
    setVolume(v) { vol = v; if (master && on) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.05); },
    // 배경음악 켜기/끄기, 경주 레이어, 일시정지 때 작게
    bgm(v) { if (v && !bgmOn && ctx) nextTime = ctx.currentTime + 0.1; bgmOn = v; },
    setRace(v) { race = v; },
    setDuck(v) { duck = v; if (ctx) setBus(bgmBus, v ? 0.25 : 0.9); },

    // 새 단서 공개: 딩동댕
    chime() { if (!ready()) return; const t = ctx.currentTime + 0.05; osc(88, t, 0.6, 'sine', 0.22); osc(93, t + 0.15, 0.8, 'sine', 0.22); osc(100, t + 0.3, 1.1, 'sine', 0.14); },
    // 마감 카운트다운
    tick(n) { if (!ready()) return; const t = ctx.currentTime + 0.01; osc(n <= 1 ? 96 : 91, t, 0.1, 'square', 0.12, sfxBus, { lp: 3000 }); },
    // 출발! 나팔 + 종
    raceStart() {
      if (!ready()) return; const t = ctx.currentTime + 0.03;
      [67, 72, 76, 79].forEach((m, i) => { osc(m, t + i * 0.1, 0.12, 'sawtooth', 0.09, sfxBus, { lp: 2500 }); });
      [79, 84].forEach(m => osc(m, t + 0.42, 0.7, 'sawtooth', 0.07, sfxBus, { lp: 2800, attack: 0.02 }));
      osc(0, t + 0.42, 1.2, 'sine', 0.12, sfxBus, { freq: 1568 }); osc(0, t + 0.42, 1.0, 'sine', 0.07, sfxBus, { freq: 2350 });
    },
    // 한 턴 끝: 결승선 통과 느낌의 짧은 징글 + 심벌
    roundEnd() {
      if (!ready()) return; const t = ctx.currentTime + 0.03;
      kick(t, 0.6); noise(t, 1.2, 0.12, 6000, 0.4, sfxBus, 'highpass');
      [[62, 65, 69], [65, 69, 72], [69, 73, 76]].forEach((c, i) => c.forEach(m => osc(m, t + i * 0.16, i === 2 ? 0.9 : 0.18, 'sawtooth', 0.045, sfxBus, { lp: 2400 })));
      osc(0, t + 0.32, 0.4, 'triangle', 0.15, sfxBus, { freq: 110, slideTo: 55 });
    },
    // 게임 시작
    fanfareStart() {
      if (!ready()) return; const t = ctx.currentTime + 0.05;
      tom(t, 180, 0.3); tom(t + 0.15, 140, 0.3); tom(t + 0.3, 110, 0.35);
      [62, 69, 74].forEach((m, i) => osc(m, t + 0.45 + i * 0.12, 0.2, 'sawtooth', 0.08, sfxBus, { lp: 2500 }));
      [62, 69, 74, 77].forEach(m => osc(m, t + 0.85, 1.4, 'sawtooth', 0.05, sfxBus, { lp: 2500, attack: 0.03 }));
      kick(t + 0.85, 0.6); noise(t + 0.85, 1.4, 0.1, 6000, 0.4, sfxBus, 'highpass');
    },
    // 경기 종료: 드럼롤 + 승리 팡파르
    fanfareEnd() {
      if (!ready()) return; const t = ctx.currentTime + 0.05;
      for (let i = 0; i < 18; i++) snare(t + i * 0.045, 0.05 + i * 0.008);
      const s = t + 0.85;
      [74, 77, 81].forEach((m, i) => osc(m, s + i * 0.14, 0.16, 'sawtooth', 0.09, sfxBus, { lp: 3000 }));
      [74, 78, 81, 86].forEach(m => { osc(m, s + 0.45, 2.2, 'sawtooth', 0.05, sfxBus, { lp: 3000, attack: 0.02 }); osc(m - 12, s + 0.45, 2.2, 'triangle', 0.07, sfxBus); });
      kick(s + 0.45, 0.7); noise(s + 0.45, 2.0, 0.14, 6000, 0.4, sfxBus, 'highpass');
    }
  };
  // 어떤 클릭·터치·키 입력이든 들어오면 소리 잠금 해제 (휴대폰은 touchend/click이 필요)
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (!ready()) api.unlock(); }, true));
  window.SagiSound = api;
})();
