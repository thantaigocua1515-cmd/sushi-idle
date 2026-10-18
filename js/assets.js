/* js/assets.js — Manifest + loader ảnh. Browser-only. */
(function (root) {
  'use strict';

  // key -> đường dẫn tương đối từ index.html
  var MANIFEST = {};
  var i, n;

  for (n = 0; n <= 10; n++) MANIFEST['floor' + n] = 'assets/floors/floor-lv' + n + '.png';
  for (i = 0; i < 20; i++) {
    var p = ('0' + i).slice(-2);
    MANIFEST['chefCook' + i] = 'assets/chef/cooking-' + p + '.png';
    MANIFEST['chefWalk' + i] = 'assets/chef/walk-' + p + '.png';
    MANIFEST['chefServe' + i] = 'assets/chef/serve-' + p + '.png';
    MANIFEST['waiter' + i] = 'assets/waiter/anim-' + p + '.png';
    MANIFEST['deliv' + i] = 'assets/delivery/anim-' + p + '.png';
  }
  for (i = 0; i < 40; i++) {
    var q = ('0' + i).slice(-2);
    MANIFEST['cashier' + i] = 'assets/cashier/anim-' + q + '.png';
    MANIFEST['car' + i] = 'assets/car/move-' + q + '.png';
  }
  // xe drive-thru các loại (mỗi loại 40 frame)
  for (var c = 2; c <= 5; c++) {
    for (i = 0; i < 40; i++) {
      var r = ('0' + i).slice(-2);
      MANIFEST['car' + c + '_' + i] = 'assets/car' + c + '/move-' + r + '.png';
    }
  }
  // tòa tầng trệt theo level thu ngân (CashierL1..L6)
  for (n = 1; n <= 6; n++) MANIFEST['cashierL' + n] = 'assets/cashiers/cashier-l' + n + '.png';

  Object.assign(MANIFEST, {
    island: 'assets/map/island.png',
    mapLocked: 'assets/map/locked.png',
    mapAvail: 'assets/map/available.png',
    mapLock: 'assets/map/lock.png',
    nameplate: 'assets/map/nameplate.png',
    mapClouds: 'assets/map/clouds.png',
    tower: 'assets/shop/tower.png',
    btnGreen: 'assets/ui/btn-green.png',
    btnGreenP: 'assets/ui/btn-green-pressed.png',
    btnBlue: 'assets/ui/btn-blue.png',
    btnBlueOff: 'assets/ui/btn-blue-off.png',
    btnOrange: 'assets/ui/btn-orange.png',
    btnOrangeS: 'assets/ui/btn-orange-small.png',
    btnClose: 'assets/ui/btn-close.png',
    coin: 'assets/ui/coin.png',
    gems: 'assets/ui/gems.png',
    coinBar: 'assets/ui/hud-coin-bar.png',
    gemsBar: 'assets/ui/gems-plus-bar.png',
    hubBar: 'assets/ui/hub-area-bar.png',
    popup: 'assets/ui/popup-box.png',
    contentBox: 'assets/ui/content-box.png',
    upBox: 'assets/ui/upgrade-box.png',
    areaBox: 'assets/ui/area-box.png',
    shopIcon: 'assets/ui/shop-icon.png',
    mapIcon: 'assets/ui/map-icon.png',
    arrowUp: 'assets/ui/arrow-upgrade.png',
    btnMusic: 'assets/ui/btn-music.png',
    btnMusicOff: 'assets/ui/btn-music-off.png',
    btnSound: 'assets/ui/btn-sound.png',
    btnSoundOff: 'assets/ui/btn-sound-off.png',
    btnUp: 'assets/ui/btn-up.png',
    settingIcon: 'assets/ui/setting-icon.png',
    boostBtn: 'assets/ui/btn-boost.png',
    boostIcon: 'assets/ui/boost-icon.png',
    vibra: 'assets/ui/btn-vibra.png',
    vibraOff: 'assets/ui/btn-vibra-off.png',
    volBg: 'assets/ui/volume-bar-bg.png',
    volFill: 'assets/ui/volume-bar-yellow.png',
    volKnob: 'assets/ui/volume-bar-btn.png',
    reqBox: 'assets/ui/requirement-box.png',
    dishNigiri: 'assets/menu/nigiri.png',
    dishMaki: 'assets/menu/maki.png',
    dishTemaki: 'assets/menu/temaki.png',
    dishUramaki: 'assets/menu/uramaki.png',
    dishSashimi: 'assets/menu/sashimi.png',
    dishDragon: 'assets/menu/dragon-roll.png',
  });

  var DISH_ICON = { // dish id -> manifest key
    nigiri: 'dishNigiri', maki: 'dishMaki', temaki: 'dishTemaki',
    uramaki: 'dishUramaki', sashimi: 'dishSashimi', dragon: 'dishDragon',
  };

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); }; // thiếu file -> vẽ dự phòng
      img.src = src;
    });
  }

  // Tải toàn bộ, gọi onProgress(done, total). Trả về store {key: Image|null}
  async function loadAll(onProgress) {
    var keys = Object.keys(MANIFEST);
    var store = {}, done = 0;
    var BATCH = 12;
    for (var b = 0; b < keys.length; b += BATCH) {
      var slice = keys.slice(b, b + BATCH);
      var imgs = await Promise.all(slice.map(function (k) { return loadImage(MANIFEST[k]); }));
      for (var j = 0; j < slice.length; j++) {
        store[slice[j]] = imgs[j];
        done++;
      }
      if (onProgress) onProgress(done, keys.length);
    }
    return store;
  }

  // Lấy dãy frame animation: frames(store, 'chefCook', 20) -> [img...] (bỏ null)
  function frames(store, prefix, count) {
    var out = [];
    for (var k = 0; k < count; k++) {
      var img = store[prefix + k];
      if (img) out.push(img);
    }
    return out;
  }

  // Frame theo thời gian: t giây, fps
  function anim(framesArr, t, fps) {
    if (!framesArr.length) return null;
    var idx = Math.floor(t * (fps || 8)) % framesArr.length;
    return framesArr[idx];
  }

  root.SushiAssets = {
    MANIFEST: MANIFEST, DISH_ICON: DISH_ICON,
    loadAll: loadAll, frames: frames, anim: anim,
  };
})(typeof self !== 'undefined' ? self : this);
