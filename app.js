'use strict';
// 座位：0=你（下方，東位）、1=下家（右）、2=對家（上）、3=上家（左）；出牌順序為逆時針 0→1→2→3
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SEAT = ['你', '下家', '對家', '上家'];
const G = {};
const say = m => { $('status').textContent = m; };
const ai = s => s !== 0 || !!G.auto; // 該座位是否由電腦操作（G.auto 僅供自動模擬測試用）

// ===== 存檔與戰績（M8）：使用瀏覽器 localStorage =====
const SAVE = 'mj_save', STATS = 'mj_stats';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 空間不足或被禁用：略過 */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* 略過 */ } }
};
// ===== 難度：普通／困難（困難＝電腦選牌看有效牌張數、會防守、吃碰會看台數；只用公開資訊，不偷看手牌與牌牆） =====
const LEVEL = 'mj_level', LV = { normal: '普通', hard: '困難' };
let level = store.get(LEVEL) === 'hard' ? 'hard' : 'normal';
const hardAI = s => !!(G.hard && G.hard[s]);
const hardSeats = lv => G.hardSeats || [false, lv === 'hard', lv === 'hard', lv === 'hard']; // G.hardSeats 僅供測試強弱用
function setLevel(lv) {
  level = lv; store.set(LEVEL, lv);
  $('lvNormal').className = 'lv' + (lv === 'normal' ? ' on' : '');
  $('lvHard').className = 'lv' + (lv === 'hard' ? ' on' : '');
}
const SAVED = ['dealer', 'wall', 'hands', 'melds', 'flowers', 'river', 'pass', 'called', 'discards', 'draws', 'level'];
// 每個回合開始時自動存檔（cur＝輪到誰、mode＝該回合的進行方式）
function saveGame(cur, mode) {
  const g = {}; SAVED.forEach(k => { g[k] = G[k]; });
  store.set(SAVE, { v: 1, cur, mode, g });
}

// ===== 音效（M6）：以 Web Audio 即時合成，不需要音檔；可在右上角開關 =====
const snd = { on: store.get('mj_sound') !== false, ac: null };
function audio() {
  if (!snd.on || G.auto) return null;
  try {
    if (!snd.ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; snd.ac = new C(); }
    if (snd.ac.state === 'suspended') snd.ac.resume();
    return snd.ac;
  } catch (e) { return null; }
}
function tone(a, f, t, d, type = 'sine', v = .15, f2) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .02);
}
function noise(a, t, d, v = .2, f = 2000, q = 1) {
  const n = Math.max(1, a.sampleRate * d | 0), buf = a.createBuffer(1, n, a.sampleRate), x = buf.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  src.connect(fl); fl.connect(g); g.connect(a.destination); src.start(t);
}
const SFX = {
  dice: (a, t) => { for (let i = 0; i < 9; i++) noise(a, t + i * .1, .06, .25, 2500 + Math.random() * 2500, 2); },
  shuffle: (a, t) => { for (let i = 0; i < 6; i++) noise(a, t + i * .17, .22, .18, 900 + i * 150, .8); },
  build: (a, t) => { for (let i = 0; i < 10; i++) noise(a, t + i * .1, .04, .2, 3500, 3); },
  deal: (a, t) => { noise(a, t, .04, .25, 3000, 3); tone(a, 520, t, .05, 'square', .04); },
  flower: (a, t) => tone(a, 880, t, .35, 'sine', .12, 1320),
  discard: (a, t) => { noise(a, t, .05, .35, 1800, 2); tone(a, 200, t, .07, 'triangle', .15); },
  call: (a, t) => { tone(a, 660, t, .15, 'triangle', .15); tone(a, 880, t + .1, .25, 'triangle', .15); },
  win: (a, t) => { [523, 659, 784, 1047].forEach((f, i) => tone(a, f, t + i * .11, .4, 'triangle', .15)); },
  draw: (a, t) => tone(a, 262, t, .5, 'sine', .15, 131)
};
function sfx(n) { const a = audio(); if (a && SFX[n]) SFX[n](a, a.currentTime); }

// ===== 浮水印：吃／碰／槓／胡時，在電腦家面板上顯示 1 秒（只出現一次） =====
function mark(s, text) {
  sfx(text === '胡' || text === '自摸' ? 'win' : 'call');
  if (s === 0) return;
  const m = { text }; G.mark[s] = m; render();
  setTimeout(() => { if (G.mark[s] === m) { G.mark[s] = null; render(); } }, 1000);
}

