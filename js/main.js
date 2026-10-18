/* js/main.js — Boot, game loop, đấu nối sim/render/ui/input. Browser-only. */
(function () {
  'use strict';
  var CFG = window.SushiConfig, SIM = window.SushiSim;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  // canvas logical 390x844, scale vừa màn hình, nét theo DPR
  function resize() {
    var dpr = Math.min(2.5, window.devicePixelRatio || 1);
    var scale = Math.min(window.innerWidth / CFG.W, window.innerHeight / CFG.H);
    canvas.style.width = Math.floor(CFG.W * scale) + 'px';
    canvas.style.height = Math.floor(CFG.H * scale) + 'px';
    document.getElementById('hud').style.width = canvas.style.width;
    document.getElementById('bottomnav').style.width = canvas.style.width;
    canvas.width = Math.floor(CFG.W * dpr);
    canvas.height = Math.floor(CFG.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  var params = new URLSearchParams(location.search);

  // ---------- SFX mini (WebAudio, không cần file) ----------
  var SFX = (function () {
    var ac = null, master = null, st = null, musicTimer = null, mi = 0;
    var SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    function ensure() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = st ? st.settings.volume : 0.8;
        master.connect(ac.destination);
        musicTimer = setInterval(function () {
          if (st && st.settings.music && !document.hidden) {
            var f = SCALE[(mi++) % SCALE.length] * (Math.random() < 0.25 ? 0.5 : 1);
            tone(f, f, 1.4, 'triangle', 0.05);
          }
        }, 2600);
        return true;
      } catch (e) { return false; }
    }
    function tone(f0, f1, dur, type, vol, delay) {
      if (!ac || !st || !st.settings.sound) return;
      var t = ac.currentTime + (delay || 0);
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    function vibra(ms) {
      try { if (st && st.settings.vibra && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
    }
    return {
      bind: function (state) { st = state; },
      unlock: function () { ensure(); },
      setVolume: function (v) { if (master) master.gain.value = v; },
      coin: function () { tone(880, 1320, 0.12, 'sine', 0.12); tone(1320, 1760, 0.1, 'sine', 0.08, 0.07); },
      buy: function () { tone(520, 780, 0.14, 'triangle', 0.14); tone(780, 1040, 0.12, 'triangle', 0.1, 0.09); vibra(25); },
      tap: function () { tone(660, 660, 0.07, 'sine', 0.08); },
      error: function () { tone(220, 160, 0.18, 'sawtooth', 0.08); },
      upgrade: function () { tone(440, 660, 0.12, 'triangle', 0.12); tone(660, 880, 0.12, 'triangle', 0.12, 0.1); tone(880, 1174, 0.16, 'triangle', 0.12, 0.2); vibra(40); },
    };
  })();

  async function boot() {
    var bar = document.getElementById('loadBar');
    var store = await window.SushiAssets.loadAll(function (done, total) {
      bar.style.width = Math.round(done / total * 100) + '%';
    });

    var renderer = window.SushiRender.createRenderer(store);
    var uiState = { screen: 'restaurant', mapScroll: 0, towerScroll: 0 };

    var state, offline, loaded;
    try {
      loaded = SIM.load(window.localStorage, Date.now());
      state = loaded.state; offline = loaded.offline;
    } catch (e) { state = null; loaded = null; }
    if (!state) state = SIM.createGame((Math.random() * 1e9) | 0);
    var rng = SIM.makeRng(state.seed ^ 0x9e3779b9);
    SFX.bind(state);

    function doAddFloor() {
      var r = SIM.addFloor(state);
      if (r.ok) { ui.toast('Thêm tầng ' + state.floors.length + '!'); SFX.upgrade(); }
      else { ui.toast(r.reason === 'max' ? 'Đã tối đa số tầng!' : 'Chưa đủ coin!'); SFX.error(); }
      afterAction();
    }
    function doUpgradeFloor(i, mode) {
      var r = SIM.upgradeFloor(state, i, mode);
      if (r.ok) { ui.toast('Tầng ' + (i + 1) + ' lên Lv.' + state.floors[i].level + '!'); SFX.upgrade(); }
      else { ui.toast(r.reason === 'max' ? 'Đã tối đa!' : 'Chưa đủ coin!'); SFX.error(); }
      ui.refreshFloorPopup(state, i);
      afterAction();
    }
    function doTowerBoost() {
      var r = SIM.tapBoost(state);
      ui.toast(r.ok ? 'BOOST x2 toàn tháp (30s)!' : 'Đang hồi chiêu!');
      if (r.ok) SFX.buy(); else SFX.error();
      afterAction();
    }

    var ui = window.SushiUI.createUI({
      onScreen: function (name) {
        if (name === 'shop') { ui.openShop(state); return; }
        ui.closeShop();
        uiState.screen = name;
        ui.setScreen(name);
      },
      onAddFloor: doAddFloor,
      onUpgradeFloor: doUpgradeFloor,
      onTowerBoost: doTowerBoost,
      onHireStaff: function (kind) {
        var r = SIM.hireStaff(state, kind);
        if (!r.ok) {
          var nF = CFG.STAFF[kind].reqFloor || 0;
          ui.toast(r.reason === 'coins' ? 'Chưa đủ coin!' :
            r.reason === 'reqFloor' ? 'Cần tháp ' + nF + ' tầng!' : 'Đã tối đa!');
          SFX.error();
        } else {
          ui.toast(CFG.STAFF[kind].name + ' Lv.' + state.staff[kind] + '!');
          SFX.buy();
        }
        afterAction();
      },
      onBuyBoost: function () {
        var r = SIM.buyBoost(state);
        ui.toast(r.ok ? 'Siêu bếp 5 phút!' : 'Chưa đủ gem!');
        if (r.ok) SFX.buy(); else SFX.error();
        afterAction();
      },
      onToggleSetting: function (k) {
        SIM.toggleSetting(state, k);
        ui.refreshSettings(state);
        save();
      },
      onVolume: function (v) {
        SIM.setVolume(state, v);
        SFX.setVolume(v);
        ui.paintVolume(v);
        save();
      },
      onOpenSettings: function () { ui.openSettings(state); },
    });

    function afterAction() {
      ui.updateHUD(state);
      ui.refreshShop(state);
      save();
    }

    function openPlotConfirm(pid) {
      var def = CFG.PLOTS.find(function (p) { return p.id === pid; });
      if (!def) return;
      if (state.plots[pid]) { ui.toast(def.name + ': ' + def.desc); return; }
      if (state.floors.length < def.reqFloor) { ui.toast('Cần tháp ' + def.reqFloor + ' tầng!'); return; }
      ui.confirmBox(
        'Mở khóa: ' + def.name,
        def.desc + '<br>Giá: <b>' + CFG.fmt(def.cost) + ' coin</b>',
        'Mở khóa',
        function () {
          var r = SIM.buyPlot(state, pid);
          ui.toast(r.ok ? 'Đã mở ' + def.name + '!' : 'Chưa đủ coin!');
          if (r.ok) SFX.buy(); else SFX.error();
          afterAction();
        }
      );
    }

    function clampTowerScroll() {
      var max = renderer.towerLayout(state, uiState).maxScroll;
      uiState.towerScroll = Math.max(0, Math.min(max, uiState.towerScroll));
    }

    window.SushiInput.createInput(canvas, {
      onTap: function (x, y) {
        SFX.unlock();
        if (ui.isShopOpen() || ui.isPopupOpen()) return; // popup tự xử lý tap
        // ưu tiên nhặt coin bay
        var bonus = renderer.tapFx(x, y);
        if (bonus > 0) {
          SIM.tapCoin(state, bonus);
          SFX.coin();
          ui.updateHUD(state);
          return;
        }
        if (uiState.screen === 'restaurant') {
          var hit = renderer.hitTest(state, uiState, x, y);
          if (!hit) return;
          if (hit.type === 'addFloor') {
            doAddFloor();
          } else if (hit.type === 'floorUp') {
            SFX.tap();
            ui.openFloorPopup(state, hit.i);
          } else if (hit.type === 'chef') {
            var r = SIM.tapChefFloor(state, hit.i);
            ui.toast(r.ok ? 'Tầng ' + (hit.i + 1) + ' nấu x2 (10s)!' : 'Đầu bếp tầng này đang hồi chiêu!');
            if (r.ok) SFX.buy(); else SFX.error();
            afterAction();
          } else if (hit.type === 'car') {
            var rw = state.car ? state.car.reward : 0;
            var r2 = SIM.collectCar(state);
            if (r2.ok) { ui.toast('Đơn drive-thru +' + CFG.fmt(rw) + ' coin!'); SFX.coin(); ui.updateHUD(state); }
          }
        } else if (uiState.screen === 'map') {
          var pid = renderer.plotAt(x, y, uiState.mapScroll);
          if (pid) openPlotConfirm(pid);
        }
      },
      onDrag: function (dy) {
        if (ui.isShopOpen() || ui.isPopupOpen()) return;
        if (uiState.screen === 'restaurant') {
          uiState.towerScroll -= dy; // kéo lên = cuộn xuống nội dung
          clampTowerScroll();
        } else if (uiState.screen === 'map') {
          uiState.mapScroll += dy;
        }
      },
      onKey: function (k) {
        if (k === 'escape') { ui.closeShop(); ui.closePopup(); }
        else if (k === 'shop') ui.openShop(state);
        else { uiState.screen = k; ui.closeShop(); ui.setScreen(k); }
      },
    });

    // test hooks qua URL (?test=...)
    function applyTestParam() {
      var tp = params.get('test');
      if (tp === 'debug-store') {
        var nulls = Object.keys(store).filter(function (k) { return !store[k]; });
        document.title = 'STORE null=' + nulls.length + ' [' + nulls.slice(0, 12).join(',') + '] total=' + Object.keys(store).length;
      }
      if (!tp) return;
      state = SIM.createGame(1234);
      SFX.bind(state);
      if (tp === 'tower4' || tp === 'popup-floor' || tp === 'shop' || tp === 'popup-offline') {
        state.coins = 50000;
        state.floors = [{ level: 3 }, { level: 5 }, { level: 1 }, { level: 0 }];
        state.staff.cashier = 5;
        // cuộn xuống đáy để thấy tầng trệt + xe
        uiState.towerScroll = 99999;
      }
      if (tp === 'popup-floor') ui.openFloorPopup(state, 1);
      else if (tp === 'popup-settings') ui.openSettings(state);
      else if (tp === 'popup-offline')
        ui.openOffline(2 * 3600 * 1000, 12500, function () {}, function (done) { done(true); });
      else if (tp === 'shop') ui.openShop(state);
      var scr = params.get('screen');
      if (scr === 'map') { uiState.screen = 'map'; ui.setScreen('map'); }
    }

    function save() {
      try { SIM.save(state, window.localStorage, Date.now()); } catch (e) { /* ignore */ }
    }
    // KHÔNG autosave khi đang test (tránh bẩn localStorage)
    if (!params.get('test')) {
      setInterval(save, 10000);
      document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
      window.addEventListener('beforeunload', save);
    }

    applyTestParam();
    ui.updateHUD(state);
    ui.setScreen(uiState.screen);
    document.getElementById('loading').classList.add('hidden');

    if (!params.get('test')) {
      if (offline && offline.earned > 0) {
        var gems0 = state.gems;
        ui.openOffline(offline.awayMs, offline.earned,
          function () { /* đã cộng sẵn khi load */ },
          function (done) {
            // CLAIM 2X: tốn 5 gem, nhận thêm = earned
            if (state.gems < 5) { ui.toast('Chưa đủ gem!'); done(false); return; }
            state.gems -= 5;
            state.coins += offline.earned;
            state.stats.earned += offline.earned;
            ui.toast('Nhận x2! +' + CFG.fmt(offline.earned * 2) + ' coin');
            SFX.buy();
            ui.updateHUD(state);
            save();
            done(true);
          });
      }
      else if (!loaded || !loaded.state) ui.toast('Chào mừng đến Sushi Idle!');
    }

    // loop
    var last = performance.now(), hudT = 0;
    function frame(now) {
      var dt = Math.min(100, now - last);
      last = now;
      SIM.stepGame(state, dt, rng);
      renderer.spawnFxFromSim(SIM.drainFx(state));
      renderer.updateFx(dt / 1000);
      renderer.draw(ctx, state, uiState, now);
      hudT += dt;
      if (hudT > 500) { hudT = 0; ui.updateHUD(state); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // cho test headless đọc được
    window.__sushi = { state: state, sim: SIM, cfg: CFG, uiState: uiState, ui: ui, renderer: renderer };
  }

  boot().catch(function (err) {
    document.getElementById('loadText').textContent = 'Lỗi tải game: ' + err.message;
    console.error(err);
  });
})();
