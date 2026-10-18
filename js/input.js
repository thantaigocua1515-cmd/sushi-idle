/* js/input.js — Tap (chuột + touch) + kéo dọc (drag-scroll) trên canvas + phím tắt. Browser-only. */
(function (root) {
  'use strict';
  var CFG = root.SushiConfig;
  var TAP_SLOP = 14; // px logic: dưới ngưỡng này tính là tap

  function createInput(canvas, opts) {
    var o = opts || {};

    // canvas hiển thị có thể scale (CSS) -> đổi về tọa độ logic 390x844
    function toLogical(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      return {
        x: (clientX - r.left) / r.width * CFG.W,
        y: (clientY - r.top) / r.height * CFG.H,
      };
    }

    var downPos = null, lastPos = null, dragging = false;

    canvas.addEventListener('pointerdown', function (e) {
      downPos = toLogical(e.clientX, e.clientY);
      lastPos = downPos;
      dragging = false;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!downPos) return;
      var p = toLogical(e.clientX, e.clientY);
      var moved = Math.hypot(p.x - downPos.x, p.y - downPos.y);
      if (moved > TAP_SLOP) dragging = true;
      if (dragging && o.onDrag) {
        o.onDrag(p.y - lastPos.y); // dy dương = kéo xuống
      }
      lastPos = p;
    });
    function endPointer(e) {
      if (!downPos) return;
      var p = toLogical(e.clientX, e.clientY);
      if (!dragging && Math.hypot(p.x - downPos.x, p.y - downPos.y) < TAP_SLOP && o.onTap) {
        o.onTap(p.x, p.y);
      }
      downPos = null; lastPos = null; dragging = false;
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', function () { downPos = null; lastPos = null; dragging = false; });
    // chặn menu chuột phải / bôi đen khi tap nhanh
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // wheel (desktop): cuộn dọc
    canvas.addEventListener('wheel', function (e) {
      if (o.onDrag) { o.onDrag(-e.deltaY * 0.5); e.preventDefault(); }
    }, { passive: false });

    // phím tắt: 1/2/3 đổi màn hình, Esc đóng modal
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      if (e.key === '1' && o.onKey) o.onKey('restaurant');
      else if (e.key === '2' && o.onKey) o.onKey('map');
      else if (e.key === '3' && o.onKey) o.onKey('shop');
      else if (e.key === 'Escape' && o.onKey) o.onKey('escape');
    });
  }

  root.SushiInput = { createInput: createInput };
})(typeof self !== 'undefined' ? self : this);
