/* js/render.js — Vẽ game lên canvas. Browser-only. KHÔNG sửa sim state. */
(function (root) {
  'use strict';
  var CFG = root.SushiConfig, A = root.SushiAssets;
  var W = CFG.W, H = CFG.H;

  function createRenderer(store) {
    // cache dãy frame
    var chefCook = A.frames(store, 'chefCook', 20);
    var chefWalk = A.frames(store, 'chefWalk', 20);
    var chefServe = A.frames(store, 'chefServe', 20);
    var cashierF = A.frames(store, 'cashier', 40);
    var waiterF = A.frames(store, 'waiter', 20);
    var delivF = A.frames(store, 'deliv', 20);
    var carF = A.frames(store, 'car', 40);

    var fx = []; // particles do render quản lý {kind,x,y,vx,vy,t,life,value,label,img}

    function rr(ctx, x, y, w, h, r) { // rounded rect path
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function drawImg(ctx, img, x, y, w, h) {
      if (!img) return false;
      if (w === undefined) ctx.drawImage(img, x, y);
      else ctx.drawImage(img, x, y, w, h);
      return true;
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
      var tx = 78, ty = 34; // vị trí HUD coin
      for (var i = fx.length - 1; i >= 0; i--) {
        var p = fx[i];
        p.t += dt;
        if (p.kind === 'coin') {
          // bay cong về HUD coin
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
    // tap vào coin bay -> trả về tổng bonus, 0 nếu không trúng
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

    // --- nhân vật chibi (khách vẽ tay vì kit không có sprite khách) ---
    function drawCustomer(ctx, x, yBase, color, phase) {
      var bob = phase === 'eating' ? Math.sin(Date.now() / 130) * 2 : 0;
      var y = yBase + bob;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(x, yBase + 4, 16, 5, 0, 0, 7); ctx.fill();
      // thân
      ctx.fillStyle = color;
      rr(ctx, x - 13, y - 34, 26, 26, 9); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.stroke();
      // đầu
      ctx.fillStyle = '#ffd9b3';
      ctx.beginPath(); ctx.arc(x, y - 44, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 2; ctx.stroke();
      // tóc
      ctx.fillStyle = '#4a2f1d';
      ctx.beginPath(); ctx.arc(x, y - 47, 12, Math.PI, 0); ctx.fill();
      // mắt
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(x - 4.5, y - 43, 1.8, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4.5, y - 43, 1.8, 0, 7); ctx.fill();
      if (phase === 'eating') { // miệng nhai
        ctx.strokeStyle = '#a55'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y - 38, 3.5, 0.2, Math.PI - 0.2); ctx.stroke();
      }
    }

    function bubble(ctx, x, y, w, h) {
      ctx.fillStyle = 'rgba(255,255,255,.96)';
      rr(ctx, x - w / 2, y - h / 2, w, h, 10); ctx.fill();
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.96)';
      ctx.beginPath();
      ctx.moveTo(x - 6, y + h / 2 - 1); ctx.lineTo(x + 6, y + h / 2 - 1); ctx.lineTo(x, y + h / 2 + 8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // ================= MÀN NHÀ HÀNG =================
    var LAYOUT = {
      floorY: 148, chefX: 292, cashierX: 66, counterY: 400,
    };
    // Emoji dự phòng khi icon món ăn chưa kịp tải / thiếu file
    var DISH_EMOJI = { nigiri: '🍣', maki: '🍙', temaki: '🍱', uramaki: '🍘', sashimi: '🐟', dragon: '🐉' };
    function drawRestaurant(ctx, s, nowMs) {
      var t = nowMs / 1000;
      // nền tường ấm
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#241610'); g.addColorStop(0.45, '#3a2415'); g.addColorStop(1, '#1c110a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // ảnh tầng (1056x340 -> fit width)
      var fl = store['floor' + s.floor] || store.floor1;
      var fw = W, fh = fw * 340 / 1056;
      var fy = LAYOUT.floorY;
      if (fl) ctx.drawImage(fl, 0, fy, fw, fh);
      var feetY = fy + fh - 8;

      // sàn gỗ dưới nhà hàng (vân ván mờ cho đỡ trống)
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2;
      for (var py = feetY + 60; py < H - 90; py += 30) {
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
      }

      // đầu bếp (đang nấu -> cooking, bưng -> serve, còn lại walk tại chỗ)
      var chefImg;
      if (s.cooking) chefImg = A.anim(chefCook, t, 8);
      else if (s.customers.some(function (c) { return c.phase === 'beingServed'; })) chefImg = A.anim(chefServe, t, 8);
      else chefImg = A.anim(chefWalk, t, 4);
      if (chefImg) {
        var cw = 76, chh = cw * chefImg.height / chefImg.width;
        ctx.drawImage(chefImg, LAYOUT.chefX - cw / 2, feetY - chh, cw, chh);
        // tap boost: hào quang
        if (s.t / 1000 < s.buffs.cookUntil) {
          ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(LAYOUT.chefX, feetY - chh / 2, 46 + Math.sin(t * 6) * 3, 0, 7); ctx.stroke();
          text(ctx, 'x2', LAYOUT.chefX, feetY - chh - 16, 18, '#ffd54f');
        }
        // tiến độ nấu
        if (s.cooking) {
          var pr = 1 - s.cooking.t / s.cooking.total;
          ctx.fillStyle = 'rgba(0,0,0,.5)';
          rr(ctx, LAYOUT.chefX - 34, feetY - chh - 26, 68, 10, 5); ctx.fill();
          ctx.fillStyle = '#ffb300';
          rr(ctx, LAYOUT.chefX - 32, feetY - chh - 24, 64 * Math.min(1, pr), 6, 3); ctx.fill();
          var di = store[A.DISH_ICON[s.cooking.dish]];
          if (di) ctx.drawImage(di, LAYOUT.chefX + 38, feetY - chh - 30, 24, 24);
        }
        // hàng đợi
        if (s.queue.length) text(ctx, 'Chờ: ' + s.queue.length, LAYOUT.chefX, feetY + 16, 14, '#ffcc80');
      }

      // thu ngân
      var csImg = A.anim(cashierF, t, 6);
      if (csImg) {
        var csw = 84, csh = csw * csImg.height / csImg.width;
        ctx.drawImage(csImg, LAYOUT.cashierX - csw / 2, feetY - csh, csw, csh);
      }

      // phục vụ đi qua đi lại (thuê rồi thì nhanh nhẹn hơn)
      {
        var busy = s.customers.some(function (c) { return c.phase === 'beingServed'; });
        var wx = 150 + Math.sin(t * (busy ? 2.2 : 0.9)) * 90;
        var wImg = A.anim(waiterF, t, busy ? 10 : 6);
        if (wImg) {
          var ww = 62, wh = ww * wImg.height / wImg.width;
          var flip = Math.cos(t * (busy ? 2.2 : 0.9)) > 0;
          ctx.save();
          ctx.translate(wx, feetY + 44); ctx.scale(flip ? -1 : 1, 1);
          ctx.drawImage(wImg, -ww / 2, -wh, ww, wh);
          ctx.restore();
        }
      }

      // quầy bar + ghế
      var cy = LAYOUT.counterY;
      ctx.fillStyle = '#5d3a1e';
      rr(ctx, 14, cy, W - 28, 30, 12); ctx.fill();
      ctx.fillStyle = '#7a4f28';
      rr(ctx, 14, cy, W - 28, 12, 8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      for (var si = 0; si < 6; si++) {
        var sx = (0.14 + 0.72 * (si / 5)) * W;
        ctx.beginPath(); ctx.arc(sx, cy + 44, 9, 0, 7); ctx.fill();
      }

      // khách
      var n = CFG.FLOORS[s.floor].tables;
      for (var i = 0; i < s.customers.length; i++) {
        var c = s.customers[i];
        var cx = c.x * W, cby = cy - 2;
        drawCustomer(ctx, cx, cby, c.color, c.phase);
        if (c.phase === 'ordering' || c.phase === 'waiting' || c.phase === 'beingServed') {
          var bx = cx, by = cby - 92;
          bubble(ctx, bx, by, 52, 40);
          var di2 = c.dish && store[A.DISH_ICON[c.dish]];
          if (di2) ctx.drawImage(di2, bx - 13, by - 14, 26, 26);
          else text(ctx, DISH_EMOJI[c.dish] || '?', bx, by, 20, '#8a5a2b');
          if (c.phase === 'waiting') { // thanh kiên nhẫn
            var pr2 = c.t / 60;
            ctx.fillStyle = 'rgba(0,0,0,.4)';
            rr(ctx, bx - 22, by + 24, 44, 6, 3); ctx.fill();
            ctx.fillStyle = pr2 > 0.35 ? '#8bc34a' : '#e53935';
            rr(ctx, bx - 21, by + 25, 42 * Math.max(0, pr2), 4, 2); ctx.fill();
          }
        } else if (c.phase === 'eating') {
          bubble(ctx, cx, cby - 92, 40, 32);
          text(ctx, '...', cx, cby - 92, 16, '#8a5a2b');
        }
      }
      void n;

      // giao hàng đi bộ dưới cùng (nếu đã thuê)
      if (s.staff.delivery > 0) {
        var dx = (0.5 + 0.42 * Math.sin(t * 0.7)) * W;
        var dImg = A.anim(delivF, t, 8);
        if (dImg) {
          var dw = 44, dh = dw * dImg.height / dImg.width;
          ctx.save();
          ctx.translate(dx, 700); ctx.scale(Math.cos(t * 0.7) > 0 ? 1 : -1, 1);
          ctx.drawImage(dImg, -dw / 2, -dh, dw, dh);
          ctx.restore();
        }
      }

      // xe drive-thru
      if (s.car) {
        var carImg = A.anim(carF, t, 12);
        var carW = 150, carH = carW * 167 / 236;
        var carX = s.car.x * W - carW / 2, carY = 596;
        if (carImg) ctx.drawImage(carImg, carX, carY, carW, carH);
        // nhãn tap
        var pulse = 1 + Math.sin(t * 5) * 0.06;
        ctx.save(); ctx.translate(carX + carW / 2, carY - 18); ctx.scale(pulse, pulse);
        ctx.fillStyle = 'rgba(255,183,0,.95)';
        rr(ctx, -104, -17, 208, 34, 17); ctx.fill();
        ctx.strokeStyle = '#7a4f00'; ctx.lineWidth = 2; ctx.stroke();
        text(ctx, 'Đơn drive-thru! Chạm để nhận', 0, 1, 14, '#5d3a00');
        ctx.restore();
      }

      drawFx(ctx);
    }

    // ================= MÀN BẢN ĐỒ =================
    var PLOT_POS = { // tọa độ fraction trên ảnh đảo
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
      // mây trôi
      if (store.mapClouds) {
        var cx = ((t * 12) % (W + 200)) - 100;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(store.mapClouds, cx, iy + 40, 160, 57);
        ctx.drawImage(store.mapClouds, W - cx - 60, iy + ih - 120, 130, 46);
        ctx.globalAlpha = 1;
      }
      // các ô đất
      for (var i = 0; i < CFG.PLOTS.length; i++) {
        var p = CFG.PLOTS[i], pos = PLOT_POS[p.id];
        var px = pos[0] * W, py = iy + pos[1] * ih;
        var owned = !!s.plots[p.id];
        var bImg = owned ? store.mapAvail : store.mapLocked;
        var bw = 76, bh = bw * 250 / 260;
        if (bImg) ctx.drawImage(bImg, px - bw / 2, py - bh / 2, bw, bh);
        if (!owned) {
          if (store.mapLock) ctx.drawImage(store.mapLock, px - 16, py - 52, 32, 38);
          if (s.floor < p.reqFloor) text(ctx, 'Tầng ' + p.reqFloor, px, py - bh / 2 - 14, 13, '#fff');
        }
        // nameplate
        if (store.nameplate) {
          ctx.drawImage(store.nameplate, px - 52, py + bh / 2 + 22, 104, 39);
          text(ctx, owned ? p.name : '???', px, py + bh / 2 + 41, 13, owned ? '#4a2f1d' : '#999');
        }
      }
      text(ctx, 'Chạm vào ô đất để mở khóa', W / 2, H - 96, 15, '#fff');
    }

    // tap vào ô đất trên bản đồ -> trả về plot id hoặc null
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

    // hit test cho tap trên canvas (màn nhà hàng)
    function hitTest(s, ui, x, y) {
      if (ui.screen !== 'restaurant') return null;
      var fy = LAYOUT.floorY, fh = W * 340 / 1056, feetY = fy + fh - 8;
      // đầu bếp
      if (Math.abs(x - LAYOUT.chefX) < 48 && y > feetY - 130 && y < feetY + 20) return 'chef';
      // xe
      if (s.car) {
        var carX = s.car.x * W;
        if (Math.abs(x - carX) < 90 && y > 570 && y < 730) return 'car';
      }
      return null;
    }

    function draw(ctx, s, ui, nowMs) {
      ctx.clearRect(0, 0, W, H);
      if (ui.screen === 'map') drawMap(ctx, s, nowMs, ui);
      else drawRestaurant(ctx, s, nowMs);
      drawFx(ctx);
    }

    return {
      draw: draw, hitTest: hitTest, plotAt: plotAt,
      spawnFxFromSim: spawnFxFromSim, updateFx: updateFx, tapFx: tapFx,
      LAYOUT: LAYOUT,
    };
  }

  root.SushiRender = { createRenderer: createRenderer };
})(typeof self !== 'undefined' ? self : this);
