// 사기경마 반별 대결 — 문제(정답 순위·단서·레이스) 생성 로직
// 교사용 화면(host.html)에서만 사용합니다. 학생 화면에는 정답이 내려가지 않아요.
(function (root) {
  const N = 8, ROUNDS = 12, GOAL = 20;
  const R = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  // 8! = 40320가지 순위. PERMS[i][h] = h번 말의 등수(1~8)
  const PERMS = [], FIRST = [], SECOND = [];
  (function () {
    const a = [0, 1, 2, 3, 4, 5, 6, 7];
    const rec = k => {
      if (k === N) { const p = new Int8Array(N); for (let r = 0; r < N; r++) p[a[r]] = r + 1; PERMS.push(p); FIRST.push(a[0]); SECOND.push(a[1]); return; }
      for (let i = k; i < N; i++) { [a[k], a[i]] = [a[i], a[k]]; rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
    }; rec(0);
  })();
  const NP = PERMS.length;

  const TYPES = [['beat', 3], ['imm', 2], ['top', 2], ['notwin', 1], ['nottop2', 1], ['bottom', 1], ['twobeat', 2], ['parity', 1], ['sum', 1], ['between', 2]];
  const TW = TYPES.reduce((s, t) => s + t[1], 0);
  function pickType() { let x = Math.random() * TW; for (const [t, w] of TYPES) { if ((x -= w) < 0) return t; } return 'beat'; }

  function evalC(c, p) {
    switch (c.t) {
      case 'beat': return p[c.a] < p[c.b];
      case 'imm': return p[c.b] === p[c.a] + 1;
      case 'top': return p[c.a] <= c.k;
      case 'notwin': return p[c.a] !== 1;
      case 'nottop2': return p[c.a] > 2;
      case 'bottom': return p[c.a] >= 5;
      case 'twobeat': return p[c.a] < p[c.c] && p[c.b] < p[c.c];
      case 'parity': return p[c.a] % 2 === c.k;
      case 'sum': return p[c.a] + p[c.b] === c.k;
      case 'between': return p[c.a] > p[c.b] && p[c.a] < p[c.c];
    }
  }
  function textC(c) {
    const A = c.a + 1, B = c.b + 1, C = c.c + 1;
    switch (c.t) {
      case 'beat': return `${A}번 말은 ${B}번 말보다 먼저 들어온다.`;
      case 'imm': return `${A}번 말은 ${B}번 말 바로 앞에 들어온다.`;
      case 'top': return `${A}번 말은 ${c.k}등 안에 든다.`;
      case 'notwin': return `${A}번 말은 우승하지 못한다.`;
      case 'nottop2': return `${A}번 말은 1등도 2등도 아니다.`;
      case 'bottom': return `${A}번 말은 5등 이하로 들어온다.`;
      case 'twobeat': return `${A}번 말과 ${B}번 말은 모두 ${C}번 말보다 빠르다.`;
      case 'parity': return `${A}번 말의 등수는 ${c.k ? '홀수' : '짝수'}다.`;
      case 'sum': return `${A}번 말과 ${B}번 말의 등수를 더하면 ${c.k}이다.`;
      case 'between': return `${A}번 말은 ${B}번 말보다 늦고 ${C}번 말보다 빠르다.`;
    }
  }
  function genClue(truth, honest) {
    for (let i = 0; i < 300; i++) {
      const t = pickType(), [a, b, c] = shuffle(range(0, 7));
      const cl = { t, a, b, c };
      if (t === 'top') cl.k = 3 + R(2);
      if (t === 'parity') cl.k = R(2);
      if (t === 'sum') { const s = truth[a] + truth[b]; cl.k = honest ? s : s + (R(2) ? 1 : -1) * (1 + R(2)); if (cl.k < 3 || cl.k > 15) continue; }
      if (evalC(cl, truth) === honest) return cl;
    }
    return null;
  }
  // 단서가 각 순위에서 거짓인지(1) 참인지(0)
  function falseVec(c) { const v = new Uint8Array(NP); for (let i = 0; i < NP; i++) v[i] = evalC(c, PERMS[i]) ? 0 : 1; return v; }
  function truthKey(truth) { let f, s; for (let h = 0; h < N; h++) { if (truth[h] === 1) f = h; if (truth[h] === 2) s = h; } return f * 8 + s; }

  // 공개 순서대로 k개를 봤을 때, "전체 C개 중 거짓은 정확히 L개"를 아는 학생이
  // 아직 가능하다고 볼 수 있는 (1등,2등) 조합의 수. profile[k-1] = k개 공개 후 조합 수
  function profile(vecs, L) {
    const C = vecs.length, sets = Array.from({ length: C }, () => new Set());
    for (let i = 0; i < NP; i++) {
      let f = 0; const key = FIRST[i] * 8 + SECOND[i];
      for (let k = 0; k < C; k++) {
        f += vecs[k][i];
        if (f > L) break;
        if (f >= L - (C - k - 1)) sets[k].add(key);
      }
    }
    return sets.map(s => s.size);
  }

  // 한 반의 단서 세트 만들기. lieSlots: 공개 순서에서 거짓 단서가 들어갈 자리(모든 반 공통)
  function makeClassSet(truth, C, L, lieSlots, band, deadline) {
    const tk = truthKey(truth);
    while (Date.now() < deadline) {
      const lies = [], used = new Set();
      while (lies.length < L) { const c = genClue(truth, false); if (c && !used.has(textC(c))) { used.add(textC(c)); lies.push(c); } }
      const fc = new Uint8Array(NP); const vecs = new Map();
      for (const c of lies) { const v = falseVec(c); vecs.set(c, v); for (let i = 0; i < NP; i++) fc[i] += v[i]; }
      let alive = []; for (let i = 0; i < NP; i++) if (fc[i] <= L) alive.push(i);
      const trues = []; let fail = false;
      for (let step = 0; step < C - L; step++) {
        const last = step === C - L - 1;
        let best = null;
        for (let s = 0; s < 30; s++) {
          const c = genClue(truth, true); if (!c || used.has(textC(c))) continue;
          const v = falseVec(c);
          const pairs = new Set(), exact = new Set(); const na = [];
          for (const i of alive) { const f = fc[i] + v[i]; if (f <= L) { na.push(i); pairs.add(FIRST[i] * 8 + SECOND[i]); if (f === L) exact.add(FIRST[i] * 8 + SECOND[i]); } }
          const score = last ? exact.size : pairs.size;
          if (last && score !== 1) continue;
          if (!last && step < C - L - 2 && pairs.size <= 2) continue; // 너무 일찍 풀리지 않게
          if (!best || score < best.score || (score === best.score && Math.random() < .5)) best = { c, v, na, score };
        }
        if (!best) { fail = true; break; }
        trues.push(best.c); used.add(textC(best.c)); vecs.set(best.c, best.v);
        for (let i = 0; i < NP; i++) fc[i] += best.v[i];
        alive = best.na;
      }
      if (fail) continue;
      // 정답 조합이 유일한지 최종 확인
      const finalPairs = new Set(); for (let i = 0; i < NP; i++) if (fc[i] === L) finalPairs.add(FIRST[i] * 8 + SECOND[i]);
      if (finalPairs.size !== 1 || !finalPairs.has(tk)) continue;
      // 공개 순서 정하기: 거짓은 공통 자리에, 참은 섞어서. 난이도 곡선이 기준 범위에 들어오는 순서를 찾음
      for (let o = 0; o < 60; o++) {
        const ts = shuffle(trues), ls = shuffle(lies), order = [];
        let ti = 0, li = 0;
        for (let k = 0; k < C; k++) order.push(lieSlots.includes(k) ? ls[li++] : ts[ti++]);
        const pf = profile(order.map(c => vecs.get(c)), L);
        if (band(pf)) return { clues: order.map(c => ({ text: textC(c), lie: !evalC(c, truth) })), profile: pf };
      }
    }
    return null;
  }

  function distribute(T, winner) {
    const style = Math.random() * 1.8 - 0.9;
    const w = range(0, ROUNDS - 1).map(t => Math.max(.12, 1 + style * (t - 5.5) / 5.5));
    const m = new Array(ROUNDS).fill(0); let left = T;
    while (left > 0) {
      const ok = range(0, ROUNDS - 1).filter(t => m[t] < 3);
      let tot = ok.reduce((s, t) => s + w[t], 0), x = Math.random() * tot;
      for (const t of ok) { if ((x -= w[t]) < 0) { m[t]++; break; } }
      left--;
    }
    if (winner && m[ROUNDS - 1] === 0) { const src = range(0, ROUNDS - 2).filter(t => m[t] > 0); m[src[R(src.length)]]--; m[ROUNDS - 1]++; }
    return m;
  }
  function generateRace(truth) {
    const vals = shuffle(range(9, 19)).slice(0, 7).sort((a, b) => b - a);
    return range(0, 7).map(h => { const r = truth[h]; return distribute(r === 1 ? GOAL : vals[r - 2], r === 1); });
  }

  // 전체 문제 만들기. 모든 반이 같은 경주(같은 정답), 반마다 다른 단서, 같은 난이도 기준
  function generatePuzzle(nClasses, C, L, onProgress) {
    const t0 = Date.now();
    const half = Math.ceil(C / 2);
    // 난이도 기준(모든 반 공통): 남은 (1등,2등) 조합 수가 마지막 3개 단서 구간에서 같은 범위에 들도록
    const band = pf => pf[C - 1] === 1 && pf[C - 2] >= 2 && pf[C - 2] <= 5 && pf[C - 3] >= 5 && pf[C - 3] <= 16 && pf[C - 4] >= 10 && pf[half - 1] >= 20;
    for (let attempt = 0; attempt < 20; attempt++) {
      const order = shuffle(range(0, 7)); const truth = new Int8Array(N); order.forEach((h, r) => truth[h] = r + 1);
      const lieSlots = shuffle(range(0, C - 2)).slice(0, L).sort((a, b) => a - b);
      const sets = [];
      for (let c = 0; c < nClasses; c++) {
        onProgress && onProgress(`${c + 1}/${nClasses}반 단서 만드는 중…`);
        const s = makeClassSet(truth, C, L, lieSlots, band, Date.now() + 8000);
        if (!s) break;
        sets.push(s);
      }
      if (sets.length === nClasses) {
        return { truth: Array.from(truth), order: order, lieSlots, classSets: sets, moves: generateRace(truth), ms: Date.now() - t0 };
      }
    }
    return null;
  }

  const api = { N, ROUNDS, GOAL, PERMS, generatePuzzle, profile, textC, evalC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SagiLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
