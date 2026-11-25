// 사기경마 배경음악·효과음 (Web Audio로 직접 연주하는 자작곡 — 외부 음원 없음)
(function () {
  let ctx = null, master = null, on = true, vol = 0.8;
  let mode = null, step = 0, nextTime = 0;
  const BPM = { bet: 96, run: 152 };
  const SUB = { bet: 2, run: 4 }; // 박당 스텝 수 (bet: 8분음표, run: 16분음표)
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? vol : 0; master.connect(ctx.destination);
  }
  function ready() { return ctx && ctx.state === 'running'; }

  function tone(midi, t, dur, type, gain, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(mtof(midi), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  let noiseBuf = null;
  function noise(t, dur, gain, freq, q) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
  }

  // ── 베팅 시간: 차분하게 고민하는 분위기 (Am–F–C–G) ──
  const BET_CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]];
  const BET_ARP = [0, 1, 2, 3, 2, 1, 2, 1];
  function playBet(s, t, dt) {
    const bar = Math.floor(s / 8) % 4, k = s % 8, ch = BET_CHORDS[bar];
    tone(ch[BET_ARP[k]], t, dt * 1.8, 'triangle', 0.14);
    if (k === 0 || k === 4) tone(ch[0] - 24, t, dt * 3.5, 'triangle', 0.26);
    if (k % 2 === 1) noise(t, 0.04, 0.05, 8000, 0.8);
    if (k === 0 && bar % 2 === 0) tone(ch[3] + 12, t, 0.9, 'sine', 0.07);
  }

  // ── 경주: 신나게 달리는 분위기 (C–F–G–C, 말발굽 리듬) ──
  const RUN_ROOT = [36, 41, 43, 36];
  const RUN_LEAD = {
    0: 72, 2: 76, 4: 79, 6: 76, 8: 72, 10: 76, 12: 79, 14: 84,
    16: 77, 18: 81, 20: 84, 22: 81, 24: 77, 26: 79, 28: 81, 30: 84,
    32: 83, 34: 79, 36: 74, 38: 79, 40: 83, 42: 86, 44: 83, 46: 79,
    48: 84, 52: 79, 56: 76, 58: 79, 60: 84
  };
  function playRun(s, t, dt) {
    const i = s % 64, bar = Math.floor(i / 16), k = i % 16, root = RUN_ROOT[bar];
    if (k % 4 === 0) kick(t);
    const b = k % 4; // 다그닥(0,1,2) 쉼(3)
    if (b < 3) noise(t, 0.045, b === 2 ? 0.09 : 0.06, b === 2 ? 600 : 1400, 1.2);
    if (k % 2 === 0) tone(root + ((k / 2) % 2 ? 7 : 0), t, dt * 1.6, 'square', 0.05);
    if (RUN_LEAD[i]) tone(RUN_LEAD[i], t, dt * 1.7, 'square', 0.045);
    if (RUN_LEAD[i]) tone(RUN_LEAD[i] - 12, t, dt * 1.7, 'triangle', 0.04);
  }

  setInterval(() => {
    if (!ready() || !mode) return;
    const dt = 60 / BPM[mode] / SUB[mode];
    if (nextTime < ctx.currentTime - 0.2) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.15) {
      (mode === 'bet' ? playBet : playRun)(step, nextTime, dt);
      nextTime += dt; step++;
    }
  }, 25);

  const api = {
    unlock() { init(); if (ctx && ctx.state !== 'running') ctx.resume().then(() => { nextTime = ctx.currentTime + 0.05; }); },
    isReady: ready,
    setLoop(m) { if (m === mode) return; mode = m; step = 0; if (ctx) nextTime = ctx.currentTime + 0.08; },
    setOn(v) { on = v; if (master) master.gain.setTargetAtTime(on ? vol : 0, ctx.currentTime, 0.05); },
    isOn: () => on,
    setVolume(v) { vol = v; if (master && on) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.05); },
    // 새 단서 공개 딩동
    chime() { if (!ready()) return; const t = ctx.currentTime + 0.05; tone(88, t, 0.5, 'sine', 0.18); tone(93, t + 0.14, 0.8, 'sine', 0.18); tone(100, t + 0.28, 0.9, 'sine', 0.1); },
    // 마감 카운트다운
    tick(n) { if (!ready()) return; const t = ctx.currentTime + 0.01; tone(n <= 1 ? 96 : 91, t, 0.09, 'sine', 0.2); },
    // 게임 시작 팡파르
    fanfareStart() {
      if (!ready()) return; const t = ctx.currentTime + 0.05;
      [67, 72, 76].forEach((m, i) => tone(m, t + i * 0.12, 0.14, 'square', 0.08));
      [72, 76, 79, 84].forEach(m => tone(m, t + 0.38, 0.9, 'square', 0.05));
      kick(t + 0.38);
    },
    // 경기 종료 팡파르
    fanfareEnd() {
      if (!ready()) return; const t = ctx.currentTime + 0.05;
      for (let i = 0; i < 14; i++) noise(t + i * 0.05, 0.05, 0.03 + i * 0.004, 300, 0.8);
      const s = t + 0.75;
      [72, 76, 79].forEach((m, i) => tone(m, s + i * 0.13, 0.15, 'square', 0.08));
      [72, 76, 79, 84].forEach(m => { tone(m, s + 0.42, 1.8, 'square', 0.045); tone(m - 12, s + 0.42, 1.8, 'triangle', 0.05); });
      kick(s + 0.42); noise(s + 0.42, 1.2, 0.08, 5000, 0.5);
    }
  };
  window.SagiSound = api;
})();
