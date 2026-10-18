/* js/config.js — Toàn bộ số liệu cân bằng game (balance).
 * UMD: dùng được cả trong browser (script thường) và node (require) để test.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SushiConfig = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  var W = 390, H = 844; // logical resolution (portrait mobile)

  // Tầng nhà hàng: cost = tiền nâng TỪ tầng trước LÊN tầng này
  var FLOORS = [
    { cost: 0,      tables: 0, mult: 0.0,  dish: null },      // 0: đóng cửa
    { cost: 0,      tables: 2, mult: 1.0,  dish: 'nigiri' },  // 1: bắt đầu
    { cost: 300,    tables: 2, mult: 1.3,  dish: 'maki' },
    { cost: 900,    tables: 3, mult: 1.7,  dish: null },
    { cost: 2500,   tables: 3, mult: 2.2,  dish: 'temaki' },  // mở drive-thru
    { cost: 7000,   tables: 4, mult: 2.9,  dish: null },
    { cost: 18000,  tables: 4, mult: 3.8,  dish: 'uramaki' },
    { cost: 45000,  tables: 5, mult: 5.0,  dish: null },
    { cost: 110000, tables: 5, mult: 6.6,  dish: 'sashimi' },
    { cost: 280000, tables: 6, mult: 8.7,  dish: null },
    { cost: 700000, tables: 6, mult: 11.5, dish: 'dragon' },
  ];
  var MAX_FLOOR = 10;

  // Thực đơn: price = giá gốc, cook = giây nấu ở chef lv1
  var DISHES = {
    nigiri: { name: 'Nigiri',      price: 12,  cook: 4  },
    maki:   { name: 'Maki',        price: 24,  cook: 6  },
    temaki: { name: 'Temaki',      price: 42,  cook: 8  },
    uramaki:{ name: 'Uramaki',     price: 70,  cook: 11 },
    sashimi:{ name: 'Sashimi',     price: 115, cook: 14 },
    dragon: { name: 'Dragon Roll', price: 180, cook: 18 },
  };
  var DISH_IDS = Object.keys(DISHES);

  // Nhân sự: hire = giá thuê, base = giá nâng cấp ở lv0, cost(lvl) = base * 1.7^lvl
  var STAFF = {
    chef:     { name: 'Đầu bếp',  hire: 60,  base: 50,  max: 20, icon: 'chef',     desc: 'Nấu nhanh hơn' },
    waiter:   { name: 'Phục vụ',  hire: 90,  base: 70,  max: 20, icon: 'waiter',   desc: 'Bưng + dọn nhanh hơn' },
    cashier:  { name: 'Thu ngân', hire: 120, base: 90,  max: 20, icon: 'cashier',  desc: 'Tăng tiền tip' },
    delivery: { name: 'Giao hàng',hire: 400, base: 220, max: 15, icon: 'delivery', desc: 'Drive-thru xịn hơn', reqFloor: 4 },
  };
  var STAFF_IDS = Object.keys(STAFF);

  // Ô đất trên bản đồ đảo
  var PLOTS = [
    { id: 'drivethru',  name: 'Drive-Thru',  cost: 1500,  reqFloor: 4, desc: 'Xe hơi mang đơn lớn định kỳ' },
    { id: 'garden',     name: 'Vườn rau',    cost: 3000,  reqFloor: 3, desc: 'Doanh thu món ăn +12%' },
    { id: 'fishmarket', name: 'Chợ cá',      cost: 8000,  reqFloor: 5, desc: 'Thời gian nấu -15%' },
    { id: 'warehouse',  name: 'Nhà kho',     cost: 20000, reqFloor: 6, desc: 'Thu nhập offline 50% -> 75%' },
    { id: 'tower',      name: 'Sushi Tower', cost: 60000, reqFloor: 8, desc: 'Tiền tip +25%' },
  ];

  // Cột mốc tặng gem
  var MILESTONES = [
    { id: 'serve25',  gems: 5,  desc: 'Phục vụ 25 khách' },
    { id: 'serve100', gems: 12, desc: 'Phục vụ 100 khách' },
    { id: 'serve500', gems: 30, desc: 'Phục vụ 500 khách' },
  ];

  var OFFLINE_CAP_MS = 8 * 3600 * 1000; // cap 8 tiếng
  var OFFLINE_EFF = 0.5;                // hiệu suất offline 50% (75% nếu có nhà kho)
  var START_COINS = 80;
  var CHEF_BOOST_CD = 60;               // cooldown tap đầu bếp (giây)
  var CHEF_BOOST_DUR = 10;              // thời gian boost (giây)
  var SAVE_KEY = 'sushi-idle-save-v1';

  // --- hàm cân bằng ---
  function staffCost(kind, lvl) { // lvl hiện tại -> giá nâng lên lvl+1 (lvl=0 là giá thuê)
    var s = STAFF[kind];
    if (lvl <= 0) return s.hire;
    return Math.round(s.base * Math.pow(1.7, lvl));
  }
  function cookMult(lvl)   { return 1 + 0.30 * lvl; }  // tốc độ nấu
  function serveMult(lvl)  { return 1 + 0.30 * lvl; }  // tốc độ bưng/dọn
  function tipMult(lvl)    { return 1 + 0.10 * lvl; }  // hệ số tip
  function spawnInterval(floor) { // giây giữa 2 khách
    return Math.max(2.2, 8.5 - 0.65 * (floor - 1));
  }
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
    W: W, H: H, FLOORS: FLOORS, MAX_FLOOR: MAX_FLOOR,
    DISHES: DISHES, DISH_IDS: DISH_IDS,
    STAFF: STAFF, STAFF_IDS: STAFF_IDS, PLOTS: PLOTS, MILESTONES: MILESTONES,
    OFFLINE_CAP_MS: OFFLINE_CAP_MS, OFFLINE_EFF: OFFLINE_EFF,
    START_COINS: START_COINS, CHEF_BOOST_CD: CHEF_BOOST_CD,
    CHEF_BOOST_DUR: CHEF_BOOST_DUR, SAVE_KEY: SAVE_KEY,
    staffCost: staffCost, cookMult: cookMult, serveMult: serveMult,
    tipMult: tipMult, spawnInterval: spawnInterval,
    carInterval: carInterval, carRewardMult: carRewardMult, fmt: fmt,
  };
}));
