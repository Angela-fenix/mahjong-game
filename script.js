'use strict';

// ===== 牌的編碼：0-8 萬、9-17 筒、18-26 條、27-30 東南西北、31-33 中發白、34-41 花牌 =====
const WIND = ['東', '南', '西', '北'];
const HON = ['東', '南', '西', '北', '中', '發', '白'];
const NUM = '一二三四五六七八九';
const FLW = '春夏秋冬梅蘭菊竹';
const isFlower = t => t >= 34;
const name = t => t >= 34 ? FLW[t - 34] : t >= 27 ? HON[t - 27] : NUM[t % 9] + '萬筒條'[t / 9 | 0];
const suit = t => t >= 27 ? 3 : t / 9 | 0;

// 牌牆：136 張基本牌 + 8 張花牌，洗牌一次；頭（shift）摸牌，尾（pop）補牌
function newWall() {
  const w = [];
  for (let t = 0; t < 34; t++) {
    for (let i = 0; i < 4; i++)
      w.push(t);
  }
  for (let t = 34; t < 42; t++) w.push(t);
  for (let i = w.length - 1; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0;
    [w[i], w[j]] = [w[j], w[i]];
  }

  return w;
}

const counts = arr => { const c = Array(34).fill(0); arr.forEach(t => c[t]++); return c; };

// ===== 胡牌判定：回溯拆解（1 將牌 + N 面子），回傳所有拆法 =====
function split(c, i, acc, cb) {
  while (i < 34 && !c[i]) i++;
  if (i >= 34) { cb(acc.slice()); return; }
  if (c[i] >= 3) {
    c[i] -= 3; acc.push({ t: i, k: 'p' }); split(c, i, acc, cb); acc.pop(); c[i] += 3;
  }
  if (i < 27 && i % 9 < 7 && c[i + 1] && c[i + 2]) {
    c[i]--; c[i + 1]--; c[i + 2]--;
    acc.push({ t: i, k: 'c' }); split(c, i, acc, cb); acc.pop();
    c[i]++; c[i + 1]++; c[i + 2]++;
  }

}
function decomps(c) {
  const res = [];
  for (let p = 0; p < 34; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    split(c, 0, [], sets => res.push({ pair: p, sets }));
    c[p] += 2;
  }
  return res;
}

// tiles：手中未副露的牌；melds：已吃碰的面子。5 面子 + 1 將牌
const canWin = (tiles, melds) =>
  tiles.length === 3 * (5 - melds.length) + 2 && decomps(counts(tiles)).length > 0;
const waits = (tiles, melds) => {
  const w = [];
  for (let t = 0; t < 34; t++) { if (canWin(tiles.concat(t), melds)) w.push(t); }
  return w;
};

// ===== 台數計算（依規格書階段 1 牌型與 M7 天胡、地胡、人胡；八仙過海、七搶一在 app.js 處理；另加平胡） =====
// melds 的 k：'p' 碰、'c' 吃、'g' 槓（open=false 為暗槓）；槓算 1 組面子，視為刻子
// x: { tiles(含胡的那張), melds, flowers, seat(門風 0-3, 0=莊家), 
// self, win, last, kong(槓上自摸), rob(搶槓), river(河底撈魚：最後一張打出的牌),
//      special('天胡'|'地胡'|'人胡'), round(圈風 0-3：東南西北，預設 0) }
const isPung = s => s.k === 'p' || s.k === 'g';

