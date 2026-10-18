/* js/ui.js — HUD, bottom nav, popup khung mái ngói, toast (DOM). Browser-only. */
(function (root) {
  'use strict';
  var CFG = root.SushiConfig, SIM = root.SushiSim;
  var $ = function (id) { return document.getElementById(id); };

  function createUI(callbacks) {
    var cb = callbacks || {};
    var bulkMode = 'x1'; // chế độ mua bulk popup tầng

    // ---------- HUD ----------
    function updateHUD(s) {
      $('coinVal').textContent = CFG.fmt(s.coins);
      $('gemVal').textContent = CFG.fmt(s.gems);
      var now = s.t / 1000;
      var boostOn = now < s.buffs.towerUntil;
      $('towerBoostBadge').style.display = boostOn ? 'block' : 'none';
      var cdBtn = $('navBoost'), cdTxt = $('boostCd');
      if (now < s.buffs.towerCdUntil) {
        cdBtn.classList.add('cooling');
        cdTxt.textContent = Math.ceil(s.buffs.towerCdUntil - now) + 's';
      } else {
        cdBtn.classList.remove('cooling');
        cdTxt.textContent = '';
      }
    }

    // ---------- bottom nav ----------
    function setScreen(name) {
      document.querySelectorAll('#bottomnav [data-screen]').forEach(function (b) {
        b.classList.toggle('active', b.dataset.screen === name);
      });
      $('mapBack').classList.toggle('show', name === 'map');
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

    // ---------- popup dùng chung ----------
    function showPopup(title, bodyHTML) {
      $('popupTitle').textContent = title;
      $('popupBody').innerHTML = bodyHTML;
      $('popup').classList.remove('hidden');
    }
    function closePopup() { $('popup').classList.add('hidden'); }
    function isPopupOpen() { return !$('popup').classList.contains('hidden'); }

    // nút kit
    function kbtn(label, cls, attrs) {
      return '<button class="kbtn ' + (cls || '') + '" ' + (attrs || '') + '>' + label + '</button>';
    }

    // ---------- popup nâng tầng ----------
    function floorStatsRows(s, i, count) {
      var f = s.floors[i], lvl2 = Math.min(CFG.MAX_FLOOR_LEVEL, f.level + count);
      var inc1 = SIM.floorIncome(s, i);
      // thu nhập sau khi nâng: tính tạm bằng cách clone level
      var old = f.level; f.level = lvl2;
      var inc2 = SIM.floorIncome(s, i);
      f.level = old;
      var pct = inc1 > 0 ? Math.round((inc2 - inc1) / inc1 * 100) : 0;
      function row(k, v, up) {
        return '<div class="res-row"><span class="dot"></span><span class="k">' + k + '</span>' +
          '<span class="v">' + v + '</span>' + (up ? '<span class="up">+' + up + '</span>' : '') + '</div>';
      }
      return row('Cấp độ', 'Lv.' + f.level + ' → Lv.' + lvl2, count) +
        row('Thu nhập/s', CFG.fmt(inc1) + ' → ' + CFG.fmt(inc2), pct + '%');
    }

    function bulkCount(s, i) {
      var f = s.floors[i];
      if (bulkMode === 'x10') return Math.min(10, CFG.MAX_FLOOR_LEVEL - f.level);
      if (bulkMode === 'max') return CFG.maxAffordableLevels(f.level, s.coins);
      return Math.min(1, CFG.MAX_FLOOR_LEVEL - f.level);
    }
    function bulkCost(s, i) {
      var f = s.floors[i];
      return CFG.bulkUpgradeCost(f.level, bulkCount(s, i));
    }

    function openFloorPopup(s, i) {
      var f = s.floors[i];
      if (!f) return;
      bulkMode = 'x1';
      renderFloorPopup(s, i);
    }
    function renderFloorPopup(s, i) {
      var f = s.floors[i];
      var maxed = f.level >= CFG.MAX_FLOOR_LEVEL;
      var count = maxed ? 0 : bulkCount(s, i);
      var cost = maxed ? 0 : bulkCost(s, i);
      var can = !maxed && count > 0 && s.coins >= cost;
      var html = '<div class="res-box"><div class="res-title">KẾT QUẢ</div>' +
        (maxed ? '<div class="res-row"><span class="dot"></span><span class="k">Cấp độ</span><span class="v">Lv.' + f.level + ' (MAX)</span></div>'
               : floorStatsRows(s, i, count)) + '</div>';
      if (!maxed) {
        html += '<div class="req-title">YÊU CẦU NÂNG CẤP</div>' +
          '<div class="req-box"><img src="assets/ui/coin.png" alt=""><span>' + CFG.fmt(cost) + '</span></div>' +
          '<div class="bulk-row">' +
          ['x1', 'x10', 'max'].map(function (m) {
            return '<button data-bulk="' + m + '" class="' + (bulkMode === m ? 'sel' : '') + '">' +
              (m === 'max' ? 'MAX' : m) + '</button>';
          }).join('') + '</div>';
      }
      html += kbtn(maxed ? 'TỐI ĐA' : 'NÂNG CẤP', 'big', 'data-upgrade="1"' + (can ? '' : ' disabled'));
      showPopup('TẦNG ' + (i + 1), html);

      $('popupBody').querySelectorAll('[data-bulk]').forEach(function (b) {
        b.onclick = function () { bulkMode = b.dataset.bulk; renderFloorPopup(s, i); };
      });
      var up = $('popupBody').querySelector('[data-upgrade]');
      if (up && !up.disabled) up.onclick = function () { cb.onUpgradeFloor && cb.onUpgradeFloor(i, bulkMode); };
    }
    function refreshFloorPopup(s, i) {
      if (isPopupOpen() && $('popupTitle').textContent.indexOf('TẦNG') === 0) renderFloorPopup(s, i);
    }

    // ---------- popup cài đặt ----------
    function setBtnHTML(key, on, imgOn, imgOff, label) {
      return '<button data-set="' + key + '" class="' + (on ? '' : 'off') + '" aria-label="' + label + '">' +
        '<img src="assets/ui/' + (on ? imgOn : imgOff) + '" alt="' + label + '"></button>';
    }
    function openSettings(s) {
      var st = s.settings;
      var html = '<div class="set-row">' +
        setBtnHTML('music', st.music, 'btn-music.png', 'btn-music-off.png', 'Nhạc') +
        setBtnHTML('sound', st.sound, 'btn-sound.png', 'btn-sound-off.png', 'Âm thanh') +
        setBtnHTML('vibra', st.vibra, 'btn-vibra.png', 'btn-vibra-off.png', 'Rung') +
        '</div>' +
        '<div class="vol-wrap"><div class="vol-label">ÂM LƯỢNG</div>' +
        '<div class="vol-bar" id="volBar">' +
        '<img class="vol-bg" src="assets/ui/volume-bar-bg.png" alt="">' +
        '<div class="vol-fill" id="volFill"><img src="assets/ui/volume-bar-yellow.png" alt=""></div>' +
        '<div class="vol-knob" id="volKnob"><img src="assets/ui/volume-bar-btn.png" alt=""></div>' +
        '</div></div>' +
        '<div class="set-btns">' +
        kbtn('CHIA SẺ', '', 'data-share="1"') +
        kbtn('GAME KHÁC', '', 'data-more="1"') +
        '</div>';
      showPopup('CÀI ĐẶT', html);
      paintVolume(st.volume);

      $('popupBody').querySelectorAll('[data-set]').forEach(function (b) {
        b.onclick = function () { cb.onToggleSetting && cb.onToggleSetting(b.dataset.set); };
      });
      var bar = $('volBar');
      function setFromEvent(e) {
        var r = bar.getBoundingClientRect();
        var cx = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
        var v = Math.max(0, Math.min(1, (cx - r.left) / r.width));
        cb.onVolume && cb.onVolume(v);
      }
      bar.addEventListener('pointerdown', function (e) {
        setFromEvent(e);
        function mv(ev) { setFromEvent(ev); }
        function up() {
          window.removeEventListener('pointermove', mv);
          window.removeEventListener('pointerup', up);
        }
        window.addEventListener('pointermove', mv);
        window.addEventListener('pointerup', up);
      });
      var sh = $('popupBody').querySelector('[data-share]');
      if (sh) sh.onclick = function () { toast('Chia sẻ sắp ra mắt!'); };
      var mo = $('popupBody').querySelector('[data-more]');
      if (mo) mo.onclick = function () { toast('Game khác sắp ra mắt!'); };
    }
    function paintVolume(v) {
      var fill = $('volFill'), knob = $('volKnob');
      if (!fill || !knob) return;
      var pct = Math.round(v * 100);
      fill.style.width = pct + '%';
      knob.style.left = pct + '%';
    }
    function refreshSettings(s) {
      if (isPopupOpen() && $('popupTitle').textContent === 'CÀI ĐẶT') openSettings(s);
    }

    // ---------- popup offline ----------
    function openOffline(awayMs, earned, onClaim, onClaim2x) {
      var mins = Math.round(awayMs / 60000);
      var when = mins >= 60 ? (Math.floor(mins / 60) + ' giờ ' + (mins % 60) + ' phút') : (mins + ' phút');
      var html = '<div class="off-pile">' +
        '<img src="assets/ui/coin.png" style="left:38%;top:6px;width:64px;height:64px">' +
        '<img src="assets/ui/gems.png" style="left:24%;top:34px;width:44px;height:44px">' +
        '<img src="assets/ui/coin.png" style="left:56%;top:38px;width:48px;height:48px">' +
        '<img src="assets/ui/coin.png" style="left:44%;top:52px;width:40px;height:40px">' +
        '</div>' +
        '<div class="off-amount">+' + CFG.fmt(earned) + ' coin</div>' +
        '<div class="off-sub">Bạn vắng mặt ' + when + ' — nhà hàng vẫn hoạt động!</div>' +
        '<div class="off-btns">' +
        kbtn('NHẬN X2 <span style="font-size:14px">· 5 gem</span>', 'blue', 'data-claim2x="1"') +
        kbtn('NHẬN', 'big', 'data-claim="1"') +
        '</div>';
      showPopup('THU NHẬP OFFLINE', html);
      var c1 = $('popupBody').querySelector('[data-claim]');
      if (c1) c1.onclick = function () { closePopup(); onClaim && onClaim(false); };
      var c2 = $('popupBody').querySelector('[data-claim2x]');
      if (c2) c2.onclick = function () {
        if (onClaim2x) onClaim2x(function (ok) { if (ok) closePopup(); });
      };
    }

    // ---------- popup xác nhận chung ----------
    function confirmBox(title, bodyHTML, okLabel, onOk) {
      showPopup(title, '<div style="text-align:center;font-size:15px;line-height:1.6;font-family:system-ui">' +
        bodyHTML + '</div><div style="height:12px"></div>' +
        kbtn(okLabel || 'ĐỒNG Ý', 'big', 'data-ok="1"'));
      var b = $('popupBody').querySelector('[data-ok]');
      if (b) b.onclick = function () { closePopup(); onOk && onOk(); };
    }

    // ---------- shop modal (nhân sự + thực đơn + boost) ----------
    function staffRow(s, kind) {
      var def = CFG.STAFF[kind], lvl = s.staff[kind];
      var maxed = lvl >= def.max;
      var cost = maxed ? 0 : CFG.staffCost(kind, lvl);
      var need = def.reqFloor || 0, nFloors = s.floors.length;
      var lvlTxt = lvl <= 0 ? 'Chưa thuê' : ('Lv.' + lvl);
      var btn;
      if (maxed) btn = '<button class="buy" disabled>MAX</button>';
      else if (nFloors < need)
        btn = '<button class="buy" disabled>Cần ' + need + ' tầng</button>';
      else btn = '<button class="buy' + (s.coins >= cost ? '' : ' cant') + '" data-staff="' + kind + '">' +
        (lvl <= 0 ? 'Thuê' : 'Nâng') + ' • ' + CFG.fmt(cost) + '</button>';
      return '<div class="shop-row">' +
        '<div class="shop-info"><div class="shop-name">' + def.name + ' <span class="lvl">' + lvlTxt + '</span></div>' +
        '<div class="shop-desc">' + def.desc + '</div></div>' + btn + '</div>';
    }

    function openShop(s) {
      var html = '';
      html += '<div class="shop-sec"><div class="shop-sec-title">Nhân sự</div>';
      CFG.STAFF_IDS.forEach(function (k) { html += staffRow(s, k); });
      html += '</div>';
      html += '<div class="shop-sec"><div class="shop-sec-title">Thực đơn</div><div class="menu-grid">';
      var unlocked = SIM.dishesUnlocked(s);
      CFG.DISH_IDS.forEach(function (d) {
        var un = unlocked.indexOf(d) >= 0;
        var dd = CFG.DISHES[d];
        html += '<div class="menu-item' + (un ? '' : ' locked') + '">' +
          '<img src="assets/menu/' + d.replace('dragon', 'dragon-roll') + '.png" alt="">' +
          '<div class="menu-name">' + dd.name + '</div>' +
          '<div class="menu-price">' + (un ? CFG.fmt(dd.price) + ' coin' : (CFG.DISH_UNLOCK_FLOORS[d] || '?') + ' tầng') + '</div></div>';
      });
      html += '</div></div>';
      html += '<div class="shop-sec"><div class="shop-sec-title">Boost (gem)</div>' +
        '<div class="shop-row"><div class="shop-info"><div class="shop-name">Siêu bếp 5 phút</div>' +
        '<div class="shop-desc">Tốc độ kiếm coin x2 toàn tháp trong 5 phút</div></div>' +
        '<button class="buy gem' + (s.gems >= 5 ? '' : ' cant') + '" data-boost="1">5 gem</button></div></div>';

      $('shopBody').innerHTML = html;
      $('shopModal').classList.remove('hidden');

      $('shopBody').querySelectorAll('[data-staff]').forEach(function (b) {
        b.onclick = function () { cb.onHireStaff && cb.onHireStaff(b.dataset.staff); };
      });
      var bb = $('shopBody').querySelector('[data-boost]');
      if (bb) bb.onclick = function () { cb.onBuyBoost && cb.onBuyBoost(); };
    }
    function refreshShop(s) { if (!$('shopModal').classList.contains('hidden')) openShop(s); }
    function closeShop() { $('shopModal').classList.add('hidden'); }
    function isShopOpen() { return !$('shopModal').classList.contains('hidden'); }

    // wire tĩnh
    $('btnCloseShop').onclick = closeShop;
    $('popupClose').onclick = closePopup;
    $('navBoost').onclick = function () { cb.onTowerBoost && cb.onTowerBoost(); };
    $('btnSettings').onclick = function () { cb.onOpenSettings && cb.onOpenSettings(); };
    document.querySelectorAll('#bottomnav [data-screen]').forEach(function (b) {
      b.onclick = function () { cb.onScreen && cb.onScreen(b.dataset.screen); };
    });

    return {
      updateHUD: updateHUD, setScreen: setScreen, toast: toast,
      confirmBox: confirmBox, closePopup: closePopup, isPopupOpen: isPopupOpen,
      openFloorPopup: openFloorPopup, refreshFloorPopup: refreshFloorPopup,
      openSettings: openSettings, refreshSettings: refreshSettings,
      openOffline: openOffline, paintVolume: paintVolume,
      openShop: openShop, refreshShop: refreshShop, closeShop: closeShop, isShopOpen: isShopOpen,
    };
  }

  root.SushiUI = { createUI: createUI };
})(typeof self !== 'undefined' ? self : this);
