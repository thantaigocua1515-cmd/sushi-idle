/* js/input.js — Tap (chuột + touch) trên canvas + phím tắt. Browser-only. */
(function (root) {
  'use strict';
  var CFG = root.SushiConfig;

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

    var downPos = null;
    canvas.addEventListener('pointerdown', function (e) {
      downPos = toLogical(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', function (e) {
      if (!downPos) return;
      var p = toLogical(e.clientX, e.clientY);
      // chỉ tính là tap nếu không rê quá 12px
      if (Math.hypot(p.x - downPos.x, p.y - downPos.y) < 14 && o.onTap) {
        o.onTap(p.x, p.y);
      }
      downPos = null;
    });
    canvas.addEventListener('pointercancel', function () { downPos = null; });
    // chặn menu chuột phải / bôi đen khi tap nhanh
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

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
