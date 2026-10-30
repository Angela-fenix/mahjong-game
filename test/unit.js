const vm = require('vm'), fs = require('fs'), assert = require('assert');
const ctx = vm.createContext({ Math });
vm.runInContext(fs.readFileSync(__dirname + '/../script.js', 'utf8'), ctx);

const run = c => vm.runInContext(c, ctx);

// 牌型簡記：123m=萬 456p=筒 789s=條 1-7z=東南西北中發白
const P = str => { const r = []; let d = []; for (const ch of str) { if (/\d/.test(ch)) d.push(+ch); else { d.forEach(n => r.push({ m: n - 1, p: 8 + n, s: 17 + n, z: 26 + n }[ch])); d = []; } } return r; };
ctx.P = P;

const tai = x => run('calcTai')(x);
const names = r => r.list.map(e => e.n).join(',');
let n = 0;
const t = (label, f) => { f(); n++; console.log('ok  ' + label); };
const base = { melds: [], flowers: [], seat: 1, self: false, last: false };

t('canWin 平胡', () => assert(run('canWin')(P('123m456m789m123p456p22s'), [])));
t('canWin 非胡', () => assert(!run('canWin')(P('123m456m789m123p456p23s'), [])));
t('shanten 聽牌=0', () => assert.strictEqual(run('shanten')(run('counts')(P('123m456m789m123p456p2s')), 0), 0));
t('shanten 胡牌=-1', () => assert.strictEqual(run('shanten')(run('counts')(P('123m456m789m123p456p22s')), 0), -1));
t('shanten 有副露', () => assert.strictEqual(run('shanten')(run('counts')(P('123m456m789m123p2s')), 1), 0));

const h1 = P('123m456m789m123p456p22s');
t('門清+獨聽 = 2', () => {
  const r = tai({ ...base, tiles: h1, win: 19 }); assert.strictEqual(r.sum, 2, names(r));
});
t('門清一摸三+獨聽 = 4', () => {
  const r = tai({ ...base, tiles: h1, win: 19, self: true }); assert.strictEqual(r.sum, 4, names(r));
});
t('搶槓 +1', () => {
  const r = tai({ ...base, tiles: h1, win: 19, rob: true }); assert.strictEqual(r.sum, 3); assert(names(r).includes('搶槓'));
});
t('槓上自摸 +1（自摸才計）', () => {
  assert.strictEqual(tai({ ...base, tiles: h1, win: 19, self: true, kong: true }).sum, 5);
  assert(!names(tai({ ...base, tiles: h1, win: 19, kong: true })).includes('槓上自摸'));
});
t('河底撈魚 +1（放槍才計）', () => {
  const r = tai({ ...base, tiles: h1, win: 19, river: true }); assert.strictEqual(r.sum, 3, names(r)); assert(names(r).includes('河底撈魚'));
  assert(!names(tai({ ...base, tiles: h1, win: 19, self: true, river: true })).includes('河底撈魚'));
});
t('大三元 8 台（另計門清 1、獨聽 1、三暗刻 2，所以合計 12）', () => {
  const r = tai({ ...base, tiles: P('123m456m555z666z777z11p'), win: 9 });
  assert.strictEqual(r.list.find(e => e.n === '大三元').t, 8, names(r));
});
t('大三元 + 三暗刻 = 12（中發白三組刻子都是暗刻）', () => {
  const r = tai({ ...base, tiles: P('123m456m555z666z777z11p'), win: 9 });
  assert.strictEqual(r.sum, 12, names(r)); assert(names(r).includes('三暗刻'));
});
t('暗槓：門清一摸三、場風、本風、莊家', () => {
  const r = tai({ ...base, seat: 0, self: true, tiles: P('123m456m789m123p22s'), win: 19, melds: [{ k: 'g', t: 27, open: false }] });
  assert.strictEqual(r.sum, 7, names(r));
});
t('明槓：不算門清、不算暗刻', () => {
  const r = tai({ ...base, seat: 1, tiles: P('123m456m789m123p22s'), win: 19, melds: [{ k: 'g', t: 31, open: true }] });
  assert(!names(r).includes('門清') && names(r).includes('箭牌'), names(r));
});
t('全求人+碰碰胡+獨聽 = 6', () => {
  const m = [0, 1, 2, 9, 10].map(x => ({ k: 'p', t: x, open: true }));
  const r = tai({ ...base, tiles: [18, 18], win: 18, melds: m }); assert.strictEqual(r.sum, 6, names(r));
});
t('含暗槓的 5 組面子不算全求人', () => {
  const m = [0, 1, 2, 9].map(x => ({ k: 'p', t: x, open: true })).concat({ k: 'g', t: 10, open: false });
  assert(!names(tai({ ...base, tiles: [18, 18], win: 18, melds: m })).includes('全求人'));
});
t('四暗刻：3 組暗刻 + 1 組暗槓（碰牌不算暗刻）', () => {
  const r = tai({ ...base, self: true, tiles: P('111m222m333p44s'), win: 21, melds: [{ k: 'g', t: 30, open: false }, { k: 'p', t: 20, open: true }] });
  assert(names(r).includes('四暗刻') && !names(r).includes('五暗刻'), names(r));
});

