/* test/sim.test.js — Test sim.js bằng node, không cần browser.
 * Chạy: node test/sim.test.js
 */
var CFG = require('../js/config.js');
var SIM = require('../js/sim.js');

var pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  PASS ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(msg + ' (got ' + a + ', want ' + b + ')'); }
function ok(v, msg) { if (!v) throw new Error(msg); }
function finite(n, msg) { if (!isFinite(n)) throw new Error(msg + ' is not finite: ' + n); }

function memStorage() {
  var d = {};
  return {
    setItem: function (k, v) { d[k] = String(v); },
    getItem: function (k) { return k in d ? d[k] : null; },
  };
}
function runTicks(s, secs, seed) {
  var rng = SIM.makeRng(seed || 42);
  var steps = Math.ceil(secs * 10);
  for (var i = 0; i < steps; i++) SIM.stepGame(s, 100, rng);
  return s;
}
function noNaN(s) {
  ['coins', 'gems', 'floor', 't'].forEach(function (k) { finite(s[k], 'state.' + k); });
  ok(s.coins >= 0, 'coins âm');
  s.customers.forEach(function (c) { finite(c.x, 'customer.x'); finite(c.t, 'customer.t'); });
}

console.log('== sim tests ==');

// 1. game mới hợp lệ
t('new game hợp lệ', function () {
  var s = SIM.createGame(7);
  eq(s.floor, 1, 'floor'); eq(s.coins, CFG.START_COINS, 'coins');
  ok(s.dishes.indexOf('nigiri') >= 0, 'có nigiri');
  eq(s.staff.chef, 1, 'chef lv1');
});

// 2. chạy 5 phút: khách đến, nấu, thu tiền, không NaN/âm
t('tick 300s: economy chạy', function () {
  var s = SIM.createGame(7);
  runTicks(s, 300);
  noNaN(s);
  ok(s.stats.served > 0, 'phục vụ được khách, got ' + s.stats.served);
  ok(s.stats.earned > 0, 'kiếm được tiền');
  ok(s.coins >= 0, 'coins >= 0');
});

// 3. nâng tầng
t('buyFloor: tầng 1->2', function () {
  var s = SIM.createGame(1);
  s.coins = 100000;
  var gems0 = s.gems;
  var r = SIM.buyFloor(s);
  ok(r.ok, 'mua được'); eq(s.floor, 2, 'floor=2');
  ok(s.dishes.indexOf('maki') >= 0, 'mở món maki');
  ok(s.gems === gems0 + 2, 'thưởng 2 gem');
  var r2 = SIM.buyFloor(s); // thiếu tiền? vẫn còn nhiều -> ok; test thiếu tiền riêng
  ok(r2.ok, 'mua tiếp được');
});
t('buyFloor: thiếu tiền thì fail', function () {
  var s = SIM.createGame(1); s.coins = 10;
  var r = SIM.buyFloor(s);
  ok(!r.ok && r.reason === 'coins', 'fail vì coins');
  eq(s.floor, 1, 'floor không đổi');
});
t('buyFloor: max tầng', function () {
  var s = SIM.createGame(1); s.floor = 10; s.coins = 1e9;
  var r = SIM.buyFloor(s);
  ok(!r.ok && r.reason === 'max', 'fail vì max');
});

// 4. nhân sự: cost curve 1.7^lvl
t('staff cost curve', function () {
  eq(CFG.staffCost('chef', 0), CFG.STAFF.chef.hire, 'giá thuê');
  var c1 = CFG.staffCost('chef', 1), c2 = CFG.staffCost('chef', 2);
  ok(c2 > c1, 'giá tăng dần');
  ok(Math.abs(c2 / c1 - 1.7) < 0.05, 'tỉ lệ ~1.7, got ' + (c2 / c1));
  var s = SIM.createGame(1); s.coins = 1e9;
  ok(SIM.hireStaff(s, 'waiter').ok, 'thuê phục vụ');
  eq(s.staff.waiter, 1, 'waiter lv1');
  ok(SIM.hireStaff(s, 'delivery').ok === false, 'delivery cần tầng 4');
  s.floor = 4;
  ok(SIM.hireStaff(s, 'delivery').ok, 'tầng 4 thuê được delivery');
});

