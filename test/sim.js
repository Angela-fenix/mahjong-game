// 電腦對打模擬（規格書第 14 節）：G.auto 讓座位 0 也由電腦操作；G.debug 開啟牌數不變量檢查
const vm = require('vm'), fs = require('fs');
const stub = () => ({
  innerHTML: '',
  textContent: '',
  hidden: false,
  onclick: null,
  dataset: {},
  append() { },
  addEventListener() { },
  closest() { return null; }
});
const els = {};
const ctx = vm.createContext({
  document: {
    getElementById: id => els[id] || (els[id] = stub()),
    createElement: stub
  },
  Image: function () { },
  localStorage: {
    _d: {},
    getItem(k) { return k in this._d ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
  },
  setTimeout: f => { f(); }, console, Math
});

for (const f of ['script.js', 'app.js'])
  vm.runInContext(fs.readFileSync(__dirname + '/../' + f, 'utf8'), ctx);

const run = c => vm.runInContext(c, ctx);
run('G.auto = true; G.debug = true;');

(async () => {
    const N = +process.argv[2] || 300, st = {}, kinds = ['流局', '自摸', '胡牌', '八仙過海', '七搶一',
       '搶槓', '槓上自摸', '天胡', '地胡', '人胡', '平胡', '三暗刻', '四暗刻', '五暗刻'];
  const t0 = Date.now(); let kongs = 0;
  for (let i = 0; i < N; i++) {
    await vm.runInContext('start()', ctx);
    const html = els.result.innerHTML;

    if (run('total()') !== 144)
      throw new Error('牌數不是 144');
    kinds.forEach(k => { const hit = /^(天胡|地胡|人胡|平胡|三暗刻|四暗刻|五暗刻)$/.test(k) ? 
      new RegExp(k + ' \\d+ 台').test(html) : html.includes(k); if (hit) st[k] = (st[k] || 0) + 1; });
    kongs += run('G.melds.flat().filter(m=>m.k==="g").length');

    if (!/流局|自摸|胡牌|八仙過海|七搶一/.test(html))
      throw new Error('結算畫面異常');
  }

  console.log(`${N} 局完成，無例外、無卡死，耗時 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('結果統計：', st, '；結束時場上槓牌組數合計：', kongs);
})().catch(e => { console.error('FAIL', e); process.exit(1); });