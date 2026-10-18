/* js/sim.js — Mô phỏng game Sushi Idle (mô hình THÁP DỌC).
 * ZERO DOM/browser API: chạy được trong browser lẫn node (để test).
 *  - state là plain JSON (lưu localStorage / gửi mạng đều được)
 *  - rng và thời gian inject từ ngoài -> dễ test, không random ma
 *  - render KHÔNG BAO GIỜ sửa state; mọi thay đổi qua stepGame/actions
 *
 * Kinh tế: mỗi tầng tháp tự sinh thu nhập passive (coin/giây).
 * Khách/đầu bếp nấu nướng là visual ở render, không nằm trong sim.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./config.js'));
  } else {
    root.SushiSim = factory(root.SushiConfig);
  }
}(typeof self !== 'undefined' ? self : this, function (CFG) {

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

  function createGame(seed) {
    return {
      v: 2, seed: seed >>> 0 || 1, t: 0,
      coins: CFG.START_COINS, gems: 0,
      floors: [{ level: 0 }],   // tầng tháp, index 0 = tầng 1 (dưới cùng)
      floorBuffUntil: {},       // idx -> giây (buff x2 khi tap đầu bếp từng tầng)
      floorCdUntil: {},         // idx -> giây (cooldown tap từng tầng)
      staff: { chef: 1, waiter: 0, cashier: 0, delivery: 0 },
      plots: {},
      car: null,                // {x, reward, collected}
      carTimer: 25,
      buffs: { towerUntil: 0, towerCdUntil: 0 }, // boost x2 toàn tháp
      stats: { earned: 0, incomePerSec: 0, lost: 0 },
      gemsClaimed: {},
      settings: { music: true, sound: true, vibra: true, volume: 0.8 },
      fx: [],                   // sự kiện cho render — render drain
      nextId: 1,
      lastSeen: 0,
    };
  }

  // --- helpers tính toán ---
  function hasPlot(s, id) { return !!s.plots[id]; }
  function towerCount(s) { return s.floors.length; }

  // Món đã mở theo số tầng tháp
  function dishesUnlocked(s) {
    var n = towerCount(s), out = [];
    for (var i = 0; i < CFG.DISH_IDS.length; i++) {
      var d = CFG.DISH_IDS[i];
      if ((CFG.DISH_UNLOCK_FLOORS[d] || 99) <= n) out.push(d);
    }
    return out.length ? out : ['nigiri'];
  }
  function avgDishPrice(s) {
    var ds = dishesUnlocked(s), sum = 0;
    for (var i = 0; i < ds.length; i++) sum += CFG.DISHES[ds[i]].price;
    return sum / ds.length;
  }
  function staffIncomeMult(s) {
    return (1 + 0.10 * s.staff.chef) * (1 + 0.06 * s.staff.waiter);
  }
  function cashierTip(s) {
    var m = s.staff.cashier <= 0 ? 1 : CFG.tipMult(s.staff.cashier);
    return hasPlot(s, 'tower') ? m * 1.25 : m;
  }
  function dishMult(s) { return avgDishPrice(s) / 12; }

  // Thu nhập 1 tầng (coin/giây)
  function floorIncome(s, i) {
    var f = s.floors[i];
    if (!f) return 0;
    var m = CFG.floorBaseIncome(f.level) * staffIncomeMult(s) * dishMult(s) * cashierTip(s);
    if (hasPlot(s, 'garden')) m *= 1.12;
    var now = s.t / 1000;
    if (now < s.buffs.towerUntil) m *= 2;
    if (now < (s.floorBuffUntil[i] || 0)) m *= 2;
    return m;
  }
  function totalIncome(s) {
    var t = 0;
    for (var i = 0; i < s.floors.length; i++) t += floorIncome(s, i);
    return t;
  }
  // ước lượng thu nhập/giây (dùng tính offline) = thu nhập hiện tại
  function estimateIncomePerSec(s) { return totalIncome(s); }

  function pushFx(s, e) { s.fx.push(e); }
  function drainFx(s) { var f = s.fx; s.fx = []; return f; }

  function checkMilestones(s) {
    for (var i = 0; i < CFG.MILESTONES.length; i++) {
      var m = CFG.MILESTONES[i];
      if (s.gemsClaimed[m.id]) continue;
      if (s.stats.earned >= m.need) {
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

    // 1) thu nhập passive các tầng
    var inc = totalIncome(s) * dt;
    if (inc > 0) {
      s.coins += inc;
      s.stats.earned += inc;
      checkMilestones(s);
    }

    // 2) drive-thru: cần plot + đủ tầng tháp
    if (hasPlot(s, 'drivethru') && towerCount(s) >= 3) {
      if (!s.car) {
        s.carTimer -= dt;
        if (s.carTimer <= 0) {
          var rw = Math.round(totalIncome(s) * 8 * CFG.carRewardMult(s.staff.delivery));
          s.car = { x: 1.25, reward: Math.max(20, rw), collected: false };
          s.carTimer = CFG.carInterval(s.staff.delivery) * (0.8 + 0.4 * rng());
        }
      } else {
        s.car.x -= 0.22 * dt;
        if (s.car.x < -0.35) {
          if (!s.car.collected) {
            s.coins += s.car.reward;
            s.stats.earned += s.car.reward;
            pushFx(s, { t: 'coin', x: 0.5, y: 0.82, amount: s.car.reward, big: true });
            checkMilestones(s);
          }
          s.car = null;
        }
      }
    }

    // 3) EMA thu nhập/giây
    var inst = inc / dt;
    s.stats.incomePerSec = s.stats.incomePerSec * 0.96 + inst * 0.04;

    return s;
  }

  // --- actions (UI gọi) ---
  function ok(extra) {
    var r = { ok: true };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  function fail(reason) { return { ok: false, reason: reason }; }

  // Xây thêm 1 tầng tháp
  function addFloor(s) {
    if (s.floors.length >= CFG.MAX_TOWER_FLOORS) return fail('max');
    var cost = CFG.addFloorCost(s.floors.length);
    if (s.coins < cost) return fail('coins');
    s.coins -= cost;
    s.floors.push({ level: 0 });
    s.gems += 2;
    pushFx(s, { t: 'gem', x: 0.5, y: 0.3, amount: 2, label: 'Thêm tầng ' + s.floors.length + '!' });
    pushFx(s, { t: 'floorup', floor: s.floors.length });
    return ok({ cost: cost });
  }

  // Nâng level 1 tầng: mode 'x1' | 'x10' | 'max'
  function upgradeFloor(s, idx, mode) {
    var f = s.floors[idx];
    if (!f) return fail('floor');
    if (f.level >= CFG.MAX_FLOOR_LEVEL) return fail('max');
    var want = mode === 'x10' ? 10 : (mode === 'max' ? 999 : 1);
    want = Math.min(want, CFG.MAX_FLOOR_LEVEL - f.level);
    var n = 0, total = 0;
    if (mode === 'max') {
      n = CFG.maxAffordableLevels(f.level, s.coins);
      total = CFG.bulkUpgradeCost(f.level, n);
    } else {
      // mua được bao nhiêu trong `want` (dừng khi hết tiền)
      var c = s.coins;
      while (n < want && f.level + n < CFG.MAX_FLOOR_LEVEL) {
        var pc = CFG.upgradeFloorCost(f.level + n);
        if (c < pc) break;
        c -= pc; total += pc; n++;
      }
    }
    if (n <= 0) return fail('coins');
    s.coins -= total;
    f.level += n;
    pushFx(s, { t: 'floorup', floor: idx + 1, label: 'Tầng ' + (idx + 1) + ' Lv.' + f.level + '!' });
    return ok({ levels: n, cost: total });
  }

  // Tap đầu bếp của tầng idx: buff x2 tầng đó
  function tapChefFloor(s, idx) {
    if (!s.floors[idx]) return fail('floor');
    var now = s.t / 1000;
    if (now < (s.floorCdUntil[idx] || 0)) return fail('cooldown');
    s.floorBuffUntil[idx] = now + CFG.CHEF_BOOST_DUR;
    s.floorCdUntil[idx] = now + CFG.CHEF_BOOST_CD;
    pushFx(s, { t: 'boost', x: 0.62, y: 0.3, label: 'Tầng ' + (idx + 1) + ' x2!' });
    return ok();
  }

  // Nút BOOST: x2 toàn tháp 30s, cooldown 5 phút
  function tapBoost(s) {
    var now = s.t / 1000;
    if (now < s.buffs.towerCdUntil) return fail('cooldown');
    s.buffs.towerUntil = now + CFG.TOWER_BOOST_DUR;
    s.buffs.towerCdUntil = now + CFG.TOWER_BOOST_CD;
    pushFx(s, { t: 'boost', x: 0.5, y: 0.3, label: 'BOOST x2 toàn tháp!' });
    return ok();
  }

  function hireStaff(s, kind) {
    var def = CFG.STAFF[kind];
    if (!def) return fail('kind');
    var lvl = s.staff[kind];
    if (lvl >= def.max) return fail('max');
    if (def.reqFloor && towerCount(s) < def.reqFloor) return fail('reqFloor');
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
    if (towerCount(s) < def.reqFloor) return fail('reqFloor');
    if (s.coins < def.cost) return fail('coins');
    s.coins -= def.cost;
    s.plots[id] = 1;
    s.gems += 3;
    pushFx(s, { t: 'gem', x: 0.5, y: 0.4, amount: 3, label: 'Mở ' + def.name + '!' });
    return ok();
  }

  function collectCar(s) {
    if (!s.car || s.car.collected) return fail('none');
    s.car.collected = true;
    s.coins += s.car.reward;
    s.stats.earned += s.car.reward;
    pushFx(s, { t: 'coin', x: s.car.x, y: 0.82, amount: s.car.reward, big: true });
    checkMilestones(s);
    return ok();
  }

  function buyBoost(s) { // 5 gem = x2 toàn tháp 5 phút
    if (s.gems < 5) return fail('gems');
    s.gems -= 5;
    s.buffs.towerUntil = s.t / 1000 + 300;
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
  function setVolume(s, v) {
    v = Math.max(0, Math.min(1, Number(v) || 0));
    s.settings.volume = v;
    return v;
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

  function sanitizeFloors(floors) {
    var out = [];
    if (Array.isArray(floors)) {
      for (var i = 0; i < Math.min(floors.length, CFG.MAX_TOWER_FLOORS); i++) {
        var lv = num(floors[i] && floors[i].level, 0) | 0;
        out.push({ level: Math.max(0, Math.min(CFG.MAX_FLOOR_LEVEL, lv)) });
      }
    }
    if (!out.length) out.push({ level: 0 });
    return out;
  }

  function sanitize(loaded) {
    var s = createGame(num(loaded.seed, 1));
    s.t = num(loaded.t, 0);
    s.coins = Math.max(0, num(loaded.coins, CFG.START_COINS));
    s.gems = Math.max(0, num(loaded.gems, 0));
    s.floors = sanitizeFloors(loaded.floors);
    if (loaded.floorBuffUntil) for (var fb in loaded.floorBuffUntil)
      s.floorBuffUntil[fb] = Math.max(0, num(loaded.floorBuffUntil[fb], 0));
    if (loaded.floorCdUntil) for (var fc in loaded.floorCdUntil)
      s.floorCdUntil[fc] = Math.max(0, num(loaded.floorCdUntil[fc], 0));
    if (loaded.staff) for (var k in s.staff)
      if (loaded.staff[k] !== undefined)
        s.staff[k] = Math.max(0, Math.min(CFG.STAFF[k].max, num(loaded.staff[k], 0) | 0));
    if (loaded.plots) for (var p in loaded.plots) s.plots[p] = 1;
    s.carTimer = num(loaded.carTimer, 25);
    if (loaded.buffs) {
      s.buffs.towerUntil = num(loaded.buffs.towerUntil, 0);
      s.buffs.towerCdUntil = num(loaded.buffs.towerCdUntil, 0);
    }
    if (loaded.stats) {
      s.stats.earned = Math.max(0, num(loaded.stats.earned, 0));
      s.stats.lost = Math.max(0, num(loaded.stats.lost, 0) | 0);
      s.stats.incomePerSec = Math.max(0, num(loaded.stats.incomePerSec, 0));
    }
    if (loaded.gemsClaimed) s.gemsClaimed = loaded.gemsClaimed;
    if (loaded.settings) for (var sk in s.settings) {
      if (sk === 'volume') s.settings.volume = Math.max(0, Math.min(1, num(loaded.settings.volume, 0.8)));
      else if (typeof loaded.settings[sk] === 'boolean') s.settings[sk] = loaded.settings[sk];
    }
    s.nextId = Math.max(1, num(loaded.nextId, 1) | 0);
    s.fx = [];
    return s;
  }

  // Migration save v1 {floor:n, ...} -> v2 {floors:[{level:n}]}
  function migrateV1(old) {
    var s = createGame(num(old.seed, 1));
    s.t = num(old.t, 0);
    s.coins = Math.max(0, num(old.coins, CFG.START_COINS));
    s.gems = Math.max(0, num(old.gems, 0));
    var n = Math.max(1, Math.min(CFG.MAX_FLOOR_LEVEL, num(old.floor, 1) | 0));
    s.floors = [{ level: n }];
    if (old.staff) for (var k in s.staff)
      if (old.staff[k] !== undefined && CFG.STAFF[k])
        s.staff[k] = Math.max(0, Math.min(CFG.STAFF[k].max, num(old.staff[k], 0) | 0));
    if (old.plots) for (var p in old.plots) s.plots[p] = 1;
    if (old.stats) {
      s.stats.earned = Math.max(0, num(old.stats.earned, 0));
      s.stats.lost = Math.max(0, num(old.stats.lost, 0) | 0);
    }
    if (old.gemsClaimed) s.gemsClaimed = old.gemsClaimed;
    if (old.settings) for (var sk in old.settings)
      if (typeof old.settings[sk] === 'boolean' && s.settings[sk] !== undefined)
        s.settings[sk] = old.settings[sk];
    s.nextId = Math.max(1, num(old.nextId, 1) | 0);
    return s;
  }

  function load(storage, nowMs) {
    var raw = null;
    try { raw = storage.getItem(CFG.SAVE_KEY); } catch (e) { /* ignore */ }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        var s = sanitize(parsed || {});
        return finishLoad(s, parsed, storage, nowMs);
      } catch (e) { return { state: null, offline: null }; }
    }
    // thử migration từ save v1
    try { raw = storage.getItem(CFG.SAVE_KEY_V1); } catch (e) { raw = null; }
    if (raw) {
      try {
        var old = JSON.parse(raw);
        if (old && old.floor !== undefined) {
          var ms = migrateV1(old);
          return finishLoad(ms, old, storage, nowMs);
        }
      } catch (e) { /* ignore */ }
    }
    return { state: null, offline: null };
  }

  function finishLoad(s, parsed, storage, nowMs) {
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
        checkMilestones(s);
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
    totalIncome: totalIncome, floorIncome: floorIncome,
    dishesUnlocked: dishesUnlocked,
    addFloor: addFloor, upgradeFloor: upgradeFloor,
    tapChefFloor: tapChefFloor, tapBoost: tapBoost,
    hireStaff: hireStaff, buyPlot: buyPlot,
    collectCar: collectCar, buyBoost: buyBoost,
    tapCoin: tapCoin, toggleSetting: toggleSetting, setVolume: setVolume,
    save: save, load: load, sanitize: sanitize, migrateV1: migrateV1,
  };
}));
