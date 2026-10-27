// 圖一情境：上家（莊）打出中；玩家手上有 2 張中時應詢問碰，只有 1 張時不應詢問
const vm = require('vm'), fs = require('fs'), assert = require('assert');
const stub = () => ({ innerHTML: '', textContent: '', hidden: false, onclick: null, dataset: {}, append() {}, addEventListener() {}, closest() { return null; } });
const els = {};
const ctx = vm.createContext({ document: { getElementById: id => els[id] || (els[id] = stub()), createElement: stub }, Image: function () {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, setTimeout: f => { f(); }, console, Math });
for (const f of ['script.js', 'app.js']) vm.runInContext(fs.readFileSync(__dirname + '/../' + f, 'utf8'), ctx);
const run = c => vm.runInContext(c, ctx);
const setup = h0 => run(`Object.assign(G,{dealer:3,wall:newWall(),pass:false,flowerWin:null,
  hands:[${JSON.stringify(h0)},[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],[18,19,20,21,22,23,24,25,26,0,1,2,3,4,5,6],[9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]],
  melds:[[],[],[],[]],flowers:[[],[],[],[]],river:[[],[],[],[31]],mark:[null,null,null,null],called:false,discards:0,draws:[0,0,0,0]})`);
(async () => {
  const tick = () => new Promise(r => setImmediate(r));
  // 兩張中（31）→ 要問碰
  setup([0, 2, 3, 3, 4, 9, 16, 19, 21, 23, 24, 25, 26, 27, 31, 31]);
  run('react(3, 31)'); await tick();
  assert(els.status && /要碰 中/.test(els.status.textContent), '有兩張中應詢問碰');
  // 只有一張中 → 不問碰，直接結束反應（輪到玩家摸牌）
  els.status.textContent = '';
  setup([0, 2, 3, 3, 4, 9, 16, 19, 21, 23, 24, 25, 26, 27, 31, 32]);
  const r = await run('react(3, 31)');
  assert(!/要碰/.test(els.status.textContent) && r.s === undefined && !r.hu);
  console.log('pong prompt ok');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
