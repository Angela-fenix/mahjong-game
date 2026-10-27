
const vm = require('vm'), fs = require('fs'), assert = require('assert');
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
const fresh = () =>
  run(`Object.assign(G,{
    dealer:0,
    wall:newWall(),
    flowerWin:null,
    hands:[[],[],[],[]],
    melds:[[],[],[],[]],
    flowers:[[],[],[],[]],
    river:[[],[],[],[]],
    mark:[null,null,null,null]})`
  );

// 八仙過海：自己補到第 8 張花
fresh();
run('G.flowers[2]=[34,35,36,37,38,39,40]; G.hands[2]=[41,0,1]; fixFlowers(2)');
assert.deepStrictEqual(JSON.parse(run('JSON.stringify(G.flowerWin)')), { s: 2, kind: '八仙過海' });
run('finishFlower()');
assert(/八仙過海 8 台/.test(els.result.innerHTML) && /其餘三家各付 8 分/.test(els.result.innerHTML));

// 七搶一：3 號持 7 張，1 號補到第 8 張 → 3 號胡，1 號放槍
fresh();
run('G.flowers[3]=[34,35,36,37,38,39,40]; G.hands[1]=[41,0,1]; fixFlowers(1)');
assert.deepStrictEqual(JSON.parse(run('JSON.stringify(G.flowerWin)')), { s: 3, from: 1, kind: '七搶一' });
run('finishFlower()');
assert(/上家・七搶一/.test(els.result.innerHTML) && /下家放槍，付 8 分/.test(els.result.innerHTML));

// 花牌不足 8 張總數時不誤判
fresh();
run('G.flowers[3]=[34,35,36,37,38,39]; G.hands[1]=[41,0,1]; fixFlowers(1)');
assert.strictEqual(run('G.flowerWin'), null);

console.log('flower-win paths ok');