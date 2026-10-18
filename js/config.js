/* js/config.js — Toàn bộ số liệu cân bằng game (balance).
 * UMD: dùng được cả trong browser (script thường) và node (require) để test.
 *
 * Mô hình tháp: nhà hàng là 1 tòa tháp dọc, gồm nhiều tầng (tower floors).
 * Mỗi tầng có LEVEL riêng (0..10) quyết định ngoại hình (Floor_Lv{level}.png)
 * và thu nhập. Thêm tầng mới = xây thêm 1 tầng tháp.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SushiConfig = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  var W = 390, H = 844; // logical resolution (portrait mobile)

  // ---- Tháp ----
  var MAX_TOWER_FLOORS = 8;   // số tầng tháp tối đa
  var MAX_FLOOR_LEVEL = 10;   // level tối đa mỗi tầng (khớp 11 ảnh Floor_Lv0..Lv10)

  // Giá xây tầng mới: count = số tầng ĐANG có -> giá mua tầng tiếp theo
  // 500 -> 1.6K -> 5.1K -> 16.4K -> 52.4K -> 167.8K -> 536.9K
  function addFloorCost(count) {
    return Math.round(500 * Math.pow(3.2, Math.max(0, count - 1)));
  }
  // Giá nâng 1 level cho 1 tầng: level = level hiện tại
  // 120 -> 228 -> 433 -> 823 -> 1.6K -> 3K -> 5.6K -> 10.7K -> 20.4K -> 38.7K
  function upgradeFloorCost(level) {
    return Math.round(120 * Math.pow(1.9, level));
  }
  // Tổng giá nâng `count` level liên tiếp từ `level`
  function bulkUpgradeCost(level, count) {
    var total = 0;
    for (var k = 0; k < count; k++) total += upgradeFloorCost(level + k);
    return total;
  }
  // Số level tối đa mua được với `coins` (không vượt MAX_FLOOR_LEVEL)
  function maxAffordableLevels(level, coins) {
    var n = 0;
    while (level + n < MAX_FLOOR_LEVEL) {
      var c = upgradeFloorCost(level + n);
      if (coins < c) break;
      coins -= c; n++;
    }
    return n;
  }
  // Thu nhập gốc 1 tầng (coin/giây), chưa nhân hệ số
  function floorBaseIncome(level) {
    return 8 * Math.pow(level + 1, 1.4);
  }

  // Thực đơn: price = giá gốc; mở khóa theo SỐ TẦNG tháp
  var DISHES = {
    nigiri: { name: 'Nigiri',      price: 12,  cook: 4  },
    maki:   { name: 'Maki',        price: 24,  cook: 6  },
    temaki: { name: 'Temaki',      price: 42,  cook: 8  },
    uramaki:{ name: 'Uramaki',     price: 70,  cook: 11 },
    sashimi:{ name: 'Sashimi',     price: 115, cook: 14 },
    dragon: { name: 'Dragon Roll', price: 180, cook: 18 },
  };
  var DISH_IDS = Object.keys(DISHES);
  var DISH_UNLOCK_FLOORS = { // dish id -> số tầng tháp cần để mở
    nigiri: 1, maki: 2, temaki: 3, uramaki: 4, sashimi: 5, dragon: 6,
  };

  // Nhân sự: hire = giá thuê, base = giá nâng cấp ở lv0, cost(lvl) = base * 1.7^lvl
  // reqFloor: số TẦNG THÁP tối thiểu (ngữ nghĩa mới)
  var STAFF = {
    chef:     { name: 'Đầu bếp',  hire: 60,  base: 50,  max: 20, icon: 'chef',     desc: 'Tăng thu nhập mỗi tầng' },
    waiter:   { name: 'Phục vụ',  hire: 90,  base: 70,  max: 20, icon: 'waiter',   desc: 'Tăng thu nhập mỗi tầng' },
    cashier:  { name: 'Thu ngân', hire: 120, base: 90,  max: 20, icon: 'cashier',  desc: 'Tăng tiền tip' },
    delivery: { name: 'Giao hàng',hire: 400, base: 220, max: 15, icon: 'delivery', desc: 'Drive-thru xịn hơn', reqFloor: 3 },
  };
  var STAFF_IDS = Object.keys(STAFF);

  // Ô đất trên bản đồ đảo (reqFloor = số tầng tháp tối thiểu)
  var PLOTS = [
    { id: 'drivethru',  name: 'Drive-Thru',  cost: 1500,  reqFloor: 3, desc: 'Xe hơi mang đơn lớn định kỳ' },
    { id: 'garden',     name: 'Vườn rau',    cost: 3000,  reqFloor: 2, desc: 'Doanh thu món ăn +12%' },
    { id: 'fishmarket', name: 'Chợ cá',      cost: 8000,  reqFloor: 4, desc: 'Mở khóa món cao cấp sớm' },
    { id: 'warehouse',  name: 'Nhà kho',     cost: 20000, reqFloor: 5, desc: 'Thu nhập offline 50% -> 75%' },
    { id: 'tower',      name: 'Sushi Tower', cost: 60000, reqFloor: 6, desc: 'Tiền tip +25%' },
  ];

  // Cột mốc tặng gem (theo tổng coin đã kiếm)
  var MILESTONES = [
    { id: 'earn1k',   need: 1000,      gems: 5,  desc: 'Kiếm 1K coin' },
    { id: 'earn100k', need: 100000,    gems: 12, desc: 'Kiếm 100K coin' },
    { id: 'earn10m',  need: 10000000,  gems: 30, desc: 'Kiếm 10M coin' },
  ];

  var OFFLINE_CAP_MS = 8 * 3600 * 1000; // cap 8 tiếng
  var OFFLINE_EFF = 0.5;                // hiệu suất offline 50% (75% nếu có nhà kho)
  var START_COINS = 80;
  var CHEF_BOOST_DUR = 10;              // tap đầu bếp 1 tầng: x2 trong 10s
  var CHEF_BOOST_CD = 60;               // cooldown mỗi tầng (giây)
  var TOWER_BOOST_DUR = 30;             // nút BOOST: x2 toàn tháp 30s
  var TOWER_BOOST_CD = 300;             // cooldown 5 phút
  var SAVE_KEY = 'sushi-idle-save-v2';
  var SAVE_KEY_V1 = 'sushi-idle-save-v1';

  // --- hàm cân bằng ---
  function staffCost(kind, lvl) { // lvl hiện tại -> giá nâng lên lvl+1 (lvl=0 là giá thuê)
    var s = STAFF[kind];
    if (lvl <= 0) return s.hire;
    return Math.round(s.base * Math.pow(1.7, lvl));
  }
  function tipMult(lvl)    { return 1 + 0.10 * lvl; }  // hệ số tip
  function carInterval(lvl) { return 75 / (1 + 0.20 * lvl); } // giây giữa 2 xe
  function carRewardMult(lvl) { return 1 + 0.15 * lvl; }

  // Rút gọn số: 1200 -> 1.2K, 3400000 -> 3.4M
  function fmt(n) {
    if (!isFinite(n)) return '0';
    n = Math.floor(n);
    if (n < 0) return '-' + fmt(-n);
    if (n < 1000) return '' + n;
    var units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][0]) {
        var v = n / units[i][0];
        return (v >= 100 ? Math.floor(v) : (Math.floor(v * 10) / 10)) + units[i][1];
      }
    }
    return '' + n;
  }

  return {
    W: W, H: H,
    MAX_TOWER_FLOORS: MAX_TOWER_FLOORS, MAX_FLOOR_LEVEL: MAX_FLOOR_LEVEL,
    DISHES: DISHES, DISH_IDS: DISH_IDS, DISH_UNLOCK_FLOORS: DISH_UNLOCK_FLOORS,
    STAFF: STAFF, STAFF_IDS: STAFF_IDS, PLOTS: PLOTS, MILESTONES: MILESTONES,
    OFFLINE_CAP_MS: OFFLINE_CAP_MS, OFFLINE_EFF: OFFLINE_EFF,
    START_COINS: START_COINS, CHEF_BOOST_DUR: CHEF_BOOST_DUR,
    CHEF_BOOST_CD: CHEF_BOOST_CD, TOWER_BOOST_DUR: TOWER_BOOST_DUR,
    TOWER_BOOST_CD: TOWER_BOOST_CD,
    SAVE_KEY: SAVE_KEY, SAVE_KEY_V1: SAVE_KEY_V1,
    addFloorCost: addFloorCost, upgradeFloorCost: upgradeFloorCost,
    bulkUpgradeCost: bulkUpgradeCost, maxAffordableLevels: maxAffordableLevels,
    floorBaseIncome: floorBaseIncome,
    staffCost: staffCost, tipMult: tipMult,
    carInterval: carInterval, carRewardMult: carRewardMult, fmt: fmt,
  };
}));