// ===== M7：天胡、地胡、人胡、天聽、地聽 =====
t('天胡 24 台：不另計莊家、門清一摸三，也不算獨聽', () => {
  const r = tai({ ...base, seat: 0, self: true, tiles: h1, win: 19, special: '天胡' });
  assert.strictEqual(r.sum, 24, names(r));
});
t('地胡 16 台 + 獨聽 1 台', () => {
  const r = tai({ ...base, self: true, tiles: h1, win: 19, special: '地胡' });
  assert.strictEqual(r.sum, 17, names(r)); assert(!names(r).includes('自摸') && !names(r).includes('門清'));
});
t('人胡 16 台（放槍胡）：不另計門清', () => {
  const r = tai({ ...base, tiles: h1, win: 19, special: '人胡' });
  assert.strictEqual(r.sum, 17, names(r)); assert(!names(r).includes('門清'));
});
t('天地人胡仍可加其他牌型台（箭牌）', () => {
  const r = tai({ ...base, self: true, tiles: P('123m456m789m123p22s'), win: 19, special: '地胡', melds: [{ k: 'g', t: 31, open: true }] });
  assert(names(r).includes('箭牌') && names(r).includes('地胡'), names(r));
});
// ===== 平胡：全順子、將牌不是字牌、非獨聽，2 台 =====
t('平胡 2 台（兩面聽、放槍）：門清 1 + 平胡 2 = 3', () => {
  const r = tai({ ...base, tiles: h1, win: 14 }); // 胡 6筒，聽 3筒、6筒
  assert.strictEqual(r.sum, 3, names(r)); assert(names(r).includes('平胡'));
});
t('平胡 + 門清一摸三（自摸）= 5', () => {
  const r = tai({ ...base, tiles: h1, win: 14, self: true }); assert.strictEqual(r.sum, 5, names(r));
});
t('獨聽（單吊將牌）不算平胡', () => { assert(!names(tai({ ...base, tiles: h1, win: 19 })).includes('平胡')); });
t('將牌是字牌不算平胡', () => {
  const r = tai({ ...base, tiles: P('123m456m789m123p456p11z'), win: 14 }); assert(!names(r).includes('平胡'), names(r));
});
t('有刻子不算平胡', () => {
  const r = tai({ ...base, tiles: P('111m456m789m123p456p22s'), win: 14 }); assert(!names(r).includes('平胡'), names(r));
});
t('有槓不算平胡', () => {
  const r = tai({ ...base, tiles: P('456m789m123p456p22s'), win: 14, melds: [{ k: 'g', t: 0, open: true }] }); assert(!names(r).includes('平胡'), names(r));
});
t('吃牌的順子仍可算平胡（不是門清，只有平胡 2 台）', () => {
  const r = tai({ ...base, tiles: P('456m789m123p456p22s'), win: 14, melds: [{ k: 'c', t: 0, open: true, tiles: [0, 1, 2] }] });
  assert.strictEqual(r.sum, 2, names(r));
});
t('天胡不算平胡', () => { assert(!names(tai({ ...base, seat: 0, self: true, tiles: h1, win: 14, special: '天胡' })).includes('平胡')); });

// ===== 圈風輪流（東南西北）：場風看圈風、本風看門風 =====
t('南風圈：碰東不算場風（閒家）', () => {
  const r = tai({ ...base, round: 1, tiles: P('123m456m789m123p22s'), win: 19, melds: [{ k: 'p', t: 27, open: true }] });
  assert(!names(r).includes('場風') && !names(r).includes('本風'), names(r));
});
t('南風圈：門風南的閒家碰南 = 場風 + 本風', () => {
  const r = tai({ ...base, round: 1, tiles: P('123m456m789m123p22s'), win: 19, melds: [{ k: 'p', t: 28, open: true }] });
  assert(names(r).includes('場風') && names(r).includes('本風'), names(r));
});
t('南風圈：莊家（門風東）碰東只算本風', () => {
  const r = tai({ ...base, seat: 0, round: 1, tiles: P('123m456m789m123p22s'), win: 19, melds: [{ k: 'p', t: 27, open: true }] });
  assert(names(r).includes('本風') && !names(r).includes('場風'), names(r));
});
t('東風圈（預設）：莊家碰東 = 場風 + 本風', () => {
  const r = tai({ ...base, seat: 0, tiles: P('123m456m789m123p22s'), win: 19, melds: [{ k: 'p', t: 27, open: true }] });
  assert(names(r).includes('場風') && names(r).includes('本風'), names(r));
});

