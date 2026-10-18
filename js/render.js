/* js/render.js — Vẽ game lên canvas. Browser-only. KHÔNG sửa sim state. */
(function (root) {
  'use strict';
  var CFG = root.SushiConfig, A = root.SushiAssets;
  var W = CFG.W, H = CFG.H;

  // Kích thước layout tháp (design 390x844)
  var VIEW_TOP = 78, VIEW_BOTTOM = 760;
  var FLOOR_W = W, FLOOR_H = Math.round(W * 340 / 1056); // 126
  var GROUND_H = Math.round(W * 412 / 1040);            // 155
  var ROAD_H = 88, ADD_H = 60;

  function createRenderer(store) {
    // cache dãy frame
    var chefCook = A.frames(store, 'chefCook', 20);
    var chefServe = A.frames(store, 'chefServe', 20);

    // ============ KHÁCH + THANG MÁY + ĐẦU BẾP (render-local, thuần visual) ============
    var KITCHEN_X = 248;
    var ELEV_SPEED = 150, ELEV_PAUSE = 1.6, CAB_W = 52, CAB_H = 64, DOOR_X = 58;
    var elev = { y: 0, stopIdx: 0, dir: 1, pauseT: 1.2, riders: [], init: false, nStops: 0 };
    var flow = { list: [], nextId: 1, spawnT: 2 };
    var chefSt = {}; // fi -> {mode, x, cookT, serveT, cust}
    var lastNow = 0;

    function tableSpots() { return [92, 172]; }
    function floorFy(i, L) {
      for (var f = 0; f < L.floors.length; f++) if (L.floors[f].i === i) return L.floors[f].fy;
      return 0;
    }
    // điểm dừng: 0 = trệt, s>=1 = tầng (s-1) — xếp từ dưới lên để thang đi lên từng tầng
    function elevStops(L) {
      var stops = [{ y: L.groundY + GROUND_H - 78, floor: -1 }];
      for (var i = 0; i < L.floors.length; i++)
        stops.push({ y: floorFy(i, L) + FLOOR_H - 78, floor: i });
      return stops;
    }
    function elevNextDir() {
      if (elev.stopIdx <= 0) return 1;
      if (elev.stopIdx >= elev.nStops - 1) return -1;
      return elev.dir;
    }
    function updateElev(dt, L) {
      var stops = elevStops(L);
      elev.nStops = stops.length;
      if (elev.stopIdx > stops.length - 1) elev.stopIdx = stops.length - 1;
      if (!elev.init) { elev.y = stops[0].y; elev.init = true; }
      var target = stops[elev.stopIdx].y;
      if (elev.pauseT > 0) {
        elev.pauseT -= dt;
        elev.y = target;
        if (elev.pauseT <= 0) {
          var nx = elev.stopIdx + elev.dir;
          if (nx >= stops.length) { elev.dir = -1; nx = elev.stopIdx - 1; }
          else if (nx < 0) { elev.dir = 1; nx = elev.stopIdx + 1; }
          elev.stopIdx = nx;
        }
        return;
      }
      var d = target - elev.y;
      var step = ELEV_SPEED * dt;
      if (Math.abs(d) <= step) { elev.y = target; elev.pauseT = ELEV_PAUSE; }
      else elev.y += (d > 0 ? step : -step);
    }

    function spotFree(i, k) {
      for (var j = 0; j < flow.list.length; j++) {
        var c = flow.list[j];
        if (c.floor === i && c.spot === k &&
            (c.state === 'toTable' || c.state === 'ordering' || c.state === 'eating')) return false;
      }
      return true;
    }
    function trySpawn(L, N) {
      if (flow.list.length >= 2 * N) return;
      var free = [];
      for (var i = 0; i < N; i++)
        for (var k = 0; k < 2; k++)
          if (spotFree(i, k)) free.push({ i: i, k: k });
      if (!free.length) return;
      var pick = free[(Math.random() * free.length) | 0];
      flow.list.push({
        id: flow.nextId++,
        variant: (Math.random() * 4) | 0,
        dish: CFG.DISH_IDS[(Math.random() * CFG.DISH_IDS.length) | 0],
        floor: pick.i, spot: pick.k,
        state: 'toElevator', x: W + 30, y: L.roadY + 55, rideY: 0, eatT: 0,
      });
    }
    function updateFlow(dt, L, N) {
      flow.spawnT -= dt;
      if (flow.spawnT <= 0) { flow.spawnT = 5; trySpawn(L, N); }
      var stops = elevStops(L);
      var cabFeet = elev.y + CAB_H - 6;
      for (var j = flow.list.length - 1; j >= 0; j--) {
        var cu = flow.list[j];
        switch (cu.state) {
          case 'toElevator':
            cu.y = L.roadY + 55;
            cu.x -= 55 * dt;
            if (cu.x <= DOOR_X) { cu.x = DOOR_X; cu.state = 'waitElevator'; }
            break;
          case 'waitElevator':
            cu.y = L.roadY + 55;
            if (elev.stopIdx === 0 && elev.pauseT > 0 && elevNextDir() === 1 && elev.riders.length < 2) {
              cu.state = 'riding'; cu.rideY = cu.y; elev.riders.push(cu);
            }
            break;
          case 'riding': {
            cu.rideY += (cabFeet - cu.rideY) * Math.min(1, dt * 8);
            var st = stops[elev.stopIdx];
            if (st && st.floor === cu.floor && elev.pauseT > 0) {
              var ri = elev.riders.indexOf(cu);
              if (ri >= 0) elev.riders.splice(ri, 1);
              cu.state = 'toTable'; cu.x = DOOR_X;
            }
            break;
          }
          case 'toTable': {
            cu.y = floorFy(cu.floor, L) + FLOOR_H - 8;
            var tx = tableSpots()[cu.spot], dx = tx - cu.x, step = 60 * dt;
            if (Math.abs(dx) <= step) { cu.x = tx; cu.state = 'ordering'; }
            else cu.x += (dx > 0 ? step : -step);
            break;
          }
          case 'ordering':
            cu.y = floorFy(cu.floor, L) + FLOOR_H - 8;
            break; // đầu bếp xử lý chuyển sang eating
          case 'eating':
            cu.y = floorFy(cu.floor, L) + FLOOR_H - 8;
            cu.eatT -= dt;
            if (cu.eatT <= 0) cu.state = 'toShaft';
            break;
          case 'toShaft': {
            cu.y = floorFy(cu.floor, L) + FLOOR_H - 8;
            var dx2 = DOOR_X - cu.x, step2 = 60 * dt;
            if (Math.abs(dx2) <= step2) { cu.x = DOOR_X; cu.state = 'waitDown'; }
            else cu.x += (dx2 > 0 ? step2 : -step2);
            break;
          }
          case 'waitDown':
            cu.y = floorFy(cu.floor, L) + FLOOR_H - 8;
            if (stops[elev.stopIdx] && stops[elev.stopIdx].floor === cu.floor &&
                elev.pauseT > 0 && elevNextDir() === -1 && elev.riders.length < 2) {
              cu.state = 'ridingDown'; cu.rideY = cu.y; elev.riders.push(cu);
            }
            break;
          case 'ridingDown': {
            cu.rideY += (cabFeet - cu.rideY) * Math.min(1, dt * 8);
            if (elev.stopIdx === 0 && elev.pauseT > 0) {
              var rj = elev.riders.indexOf(cu);
              if (rj >= 0) elev.riders.splice(rj, 1);
              cu.state = 'exit'; cu.x = DOOR_X; cu.y = L.roadY + 55;
            }
            break;
          }
          case 'exit':
            cu.y = L.roadY + 55;
            cu.x += 55 * dt;
            if (cu.x > W + 40) flow.list.splice(j, 1);
            break;
        }
      }
    }

    function chefState(fi) {
      if (!chefSt[fi]) chefSt[fi] = { mode: 'idle', x: KITCHEN_X, cookT: 0, serveT: 0, cust: null };
      return chefSt[fi];
    }
    function chefX(fi) { return chefState(fi).x; }
    function updateChefs(dt, N) {
      for (var fi = 0; fi < N; fi++) {
        var cs = chefState(fi);
        if (cs.mode === 'idle') {
          var target = null;
          for (var j = 0; j < flow.list.length; j++) {
            var c = flow.list[j];
            if (c.floor === fi && c.state === 'ordering') { target = c; break; }
          }
          if (target) { cs.mode = 'cooking'; cs.cookT = 2.5; cs.cust = target; }
        } else if (cs.mode === 'cooking') {
          cs.cookT -= dt;
          if (!cs.cust || cs.cust.state !== 'ordering') { cs.mode = 'idle'; cs.cust = null; }
          else if (cs.cookT <= 0) cs.mode = 'toCust';
        } else if (cs.mode === 'toCust') {
          var cu = cs.cust;
          if (!cu || cu.state !== 'ordering') { cs.mode = 'idle'; cs.cust = null; }
          else {
            var tx = tableSpots()[cu.spot] + 38, d = tx - cs.x, step = 95 * dt;
            if (Math.abs(d) <= step) { cs.x = tx; cs.mode = 'serve'; cs.serveT = 0.5; }
            else cs.x += (d > 0 ? step : -step);
          }
        } else if (cs.mode === 'serve') {
          cs.serveT -= dt;
          if (cs.serveT <= 0) {
            if (cs.cust && cs.cust.state === 'ordering') { cs.cust.state = 'eating'; cs.cust.eatT = 4; }
            cs.cust = null; cs.mode = 'back';
          }
        } else if (cs.mode === 'back') {
          var d2 = KITCHEN_X - cs.x, step2 = 95 * dt;
          if (Math.abs(d2) <= step2) { cs.x = KITCHEN_X; cs.mode = 'idle'; }
          else cs.x += (d2 > 0 ? step2 : -step2);
        }
      }
    }
    var chefWalk = A.frames(store, 'chefWalk', 20);
    var cashierF = A.frames(store, 'cashier', 40);
    var waiterF = A.frames(store, 'waiter', 20);
    var delivF = A.frames(store, 'deliv', 20); // Lift Guy: dùng cho thang máy
    var carSets = [A.frames(store, 'car', 40)];
    for (var cs = 2; cs <= 5; cs++) carSets.push(A.frames(store, 'car' + cs + '_', 40));

    var fx = []; // particles do render quản lý

    function rr(ctx, x, y, w, h, r) { // rounded rect path
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function text(ctx, s, x, y, size, color, font, align) {
      ctx.fillStyle = color || '#fff';
      ctx.font = size + 'px "' + (font || 'Lilita One') + '", sans-serif';
      ctx.textAlign = align || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s, x, y);
    }

    // --- particles ---
    function spawnFxFromSim(events) {
      for (var i = 0; i < events.length; i++) {
        var e = events[i], px = e.x * W;
        if (e.t === 'coin') {
          var n = e.big ? 6 : 3;
          for (var k = 0; k < n; k++) {
            fx.push({
              kind: 'coin', x: px + (Math.random() - 0.5) * 40, y: e.y * H,
              vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 60,
              t: 0, life: 1.6, value: Math.max(1, Math.round(e.amount / n)),
              img: store.coin, tappable: true,
            });
          }
        } else if (e.t === 'gem') {
          fx.push({ kind: 'text', x: px, y: e.y * H, vx: 0, vy: -40, t: 0, life: 2.2, label: '+' + e.amount + ' gem', color: '#7ee7ff', img: store.gems });
        } else if (e.t === 'boost' || e.t === 'floorup' || e.t === 'hire') {
          fx.push({ kind: 'text', x: px, y: e.y * H, vx: 0, vy: -34, t: 0, life: 2.0, label: e.label || 'Nâng cấp!', color: '#ffe082' });
        }
      }
    }
    function updateFx(dt) {
      var tx = 300, ty = 34; // vị trí HUD coin (mới)
      for (var i = fx.length - 1; i >= 0; i--) {
        var p = fx[i];
        p.t += dt;
        if (p.kind === 'coin') {
          var dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
          var sp = 260 + p.t * 500;
          p.vx = p.vx * 0.9 + (dx / d) * sp * 0.12;
          p.vy = p.vy * 0.9 + (dy / d) * sp * 0.12;
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (d < 26 || p.t > p.life) fx.splice(i, 1);
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.t > p.life) fx.splice(i, 1);
        }
      }
    }
    function tapFx(x, y) {
      var bonus = 0;
      for (var i = fx.length - 1; i >= 0; i--) {
        var p = fx[i];
        if (p.kind === 'coin' && p.tappable && Math.hypot(p.x - x, p.y - y) < 26) {
          bonus += Math.max(1, Math.round(p.value * 0.15));
          fx.splice(i, 1);
        }
      }
      return bonus;
    }
    function drawFx(ctx) {
      for (var i = 0; i < fx.length; i++) {
        var p = fx[i], a = 1 - p.t / p.life;
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.4));
        if (p.kind === 'coin' && p.img) {
          var s = 22 + Math.sin(p.t * 12) * 3;
          ctx.drawImage(p.img, p.x - s / 2, p.y - s / 2, s, s);
        } else if (p.kind === 'text') {
          if (p.img) ctx.drawImage(p.img, p.x - 34, p.y - 16, 26, 26);
          ctx.font = '18px "Lilita One", sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)';
          ctx.strokeText(p.label, p.x + (p.img ? 14 : 0), p.y);
          ctx.fillStyle = p.color || '#fff';
          ctx.fillText(p.label, p.x + (p.img ? 14 : 0), p.y);
        }
        ctx.globalAlpha = 1;
      }
    }

    // --- khách hàng: sprite AI-gen theo style kit (store.cust0..3), fallback blob nếu chưa tải ---
    function drawCustomer(ctx, store, x, yBase, variant, phase, scale) {
      scale = scale || 1;
      ctx.save();
      ctx.translate(x, yBase);
      var bob = (phase === 'eating' || phase === 'walking') ? Math.sin(Date.now() / 130) * 2 : 0;
      ctx.translate(0, bob);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(0, 4, 16, 5, 0, 0, 7); ctx.fill();
      var img = store['cust' + ((variant || 0) % 4)];
      if (img) {
        var h = 66 * scale, w = h * img.width / img.height;
        ctx.drawImage(img, -w / 2, -h + 4, w, h);
      } else {
        ctx.fillStyle = '#e08a97';
        rr(ctx, -13, -34, 26, 26, 9); ctx.fill();
        ctx.fillStyle = '#ffd9b3';
        ctx.beginPath(); ctx.arc(0, -44, 12, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    function bubble(ctx, x, y, w, h) {
      ctx.fillStyle = '#fdeed3'; // kem như popup kit
      rr(ctx, x - w / 2, y - h / 2, w, h, 10); ctx.fill();
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.96)';
      ctx.beginPath();
      ctx.moveTo(x - 6, y + h / 2 - 1); ctx.lineTo(x + 6, y + h / 2 - 1); ctx.lineTo(x, y + h / 2 + 8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    var DISH_EMOJI = { nigiri: '🍣', maki: '🍙', temaki: '🍱', uramaki: '🍘', sashimi: '🐟', dragon: '🐉' };

    // ---- layout tháp (dùng chung cho vẽ + hitTest) ----
    function towerLayout(s, ui) {
      var N = s.floors.length;
      var contentH = ADD_H + N * FLOOR_H + GROUND_H + ROAD_H;
      var viewportH = VIEW_BOTTOM - VIEW_TOP;
      var maxScroll = Math.max(0, contentH - viewportH);
      var scroll = Math.max(0, Math.min(maxScroll, ui.towerScroll || 0));
      var y0 = contentH <= viewportH ? VIEW_BOTTOM - contentH : VIEW_TOP - scroll;
      var addBar = { x: (W - 300) / 2, y: y0 + 8, w: 300, h: 44 };
      var floors = [];
      for (var i = N - 1; i >= 0; i--) {
        var fy = y0 + ADD_H + (N - 1 - i) * FLOOR_H;
        floors.push({
          i: i, fy: fy,
          btn: { x: W - 52, y: fy + 10, w: 42, h: 40 },
          chef: { x: 248, y: fy + 44, w: 64, h: 74 },
        });
      }
      var groundY = y0 + ADD_H + N * FLOOR_H;
      var roadY = groundY + GROUND_H;
      return {
        y0: y0, contentH: contentH, maxScroll: maxScroll, scroll: scroll,
        addBar: addBar, floors: floors, groundY: groundY, roadY: roadY,
      };
    }

    // ================= MÀN THÁP =================
    function drawTower(ctx, s, ui, nowMs, L) {
      var t = nowMs / 1000;
      var N = s.floors.length;

      // --- nền trời ---
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2f9be8'); g.addColorStop(0.55, '#7cc4f5'); g.addColorStop(1, '#c4e7fb');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // skyline xa (tòa nhà đơn giản, 2 lớp)
      function skyline(baseY, color, seed, bh) {
        ctx.fillStyle = color;
        for (var i = 0; i < 16; i++) {
          var hsh = Math.abs(Math.sin(i * 127.1 + seed * 311.7) * 43758.5) % 1;
          var bw = 34 + hsh * 44, bh2 = bh * (0.5 + hsh * 0.9);
          var bx = i * 28 - 20 + hsh * 14;
          rr(ctx, bx, baseY - bh2, bw, bh2, 4); ctx.fill();
        }
      }
      skyline(VIEW_BOTTOM - 40, 'rgba(150,195,235,.55)', 3, 190);
      skyline(VIEW_BOTTOM - 40, 'rgba(110,165,220,.6)', 7, 130);

      // mây trôi
      if (store.mapClouds) {
        var clouds = [
          { x: ((t * 9) % (W + 320)) - 160, y: 108, w: 150 },
          { x: ((t * 6 + 200) % (W + 320)) - 160, y: 210, w: 110 },
          { x: (W - ((t * 7 + 90) % (W + 320)) + 160), y: 300, w: 130 },
        ];
        ctx.globalAlpha = 0.9;
        for (var ci = 0; ci < clouds.length; ci++) {
          var cl = clouds[ci];
          ctx.drawImage(store.mapClouds, cl.x, cl.y, cl.w, cl.w * 164 / 442);
        }
        ctx.globalAlpha = 1;
      }

      // --- thanh THÊM TẦNG ---
      (function () {
        var b = L.addBar, maxed = N >= CFG.MAX_TOWER_FLOORS;
        ctx.fillStyle = '#6b4226';
        rr(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
        ctx.strokeStyle = '#4a2c17'; ctx.lineWidth = 3; ctx.stroke();
        if (store.coin) ctx.drawImage(store.coin, b.x + 14, b.y + 8, 28, 28);
        if (maxed) {
          text(ctx, 'TỐI ĐA ' + N + ' TẦNG', b.x + b.w / 2 + 14, b.y + b.h / 2, 20, '#ffe9b8', 'Bebas Neue');
        } else {
          var cost = CFG.addFloorCost(N);
          text(ctx, CFG.fmt(cost), b.x + 66, b.y + b.h / 2, 22, '#ffd54f', 'Bebas Neue', 'left');
          text(ctx, 'THÊM TẦNG', b.x + b.w - 18, b.y + b.h / 2, 20, '#ffe9b8', 'Bebas Neue', 'right');
        }
      })();

      // --- các tầng (vẽ từ trên xuống) ---
      for (var fi = 0; fi < L.floors.length; fi++) {
        (function (F) {
          var i = F.i, fy = F.fy, lvl = s.floors[i].level;
          if (fy + FLOOR_H < VIEW_TOP - 40 || fy > VIEW_BOTTOM + 40) return; // cull
          var img = store['floor' + lvl] || store.floor0;
          if (img) ctx.drawImage(img, 0, fy, FLOOR_W, FLOOR_H);

          // biển tên tầng
          var nx = 158, ny = fy - 2, nw = 150, nh = 32;
          ctx.fillStyle = '#6b4226';
          rr(ctx, nx - nw / 2, ny, nw, nh, 9); ctx.fill();
          ctx.strokeStyle = '#3d2412'; ctx.lineWidth = 2.5; ctx.stroke();
          text(ctx, 'TẦNG ' + (i + 1) + ' · LV' + lvl, nx, ny + nh / 2 + 1, 19, '#ffe9b8', 'Bebas Neue');
          // thu nhập/s nhỏ dưới biển tên
          text(ctx, '+' + CFG.fmt(root.SushiSim.floorIncome(s, i)) + '/s', nx, ny + nh + 11, 12, '#fff', 'Lilita One');

          // nút clipboard nâng cấp (mép phải)
          var b = F.btn;
          var afford = s.coins >= CFG.upgradeFloorCost(lvl) && lvl < CFG.MAX_FLOOR_LEVEL;
          var pulse = afford ? 1 + Math.sin(t * 5) * 0.07 : 1;
          if (store.btnUp) {
            var bw = b.w * pulse, bh = b.h * pulse;
            ctx.drawImage(store.btnUp, b.x + (b.w - bw) / 2, b.y + (b.h - bh) / 2, bw, bh);
          }
          if (lvl >= CFG.MAX_FLOOR_LEVEL) text(ctx, 'MAX', b.x + b.w / 2, b.y + b.h + 10, 12, '#ffd54f', 'Bebas Neue');

          // đầu bếp: idle đứng đợi, có đơn mới nấu rồi bưng khay đi giao
          var c = F.chef;
          var cs = chefState(i);
          var chx = cs.x;
          var chefImg;
          if (cs.mode === 'idle') chefImg = chefCook[0] || null;
          else if (cs.mode === 'cooking') chefImg = A.anim(chefCook, t + i * 1.7, 8);
          else if (cs.mode === 'serve') chefImg = chefServe[0] || null;
          else chefImg = A.anim(chefServe, t * 9, 9); // toCust, back
          if (chefImg) {
            var chh = c.h, cw = chh * chefImg.width / chefImg.height;
            ctx.save();
            if (cs.mode === 'back') { ctx.translate(chx, 0); ctx.scale(-1, 1); ctx.translate(-chx, 0); }
            ctx.drawImage(chefImg, chx - cw / 2, c.y + c.h / 2 - chh, cw, chh);
            ctx.restore();
            var now = s.t / 1000;
            if (now < (s.floorBuffUntil[i] || 0)) {
              ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.arc(chx, c.y, 40 + Math.sin(t * 6) * 3, 0, 7); ctx.stroke();
              text(ctx, 'x2', chx, c.y - 48, 17, '#ffd54f');
            } else if (now < (s.floorCdUntil[i] || 0)) {
              // đang hồi chiêu: không vẽ gì thêm
            }
          }

          // khách theo luồng thang máy (render-local)
          for (var cj = 0; cj < flow.list.length; cj++) {
            var cu = flow.list[cj];
            if (cu.floor !== i) continue;
            if (cu.state !== 'toTable' && cu.state !== 'ordering' && cu.state !== 'eating' &&
                cu.state !== 'toShaft' && cu.state !== 'waitDown') continue;
            var cyb = fy + FLOOR_H - 8;
            var ph = cu.state === 'eating' ? 'eating'
              : (cu.state === 'toTable' || cu.state === 'toShaft') ? 'walking' : 'idle';
            drawCustomer(ctx, store, cu.x, cyb, cu.variant, ph, 0.72);
            if (cu.state === 'ordering') {
              bubble(ctx, cu.x, cyb - 86, 48, 40);
              var di = store[A.DISH_ICON[cu.dish]];
              if (di) ctx.drawImage(di, cu.x - 16, cyb - 102, 32, 32);
              else text(ctx, DISH_EMOJI[cu.dish] || '?', cu.x, cyb - 86, 18, '#8a5a2b');
            } else if (cu.state === 'eating') {
              bubble(ctx, cu.x, cyb - 86, 36, 28);
              text(ctx, '...', cu.x, cyb - 86, 13, '#8a5a2b');
            }
          }
        })(L.floors[fi]);
      }

      // --- tầng trệt: tòa SUSHI TOWER ---
      (function () {
        var gy = L.groundY;
        if (gy > VIEW_BOTTOM + 40 || gy + GROUND_H < VIEW_TOP - 40) return;
        // cashier staff level 0..20 -> map 1..6
        var lv = Math.max(1, Math.min(6, Math.ceil(s.staff.cashier / 4) || 1));
        var img = store['cashierL' + lv] || store.cashierL1;
        if (img) ctx.drawImage(img, 0, gy, W, GROUND_H);
      })();

      // --- thang máy (vẽ SAU tòa tầng trệt để thấy rõ khách lên/xuống ở trệt) ---
      (function () {
        var sx = 8, sw = 36;
        var shaftTop = L.y0 + ADD_H + 4, shaftBot = L.groundY + GROUND_H - 4;
        if (shaftBot <= shaftTop + 60) return;
        // ray
        ctx.fillStyle = '#20140c';
        rr(ctx, sx, shaftTop, sw, shaftBot - shaftTop, 8); ctx.fill();
        ctx.strokeStyle = '#0f0905'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx + 12, shaftTop + 6); ctx.lineTo(sx + 12, shaftBot - 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx + sw - 12, shaftTop + 6); ctx.lineTo(sx + sw - 12, shaftBot - 6); ctx.stroke();
        // cabin rộng 52, căn giữa shaft; dừng theo điểm dừng (updateElev)
        var cabY = elev.y, cabX = sx + sw / 2 - CAB_W / 2;
        if (cabY + CAB_H < VIEW_TOP - 60 || cabY > VIEW_BOTTOM + 60) return;
        ctx.fillStyle = '#3a2a18';
        rr(ctx, cabX, cabY, CAB_W, CAB_H, 6); ctx.fill();
        // Lift Guy + khách trong cabin
        var lg = A.anim(delivF, t, 6);
        if (lg) {
          var lw = 24, lh = lw * lg.height / lg.width;
          ctx.drawImage(lg, cabX + 4, cabY + CAB_H - 4 - lh, lw, lh);
        }
        for (var r = 0; r < elev.riders.length; r++) {
          var rc = elev.riders[r];
          drawCustomer(ctx, store, cabX + 35 + r * 13, rc.rideY || (cabY + CAB_H - 6), rc.variant, 'idle', 0.42);
        }
        // viền cabin đè lên trên cho gọn
        ctx.strokeStyle = '#e8b32a'; ctx.lineWidth = 3;
        rr(ctx, cabX, cabY, CAB_W, CAB_H, 6); ctx.stroke();
      })();

      // --- đường + xe ---
      (function () {
        var ry = L.roadY;
        if (ry > VIEW_BOTTOM + 60 || ry + ROAD_H < VIEW_TOP - 60) return;
        // vỉa hè + mặt đường
        ctx.fillStyle = '#9aa0ab'; ctx.fillRect(0, ry, W, 10);
        ctx.fillStyle = '#3c414c'; ctx.fillRect(0, ry + 10, W, ROAD_H - 22);
        ctx.fillStyle = '#57a85a'; ctx.fillRect(0, ry + ROAD_H - 12, W, 12);
        // vạch đứt giữa đường
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        for (var dx = -20; dx < W + 20; dx += 44) {
          ctx.fillRect(dx, ry + 10 + (ROAD_H - 22) / 2 - 2, 24, 4);
        }
        // 5 xe ambient, 2 làn — sprite xe quay mặt TRÁI sẵn:
        // làn trên đi sang trái (không lật), làn dưới đi sang phải (lật ngang)
        var lanes = [ry + 26, ry + 58];
        var laneCars = [[0, 2, 4], [1, 3]];
        var carSpeed = 52, span = W + 320;
        var orderX = s.car ? s.car.x * W : null;
        for (var li = 0; li < laneCars.length; li++) {
          var right = li === 1, ids = laneCars[li];
          for (var j = 0; j < ids.length; j++) {
            var k = ids[j];
            var set = carSets[k] || carSets[0];
            var img = A.anim(set, t, 10);
            if (!img) continue;
            var off = (span / ids.length) * j;
            var x = right
              ? ((t * carSpeed + off) % span) - 160
              : span - 160 - ((t * carSpeed + off) % span);
            if (orderX !== null && Math.abs(x + 52 - orderX) < 150) continue; // tránh xe đơn drive-thru
            var cw = 104, ch = cw * img.height / img.width;
            var cy2 = lanes[li];
            ctx.save();
            if (right) { ctx.translate(x + cw / 2, 0); ctx.scale(-1, 1); ctx.translate(-(x + cw / 2), 0); }
            ctx.drawImage(img, x, cy2 - ch / 2, cw, ch);
            ctx.restore();
          }
        }
        // xe đơn drive-thru (từ sim)
        if (s.car) {
          var cImg = A.anim(carSets[0], t, 12);
          var cW = 128, cH = cW * 167 / 236;
          var carX = s.car.x * W - cW / 2, carY = lanes[0];
          if (cImg) ctx.drawImage(cImg, carX, carY - cH / 2, cW, cH);
          var pulse = 1 + Math.sin(t * 5) * 0.06;
          ctx.save(); ctx.translate(carX + cW / 2, carY - cH / 2 - 16); ctx.scale(pulse, pulse);
          ctx.fillStyle = 'rgba(255,183,0,.95)';
          rr(ctx, -104, -17, 208, 34, 17); ctx.fill();
          ctx.strokeStyle = '#7a4f00'; ctx.lineWidth = 2; ctx.stroke();
          text(ctx, 'Đơn drive-thru! Chạm để nhận', 0, 1, 14, '#5d3a00');
          ctx.restore();
        }
      })();

      // --- khách ở mặt đất: đi tới / đợi / rời thang máy ---
      (function () {
        var gyb = L.roadY + 55;
        if (gyb > VIEW_BOTTOM + 40 || gyb < VIEW_TOP - 40) return;
        for (var j = 0; j < flow.list.length; j++) {
          var cu = flow.list[j];
          if (cu.state !== 'toElevator' && cu.state !== 'waitElevator' && cu.state !== 'exit') continue;
          drawCustomer(ctx, store, cu.x, gyb, cu.variant,
            cu.state === 'waitElevator' ? 'idle' : 'walking', 0.72);
        }
      })();

      drawFx(ctx);
    }

    // ================= MÀN BẢN ĐỒ (giữ nguyên) =================
    var PLOT_POS = {
      drivethru: [0.60, 0.30], garden: [0.32, 0.47], fishmarket: [0.60, 0.60],
      warehouse: [0.38, 0.73], tower: [0.30, 0.20],
    };
    function drawMap(ctx, s, nowMs, ui) {
      var t = nowMs / 1000;
      ctx.fillStyle = '#29a3d8'; ctx.fillRect(0, 0, W, H);
      var isl = store.island;
      var iw = W, ih = iw * 3118 / 1903;
      var iy = 84 + (ui.mapScroll || 0);
      if (isl) ctx.drawImage(isl, 0, iy, iw, ih);
      if (store.mapClouds) {
        var cx = ((t * 12) % (W + 200)) - 100;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(store.mapClouds, cx, iy + 40, 160, 57);
        ctx.drawImage(store.mapClouds, W - cx - 60, iy + ih - 120, 130, 46);
        ctx.globalAlpha = 1;
      }
      for (var i = 0; i < CFG.PLOTS.length; i++) {
        var p = CFG.PLOTS[i], pos = PLOT_POS[p.id];
        var px = pos[0] * W, py = iy + pos[1] * ih;
        var owned = !!s.plots[p.id];
        var bImg = owned ? store.mapAvail : store.mapLocked;
        var bw = 76, bh = bw * 250 / 260;
        if (bImg) ctx.drawImage(bImg, px - bw / 2, py - bh / 2, bw, bh);
        if (!owned) {
          if (store.mapLock) ctx.drawImage(store.mapLock, px - 16, py - 52, 32, 38);
          if (s.floors.length < p.reqFloor) text(ctx, s.floors.length + '/' + p.reqFloor + ' tầng', px, py - bh / 2 - 14, 13, '#fff');
        }
        if (store.nameplate) {
          ctx.drawImage(store.nameplate, px - 52, py + bh / 2 + 22, 104, 39);
          text(ctx, owned ? p.name : '???', px, py + bh / 2 + 41, 13, owned ? '#4a2f1d' : '#999');
        }
      }
      text(ctx, 'Chạm vào ô đất để mở khóa', W / 2, H - 96, 15, '#fff');
    }

    function plotAt(x, y, mapScroll) {
      var iw = W, ih = iw * 3118 / 1903;
      var iy = 84 + (mapScroll || 0);
      for (var i = 0; i < CFG.PLOTS.length; i++) {
        var p = CFG.PLOTS[i], pos = PLOT_POS[p.id];
        var px = pos[0] * W, py = iy + pos[1] * ih;
        if (Math.abs(x - px) < 55 && Math.abs(y - py) < 60) return p.id;
      }
      return null;
    }

    // hit test cho tap trên canvas (màn tháp)
    function hitTest(s, ui, x, y) {
      if (ui.screen !== 'restaurant') return null;
      if (y < VIEW_TOP || y > VIEW_BOTTOM) return null;
      var L = towerLayout(s, ui);
      var b = L.addBar;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return { type: 'addFloor' };
      for (var fi = 0; fi < L.floors.length; fi++) {
        var F = L.floors[fi];
        if (x >= F.btn.x && x <= F.btn.x + F.btn.w && y >= F.btn.y && y <= F.btn.y + F.btn.h)
          return { type: 'floorUp', i: F.i };
        var c = F.chef;
        if (Math.abs(x - chefX(F.i)) < 44 && y > c.y - c.h && y < c.y + c.h * 0.7)
          return { type: 'chef', i: F.i };
      }
      if (s.car) {
        var carX = s.car.x * W;
        if (Math.abs(x - carX) < 90 && y > L.roadY && y < L.roadY + ROAD_H) return { type: 'car' };
      }
      return null;
    }

    function draw(ctx, s, ui, nowMs) {
      ctx.clearRect(0, 0, W, H);
      var dt = 0;
      if (lastNow > 0) dt = Math.min(0.1, Math.max(0, (nowMs - lastNow) / 1000));
      lastNow = nowMs;
      if (ui.screen === 'map') {
        drawMap(ctx, s, nowMs, ui);
      } else {
        var L = towerLayout(s, ui);
        ui.towerScroll = L.scroll; // clamp
        updateElev(dt, L);
        updateFlow(dt, L, s.floors.length);
        updateChefs(dt, s.floors.length);
        drawTower(ctx, s, ui, nowMs, L);
      }
      drawFx(ctx);
    }

    return {
      draw: draw, hitTest: hitTest, plotAt: plotAt,
      spawnFxFromSim: spawnFxFromSim, updateFx: updateFx, tapFx: tapFx,
      towerLayout: towerLayout, VIEW_TOP: VIEW_TOP, VIEW_BOTTOM: VIEW_BOTTOM,
    };
  }

  root.SushiRender = { createRenderer: createRenderer };
})(typeof self !== 'undefined' ? self : this);