// ===== 顯示 =====
function tileHTML(t, i, cls = '') {
  return `<span class="t ${cls}"${i == null ? '' : ` data-i="${i}" tabindex="0"`}><img src="img/t${t}.webp" alt="${name(t)}" draggable="false"></span>`;
}
const small = arr => arr.map(t => tileHTML(t, null, 'sm')).join('');
const BACK = '<span class="t back sm"></span>';
const meldTiles = m => m.tiles || (m.k === 'g' ? [m.t, m.t, m.t, m.t] : m.k === 'p' ? [m.t, m.t, m.t] : [m.t, m.t + 1, m.t + 2]);
// 暗槓：電腦家四張全部蓋放（規格書：暗槓蓋放）；玩家自己的暗槓兩端蓋牌、中間兩張亮出（看得出是哪張，也和明槓分得開）；其餘面子一律亮出
const meldHTML = (m, hide, own) =>
  `<span class="meld">${m.k === 'g' && !m.open ?
    (hide ? BACK.repeat(4) : own ? BACK + small([m.t, m.t]) + BACK : small(meldTiles(m))) : small(meldTiles(m))}</span>`;
// 浮水印：每次 render 都會重建 DOM，所以只有第一次要播進場動畫，之後加上 still 不再重播
function markHTML(m) {
  const cls = m.shown ? 'mark still' : 'mark'; m.shown = true;
  return `<div class="${cls}">${m.text}</div>`;
}

