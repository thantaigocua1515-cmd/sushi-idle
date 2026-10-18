/* test/sim.test.js — Test sim.js (mô hình THÁP) bằng node, không cần browser.
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
function close(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error(msg + ' (got ' + a + ', want ~' + b + ')');
}
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
  ['coins', 'gems', 't'].forEach(function (k) { finite(s[k], 'state.' + k); });
  ok(s.coins >= 0, 'coins âm');
  ok(Array.isArray(s.floors) && s.floors.length >= 1, 'floors hợp lệ');
  s.floors.forEach(function (f, i) {
    ok(f.level >= 0 && f.level <= CFG.MAX_FLOOR_LEVEL, 'floors[' + i + '].level trong biên');
  });
}

console.log('== sim tests (tower) ==');

// 1. game mới hợp lệ
t('new game: 1 tầng level 0', function () {
  var s = SIM.createGame(7);
  eq(s.v, 2, 'v=2');
  eq(s.floors.length, 1, '1 tầng');
  eq(s.floors[0].level, 0, 'level 0');
  eq(s.coins, CFG.START_COINS, 'coins');
  var ds = SIM.dishesUnlocked(s);
  eq(ds.length, 1, '1 món'); eq(ds[0], 'nigiri', 'nigiri');
});

// 2. tick 60s: thu nhập passive, không NaN
t('tick 60s: thu nhập passive', function () {
  var s = SIM.createGame(7);
  var c0 = s.coins;
  runTicks(s, 60);
  noNaN(s);
  ok(s.coins > c0, 'coins tăng, got ' + s.coins);
  ok(s.stats.earned > 0, 'earned > 0');
  ok(s.stats.incomePerSec > 0, 'incomePerSec > 0, got ' + s.stats.incomePerSec);
});

// 3. thu nhập nhiều tầng = tổng các tầng
t('thu nhập nhiều tầng cộng dồn', function () {
  var s = SIM.createGame(1);
  s.coins = 1e9;
  var i1 = SIM.totalIncome(s);
  ok(SIM.addFloor(s).ok, 'thêm tầng 2');
  ok(SIM.upgradeFloor(s, 1, 'x1').ok, 'nâng tầng 2 lên lv1');
  var i2 = SIM.totalIncome(s);
  ok(i2 > i1, 'thu nhập tăng: ' + i1.toFixed(1) + ' -> ' + i2.toFixed(1));
  // kiểm tra công thức 1 tầng: 8*(lvl+1)^1.4 * mults
  var s2 = SIM.createGame(1);
  s2.floors = [{ level: 5 }];
  var got = SIM.floorIncome(s2, 0);
  var mult = (1 + 0.10 * 1) * (1 + 0.06 * 0) * 1 * (12 / 12);
  close(got, 8 * Math.pow(6, 1.4) * mult, 0.01, 'công thức thu nhập tầng');
});

// 4. giá thêm tầng theo curve 3.2^n
t('addFloor: giá + giới hạn', function () {
  eq(CFG.addFloorCost(1), 500, 'tầng 2 = 500');
  eq(CFG.addFloorCost(2), 1600, 'tầng 3 = 1600');
  var s = SIM.createGame(1); s.coins = 10;
  var r = SIM.addFloor(s);
  ok(!r.ok && r.reason === 'coins', 'thiếu tiền fail');
  eq(s.floors.length, 1, 'không thêm tầng');
  s.coins = 1e12;
  for (var i = 0; i < 7; i++) ok(SIM.addFloor(s).ok, 'thêm tầng ' + (i + 2));
  eq(s.floors.length, 8, 'tối đa 8 tầng');
  var r2 = SIM.addFloor(s);
  ok(!r2.ok && r2.reason === 'max', 'vượt max fail');
  var ds = SIM.dishesUnlocked(s);
  ok(ds.indexOf('dragon') >= 0, '8 tầng mở dragon roll');
});

// 5. nâng tầng x1/x10/MAX đúng tổng giá
t('upgradeFloor x1/x10/MAX', function () {
  var s = SIM.createGame(1); s.coins = 1e9;
  // x1: level 0 -> 1, giá 120
  var r1 = SIM.upgradeFloor(s, 0, 'x1');
  ok(r1.ok && r1.levels === 1, 'x1 ok');
  eq(r1.cost, CFG.upgradeFloorCost(0), 'giá x1 = 120, got ' + r1.cost);
  eq(s.floors[0].level, 1, 'level=1');
  // x10 từ level 1: tối đa lên 10 (cap), giá = tổng curve
  var r10 = SIM.upgradeFloor(s, 0, 'x10');
  ok(r10.ok, 'x10 ok');
  eq(s.floors[0].level, 10, 'level=10 (cap)');
  var want = CFG.bulkUpgradeCost(1, 9);
  eq(r10.cost, want, 'tổng giá x10 đúng, got ' + r10.cost + ' want ' + want);
  var rMax = SIM.upgradeFloor(s, 0, 'x1');
  ok(!rMax.ok && rMax.reason === 'max', 'đã max thì fail');
  // MAX với ít tiền: chỉ mua được vài level
  var s2 = SIM.createGame(1); s2.coins = 500;
  var rm = SIM.upgradeFloor(s2, 0, 'max');
  ok(rm.ok, 'max ok');
  var n = CFG.maxAffordableLevels(0, 500);
  eq(rm.levels, n, 'số level đúng, got ' + rm.levels + ' want ' + n);
  eq(s2.floors[0].level, n, 'level đúng');
  eq(rm.cost, CFG.bulkUpgradeCost(0, n), 'tổng giá đúng');
  // thiếu tiền hẳn
  var s3 = SIM.createGame(1); s3.coins = 10;
  var r3 = SIM.upgradeFloor(s3, 0, 'x1');
  ok(!r3.ok && r3.reason === 'coins', 'thiếu tiền fail');
});

// 6. tap đầu bếp từng tầng: buff riêng + cooldown riêng
t('tapChefFloor: buff từng tầng', function () {
  var s = SIM.createGame(1); s.coins = 1e9;
  SIM.addFloor(s);
  runTicks(s, 2);
  ok(SIM.tapChefFloor(s, 0).ok, 'tap tầng 1 ok');
  ok(SIM.tapChefFloor(s, 1).ok, 'tap tầng 2 ok (cooldown riêng)');
  ok(!SIM.tapChefFloor(s, 0).ok, 'tap lại tầng 1 bị cooldown');
  var i0 = SIM.floorIncome(s, 0), i1 = SIM.floorIncome(s, 1);
  // cả 2 tầng đều x2 so với lúc không buff: so với tầng không buff không có -> kiểm tra tỉ lệ
  ok(i0 > 0 && i1 > 0, 'thu nhập > 0 khi buff');
  runTicks(s, 70); // hết buff (10s) + cooldown (60s)
  ok(SIM.tapChefFloor(s, 0).ok, 'hết cooldown tap lại được');
  ok(!SIM.tapChefFloor(s, 9).ok, 'tầng không tồn tại fail');
});

// 7. nút BOOST toàn tháp
t('tapBoost: x2 toàn tháp 30s, cd 5 phút', function () {
  var s = SIM.createGame(1);
  runTicks(s, 2);
  var before = SIM.totalIncome(s);
  ok(SIM.tapBoost(s).ok, 'boost ok');
  var after = SIM.totalIncome(s);
  close(after / before, 2, 0.001, 'thu nhập x2');
  ok(!SIM.tapBoost(s).ok, 'đang cooldown fail');
  runTicks(s, 310);
  ok(SIM.tapBoost(s).ok, 'hết 5 phút boost lại được');
});

// 8. drive-thru: cần plot + 3 tầng
t('drive-thru cần 3 tầng', function () {
  var s = SIM.createGame(3);
  s.coins = 1e9;
  // 1 tầng: mua plot được? reqFloor=3 -> fail
  var r = SIM.buyPlot(s, 'drivethru');
  ok(!r.ok && r.reason === 'reqFloor', '1 tầng không mua được drive-thru');
  SIM.addFloor(s); SIM.addFloor(s);
  ok(SIM.buyPlot(s, 'drivethru').ok, '3 tầng mua được');
  s.carTimer = 0.01;
  runTicks(s, 2);
  ok(!!s.car, 'xe spawn');
  var rw = s.car.reward; ok(rw > 0, 'reward > 0');
  var c0 = s.coins;
  ok(SIM.collectCar(s).ok, 'collect ok');
  eq(s.coins, c0 + rw, 'coins tăng đúng');
});

// 9. milestone theo tổng coin kiếm được
t('milestone earn1k tặng gem', function () {
  var s = SIM.createGame(5);
  s.stats.earned = 999;
  s.coins = 1e9;
  s.floors = [{ level: 10 }];
  runTicks(s, 5);
  ok(s.stats.earned >= 1000, 'earned >= 1000');
  ok(s.gems >= 5, 'được tặng 5 gem, got ' + s.gems);
});

// 10. save/load v2 roundtrip
t('save/load v2 giữ nguyên', function () {
  var st = memStorage();
  var s = SIM.createGame(9);
  s.coins = 1e9;
  SIM.addFloor(s); SIM.addFloor(s);
  SIM.upgradeFloor(s, 0, 'x10');
  SIM.tapBoost(s);
  ok(SIM.save(s, st, 1000000), 'save ok');
  var r = SIM.load(st, 1000000 + 30000);
  ok(!!r.state, 'load được');
  eq(r.state.floors.length, 3, '3 tầng');
  eq(r.state.floors[0].level, s.floors[0].level, 'level tầng 1 giữ nguyên');
  eq(r.offline, null, '30s không offline');
  noNaN(r.state);
});

// 11. migration save v1 -> v2
t('migration v1: {floor:n} -> floors=[{level:n}]', function () {
  var st = memStorage();
  // giả lập save v1
  st.setItem(CFG.SAVE_KEY_V1, JSON.stringify({
    v: 1, seed: 42, t: 1000, coins: 5000, gems: 7, floor: 4,
    staff: { chef: 3, waiter: 1, cashier: 0, delivery: 0 },
    plots: { garden: 1 }, dishes: ['nigiri', 'maki'],
    stats: { earned: 9999, served: 50, lost: 2 },
    settings: { music: false, sound: true },
    lastSeen: 2000,
  }));
  var r = SIM.load(st, 2000 + 30000); // 30s sau -> không offline
  ok(!!r.state, 'migrate được');
  eq(r.state.v, 2, 'v=2');
  eq(r.state.floors.length, 1, '1 tầng');
  eq(r.state.floors[0].level, 4, 'level=4 từ floor cũ');
  eq(Math.floor(r.state.coins), 5000, 'coins giữ');
  eq(r.state.gems, 7, 'gems giữ');
  eq(r.state.staff.chef, 3, 'staff giữ');
  ok(r.state.plots.garden === 1, 'plots giữ');
  eq(r.state.settings.music, false, 'settings giữ');
  noNaN(r.state);
});

// 12. offline 10h -> cap 8h
t('offline cap 8h', function () {
  var st = memStorage();
  var s = SIM.createGame(11);
  s.floors = [{ level: 5 }];
  var ips = SIM.totalIncome(s);
  ok(SIM.save(s, st, 1000), 'save');
  var r = SIM.load(st, 1000 + 10 * 3600 * 1000);
  ok(!!r.offline, 'có offline');
  var want = Math.floor(ips * 8 * 3600 * 0.5);
  var got = r.offline.earned;
  ok(Math.abs(got - want) <= Math.max(2, want * 0.02), 'earned ~ cap 8h, got ' + got + ' want ' + want);
});

// 13. load hỏng -> null
t('load hỏng -> null', function () {
  var st = memStorage();
  st.setItem(CFG.SAVE_KEY, 'not-json{{{');
  var r = SIM.load(st, 999);
  ok(r.state === null, 'state null');
});

// 14. staff cost + hire với reqFloor = số tầng
t('hireStaff: reqFloor theo số tầng', function () {
  var s = SIM.createGame(1); s.coins = 1e9;
  var r = SIM.hireStaff(s, 'delivery');
  ok(!r.ok && r.reason === 'reqFloor', 'delivery cần 3 tầng');
  SIM.addFloor(s); SIM.addFloor(s);
  ok(SIM.hireStaff(s, 'delivery').ok, '3 tầng thuê được');
  eq(CFG.staffCost('chef', 0), CFG.STAFF.chef.hire, 'giá thuê');
});

// 15. bulk MAX không vượt level cap dù nhiều tiền
t('MAX không vượt Lv.10', function () {
  var s = SIM.createGame(1); s.coins = 1e15;
  var r = SIM.upgradeFloor(s, 0, 'max');
  ok(r.ok, 'ok');
  eq(s.floors[0].level, 10, 'dừng ở Lv.10');
  eq(r.levels, 10, 'mua đúng 10 level');
});

console.log('\n' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
