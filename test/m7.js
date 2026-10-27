// M7 流程測試：天胡、地胡、人胡的判定（報聽功能已移除）
const vm = require('vm'), fs = require('fs'), assert = require('assert');
const stub = () => ({ innerHTML: '', textContent: '', hidden: false, onclick: null, dataset: {}, append() {}, addEventListener() {}, closest() { return null; } });
const els = {};
const ctx = vm.createContext({ document: { getElementById: id => els[id] || (els[id] = stub()), createElement: stub }, Image: function () {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, setTimeout: f => { f(); }, console, Math });
for (const f of ['script.js', 'app.js']) vm.runInContext(fs.readFileSync(__dirname + '/../' + f, 'utf8'), ctx);
const run = c => vm.runInContext(c, ctx);
run('G.auto = true; G.debug = true;');
// 牌型簡記：123m=萬 456p=筒 789s=條 1-7z=東南西北中發白
const P = str => { const r = []; let d = []; for (const ch of str) { if (/\d/.test(ch)) d.push(+ch); else { d.forEach(n => r.push({ m: n - 1, p: 8 + n, s: 17 + n, z: 26 + n }[ch])); d = []; } } return r; };
ctx.P = P;
// 以指定手牌開局（其餘牌洗進牌牆），head：牌牆最前面的一張（下一張要被摸的牌）
function setup(dealer, hands, head) {
  const wall = run('newWall()');
  hands.flat().forEach(t => wall.splice(wall.indexOf(t), 1));
  if (head !== undefined) wall.splice(wall.indexOf(head), 1), wall.unshift(head);
  ctx._w = wall; ctx._h = hands.map(h => h.slice()); // 複製，避免前一局的摸打改到共用的陣列
  run(`Object.assign(G,{dealer:${dealer},dealerShown:true,level:'normal',hard:[false,false,false,false],wall:_w,hands:_h,melds:[[],[],[],[]],flowers:[[],[],[],[]],river:[[],[],[],[]],
    called:false,discards:0,draws:[0,0,0,0],flowerWin:null,pass:false,pick:null,tag:null,mark:[null,null,null,null]})`);
}
const junk = P('111z222z333z44z55z66z77z'); // 17 張字牌：打出後別家不能吃、也碰不到
(async () => {
  const win17 = P('123m456m789m123p456p22s');
  // 天胡：莊家起手即成胡
  setup(0, [win17, P('2m4m6m8m2p4p6p8p4s6s8s3m5m7m9m3p'), P('3p5p7p9p3s5s7s9s2m4m6m8m1p5p7p9p'), P('2p4p6p8p3m5m7m9m2s4s6s8s5s7s9s6p')]);
  await run('loop()');
  assert(/天胡 24 台/.test(els.result.innerHTML) && /共 24 台/.test(els.result.innerHTML), '天胡');
  // 地胡：閒家第一次摸牌即自摸
  const t16 = P('123m456m789m123p456p2s');
  setup(0, [junk, t16, P('2m4m6m8m2p4p6p8p4s6s8s3m5m7m9m3p'), P('3p5p7p9p3s5s7s9s2m4m6m8m1p5p7p9p')], 19);
  await run('loop()');
  assert(/地胡 16 台/.test(els.result.innerHTML) && /獨聽 1 台/.test(els.result.innerHTML), '地胡');
  // 人胡：閒家於第一圈內胡別人打的牌（沒有人吃碰槓）
  setup(0, [junk, t16, [], []]);
  run('G.hands[2] = P("2m4m6m8m2p4p6p8p4s6s8s3m5m7m9m3p"); G.hands[3] = P("3p5p7p9p3s5s7s9s2m4m6m8m1p5p7p9p"); G.discards = 1; G.draws = [0, 0, 0, 0]');
  run('finish([{ s: 1, self: false }], 19, 0)');
  assert(/人胡 16 台/.test(els.result.innerHTML), '人胡');
  // 有人吃碰槓、或超過第一圈 → 不是人胡
  run('G.called = true; finish([{ s: 1, self: false }], 19, 0)');
  assert(!/人胡 \d+ 台/.test(els.result.innerHTML));
  run('G.called = false; G.discards = 5; finish([{ s: 1, self: false }], 19, 0)');
  assert(!/人胡 \d+ 台/.test(els.result.innerHTML));
  console.log('M7 flows ok');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
