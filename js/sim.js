/* js/sim.js — Mô phỏng game Sushi Idle.
 * ZERO DOM/browser API: chạy được trong browser lẫn node (để test).
 *  - state là plain JSON (lưu localStorage / gửi mạng đều được)
 *  - rng và thời gian inject từ ngoài -> dễ test, không random ma
 *  - render KHÔNG BAO GIỜ sửa state; mọi thay đổi qua stepGame/actions
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./config.js'));
  } else {
    root.SushiSim = factory(root.SushiConfig);
  }
}(typeof self !== 'undefined' ? self : this, function (CFG) {

  var PATIENCE = 60;      // giây khách chịu đợi món
  var EAT_BASE = 6;       // giây ăn cơ bản
  var SERVE_BASE = 3;     // giây bưng món cơ bản
  var WALK_SPEED = 0.45;  // tốc độ đi (fraction/giây)

  // RNG deterministic (mulberry32)
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var CUSTOMER_COLORS = ['#ff8a80', '#82b1ff', '#b9f6ca', '#fff59d', '#ce93d8', '#ffcc80', '#80deea'];

  function createGame(seed) {
    return {
      v: 1, seed: seed >>> 0 || 1, t: 0,
      coins: CFG.START_COINS, gems: 0,
      floor: 1,
      staff: { chef: 1, waiter: 0, cashier: 0, delivery: 0 },
      dishes: ['nigiri'],
      plots: {},
      customers: [],
      queue: [],        // order đang chờ nấu: {dish, custId}
      cooking: null,    // {dish, t, total, custId}
      car: null,        // {x, reward, collected}
      carTimer: 25,
      spawnTimer: 1.5,
      buffs: { cookUntil: 0, cookCdUntil: 0 },
      stats: { served: 0, earned: 0, incomePerSec: 0, lost: 0 },
      gemsClaimed: {},
      settings: { music: true, sound: true },
      fx: [],           // sự kiện cho render (coin bay, popup...) — render drain
      nextId: 1,
      lastSeen: 0,
    };
  }

  // --- helpers tính toán ---
  function floorDef(s) { return CFG.FLOORS[s.floor]; }
  function tables(s) { return floorDef(s).tables; }
  function floorMult(s) { return floorDef(s).mult; }
  function hasPlot(s, id) { return !!s.plots[id]; }

  function chefEff(s)  { var l = s.staff.chef;     return l <= 0 ? 0.6 : CFG.cookMult(l); }
  function waiterEff(s){ var l = s.staff.waiter;   return l <= 0 ? 0.6 : CFG.serveMult(l); }
  function cashierTip(s){
    var m = s.staff.cashier <= 0 ? 1 : CFG.tipMult(s.staff.cashier);
    return hasPlot(s, 'tower') ? m * 1.25 : m;
  }
  function cookTime(s, dish) {
    var t = CFG.DISHES[dish].cook / chefEff(s);
    if (hasPlot(s, 'fishmarket')) t *= 0.85;
    if (s.t / 1000 < s.buffs.cookUntil) t *= 0.5; // boost tap đầu bếp / gem
    return t;
  }
  function serveTime(s) { return SERVE_BASE / waiterEff(s); }

  function dishPrice(s, dish) {
    var p = CFG.DISHES[dish].price * floorMult(s);
    if (hasPlot(s, 'garden')) p *= 1.12;
    return p;
  }
  function avgDishPrice(s) {
    var sum = 0;
    for (var i = 0; i < s.dishes.length; i++) sum += dishPrice(s, s.dishes[i]);
    return s.dishes.length ? sum / s.dishes.length : 10;
  }
  // ước lượng thu nhập/giây (dùng tính offline)
  function estimateIncomePerSec(s) {
    var tb = tables(s);
    if (!tb) return 0;
    var cycle = CFG.spawnInterval(s.floor) + 10;
    return (tb / cycle) * avgDishPrice(s) * 1.1;
  }

  function stoolX(s, i) {
    var n = tables(s);
    if (n <= 1) return 0.5;
    return 0.14 + 0.72 * (i / (n - 1));
  }
  function freeStool(s) {
    var n = tables(s);
    var used = {};
    for (var i = 0; i < s.customers.length; i++) {
      var c = s.customers[i];
      if (c.phase !== 'leaving') used[c.stool] = 1;
    }
    for (var k = 0; k < n; k++) if (!used[k]) return k;
    return -1;
  }
  function pickDish(s, rng) {
    // ưu tiên món đắt hơn một chút (khách thích món xịn)
    var ds = s.dishes, w = 0, ws = [];
    for (var i = 0; i < ds.length; i++) {
      var ww = 1 + CFG.DISHES[ds[i]].price / 120;
      ws.push(ww); w += ww;
    }
    var r = rng() * w;
    for (var j = 0; j < ds.length; j++) { r -= ws[j]; if (r <= 0) return ds[j]; }
    return ds[ds.length - 1];
  }

  function pushFx(s, e) { s.fx.push(e); }
  function drainFx(s) { var f = s.fx; s.fx = []; return f; }

  function checkMilestones(s) {
    for (var i = 0; i < CFG.MILESTONES.length; i++) {
      var m = CFG.MILESTONES[i];
      if (s.gemsClaimed[m.id]) continue;
      var need = parseInt(m.id.replace('serve', ''), 10);
      if (s.stats.served >= need) {
        s.gemsClaimed[m.id] = 1;
        s.gems += m.gems;
        pushFx(s, { t: 'gem', x: 0.5, y: 0.35, amount: m.gems, label: m.desc });
      }
    }
  }

  // --- tick chính ---
  function stepGame(s, dtMs, rng) {
    var dt = Math.max(0, dtMs) / 1000;
    if (dt <= 0) return s;
    s.t += dtMs;
    var earned0 = s.stats.earned;

    // 1) spawn khách
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      s.spawnTimer = CFG.spawnInterval(s.floor) * (0.7 + 0.6 * rng());
      var stool = freeStool(s);
      if (stool >= 0 && tables(s) > 0) {
        s.customers.push({
          id: s.nextId++, stool: stool, x: -0.12, tx: stoolX(s, stool),
          phase: 'arriving', t: 0, dish: null, price: 0,
          color: CUSTOMER_COLORS[(rng() * CUSTOMER_COLORS.length) | 0],
          angry: false,
        });
      }
    }

    // 2) nấu ăn (1 bếp)
    if (!s.cooking && s.queue.length) {
      var o = s.queue.shift();
      var total = cookTime(s, o.dish);
      s.cooking = { dish: o.dish, t: total, total: total, custId: o.custId };
    }
    if (s.cooking) {
      s.cooking.t -= dt;
      if (s.cooking.t <= 0) {
        var cust = byId(s, s.cooking.custId);
        if (cust && cust.phase === 'waiting') {
          cust.phase = 'beingServed';
          cust.t = serveTime(s);
        }
        s.cooking = null;
      }
    }

    // 3) khách
    for (var i = s.customers.length - 1; i >= 0; i--) {
      var c = s.customers[i];
      if (c.phase === 'arriving') {
        c.x += WALK_SPEED * dt * (c.tx > c.x ? 1 : -1);
        if (Math.abs(c.x - c.tx) < 0.02) { c.x = c.tx; c.phase = 'ordering'; c.t = 1.0; }
      } else if (c.phase === 'ordering') {
        c.t -= dt;
        if (c.t <= 0) {
          c.dish = pickDish(s, rng);
          s.queue.push({ dish: c.dish, custId: c.id });
          c.phase = 'waiting'; c.t = PATIENCE;
        }
      } else if (c.phase === 'waiting') {
        c.t -= dt;
        if (c.t <= 0) { c.phase = 'leaving'; c.angry = true; s.stats.lost++; }
      } else if (c.phase === 'beingServed') {
        c.t -= dt;
        if (c.t <= 0) { c.phase = 'eating'; c.t = EAT_BASE * (0.8 + 0.4 * rng()); }
      } else if (c.phase === 'eating') {
        c.t -= dt;
        if (c.t <= 0) {
          var base = dishPrice(s, c.dish);
          var tip = base * 0.15 * cashierTip(s);
          var total = Math.round(base + tip);
          s.coins += total;
          s.stats.earned += total;
          s.stats.served++;
          pushFx(s, { t: 'coin', x: c.x, y: 0.62, amount: total });
          checkMilestones(s);
          c.phase = 'leaving';
        }
      } else if (c.phase === 'leaving') {
        c.x += 0.55 * dt;
        if (c.x > 1.18) s.customers.splice(i, 1);
      }
    }

    // 4) drive-thru
    if (hasPlot(s, 'drivethru') && s.floor >= 4) {
      if (!s.car) {
        s.carTimer -= dt;
        if (s.carTimer <= 0) {
          var rw = Math.round(avgDishPrice(s) * 12 * floorMult(s) * CFG.carRewardMult(s.staff.delivery));
          s.car = { x: 1.25, reward: rw, collected: false };
          s.carTimer = CFG.carInterval(s.staff.delivery) * (0.8 + 0.4 * rng());
        }
      } else {
        s.car.x -= 0.22 * dt;
        if (s.car.x < -0.35) {
          if (!s.car.collected) {
            s.coins += s.car.reward;
            s.stats.earned += s.car.reward;
            pushFx(s, { t: 'coin', x: 0.5, y: 0.82, amount: s.car.reward, big: true });
          }
          s.car = null;
        }
      }
    }

    // 5) EMA thu nhập/giây
    var inst = (s.stats.earned - earned0) / dt;
    s.stats.incomePerSec = s.stats.incomePerSec * 0.96 + inst * 0.04;

    return s;
  }

  function byId(s, id) {
    for (var i = 0; i < s.customers.length; i++)
      if (s.customers[i].id === id) return s.customers[i];
    return null;
  }

  // --- actions (UI gọi) ---
  function ok() { return { ok: true }; }
  function fail(reason) { return { ok: false, reason: reason }; }

  function buyFloor(s) {
    if (s.floor >= CFG.MAX_FLOOR) return fail('max');
    var next = s.floor + 1, cost = CFG.FLOORS[next].cost;
    if (s.coins < cost) return fail('coins');
    s.coins -= cost; s.floor = next;
    var dish = CFG.FLOORS[next].dish;
    if (dish && s.dishes.indexOf(dish) < 0) s.dishes.push(dish);
    s.gems += 2;
    pushFx(s, { t: 'gem', x: 0.5, y: 0.3, amount: 2, label: 'Lên tầng ' + next + '!' });
    pushFx(s, { t: 'floorup', floor: next });
    return ok();
  }

  function hireStaff(s, kind) {
    var def = CFG.STAFF[kind];
    if (!def) return fail('kind');
    var lvl = s.staff[kind];
    if (lvl >= def.max) return fail('max');
    if (def.reqFloor && s.floor < def.reqFloor) return fail('reqFloor');
    var cost = CFG.staffCost(kind, lvl);
    if (s.coins < cost) return fail('coins');
    s.coins -= cost; s.staff[kind] = lvl + 1;
    pushFx(s, { t: 'hire', kind: kind, lvl: lvl + 1 });
    return ok();
  }

  function buyPlot(s, id) {
    var def = null;
    for (var i = 0; i < CFG.PLOTS.length; i++)
      if (CFG.PLOTS[i].id === id) def = CFG.PLOTS[i];
    if (!def) return fail('kind');
    if (hasPlot(s, id)) return fail('owned');
    if (s.floor < def.reqFloor) return fail('reqFloor');
    if (s.coins < def.cost) return fail('coins');
    s.coins -= def.cost;
    s.plots[id] = 1;
    s.gems += 3;
    pushFx(s, { t: 'gem', x: 0.5, y: 0.4, amount: 3, label: 'Mở ' + def.name + '!' });
    return ok();
  }

  function tapChef(s) {
    var now = s.t / 1000;
    if (now < s.buffs.cookCdUntil) return fail('cooldown');
    s.buffs.cookUntil = now + CFG.CHEF_BOOST_DUR;
    s.buffs.cookCdUntil = now + CFG.CHEF_BOOST_CD;
    pushFx(s, { t: 'boost', x: 0.78, y: 0.3, label: 'Nấu x2!' });
    return ok();
  }

  function collectCar(s) {
    if (!s.car || s.car.collected) return fail('none');
    s.car.collected = true;
    s.coins += s.car.reward;
    s.stats.earned += s.car.reward;
    pushFx(s, { t: 'coin', x: s.car.x, y: 0.82, amount: s.car.reward, big: true });
    return ok();
  }

  function buyBoost(s) { // 5 gem = nấu x2 trong 5 phút
    if (s.gems < 5) return fail('gems');
    s.gems -= 5;
    s.buffs.cookUntil = s.t / 1000 + 300;
    pushFx(s, { t: 'boost', x: 0.5, y: 0.3, label: 'Siêu bếp 5 phút!' });
    return ok();
  }

  function tapCoin(s, v) { // nhặt coin bay: cộng thưởng thêm
    v = Math.max(0, Math.floor(v) || 0);
    s.coins += v; s.stats.earned += v;
    return s.coins;
  }

  function toggleSetting(s, k) {
    if (s.settings[k] === undefined) return s.settings;
    s.settings[k] = !s.settings[k];
    return s.settings;
  }

  // --- save/load ---
  function save(s, storage, nowMs) {
    try {
      var c = JSON.parse(JSON.stringify(s));
      c.fx = [];
      c.lastSeen = nowMs;
      storage.setItem(CFG.SAVE_KEY, JSON.stringify(c));
      return true;
    } catch (e) { return false; }
  }

  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }

  function sanitize(loaded) {
    var s = createGame(num(loaded.seed, 1));
    s.t = num(loaded.t, 0);
    s.coins = Math.max(0, num(loaded.coins, CFG.START_COINS));
    s.gems = Math.max(0, num(loaded.gems, 0));
    s.floor = Math.min(CFG.MAX_FLOOR, Math.max(1, num(loaded.floor, 1) | 0));
    if (loaded.staff) for (var k in s.staff)
      if (loaded.staff[k] !== undefined)
        s.staff[k] = Math.max(0, Math.min(CFG.STAFF[k].max, num(loaded.staff[k], 0) | 0));
    if (Array.isArray(loaded.dishes))
      s.dishes = loaded.dishes.filter(function (d) { return CFG.DISHES[d]; });
    if (!s.dishes.length) s.dishes = ['nigiri'];
    if (loaded.plots) for (var p in loaded.plots) s.plots[p] = 1;
    if (Array.isArray(loaded.customers)) s.customers = loaded.customers.slice(0, 12);
    if (Array.isArray(loaded.queue)) s.queue = loaded.queue.slice(0, 12);
    s.cooking = loaded.cooking && CFG.DISHES[loaded.cooking.dish] ? loaded.cooking : null;
    s.carTimer = num(loaded.carTimer, 25);
    s.spawnTimer = num(loaded.spawnTimer, 2);
    if (loaded.buffs) {
      s.buffs.cookUntil = num(loaded.buffs.cookUntil, 0);
      s.buffs.cookCdUntil = num(loaded.buffs.cookCdUntil, 0);
    }
    if (loaded.stats) {
      s.stats.served = Math.max(0, num(loaded.stats.served, 0) | 0);
      s.stats.earned = Math.max(0, num(loaded.stats.earned, 0));
      s.stats.lost = Math.max(0, num(loaded.stats.lost, 0) | 0);
      s.stats.incomePerSec = Math.max(0, num(loaded.stats.incomePerSec, 0));
    }
    if (loaded.gemsClaimed) s.gemsClaimed = loaded.gemsClaimed;
    if (loaded.settings) for (var sk in s.settings)
      if (typeof loaded.settings[sk] === 'boolean') s.settings[sk] = loaded.settings[sk];
    s.nextId = Math.max(1, num(loaded.nextId, 1) | 0);
    s.fx = [];
    return s;
  }

  function load(storage, nowMs) {
    var raw = null;
    try { raw = storage.getItem(CFG.SAVE_KEY); } catch (e) { /* ignore */ }
    if (!raw) return { state: null, offline: null };
    var parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { return { state: null, offline: null }; }
    var s = sanitize(parsed || {});
    var offline = null;
    var lastSeen = num(parsed.lastSeen, 0);
    var away = nowMs - lastSeen;
    if (lastSeen > 0 && away > 60 * 1000) {
      var eff = hasPlot(s, 'warehouse') ? 0.75 : CFG.OFFLINE_EFF;
      var ips = Math.max(s.stats.incomePerSec, estimateIncomePerSec(s));
      var earned = ips * Math.min(away, CFG.OFFLINE_CAP_MS) / 1000 * eff;
      earned = Math.floor(earned);
      if (earned > 0) {
        s.coins += earned;
        s.stats.earned += earned;
        offline = { awayMs: away, earned: earned };
      } else {
        offline = { awayMs: away, earned: 0 };
      }
    }
    return { state: s, offline: offline };
  }

  return {
    makeRng: makeRng, createGame: createGame, stepGame: stepGame,
    drainFx: drainFx, estimateIncomePerSec: estimateIncomePerSec,
    buyFloor: buyFloor, hireStaff: hireStaff, buyPlot: buyPlot,
    tapChef: tapChef, collectCar: collectCar, buyBoost: buyBoost,
    tapCoin: tapCoin, toggleSetting: toggleSetting,
    save: save, load: load, sanitize: sanitize,
    // expose để test
    _cookTime: cookTime, _dishPrice: dishPrice, _stoolX: stoolX,
  };
}));
