// 難度強弱測試：讓「困難」電腦與「普通」電腦同桌對打（座位輪流交換），比較平均得分、胡牌率、放槍率
const vm = require('vm'), fs = require('fs');
const stub = () => ({ innerHTML: '', textContent: '', hidden: false, onclick: null, dataset: {}, append() {}, addEventListener() {}, closest() { return null; } });
const els = {};
const ctx = vm.createContext({
  document: { getElementById: id => els[id] || (els[id] = stub()), createElement: stub },
  Image: function () {}, localStorage: { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
  setTimeout: f => { f(); }, console, Math
});
for (const f of ['script.js', 'app.js']) vm.runInContext(fs.readFileSync(__dirname + '/../' + f, 'utf8'), ctx);
const run = c => vm.runInContext(c, ctx);
run('G.auto = true;');
(async () => {
  const N = +process.argv[2] || 300, t0 = Date.now();
  const cfgs = [[1, 1, 0, 0], [0, 0, 1, 1], [1, 0, 1, 0], [0, 1, 0, 1]];
  const sum = { hard: { games: 0, score: 0, win: 0, shot: 0, draw: 0 }, normal: { games: 0, score: 0, win: 0, shot: 0, draw: 0 } };
  const only = process.argv[3] === undefined ? cfgs : [cfgs[+process.argv[3]]]; // 可指定只跑第幾組座位配置，方便平行執行
  for (const cfg of only) {
    ctx._cfg = cfg.map(Boolean);
    run('G.hardSeats = _cfg');
    for (let i = 0; i < N; i++) {
      await run('start()');
      const L = JSON.parse(run('JSON.stringify(G.last)'));
      for (let s = 0; s < 4; s++) {
        const g = cfg[s] ? sum.hard : sum.normal;
        g.games++; g.score += L.delta[s];
        if (L.ws.includes(s)) g.win++;
        if (L.from === s && L.ws.length) g.shot++;
        if (!L.ws.length) g.draw++;
      }
    }
  }
  console.log('RAW', JSON.stringify(sum));
  for (const k of ['normal', 'hard']) {
    const g = sum[k];
    console.log(`${k === 'hard' ? '困難' : '普通'}：每人每局平均 ${(g.score / g.games).toFixed(3)} 分，胡牌率 ${(100 * g.win / g.games).toFixed(1)}%，放槍率 ${(100 * g.shot / g.games).toFixed(1)}%（${g.games} 人局）`);
  }
  console.log(`耗時 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