// 玩家摸牌動畫（只畫牌移動到牌組中）：新牌從牌牆文字處飛到它在手牌中排序後的位置
async function flyDraw(i) {
  if (G.auto) return;

  const dst = $('seat0').querySelector(`.t.mine[data-i="${i}"]`), src = $('wall');
  if (!dst || !src || !dst.animate) return;

  const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
  const fly = dst.cloneNode(true);
  fly.removeAttribute('data-i'); fly.removeAttribute('tabindex'); fly.classList.remove('mine');
  Object.assign(fly.style, { position: 'fixed', left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', margin: 0, zIndex: 20, pointerEvents: 'none' });
  document.body.appendChild(fly);
  dst.style.visibility = 'hidden';
  sfx('deal');

  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
  try {
    await fly.animate(
      [{ transform: `translate(${dx}px,${dy}px) scale(.6)`, opacity: .3 }, { transform: 'none', opacity: 1 }],
      { duration: 380, easing: 'ease-out' }).finished;
  } catch (e) { /* 動畫被中斷：略過 */ }
  fly.remove(); dst.style.visibility = '';
}

function render() {
  for (let s = 0; s < 4; s++) {
    const h = G.hands[s];
    const order = h.map((_, i) => i).sort((a, b) => h[a] - h[b]);
    const hand = s === 0
      ? order.map(i => tileHTML(h[i], i, 'mine')).join('')
      : h.map(() => BACK).join('');
    const melds = G.melds[s].map(m => meldHTML(m, s !== 0, s === 0)).join('');
    $('seat' + s).className = 'seat ' + (s ? 'ai' : 'me') + (G.dealerShown && s === G.dealer ? ' dealer' : '');
    $('seat' + s).innerHTML =
      `<div class="info">${SEAT[s]}${G.dealerShown ? `・${WIND[(s - G.dealer + 4) % 4]}風` : ''}${G.dealerShown && s === G.dealer ? '<span class="badge">莊</span>' : ''}${G.turn === s ? ' ◀' : ''}${G.tag && G.tag.s === s ? '<span class="tag">放槍！</span>' : ''}</div>` +
      `<div class="hand ${s ? 'ai' : 'me'}">${hand}</div><div class="side">${melds}${small(G.flowers[s])}</div>` +
      (G.mark[s] ? markHTML(G.mark[s]) : '');
    $('river' + s).innerHTML = small(G.river[s]);
  }
  $('wall').textContent = `牌牆剩 ${G.wall.length} 張・圈風：東${G.level ? `・難度：${LV[G.level]}` : ''}`;
}

// ===== 玩家輸入 =====
const pickTile = () => new Promise(r => { G.pick = r; });
$('seat0').addEventListener('click', e => {
  const t = e.target.closest('.t.mine');
  if (t && G.pick) { const f = G.pick; G.pick = null; f(+t.dataset.i); }
});
const ask = (opts, msg) => new Promise(res => {
  say(msg);
  const a = $('actions'); a.innerHTML = '';
  opts.forEach(([label, v]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { a.innerHTML = ''; res(v); };
    a.append(b);
  });
});

// ===== 牌牆操作（頭指標＝牌牆開頭 shift；尾指標＝牌牆尾端 pop） =====
// 補花：花牌亮出，從牌尾補牌，直到手中無花；同時偵測八仙過海、七搶一（結果記在 G.flowerWin）
function flowerStep(s) { // 補一張花；有補回 true，無花或已有人胡花牌回 false
  const h = G.hands[s], f = h.findIndex(isFlower);
  if (f < 0) return false;
  G.flowers[s].push(h.splice(f, 1)[0]);
  if (G.flowers[s].length === 8) { G.flowerWin = { s, kind: '八仙過海' }; return false; }
  if (G.flowers.reduce((a, x) => a + x.length, 0) === 8) { // 第 8 張花由 s 補到：若別家已有 7 張，該家搶胡
    const o = G.flowers.findIndex((x, i) => i !== s && x.length === 7);
    if (o >= 0) { G.flowerWin = { s: o, from: s, kind: '七搶一' }; return false; }
  }
  h.push(G.wall.pop());
  return true;
}
function fixFlowers(s) { while (!G.flowerWin && flowerStep(s)); }
function draw(s) { G.hands[s].push(G.wall.shift()); fixFlowers(s); }
function drawTail(s) { G.hands[s].push(G.wall.pop()); fixFlowers(s); } // 槓後補牌
// 不變量（規格書第 14 節）：牌牆＋手牌＋副露＋牌河＋花牌＝144 張
const total = () => G.wall.length +
  [0, 1, 2, 3].reduce((a, s) => a + G.hands[s].length + G.flowers[s].length + G.river[s].length +
    G.melds[s].reduce((b, m) => b + meldTiles(m).length, 0), 0);

// ===== 電腦玩家（第二版：以向聽數決策；吃碰槓決策見 react） =====
function aiDiscardNormal(s) {
  const h = G.hands[s], nm = G.melds[s].length, c = counts(h);
  let best = 0, bs = 1e9;
  const score = {}; // 每種牌的「打出代價」：越小越該打
  h.forEach((t, i) => {
    if (score[t] === undefined) {
      c[t]--; const sh = shanten(c, nm); c[t]++;
      // 主要依據：打出後的向聽數；次要：保留對子、刻子與鄰近搭子
      let keep = c[t] * 3;
      if (t < 27) [-2, -1, 1, 2].forEach(d => {
        const n = t % 9 + d;
        if (n >= 0 && n < 9 && c[t + d]) keep += Math.abs(d) === 1 ? 2 : 1;
      });
      score[t] = sh * 100 + keep + Math.random();
    }
    if (score[t] < bs) { bs = score[t]; best = i; }
  });
  return best;
}
// 困難：場上看得見的牌（給電腦 s 看）＝所有牌河、別家明的副露、自己的副露與手牌；別家的暗槓看不到
function seenCounts(s) {
  const c = Array(34).fill(0);
  for (let o = 0; o < 4; o++) {
    G.river[o].forEach(t => c[t]++);
    G.melds[o].forEach(m => { if (o === s || m.open) meldTiles(m).forEach(t => c[t]++); });
  }
  G.hands[s].forEach(t => c[t]++);
  return c;
}
// 對手 o 離胡牌多近的粗略估計（0~1）：副露越多、牌牆越少越危險（只看得到公開資訊）
function threat(o) {
  const late = 1 - Math.min(1, Math.max(0, G.wall.length - 16) / 60);
  const m = G.melds[o].length;
  return Math.min(1, [.06, .14, .35, .7, .95, 1][m] + .25 * late * (m ? 1 : .5));
}
const tileBase = t => t >= 27 ? .55 : [.5, .75, .9, 1, 1, 1, .9, .75, .5][t % 9];
// 打出 t 放槍的危險度：場上已見越多越安全；對手打過的牌、筋牌（差 3）較安全；對手副露集中一種花色時，該花色與字牌較危險
function danger(s, t, seen) {
  const v = seen[t] >= 3 ? .1 : seen[t] === 2 ? .55 : seen[t] === 1 ? .85 : 1;
  let dg = 0;
  for (let o = 0; o < 4; o++) {
    if (o === s) continue;
    let f = threat(o) * tileBase(t) * v;
    if (G.river[o].includes(t)) f *= .12;
    else if (t < 27 && G.river[o].some(r => r < 27 && suit(r) === suit(t) && Math.abs(r - t) === 3)) f *= .55;
    const ms = G.melds[o];
    if (ms.length >= 2) {
      const nums = [...new Set(ms.map(m => suit(m.t)))].filter(x => x < 3);
      if (nums.length === 1) f *= t >= 27 ? 1.1 : suit(t) === nums[0] ? 1.8 : .6;
    }
    dg += f;
  }
  return dg;
}
// 困難的打牌：向聽數最小的打法中選「有效牌張數」最多的，再扣掉放槍危險度；對手威脅大而自己離聽牌還遠時改打安全牌
function aiDiscardHard(s) {
  const h = G.hands[s], nm = G.melds[s].length, c = counts(h), seen = seenCounts(s);
  const cand = [], done = {};
  h.forEach((t, i) => {
    if (done[t]) return; done[t] = 1;
    c[t]--; cand.push({ t, i, sh: shanten(c, nm) }); c[t]++;
  });
  const minSh = Math.min(...cand.map(x => x.sh));
  const maxT = Math.max(...[0, 1, 2, 3].filter(o => o !== s).map(threat));
  const late = G.wall.length - 16 < 12;
  const fold = maxT >= .45 && minSh >= 2;
  const W = (maxT >= .45 ? (minSh >= 2 ? 45 : minSh === 1 ? 14 : 4) : 3) * (late ? 1.4 : 1); // 防守權重
  const shPen = fold ? 35 : 100; // 每多一個向聽數的懲罰（全面防守時放寬）
  const per = [0, 0, 0, 0]; // 花色集中度（混一色、清一色）
  h.forEach(t => per[suit(t)]++);
  G.melds[s].forEach(m => { per[suit(m.t)] += meldTiles(m).length >= 4 ? 3 : meldTiles(m).length; });
  let main = 0; for (let k = 1; k < 3; k++) if (per[k] > per[main]) main = k;
  const flush = per[main] + per[3] >= 12, wind = 27 + (s - G.dealer + 4) % 4;
  let best = cand[0], bs = -1e9;
  cand.forEach(x => {
    let uk = 0;
    if (x.sh === minSh) { // 有效牌張數：摸到後向聽數會變小的牌，扣掉場上已見的
      c[x.t]--;
      for (let u = 0; u < 34; u++) {
        const live = 4 - seen[u];
        if (live <= 0) continue;
        if (!(c[u] || (u < 27 && [-2, -1, 1, 2].some(d => { const n = u % 9 + d; return n >= 0 && n < 9 && c[u + d]; })))) continue;
        c[u]++; if (shanten(c, nm) < x.sh) uk += live; c[u]--;
      }
      c[x.t]++;
    }
    let sc = -(x.sh - minSh) * shPen + uk - W * danger(s, x.t, seen) + Math.random() * .5;
    if (x.t >= 27 && c[x.t] >= 2 && (x.t >= 31 || x.t === 27 || x.t === wind)) sc -= 8; // 有台的風牌、箭牌對子要留
    else if (x.t >= 27 && c[x.t] === 1) sc += 2; // 孤張字牌先打
    if (flush && x.t < 27) sc += suit(x.t) === main ? -6 : 6;
    if (sc > bs) { bs = sc; best = x; }
  });
  return best.i;
}
function aiDiscard(s) { return hardAI(s) ? aiDiscardHard(s) : aiDiscardNormal(s); }
// 電腦要不要碰／槓（0 不要、1 碰、2 槓）。困難：箭牌、場風、本風的刻子有台，優先；平凡的牌在還是門清時不隨便開門
function aiPong(s, d, kong) {
  if (!hardAI(s)) {
    if (kong) return 2; // 第一版：能槓則槓
    const dl = meldDelta(s, [d, d]); return Math.random() < (dl < 0 ? .8 : dl === 0 ? .35 : 0) ? 1 : 0;
  }
  const open = G.melds[s].length > 0;
  const worth = d >= 31 || d === 27 || d === 27 + (s - G.dealer + 4) % 4;
  if (kong && (worth || open)) return 2;
  const dl = meldDelta(s, [d, d]);
  if (worth) return dl <= 0 ? 1 : 0;
  const sh0 = shanten(counts(G.hands[s]), G.melds[s].length);
  if (dl < 0 && (open || sh0 >= 2)) return Math.random() < .75 ? 1 : 0;
  if (dl === 0 && open) return Math.random() < .3 ? 1 : 0;
  return 0;
}
// 電腦要不要吃：回傳要吃的兩張，不吃回傳 null。困難：還是門清且離聽牌近時不吃（保留門清、自摸台）
function aiChi(s, c) {
  let bd = 99, bp = null;
  c.forEach(x => { const dl = meldDelta(s, x); if (dl < bd) { bd = dl; bp = x; } });
  if (!hardAI(s)) return Math.random() < (bd < 0 ? .6 : bd === 0 ? .25 : 0) ? bp : null;
  const open = G.melds[s].length > 0, sh0 = shanten(counts(G.hands[s]), G.melds[s].length);
  return bd < 0 && (open || sh0 >= 2) && Math.random() < .6 ? bp : null;
}
// 吃／碰後（拿走 removed 兩張、打出最佳一張）的向聽數相對於目前向聽數的變化量；<0 進步、0 持平、>0 退步
function meldDelta(s, removed) {
  const h = G.hands[s], nm = G.melds[s].length;
  const before = shanten(counts(h), nm), c = counts(h);
  removed.forEach(t => c[t]--);
  let after = 99;
  for (let t = 0; t < 34; t++) if (c[t]) { c[t]--; after = Math.min(after, shanten(c, nm + 1)); c[t]++; }
  return after - before;
}

// ===== 吃、碰、槓、胡的反應（優先順序：胡 > 碰/槓 > 吃；吃只能吃上家） =====
function chis(h, d) {
  if (d >= 27) return [];
  const n = d % 9, r = [];
  [[-2, -1], [-1, 1], [1, 2]].forEach(([a, b]) => {
    if (n + a >= 0 && n + b <= 8 && h.includes(d + a) && h.includes(d + b)) r.push([d + a, d + b]);
  });
  return r;
}
// 問其他三家能否胡 d（打出的牌或加槓的牌）；玩家選「不胡」→ 進入過水
async function winners(cur, d, msg) {
  const hu = [];
  for (let k = 1; k < 4; k++) {
    const s = (cur + k) % 4;
    if (!canWin(G.hands[s].concat(d), G.melds[s])) continue;
    if (ai(s)) { hu.push(s); continue; } // 電腦：能胡必胡
    if (G.pass) continue; // 過水：自己打出下一張牌前不能胡別人的牌
    if (await ask([['胡', 1], ['過', 0]], msg)) hu.push(s); else G.pass = true;
  }
  return hu;
}
async function react(cur, d) {
  const hu = await winners(cur, d, `可以胡 ${name(d)}！`);
  if (hu.length) return { hu };
  // 碰／明槓（任何人打的牌都可以）
  for (let k = 1; k < 4; k++) {
    const s = (cur + k) % 4, h = G.hands[s], n = h.filter(t => t === d).length;
    if (n < 2) continue;
    const kong = n >= 3 && G.wall.length > 16; // 牌牆剩 16 張以下不能再槓（需從牌尾補牌）
    let act = 0; // 0 不要、1 碰、2 槓
    if (ai(s)) {
      act = aiPong(s, d, kong);
    } else {
      act = await ask((kong ? [['槓', 2]] : []).concat([['碰', 1], ['過', 0]]),
        kong ? `要槓或碰 ${name(d)} 嗎？` : `要碰 ${name(d)} 嗎？`);
    }
    if (act) {
      for (let i = 0; i < (act === 2 ? 3 : 2); i++) h.splice(h.indexOf(d), 1);
      G.melds[s].push({ k: act === 2 ? 'g' : 'p', t: d, open: true }); G.river[cur].pop();
      mark(s, act === 2 ? '槓' : '碰'); G.called = true;
      return { s, kong: act === 2 };
    }
  }
  // 吃（只能吃上家）
  const s = (cur + 1) % 4, h = G.hands[s], c = chis(h, d);
  if (c.length) {
    let pick = null;
    if (ai(s)) {
      pick = aiChi(s, c);
    } else {
      pick = await ask(c.map(x => [`吃 ${name(x[0])}${name(x[1])}`, x]).concat([['過', null]]), `要吃 ${name(d)} 嗎？`);
    }
    if (pick) {
      pick.forEach(t => h.splice(h.indexOf(t), 1));
      G.melds[s].push({ k: 'c', t: Math.min(d, ...pick), open: true, tiles: [pick[0], d, pick[1]] }); G.river[cur].pop();
      mark(s, '吃'); G.called = true;
      return { s };
    }
  }
  return {};
}

// ===== 自己回合的選擇：自摸、暗槓、加槓 =====
async function selfAction(cur, afterKong) {
  const h = G.hands[cur], ms = G.melds[cur], c = counts(h), hu = canWin(h, ms), ks = [];
  if (G.wall.length > 16) {
    for (let t = 0; t < 34; t++) if (c[t] === 4) ks.push({ t, type: 'an' });
    ms.forEach(m => { if (m.k === 'p' && c[m.t]) ks.push({ t: m.t, type: 'add' }); });
  }
  if (!hu && !ks.length) return null;
  if (ai(cur)) return hu ? 'win' : ks[0]; // 能胡必胡；能槓則槓
  const opts = [];
  if (hu) opts.push([afterKong ? '槓上自摸胡牌' : '自摸胡牌', 'win']);
  ks.forEach(k => opts.push([`${k.type === 'an' ? '暗槓' : '加槓'} ${name(k.t)}`, k]));
  opts.push(['過', null]);
  return ask(opts, hu ? '你自摸了！' : '要槓嗎？');
}
// 執行暗槓／加槓；加槓時若有人可搶槓，回傳搶槓者（槓不成立），否則回傳 null
async function doKong(cur, k) {
  const h = G.hands[cur], ms = G.melds[cur];
  if (k.type === 'an') { // 暗槓不可搶
    for (let i = 0; i < 4; i++) h.splice(h.indexOf(k.t), 1);
    ms.push({ k: 'g', t: k.t, open: false });
    return null;
  }
  const rob = await winners(cur, k.t, `可以搶槓胡 ${name(k.t)}！`);
  if (rob.length) return rob;
  h.splice(h.indexOf(k.t), 1);
  ms.find(m => m.k === 'p' && m.t === k.t).k = 'g';
  return null;
}
async function shoot(cur, hu, d, rob) { // 放槍標記顯示 1 秒後消失，再顯示結算
  G.tag = { s: cur }; render(); say(`${SEAT[cur]}放槍！`);
  hu.forEach(w => mark(w, '胡'));
  await sleep(1000); G.tag = null;
  return finish(hu.map(s => ({ s, self: false, rob })), d, cur);
}

// ===== 主流程 =====
async function loop(cur = G.dealer, mode = 'first') {
  // mode — first：莊家起手；draw：從牌頭摸牌；meld：吃碰後直接打牌；kong：槓後從牌尾補牌
  for (; ;) {
    G.turn = cur;
    if (G.debug && total() !== 144) throw new Error('牌數不變量被破壞：' + total());
    saveGame(cur, mode);
    if (mode === 'draw') {
      if (G.wall.length <= 16) return finish([]);
      G.draws[cur]++; draw(cur);
    }
    else if (mode === 'kong') drawTail(cur);
    if (G.flowerWin) return finishFlower();
    render();
    if (!ai(cur) && (mode === 'draw' || mode === 'kong')) await flyDraw(G.hands[cur].length - 1);
    if (mode !== 'meld') {
      const act = await selfAction(cur, mode === 'kong');
      if (act === 'win') {
        mark(cur, '自摸'); // 浮水印只對電腦家顯示；音效對所有人
        if (cur !== 0 && !G.auto) await sleep(1000);
        return finish([{ s: cur, self: true, kong: mode === 'kong' }]);
      }
      if (act) {
        const rob = await doKong(cur, act);
        if (rob) return shoot(cur, rob, act.t, true);
        mark(cur, '槓'); G.called = true;
        mode = 'kong'; continue; // 補牌後可再自摸（槓上自摸）、再槓
      }
    }
    say(ai(cur) ? `${SEAT[cur]}思考中…` : '輪到你：點選一張牌打出');
    const i = ai(cur) ? (await sleep(700), aiDiscard(cur)) : await pickTile();
    const d = G.hands[cur].splice(i, 1)[0];
    G.river[cur].push(d); sfx('discard'); G.discards++;
    if (!ai(cur)) G.pass = false;
    render(); await sleep(350);
    const r = await react(cur, d);
    if (r.hu) return shoot(cur, r.hu, d, false);
    if (r.s !== undefined) { cur = r.s; mode = r.kong ? 'kong' : 'meld'; } else { cur = (cur + 1) % 4; mode = 'draw'; }
  }
}

// ===== 結算 =====
function finishFlower() {
  const f = G.flowerWin; sfx('win');
  return finish([{ s: f.s, self: f.from === undefined, flower: f.kind }], null, f.from);
}
// 天胡：莊家開局補花後手牌即成胡；地胡：閒家第一次摸牌即自摸；人胡：閒家第一圈內胡別人打的牌；皆須其間無人吃碰槓
function specialWin(w) {
  if (G.called) return null;
  if (w.self) {
    if (w.s === G.dealer && G.discards === 0) return '天胡';
    if (w.s !== G.dealer && G.draws[w.s] === 1) return '地胡';
  } else if (w.s !== G.dealer && G.discards <= 4) return '人胡';
  return null;
}
function finish(ws, d, from) {
  G.turn = -1; render(); $('actions').innerHTML = ''; store.del(SAVE);
  let out = '';
  const delta = [0, 0, 0, 0], sums = []; // 簡易結算：每台 1 分；自摸三家各付、放槍由放槍者付
  if (!ws.length) out = '<h2>流局</h2><p>牌牆剩 16 張，本局無人胡牌。</p>';
  ws.forEach(w => {
    let r, shown, names;
    if (w.flower) { // 八仙過海、七搶一：以 8 台計，不另計花牌台
      r = { sum: 8 }; shown = G.flowers[w.s].slice().sort((a, b) => a - b); names = `${w.flower} 8 台`;
    } else {
      const h = G.hands[w.s], tiles = w.self ? h : h.concat(d), win = w.self ? h[h.length - 1] : d;
      r = calcTai({
        tiles, melds: G.melds[w.s], flowers: G.flowers[w.s], seat: (w.s - G.dealer + 4) % 4,
        self: w.self, win, kong: !!w.kong, rob: !!w.rob, special: specialWin(w), last: w.self && !w.kong && G.wall.length === 16
      });
      shown = tiles.slice().sort((a, b) => a - b);
      names = r.list.map(e => `${e.n} ${e.t} 台`).join('、') || '無台';
    }
    sums.push(r.sum);
    if (w.self) { for (let q = 0; q < 4; q++) if (q !== w.s) delta[q] -= r.sum; delta[w.s] += 3 * r.sum; }
    else { delta[from] -= r.sum; delta[w.s] += r.sum; }
    const pay = w.self ? '其餘三家各付' : `${SEAT[from]}放槍，付`;
    const meldsHTML = w.flower ? '' : G.melds[w.s].map(m => meldHTML(m, false)).join('');
    out += `<h2>${SEAT[w.s]}${w.flower ? '・' + w.flower : w.self ? '自摸' : '胡牌'}</h2>` +
      `<div class="river">${small(shown)}${meldsHTML}</div>` +
      `<p>${names}</p><p><b>共 ${r.sum} 台</b>・${pay} ${r.sum} 分</p>`;
  });
  if (ws.length) out += `<p>分數變化：${SEAT.map((n, q) => `${n} ${delta[q] > 0 ? '+' : ''}${delta[q]}`).join('、')}</p>`;
  if (!ws.length) sfx('draw');
  G.last = { delta, from, ws: ws.map(w => w.s), sums }; // 供自動測試統計強弱
  recordResult(ws, from, delta, sums);
  say(ws.length ? '本局結束' : '流局');
  $('result').innerHTML = `<div class="card">${out}<button id="again">再來一局</button><button id="lvToggle">難度：${LV[level]}</button><button id="showstats">戰績</button></div>`;
  $('result').hidden = false;
}
$('result').onclick = e => {
  if (e.target.id === 'again') start();
  else if (e.target.id === 'showstats') showStats();
  else if (e.target.id === 'lvToggle') { setLevel(level === 'hard' ? 'normal' : 'hard'); e.target.textContent = `難度：${LV[level]}`; }
};

// ===== 戰績 =====
const emptyStats = () => ({ games: 0, win: 0, self: 0, shot: 0, draw: 0, score: 0, best: 0, hist: [] });
function recordResult(ws, from, delta, sums) {
  const st = store.get(STATS) || emptyStats();
  st.games++;
  let label = '流局';
  if (!ws.length) st.draw++;
  else {
    const i = ws.findIndex(w => w.s === 0);
    if (i >= 0) { st.win++; if (ws[i].self) st.self++; st.best = Math.max(st.best, sums[i]); }
    if (from === 0 && ws.some(w => !w.self)) st.shot++;
    label = ws.map((w, q) => `${SEAT[w.s]}${w.flower || (w.self ? '自摸' : '胡牌')} ${sums[q]} 台`).join('、');
  }
  st.score += delta[0];
  st.hist.unshift({ t: Date.now(), label, d: delta[0] });
  st.hist.length = Math.min(st.hist.length, 20);
  store.set(STATS, st);
}
function showStats() {
  const st = store.get(STATS) || emptyStats();
  const two = n => String(n).padStart(2, '0');
  const rows = st.hist.map(h => {
    const t = new Date(h.t);
    return `<li>${t.getMonth() + 1}/${t.getDate()} ${two(t.getHours())}:${two(t.getMinutes())}　${h.label}（你 ${h.d > 0 ? '+' : ''}${h.d}）</li>`;
  }).join('') || '<li>尚無紀錄</li>';
  $('stats').innerHTML = `<div class="card"><h2>戰績</h2>` +
    `<p>共 ${st.games} 局・胡牌 ${st.win}（自摸 ${st.self}）・放槍 ${st.shot}・流局 ${st.draw}</p>` +
    `<p><b>累計分數 ${st.score > 0 ? '+' : ''}${st.score}</b>・單局最高 ${st.best} 台</p>` +
    `<ul class="hist">${rows}</ul><button id="closestats">關閉</button><button id="clearstats">清除紀錄</button></div>`;
  $('stats').hidden = false;
}
$('stats').onclick = e => {
  if (e.target.id === 'closestats' || e.target === $('stats')) $('stats').hidden = true;
  else if (e.target.id === 'clearstats' && confirm('確定要清除所有戰績嗎？')) { store.del(STATS); showStats(); }
};

// ===== 開局：擲骰決定莊家 → 洗牌 → 發牌 → 補花 =====
// 開局動畫（M6）：擲骰 → 洗牌 → 堆牌＋開門 → 發牌 → 補花；邏輯與動畫一對一，點一下畫面可跳過
const wait = ms => G.skip ? Promise.resolve() : sleep(ms);
const face = n => '⚀⚁⚂⚃⚄⚅'[n - 1];
const r6 = () => 1 + Math.random() * 6 | 0;
async function introDice(dice, sum) {
  const o = $('intro'); o.hidden = false; sfx('dice'); say('擲骰中…');
  const show = (ds, msg, roll) => {
    o.innerHTML = `<div class="introbox"><div class="dice">${ds.map(n =>
      `<span class="die"${roll ? ` style="transform:rotate(${Math.random() * 40 - 20 | 0}deg)"` : ''}>${face(n)}</span>`).join('')}</div><p>${msg}</p></div>`;
  };
  for (let i = 0; i < 10 && !G.skip; i++) { show([r6(), r6(), r6()], '擲骰中…', true); await wait(100); }
  show(dice, `${dice.join('+')} ＝ ${sum}`);
  await wait(600);
  show(dice, `${sum} 點 → 莊家：${SEAT[G.dealer]}`);
  G.dealerShown = true; render(); // 擲骰結果出來後才標示莊家與風位
  say(`擲骰 ${dice.join('+')}＝${sum}，莊家：${SEAT[G.dealer]}`);
  await wait(1000);
}
async function introShuffle() {
  const o = $('intro'); sfx('shuffle'); say('洗牌中…');
  for (let i = 0; i < 8 && !G.skip; i++) {
    o.innerHTML = `<div class="introbox"><div class="shuf">${Array.from({ length: 8 }, () =>
      `<span class="t back sm" style="--dx:${Math.random() * 120 - 60 | 0}px;--dy:${Math.random() * 40 - 20 | 0}px;--r:${Math.random() * 40 - 20 | 0}deg"></span>`).join('')}</div><p>洗牌中…</p></div>`;
    await wait(150);
  }
}
async function introWall() {
  const o = $('intro'); sfx('build'); say('堆牌、開門…');
  const side = (k, cls) => `<div class="wside ${cls}${k === G.dealer ? ' open' : ''}">${Array.from({ length: 18 }, (_, i) =>
    `<i class="stk" style="--i:${(k + 4 - 0) % 4 * 18 + i}"></i>`).join('')}</div>`;
  o.innerHTML = `<div class="introbox"><div class="wring">${side(2, 'wt')}${side(3, 'wl')}` +
    `<div class="wmid">${SEAT[G.dealer]}（莊）面前開門</div>${side(1, 'wr')}${side(0, 'wb')}</div></div>`;
  await wait(1600);
}
async function start() {
  $('result').hidden = true; store.del(SAVE);
  const dice = [r6(), r6(), r6()], sum = dice.reduce((a, b) => a + b);
  Object.assign(G, {
    dealer: (sum - 1) % 4, wall: newWall(), turn: -1, pass: false, pick: null, tag: null, flowerWin: null, dealerShown: false, skip: !!G.auto, level, hard: hardSeats(level),
    called: false, discards: 0, draws: [0, 0, 0, 0],
    hands: [[], [], [], []], melds: [[], [], [], []], flowers: [[], [], [], []], river: [[], [], [], []],
    mark: [null, null, null, null]
  });
  render();
  await introDice(dice, sum);
  await introShuffle();
  await introWall();
  $('intro').hidden = true;
  say('發牌中…');
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const s = (G.dealer + k) % 4;
    for (let i = 0; i < 4; i++) G.hands[s].push(G.wall.shift());
    sfx('deal'); render(); await wait(110);
  }
  G.hands[G.dealer].push(G.wall.shift());
  sfx('deal'); render(); await wait(300);
  say('補花中…');
  for (let k = 0; k < 4 && !G.flowerWin; k++) {
    const s = (G.dealer + k) % 4;
    while (!G.flowerWin && flowerStep(s)) { sfx('flower'); render(); await wait(450); }
  }
  render();
  if (G.flowerWin) { await wait(800); return finishFlower(); }
  await wait(300);
  await loop();
}

// ===== 讀取存檔，從該回合開頭繼續 =====
async function resume() {
  const sv = store.get(SAVE);
  if (!sv || sv.v !== 1) return start();
  $('result').hidden = true;
  Object.assign(G, { called: false, discards: 0, draws: [0, 0, 0, 0], level: 'normal' }, sv.g, { dealerShown: true, turn: -1, pick: null, tag: null, flowerWin: null, mark: [null, null, null, null] });
  G.hard = hardSeats(G.level);
  render(); say('已讀取存檔，繼續遊戲');
  await sleep(800);
  await loop(sv.cur, sv.mode);
}

// ===== 開始遊戲：按下按鈕後才開局 =====
for (let t = 0; t < 42; t++) new Image().src = `img/t${t}.webp`; // 預先載入牌圖
$('go').onclick = () => { $('begin').hidden = true; start(); };
$('lvNormal').onclick = () => setLevel('normal');
$('lvHard').onclick = () => setLevel('hard');
setLevel(level);
$('resume').onclick = () => { $('begin').hidden = true; resume(); };
$('menu').onclick = $('statsBtn').onclick = showStats;
$('intro').onclick = () => { G.skip = true; };
const soundLabel = () => { $('sound').textContent = snd.on ? '🔊 音效' : '🔇 音效'; };
$('sound').onclick = () => { snd.on = !snd.on; store.set('mj_sound', snd.on); soundLabel(); sfx('call'); };
soundLabel();
{ const sv = store.get(SAVE); if (sv && sv.v === 1) { $('resume').hidden = false; $('resume').textContent = `繼續上次遊戲（牌牆剩 ${sv.g.wall.length} 張）`; } }