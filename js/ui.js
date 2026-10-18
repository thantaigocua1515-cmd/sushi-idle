/* js/ui.js — HUD, bottom nav, shop modal, popup, toast (DOM). Browser-only. */
(function (root) {
  'use strict';
  var CFG = root.SushiConfig, SIM = root.SushiSim;
  var $ = function (id) { return document.getElementById(id); };

  function createUI(callbacks) {
    var cb = callbacks || {};

    // ---------- HUD ----------
    function updateHUD(s) {
      $('coinVal').textContent = CFG.fmt(s.coins);
      $('gemVal').textContent = CFG.fmt(s.gems);
      $('floorBadge').textContent = 'Tầng ' + s.floor;
      var now = s.t / 1000;
      var boostOn = now < s.buffs.cookUntil;
      $('boostBadge').style.display = boostOn ? 'block' : 'none';
      $('btnMusic').classList.toggle('off', !s.settings.music);
      $('btnSound').classList.toggle('off', !s.settings.sound);
    }

    // ---------- bottom nav ----------
    function setScreen(name) {
      document.querySelectorAll('#bottomnav button').forEach(function (b) {
        b.classList.toggle('active', b.dataset.screen === name);
      });
    }

    // ---------- toast ----------
    var toastTimer = null;
    function toast(msg, ms) {
      var el = $('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 2200);
    }

    // ---------- popup xác nhận ----------
    function confirmBox(title, body, okLabel, onOk) {
      $('popupTitle').textContent = title;
      $('popupBody').innerHTML = body;
      $('popupOk').textContent = okLabel || 'Đồng ý';
      $('popup').classList.remove('hidden');
      $('popupOk').onclick = function () { $('popup').classList.add('hidden'); onOk && onOk(); };
    }
    function closePopup() { $('popup').classList.add('hidden'); }

    function welcomeBack(awayMs, earned) {
      var mins = Math.round(awayMs / 60000);
      var when = mins >= 60 ? (Math.floor(mins / 60) + ' giờ ' + (mins % 60) + ' phút') : (mins + ' phút');
      confirmBox(
        'Chào mừng trở lại!',
        'Bạn vắng mặt <b>' + when + '</b>.<br>Nhà hàng vẫn hoạt động và kiếm được:<br><span class="big-coin">+' + CFG.fmt(earned) + ' coin</span>',
        'Nhận',
        null
      );
    }

    // ---------- shop modal ----------
    function staffRow(s, kind) {
      var def = CFG.STAFF[kind], lvl = s.staff[kind];
      var maxed = lvl >= def.max;
      var cost = maxed ? 0 : CFG.staffCost(kind, lvl);
      var can = !maxed && s.coins >= cost && !(def.reqFloor && s.floor < def.reqFloor);
      var lvlTxt = lvl <= 0 ? 'Chưa thuê' : ('Lv.' + lvl);
      var btn;
      if (maxed) btn = '<button class="buy" disabled>MAX</button>';
      else if (def.reqFloor && s.floor < def.reqFloor)
        btn = '<button class="buy" disabled>Cần tầng ' + def.reqFloor + '</button>';
      else btn = '<button class="buy' + (s.coins >= cost ? '' : ' cant') + '" data-staff="' + kind + '">' +
        (lvl <= 0 ? 'Thuê' : 'Nâng') + ' • ' + CFG.fmt(cost) + '</button>';
      return '<div class="shop-row">' +
        '<div class="shop-info"><div class="shop-name">' + def.name + ' <span class="lvl">' + lvlTxt + '</span></div>' +
        '<div class="shop-desc">' + def.desc + '</div></div>' + btn + '</div>';
    }

    function openShop(s) {
      var html = '';
      // nâng tầng
      html += '<div class="shop-sec"><div class="shop-sec-title">Nâng tầng nhà hàng</div>';
      if (s.floor >= CFG.MAX_FLOOR) {
        html += '<div class="shop-row"><div class="shop-info"><div class="shop-name">Đã đạt tầng tối đa!</div></div></div>';
      } else {
        var nf = CFG.FLOORS[s.floor + 1], cost = nf.cost;
        var dish = nf.dish ? ' • Mở món ' + CFG.DISHES[nf.dish].name : '';
        html += '<div class="shop-row"><div class="shop-info"><div class="shop-name">Tầng ' + s.floor + ' → ' + (s.floor + 1) + '</div>' +
          '<div class="shop-desc">+' + (nf.tables - CFG.FLOORS[s.floor].tables) + ' bàn, thu nhập x' + nf.mult + dish + '</div></div>' +
          '<button class="buy big' + (s.coins >= cost ? '' : ' cant') + '" data-floor="1">Nâng • ' + CFG.fmt(cost) + '</button></div>';
      }
      html += '</div>';
      // nhân sự
      html += '<div class="shop-sec"><div class="shop-sec-title">Nhân sự</div>';
      CFG.STAFF_IDS.forEach(function (k) { html += staffRow(s, k); });
      html += '</div>';
      // thực đơn
      html += '<div class="shop-sec"><div class="shop-sec-title">Thực đơn</div><div class="menu-grid">';
      CFG.DISH_IDS.forEach(function (d) {
        var unlocked = s.dishes.indexOf(d) >= 0;
        var dd = CFG.DISHES[d];
        html += '<div class="menu-item' + (unlocked ? '' : ' locked') + '">' +
          '<img src="assets/menu/' + d.replace('dragon', 'dragon-roll') + '.png" alt="">' +
          '<div class="menu-name">' + dd.name + '</div>' +
          '<div class="menu-price">' + (unlocked ? CFG.fmt(dd.price) + ' coin' : 'Tầng ' + floorOfDish(d)) + '</div></div>';
      });
      html += '</div></div>';
      // boost gem
      html += '<div class="shop-sec"><div class="shop-sec-title">Boost (gem)</div>' +
        '<div class="shop-row"><div class="shop-info"><div class="shop-name">Siêu bếp 5 phút</div>' +
        '<div class="shop-desc">Tốc độ nấu x2 trong 5 phút</div></div>' +
        '<button class="buy gem' + (s.gems >= 5 ? '' : ' cant') + '" data-boost="1">5 gem</button></div></div>';

      $('shopBody').innerHTML = html;
      $('shopModal').classList.remove('hidden');

      // wire nút
      $('shopBody').querySelectorAll('[data-floor]').forEach(function (b) {
        b.onclick = function () { cb.onBuyFloor && cb.onBuyFloor(); };
      });
      $('shopBody').querySelectorAll('[data-staff]').forEach(function (b) {
        b.onclick = function () { cb.onHireStaff && cb.onHireStaff(b.dataset.staff); };
      });
      var bb = $('shopBody').querySelector('[data-boost]');
      if (bb) bb.onclick = function () { cb.onBuyBoost && cb.onBuyBoost(); };
    }
    function refreshShop(s) { if (!$('shopModal').classList.contains('hidden')) openShop(s); }
    function closeShop() { $('shopModal').classList.add('hidden'); }
    function isShopOpen() { return !$('shopModal').classList.contains('hidden'); }

    function floorOfDish(d) {
      for (var f = 1; f <= CFG.MAX_FLOOR; f++)
        if (CFG.FLOORS[f].dish === d) return f;
      return '?';
    }

    // wire tĩnh
    $('btnCloseShop').onclick = closeShop;
    $('popupClose').onclick = closePopup;
    document.querySelectorAll('#bottomnav button').forEach(function (b) {
      b.onclick = function () { cb.onScreen && cb.onScreen(b.dataset.screen); };
    });
    $('btnMusic').onclick = function () { cb.onToggleSetting && cb.onToggleSetting('music'); };
    $('btnSound').onclick = function () { cb.onToggleSetting && cb.onToggleSetting('sound'); };
    var fab = $('btnShopFab');
    if (fab) fab.onclick = function () { cb.onScreen && cb.onScreen('shop'); };

    return {
      updateHUD: updateHUD, setScreen: setScreen, toast: toast,
      confirmBox: confirmBox, closePopup: closePopup, welcomeBack: welcomeBack,
      openShop: openShop, refreshShop: refreshShop, closeShop: closeShop, isShopOpen: isShopOpen,
    };
  }

  root.SushiUI = { createUI: createUI };
})(typeof self !== 'undefined' ? self : this);
