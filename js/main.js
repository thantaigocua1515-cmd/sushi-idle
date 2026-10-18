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
    // HUD + nav bám đúng chiều rộng canvas
    document.getElementById('hud').style.width = canvas.style.width;
    document.getElementById('bottomnav').style.width = canvas.style.width;
    canvas.width = Math.floor(CFG.W * dpr);
    canvas.height = Math.floor(CFG.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  var params = new URLSearchParams(location.search);

  async function boot() {
    var bar = document.getElementById('loadBar');
    var store = await window.SushiAssets.loadAll(function (done, total) {
      bar.style.width = Math.round(done / total * 100) + '%';
    });

    var renderer = window.SushiRender.createRenderer(store);
    var uiState = { screen: 'restaurant', mapScroll: 0 };

    var state, offline;
    try {
      var loaded = SIM.load(window.localStorage, Date.now());
      state = loaded.state; offline = loaded.offline;
    } catch (e) { state = null; }
    if (!state) state = SIM.createGame((Math.random() * 1e9) | 0);
    var rng = SIM.makeRng(state.seed ^ 0x9e3779b9);

    var ui = window.SushiUI.createUI({
      onScreen: function (name) {
        if (name === 'shop') { ui.openShop(state); return; }
        ui.closeShop();
        uiState.screen = name;
        ui.setScreen(name);
      },
      onBuyFloor: function () {
        var r = SIM.buyFloor(state);
        ui.toast(r.ok ? 'Lên tầng ' + state.floor + '!' : 'Chưa đủ coin!');
        afterAction();
      },
      onHireStaff: function (kind) {
        var r = SIM.hireStaff(state, kind);
        if (!r.ok) {
          ui.toast(r.reason === 'coins' ? 'Chưa đủ coin!' :
            r.reason === 'reqFloor' ? 'Cần tầng ' + CFG.STAFF[kind].reqFloor + '!' : 'Đã tối đa!');
        } else {
          ui.toast(CFG.STAFF[kind].name + ' Lv.' + state.staff[kind] + '!');
        }
        afterAction();
      },
      onBuyBoost: function () {
        var r = SIM.buyBoost(state);
        ui.toast(r.ok ? 'Siêu bếp 5 phút!' : 'Chưa đủ gem!');
        afterAction();
      },
      onToggleSetting: function (k) { SIM.toggleSetting(state, k); ui.updateHUD(state); },
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
      if (state.floor < def.reqFloor) { ui.toast('Cần nhà hàng tầng ' + def.reqFloor + '!'); return; }
      ui.confirmBox(
        'Mở khóa: ' + def.name,
        def.desc + '<br>Giá: <b>' + CFG.fmt(def.cost) + ' coin</b>',
        'Mở khóa',
        function () {
          var r = SIM.buyPlot(state, pid);
          ui.toast(r.ok ? 'Đã mở ' + def.name + '!' : 'Chưa đủ coin!');
          afterAction();
        }
      );
    }

    window.SushiInput.createInput(canvas, {
      onTap: function (x, y) {
        if (!ui.isShopOpen() && document.getElementById('popup').classList.contains('hidden')) {
          // ưu tiên nhặt coin bay
          var bonus = renderer.tapFx(x, y);
          if (bonus > 0) {
            SIM.tapCoin(state, bonus);
            ui.updateHUD(state);
            return;
          }
        }
        if (uiState.screen === 'restaurant' && ui.isShopOpen() === false) {
          var hit = renderer.hitTest(state, uiState, x, y);
          if (hit === 'chef') {
            var r = SIM.tapChef(state);
            ui.toast(r.ok ? 'Đầu bếp tăng tốc x2 (10s)!' : 'Đang hồi chiêu, quay lại sau nhé!');
          } else if (hit === 'car') {
            var rw = state.car ? state.car.reward : 0;
            var r2 = SIM.collectCar(state);
            if (r2.ok) { ui.toast('Đơn drive-thru +' + CFG.fmt(rw) + ' coin!'); ui.updateHUD(state); }
          }
        } else if (uiState.screen === 'map') {
          var pid = renderer.plotAt(x, y, uiState.mapScroll);
          if (pid) openPlotConfirm(pid);
        }
      },
      onKey: function (k) {
        if (k === 'escape') { ui.closeShop(); ui.closePopup(); }
        else if (k === 'shop') ui.openShop(state);
        else { uiState.screen = k; ui.closeShop(); ui.setScreen(k); }
      },
    });

    // màn hình theo ?screen= (để test chụp ảnh)
    var scr = params.get('screen');
    if (scr === 'map') { uiState.screen = 'map'; ui.setScreen('map'); }
    else if (scr === 'shop') { ui.openShop(state); }

    function save() {
      try { SIM.save(state, window.localStorage, Date.now()); } catch (e) { /* ignore */ }
    }
    setInterval(save, 10000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
    window.addEventListener('beforeunload', save);

    ui.updateHUD(state);
    ui.setScreen(uiState.screen);
    document.getElementById('loading').classList.add('hidden');

    if (offline && offline.earned > 0) ui.welcomeBack(offline.awayMs, offline.earned);
    else if (!loaded || !loaded.state) ui.toast('Chào mừng đến Sushi Idle!');

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
    window.__sushi = { state: state, sim: SIM, cfg: CFG, uiState: uiState };
  }

  boot().catch(function (err) {
    document.getElementById('loadText').textContent = 'Lỗi tải game: ' + err.message;
    console.error(err);
  });
})();
