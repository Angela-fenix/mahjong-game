// 存檔／讀檔與戰績測試：收集模擬對局中的每個回合存檔，隨機挑幾個讀回並跑完，確認牌數仍為 144 且能正常結算
const vm = require('vm'), fs = require('fs'), assert = require('assert');
const stub = () => ({ innerHTML: '', textContent: '', hidden: false, onclick: null, dataset: {}, append() {}, addEventListener() {}, closest() { return null; } });
const els = {}, ls = { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
const snaps = [];
const origSet = ls.setItem.bind(ls);
ls.setItem = (k, v) => { if (k === 'mj_save') snaps.push(v); origSet(k, v); };
const ctx = vm.createContext({ document: { getElementById: id => els[id] || (els[id] = stub()), createElement: stub }, Image: function () {}, localStorage: ls, setTimeout: f => { f(); }, console, Math, confirm: () => true });
for (const f of ['script.js', 'app.js']) vm.runInContext(fs.readFileSync(__dirname + '/../' + f, 'utf8'), ctx);
const run = c => vm.runInContext(c, ctx);
run('G.auto = true; G.debug = true;');
(async () => {
  await run('start()');
  assert(snaps.length > 10, '應有多次自動存檔');
  assert.strictEqual(ls.getItem('mj_save'), null, '結算後應清除存檔');
  assert.strictEqual(JSON.parse(ls.getItem('mj_stats')).games, 1, '應記錄 1 局');
  let ok = 0;
  for (const i of [0, 1, Math.floor(snaps.length / 3), Math.floor(snaps.length / 2), snaps.length - 1]) {
    ls.setItem('mj_save', snaps[i]);
    await run('resume()');
    assert.strictEqual(run('total()'), 144); ok++;
    assert.strictEqual(ls.getItem('mj_save'), null);
  }
  const st = JSON.parse(ls.getItem('mj_stats'));
  assert.strictEqual(st.games, 1 + ok);
  run('showStats()'); assert(/戰績/.test(els.stats.innerHTML) && /累計分數/.test(els.stats.innerHTML));
  console.log(`存檔 ${snaps.length} 筆；讀回 ${ok} 次皆可繼續並結算；戰績 ${st.games} 局，累計分 ${st.score}`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