function calcTai(x) {
  const open = x.melds.some(m => m.open);
  const bef = x.tiles.slice(); bef.splice(bef.lastIndexOf(x.win), 1);
  const special = x.special || null;
  // const ting = special ? null : x.ting || null;
  const single = special !== '天胡' && waits(bef, x.melds).length === 1; // 天胡沒有「胡的那張」，不算獨聽
  let best = null;

  for (const d of decomps(counts(x.tiles))) {
    const sets = d.sets.concat(x.melds), r = [];
    const add = (n, t) => r.push({ n, t });
    const pungs = sets.filter(isPung);
    if (x.seat === 0) add('莊家', 1);

    if (!open && x.self) add('門清一摸三', 3);
    else {
      if (!open)
        add('門清', 1); if (x.self) add('自摸', 1);
    }

    if (x.melds.length === 5 && !x.self && x.melds.every(m => m.open)) add('全求人', 1);
    if (single) add('獨聽', 1);
    if (x.last && x.self) add('海底撈月', 1);
    if (x.kong && x.self) add('槓上自摸', 1);
    if (x.rob) add('搶槓', 1);
    if (x.river && !x.self) add('河底撈魚', 1); // 最後一張牌被打出後放槍胡

    // 三元牌
    const dr = pungs.filter(s => s.t >= 31).length;
    if (dr === 3)
      add('大三元', 8);
    else if (dr === 2 && d.pair >= 31)
      add('小三元', 4);
    else {
      for (let i = 0; i < dr; i++) add('箭牌', 1);
    }

    // 四喜、場風、本風
    const wp = pungs.filter(s => s.t >= 27 && s.t < 31).length;
    if (wp === 4) add('大四喜', 16);
    else if (wp === 3 && d.pair >= 27 && d.pair < 31) add('小四喜', 8);
    else pungs.forEach(s => {
      if (s.t === 27 + (x.round || 0)) add('場風', 1);
      if (s.t === 27 + x.seat) add('本風', 1);
    });

    // 花色
    const suits = new Set(sets.map(s => suit(s.t)).concat(suit(d.pair)));
    const nums = [...suits].filter(s => s < 3).length;
    if (!nums)
      add('字一色', 16);
    else if (nums === 1)
      suits.has(3) ? add('混一色', 4) : add('清一色', 8);

    if (sets.every(isPung)) add('碰碰胡', 4);

    // 暗刻（暗槓算暗刻；吃、碰、明槓不算）。放槍胡時，靠別人打出的牌湊成的那組刻子不算暗刻；
    // 但胡的牌若也能算在順子或將牌裡，刻子仍是暗刻（取對自己有利的解釋）
    let cp = d.sets.filter(s => s.k === 'p').length + x.melds.filter(m => m.k === 'g' && !m.open).length;
    if (!x.self && d.sets.some(s => s.k === 'p' && s.t === x.win)) {
      const alt = d.pair === x.win || d.sets.some(s => s.k === 'c' && x.win >= s.t && x.win <= s.t + 2);
      if (!alt) cp--;
    }

    // 五暗刻、四暗刻、三暗刻：取高者（三暗刻只要有 3 組暗刻，其餘面子可以是順子，也可以靠吃碰完成）
    if (cp === 5) add('五暗刻', 8);
    else if (cp === 4) add('四暗刻', 5);
    else if (cp === 3) add('三暗刻', 2);

    // 花牌
    x.flowers.filter(f => (f - 34) % 4 === x.seat).forEach(() => add('正花', 1));
    [34, 38].forEach(b => { if ([0, 1, 2, 3].every(i => x.flowers.includes(b + i))) add('花槓', 1); });

    // 平胡（2 台）：5 組面子全是順子（吃的也算；不能有刻子、槓）、將牌不是字牌、聽牌不是獨聽（要是兩面以上的聽法）
    if (special !== '天胡' && !single && d.pair < 27 && sets.every(s => s.k === 'c')) add('平胡', 2);

    // 天胡、地胡、人胡：不另計莊家、自摸、門清、不求人；其餘牌型台仍可加
    if (special) {
      for (let i = r.length - 1; i >= 0; i--)
        if (['莊家', '自摸', '門清', '門清一摸三'].includes(r[i].n)) r.splice(i, 1);
      add(special, { 天胡: 24, 地胡: 16, 人胡: 16 }[special]);
    }

    const sum = r.reduce((a, e) => a + e.t, 0);
    if (!best || sum > best.sum) best = { list: r, sum };
  }

  return best;
}

// ===== 向聽數（電腦玩家用）：nm = 已副露面子數；c = 34 格張數；0 = 聽牌、-1 = 已胡 =====
// 公式：2×需要的面子數 − 2×面子 − 搭子 − 將牌，搭子數受「面子＋搭子 ≤ 需要面子數」限制
// 做法：萬、筒、條、字牌四個區塊各自列舉拆法（面子數 m、搭子數 t、有無將牌 p），再把四個區塊合併，比整副牌一起列舉快很多
function blockTable(c, off, len, suited) {
  const tb = [0, 1, 2, 3, 4, 5].map(() => [-1, -1]); // tb[m][p] = 最多搭子數
  (function dfs(i, m, t, p) {
    while (i < len && !c[off + i]) i++;
    if (i >= len) { if (t > tb[m][p]) tb[m][p] = t; return; }
    const k = off + i;
    if (c[k] >= 3) { c[k] -= 3; dfs(i, m + 1, t, p); c[k] += 3; }
    if (suited && i < len - 2 && c[k + 1] && c[k + 2]) {
      c[k]--; c[k + 1]--; c[k + 2]--; dfs(i, m + 1, t, p); c[k]++; c[k + 1]++; c[k + 2]++;
    }
    if (!p && c[k] >= 2) { c[k] -= 2; dfs(i, m, t, 1); c[k] += 2; }
    if (c[k] >= 2) { c[k] -= 2; dfs(i, m, t + 1, p); c[k] += 2; }
    if (suited && i < len - 1 && c[k + 1]) { c[k]--; c[k + 1]--; dfs(i, m, t + 1, p); c[k]++; c[k + 1]++; }
    if (suited && i < len - 2 && c[k + 2]) { c[k]--; c[k + 2]--; dfs(i, m, t + 1, p); c[k]++; c[k + 2]++; }
    c[k]--; dfs(i, m, t, p); c[k]++;
  })(0, 0, 0, 0);
  return tb;
}

function shanten(c, nm) {
  const N = 5 - nm;

  let dp = [0, 1, 2, 3, 4, 5].map(m => [m === 0 ? 0 : -1, -1]); // dp[m][p] = 最多搭子數（-1 = 不可能）
  for (const [off, len, suited] of [[0, 9, true], [9, 9, true], [18, 9, true], [27, 7, false]]) {
    const tb = blockTable(c, off, len, suited), nd = [0, 1, 2, 3, 4, 5].map(() => [-1, -1]);
    for (let m = 0; m <= 5; m++) for (let p = 0; p < 2; p++) {
      if (dp[m][p] < 0) continue;
      for (let m2 = 0; m + m2 <= 5; m2++) for (let p2 = 0; p + p2 < 2; p2++) {
        if (tb[m2][p2] < 0) continue;
        const t = dp[m][p] + tb[m2][p2];
        if (t > nd[m + m2][p + p2]) nd[m + m2][p + p2] = t;
      }
    }
    dp = nd;
  }

  let best = 2 * N;
  for (let m = 0; m <= 5; m++) for (let p = 0; p < 2; p++) {
    if (dp[m][p] < 0 || m > N) continue;
    const v = 2 * N - 2 * m - Math.min(dp[m][p], N - m) - p;
    if (v < best) best = v;
  }

  return best;
}