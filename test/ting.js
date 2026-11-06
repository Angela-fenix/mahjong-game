// 聽牌提醒測試：3n+1 張聽牌時名稱旁顯示「聽牌！差 …（剩 N）」；輪到出牌（3n+2 張）時提示打哪張可聽牌
const vm = require('vm'), fs = require('fs'), assert = require('assert');
const stub = () => ({
  innerHTML: '', textContent: '', hidden: false, onclick: null, dataset: {},
  append() { }, addEventListener() { }, closest() { return null; }
});
const els = {};
const ctx = vm.createContext({
  document: {
    getElementById: id => els[id] || (els[id] = stub()),
    createElement: stub
  },
  Image: function () { }, localStorage: {
    getItem() { return null; },
    setItem() { }, removeItem() { }
  },
  setTimeout: f => { f(); }, console, Math
});

for (const f of ['script.js', 'app.js']) 
  vm.runInContext(fs.readFileSync(__dirname + '/../' + f, 'utf8'), ctx);

const run = c => vm.runInContext(c, ctx);
const P = str => { const r = []; let d = []; for (const ch of str) { if (/\d/.test(ch)) d.push(+ch); else { d.forEach(n => r.push({ m: n - 1, p: 8 + n, s: 17 + n, z: 26 + n }[ch])); d = []; } } return r; };
ctx.P = P;
const setup = (h0, turn) => {
  ctx._h = h0; run(`Object.assign(G,{dealer:0,dealerShown:true,turn:${turn},wall:newWall(),pass:false,flowerWin:null,tag:null,
  hands:[_h,[],[],[]],melds:[[],[],[],[]],flowers:[[],[],[],[]],river:[[],[],[],[]],mark:[null,null,null,null]})`);
};

// 聽牌（單吊 2條）：顯示提醒與剩餘張數（手上有 1 張，剩 3 張）
setup(P('123m456m789m123p456p2s'), -0 + 1);
run('render()');
assert(/聽牌！差 二條（剩 3）/.test(els.seat0.innerHTML), els.seat0.innerHTML);
// 河裡多一張二條 → 剩 2 張
run('G.river[1].push(19)'); run('render()');
assert(/二條（剩 2）/.test(els.seat0.innerHTML));
// 兩面聽：差 三筒、六筒
setup(P('123m456m789m123p45p22s'), 1); run('render()');
assert(/聽牌！差 三筒（剩 3）、六筒（剩 4）/.test(els.seat0.innerHTML), els.seat0.innerHTML);
// 沒聽牌：不顯示
setup(P('135m246m789m124p456p2s'), 1); run('render()');
assert(!/聽牌/.test(els.seat0.innerHTML));
// 輪到出牌（17 張）：打東可聽二條
setup(P('123m456m789m123p456p2s1z'), 0);

const hint = run('tingHint()');
assert(/打 東 差 二條/.test(hint), hint);
// 不是聽牌的 17 張：沒有提示；遊戲未開始（turn=-1）或有花牌時也不顯示
setup(P('135m246m789m124p456p2s1z'), 0); assert.strictEqual(run('tingHint()'), '');
setup(P('123m456m789m123p456p2s'), -1); run('render()'); assert(!/聽牌/.test(els.seat0.innerHTML));

// 提示獨立成一行：以換行符號開頭
setup(P('123m456m789m123p456p2s1z'), 0);
assert(/^\n聽牌提示：/.test(run('tingHint()')), '聽牌提示應以換行開頭');

// 「聽」標示：任一方聽牌都顯示（3n+1 張聽牌、3n+2 張打出後可聽牌）；沒聽牌或遊戲未開始不顯示
setup(P('135m246m789m124p456p2s'), 1);
run('G.hands[1] = P("123m456m789m123p456p2s"); G.hands[2] = P("123m456m789m123p456p2s1z"); G.hands[3] = P("135m246m789m124p456p2s"); render()');
assert(!/class="tenpai"/.test(els.seat0.innerHTML), '玩家沒聽牌');
assert(/class="tenpai">聽</.test(els.seat1.innerHTML), '電腦 3n+1 聽牌');
assert(/class="tenpai">聽</.test(els.seat2.innerHTML), '電腦 3n+2 打出後可聽牌');
assert(!/class="tenpai"/.test(els.seat3.innerHTML), '電腦沒聽牌');
setup(P('123m456m789m123p456p2s'), 1); run('render()');
assert(/class="tenpai">聽</.test(els.seat0.innerHTML) && /聽牌！差/.test(els.seat0.innerHTML), '玩家聽牌：標示與提醒並存');
setup(P('123m456m789m123p456p2s'), -1); run('G.hands[1] = P("123m456m789m123p456p2s"); render()');
assert(!/class="tenpai"/.test(els.seat1.innerHTML) && !/class="tenpai"/.test(els.seat0.innerHTML), '遊戲未開始不顯示');
console.log('ting hint + tenpai mark ok');

// 聽牌浮水印：由沒聽變成聽時，先顯示「聽牌」浮水印，浮水印消失後才出現「聽」方塊；已聽牌時不重複播放
const q = []; ctx.setTimeout = f => { q.push(f); };
const flush = () => { while (q.length) q.shift()(); };
setup(P('135m246m789m124p456p2s'), 1);
run('G.tingOn = []; G.tingHold = [false, false, false, false]; G.hands[1] = P("135m246m789m124p456p2s"); render()');
assert(!/class="tenpai"/.test(els.seat1.innerHTML) && !/class="mark/.test(els.seat1.innerHTML), '沒聽牌：無標示、無浮水印');
run('G.hands[1] = P("123m456m789m123p456p2s"); render()');
assert(/class="mark[^"]*">聽牌</.test(els.seat1.innerHTML), '剛聽牌：先出現浮水印');
assert(!/class="tenpai"/.test(els.seat1.innerHTML), '浮水印期間不顯示「聽」方塊');
flush();
assert(!/class="mark/.test(els.seat1.innerHTML), '浮水印 1 秒後消失');
assert(/class="tenpai">聽</.test(els.seat1.innerHTML), '浮水印消失後顯示「聽」方塊');
run('render()'); assert(q.length === 0 && !/class="mark/.test(els.seat1.innerHTML), '已聽牌不重複播浮水印');
// 玩家自己聽牌也會有浮水印
run('G.hands[0] = P("135m246m789m124p456p2s"); render()'); q.length = 0;
run('G.hands[0] = P("123m456m789m123p456p2s"); render()');
assert(/class="mark[^"]*">聽牌</.test(els.seat0.innerHTML), '玩家聽牌：浮水印');
flush(); assert(/class="tenpai">聽</.test(els.seat0.innerHTML));
// 摸牌（3n+2 張）時沿用聽牌狀態，標示不閃掉；打出後不再聽牌則取消
run('G.hands[1] = P("123m456m789m123p456p2s9z"); render()');
assert(/class="tenpai">聽</.test(els.seat1.innerHTML), '摸牌後仍顯示');
run('G.hands[1] = P("135m246m789m124p456p2s"); render()');
assert(!/class="tenpai"/.test(els.seat1.innerHTML), '不再聽牌：取消標示');
console.log('tenpai watermark ok');


// 新的一局要重設聽牌狀態：上一局留下的「已聽牌」不能讓新局一開始就出現「聽」
run('G.tingOn = [true, true, true, true]; G.tingHold = [true, true, true, true]');
run('start()'); // 同步執行到第一個等待為止，此時已重設
assert(run('G.tingOn.length') === 0 && run('G.tingHold.every(x => x === false)'), '開新局應重設聽牌狀態');
console.log('tenpai reset on new game ok');