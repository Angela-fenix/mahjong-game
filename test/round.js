// 圈風輪流測試：每局依序換東、南、西、北；清除戰績後從東開始；存檔讀回後圈風不變
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
  const seq = [];
  for (let i = 0; i < 9; i++) { await run('start()'); seq.push(run('G.round')); }
  assert.deepStrictEqual(seq, [0, 1, 2, 3, 0, 1, 2, 3, 0], '圈風應依序為東南西北：' + seq);
  assert(/圈風：東/.test(els.wall.textContent) || /圈風：[東南西北]/.test(els.wall.textContent));
  // 清除戰績 → 下一局從東開始
  ls.removeItem('mj_stats');
  await run('start()'); assert.strictEqual(run('G.round'), 0, '清除戰績後應從東開始');
  await run('start()'); assert.strictEqual(run('G.round'), 1);
  // 存檔讀回：圈風不變
  snaps.length = 0;
  await run('start()');
  const r = run('G.round'); const mid = JSON.parse(snaps[Math.floor(snaps.length / 2)]);
  assert.strictEqual(mid.g.round, r, '存檔應記錄圈風');
  ls.setItem('mj_save', JSON.stringify(mid)); run('G.round = 99');
  await run('resume()'); // 結算後 G.round 保留讀回的圈風
  assert.strictEqual(run('G.round'), r, '讀檔後圈風不變');
  console.log('圈風序列', seq.join(','), '；清除戰績後重新從東開始；存檔讀回圈風不變');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