// 5. drive-thru: mua plot -> xe spawn -> collect
t('drive-thru plot + car', function () {
  var s = SIM.createGame(3);
  s.coins = 1e9; s.floor = 4;
  ok(SIM.buyPlot(s, 'drivethru').ok, 'mua plot drive-thru');
  ok(s.gems === 3, 'thưởng 3 gem');
  s.carTimer = 0.01;
  runTicks(s, 2);
  ok(!!s.car, 'xe đã spawn');
  var rw = s.car.reward;
  ok(rw > 0 && isFinite(rw), 'reward hợp lệ: ' + rw);
  var c0 = s.coins;
  ok(SIM.collectCar(s).ok, 'collect được');
  eq(s.coins, c0 + rw, 'coins tăng đúng reward');
  ok(!SIM.collectCar(s).ok, 'collect 2 lần thì fail');
});

// 6. tap chef boost + cooldown
t('tapChef boost/cooldown', function () {
  var s = SIM.createGame(1);
  runTicks(s, 5);
  ok(SIM.tapChef(s).ok, 'tap lần 1 ok');
  ok(!SIM.tapChef(s).ok, 'tap lần 2 bị cooldown');
  runTicks(s, 70); // hết cooldown
  ok(SIM.tapChef(s).ok, 'hết cooldown tap lại được');
});

// 7. save/load roundtrip
t('save/load giữ nguyên state', function () {
  var st = memStorage();
  var s = SIM.createGame(9);
  runTicks(s, 120);
  s.coins = 12345; s.floor = 3;
  ok(SIM.save(s, st, 1000000), 'save ok');
  var r = SIM.load(st, 1000000 + 30000); // 30s sau -> chưa tính offline
  ok(!!r.state, 'load được');
  eq(Math.floor(r.state.coins), 12345, 'coins giữ nguyên');
  eq(r.state.floor, 3, 'floor giữ nguyên');
  eq(r.offline, null, '30s không tính offline');
});

// 8. offline 10h -> cap 8h
t('offline earnings cap 8h', function () {
  var st = memStorage();
  var s = SIM.createGame(11);
  s.stats.incomePerSec = 10; // giả lập
  s.coins = 100;
  ok(SIM.save(s, st, 1000), 'save');
  var r = SIM.load(st, 1000 + 10 * 3600 * 1000); // 10h sau
  ok(!!r.offline, 'có offline');
  var want = Math.floor(10 * 8 * 3600 * 0.5); // 10 coin/s * 8h * 50%
  eq(r.offline.earned, want, 'earned đúng cap 8h');
  eq(Math.floor(r.state.coins), 100 + want, 'coins cộng đúng');
});

// 9. load file hỏng -> không crash
t('load hỏng -> null state', function () {
  var st = memStorage();
  st.setItem(CFG.SAVE_KEY, 'not-json{{{');
  var r = SIM.load(st, 999);
  ok(r.state === null, 'state null');
  var st2 = memStorage();
  var r2 = SIM.load(st2, 999);
  ok(r2.state === null, 'chưa có save -> null');
});

// 10. fmt số
t('fmt rút gọn', function () {
  eq(CFG.fmt(999), '999', '999');
  eq(CFG.fmt(1200), '1.2K', '1.2K');
  eq(CFG.fmt(1500000), '1.5M', '1.5M');
  eq(CFG.fmt(2500000000), '2.5B', '2.5B');
  eq(CFG.fmt(NaN), '0', 'NaN -> 0');
});

// 11. milestone gem khi phục vụ đủ khách
t('milestone serve25 tặng gem', function () {
  var s = SIM.createGame(5);
  s.stats.served = 24;
  s.coins = 1e9;
  // ép 1 khách thanh toán
  s.customers.push({ id: 99, stool: 0, x: 0.5, tx: 0.5, phase: 'eating', t: 0.05, dish: 'nigiri', price: 0, color: '#fff', angry: false });
  runTicks(s, 2, 5);
  ok(s.stats.served >= 25, 'served >= 25');
  ok(s.gems >= 5, 'được tặng gem milestone, got ' + s.gems);
});

// 12. khách hết kiên nhẫn bỏ đi (không crash, không tiền)
t('khách hết kiên nhẫn', function () {
  var s = SIM.createGame(1);
  s.staff.chef = 0; // nấu chậm
  s.queue.push({ dish: 'dragon', custId: 4242 }); // order ma, không có khách
  s.customers.push({ id: 7, stool: 0, x: 0.5, tx: 0.5, phase: 'waiting', t: 0.05, dish: 'nigiri', price: 0, color: '#fff', angry: false });
  var e0 = s.stats.earned;
  runTicks(s, 3, 8);
  var c7 = s.customers.filter(function (c) { return c.id === 7; })[0];
  ok(!c7 || c7.phase === 'leaving', 'khách id=7 bỏ đi');
  eq(s.stats.earned, e0, 'không thu được tiền');
  noNaN(s);
});

console.log('\n' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