// ===== 三暗刻（2 台）：3 組暗刻（含暗槓）；其餘面子可以是順子，也可以靠吃碰；與四暗刻、五暗刻取高者 =====
const h3 = P('111m444m777m456p789s99p'); // 3 組暗刻（111、444、777 萬）+ 順子 456 筒、789 條 + 99 筒將牌（刻子不選 123 這類能拆成順子的）
t('三暗刻：自摸 = 門清一摸三 3 + 三暗刻 2', () => {
  const r = tai({ ...base, tiles: h3, win: 14, self: true }); // 胡 6筒（順子 456 筒的邊上），聽 3筒、6筒
  assert(names(r).includes('三暗刻') && !names(r).includes('四暗刻'), names(r)); assert.strictEqual(r.sum, 5, names(r));
});
t('三暗刻：胡的牌補在順子裡，放槍也成立（門清 1 + 三暗刻 2）', () => {
  const r = tai({ ...base, tiles: h3, win: 14 });
  assert(names(r).includes('三暗刻'), names(r)); assert.strictEqual(r.sum, 3, names(r));
});
t('放槍胡的牌湊成刻子：只剩 2 組暗刻，不算三暗刻', () => {
  const r = tai({ ...base, tiles: h3, win: 0 }); // 胡 1萬：湊成 111 萬
  assert(!names(r).includes('三暗刻'), names(r)); assert.strictEqual(r.sum, 1, names(r));
});
t('同一手牌自摸 1萬：三組都是暗刻，三暗刻成立', () => {
  const r = tai({ ...base, tiles: h3, win: 0, self: true });
  assert(names(r).includes('三暗刻'), names(r));
});
t('暗槓算暗刻：2 組暗刻 + 1 組暗槓', () => {
  const r = tai({ ...base, tiles: P('444m777m456p789s99p'), win: 14, melds: [{ k: 'g', t: 0, open: false }] });
  assert(names(r).includes('三暗刻') && names(r).includes('門清'), names(r)); assert.strictEqual(r.sum, 3, names(r));
});
t('明槓、碰牌不算暗刻', () => {
  const r = tai({ ...base, tiles: P('444m777m456p789s99p'), win: 14, melds: [{ k: 'g', t: 0, open: true }] });
  assert(!names(r).includes('三暗刻'), names(r));
});
t('其餘面子靠吃碰完成也成立（3 組暗刻 + 兩組吃牌）', () => {
  const m = [{ k: 'c', t: 14, open: true, tiles: [14, 15, 16] }, { k: 'c', t: 20, open: true, tiles: [20, 21, 22] }];
  const r = tai({ ...base, tiles: P('111m444m777m99p'), win: 17, melds: m }); // 單吊 9筒，放槍
  assert(names(r).includes('三暗刻') && names(r).includes('獨聽'), names(r)); assert.strictEqual(r.sum, 3, names(r));
});
t('雙碰聽牌：放槍是三暗刻＋碰碰胡，自摸是四暗刻＋碰碰胡', () => {
  const m = [{ k: 'p', t: 24, open: true }], hand = P('111m444m777m222p55p');
  const ron = tai({ ...base, tiles: hand, win: 10, melds: m }); // 胡 2筒（別人打出）
  assert(names(ron).includes('三暗刻') && names(ron).includes('碰碰胡') && !names(ron).includes('四暗刻'), names(ron));
  assert.strictEqual(ron.sum, 6, names(ron));
  const self = tai({ ...base, tiles: hand, win: 10, melds: m, self: true });
  assert(names(self).includes('四暗刻') && !names(self).includes('三暗刻'), names(self));
  assert.strictEqual(self.sum, 10, names(self));
});
t('四暗刻、五暗刻成立時不另計三暗刻', () => {
  const four = tai({ ...base, self: true, tiles: P('111m222m333p44s'), win: 21, melds: [{ k: 'g', t: 30, open: false }, { k: 'c', t: 20, open: true, tiles: [20, 21, 22] }] });
  assert(names(four).includes('四暗刻') && !names(four).includes('三暗刻'), names(four));
  const five = tai({ ...base, self: true, tiles: P('111m222m333m444p555p66s'), win: 22 });
  assert(names(five).includes('五暗刻') && !names(five).includes('四暗刻') && !names(five).includes('三暗刻'), names(five));
});
t('胡的牌也能算在順子裡：同一張牌的刻子仍是暗刻', () => {
  // 345萬 + 555萬（共 4 張五萬）：放槍胡 5萬 可以當成順子的一張，555 仍是暗刻
  const r = tai({ ...base, tiles: P('345m555m111p222p99s'), win: 4, melds: [{ k: 'c', t: 24, open: true, tiles: [24, 25, 26] }] });
  assert(names(r).includes('三暗刻'), names(r));
});
t('先前的附圖：111萬靠放槍湊成、666萬是碰的，只剩中中中 1 組暗刻，不算三暗刻', () => {
  const m = [{ k: 'p', t: 5, open: true }, { k: 'c', t: 5, open: true, tiles: [6, 5, 7] }, { k: 'p', t: 25, open: true }];
  const r = tai({ ...base, tiles: [0, 0, 0, 12, 12, 31, 31, 31], win: 0, melds: m });
  assert(!names(r).includes('三暗刻'), names(r)); assert.strictEqual(r.sum, 1, names(r));
});

console.log(n + ' tests passed');