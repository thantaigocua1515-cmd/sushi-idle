# TEST REPORT — Sushi Idle MVP

Ngày: 2026-10-18 | Môi trường: VM Linux, node v24

## 1. Test sim bằng node (`node test/sim.test.js`)

**Kết quả: 14/14 PASS** ✅

| # | Test | Kết quả |
|---|---|---|
| 1 | Game mới hợp lệ (floor 1, 80 coin, có nigiri, chef lv1) | PASS |
| 2 | Tick 300s: khách đến, nấu, thu tiền, không NaN/âm | PASS |
| 3 | buyFloor tầng 1→2: mở món maki, thưởng 2 gem | PASS |
| 4 | buyFloor thiếu tiền → fail, floor không đổi | PASS |
| 5 | buyFloor ở tầng 10 → fail (max) | PASS |
| 6 | Staff cost curve ~1.7^level; delivery cần tầng 4 | PASS |
| 7 | Mua plot drive-thru → xe spawn → collect đúng reward, không collect 2 lần | PASS |
| 8 | Tap chef: boost ok, cooldown chặn, hết cooldown tap lại được | PASS |
| 9 | Save/load: giữ nguyên coins/floor, <60s không tính offline | PASS |
| 10 | Offline 10h → tính đúng cap 8h × 50% hiệu suất | PASS |
| 11 | Load file hỏng / chưa có save → không crash, trả về null | PASS |
| 12 | fmt số: 999 / 1.2K / 1.5M / 2.5B / NaN→0 | PASS |
| 13 | Milestone serve 25 → tặng 5 gem | PASS |
| 14 | Khách hết kiên nhẫn bỏ đi, không thu tiền, không crash | PASS |

Trong lúc test phát hiện & đã fix:
- `sanitize()` làm mất `stats.incomePerSec` → offline earnings tính sai → đã giữ lại EMA và dùng `max(EMA, ước lượng lý thuyết)`.

## 2. Syntax check (`node --check` cho 7 file js)

**Kết quả: PASS** ✅ (config, sim, assets, render, ui, input, main)

## 3. Headless screenshot 3 màn hình (390×844, Playwright + Chromium riêng)

**Kết quả: PASS** ✅ — ảnh lưu ở `test/screenshots/`

| Màn hình | Kết quả |
|---|---|
| Nhà hàng (`screen-restaurant.png`) | PASS — HUD, ảnh tầng, đầu bếp đang nấu, thu ngân, phục vụ đi lại, khách + bong bóng gọi món, quầy bar, bottom nav đều hiện đúng, không vỡ layout |
| Bản đồ (`screen-map.png`) | PASS — đảo top-down, 5 ô đất có khóa + biển tên + nhãn "Tầng X", mây trôi, hướng dẫn chạm |
| Shop (`screen-shop.png`) | PASS — modal nâng tầng / nhân sự / thực đơn / boost gem, nút kit, tiếng Việt đầy đủ |
| Drive-thru (`screen-drivethru.png`) | PASS — xe hơi chạy qua + nhãn "Đơn drive-thru! Chạm để nhận", collect được 697 coin |

Trong lúc test visual phát hiện & đã fix:
- HUD: badge "Tầng X" đè lên thanh gem → chuyển badge xuống hàng 2
- Map: nhãn "Tầng X" đè lên biển tên ô đất → chuyển lên phía trên tòa nhà
- Nhãn xe drive-thru bị tràn chữ → nới rộng pill
- Sàn gỗ dưới nhà hàng quá trống → thêm vân ván mờ

## 4. Console errors khi load + tương tác (Playwright)

**Kết quả: PASS** ✅ — không có lỗi JS nào (`pageerror`/`console.error` sạch).

Tương tác đã test qua touch/keyboard thật:
- Tap đầu bếp → buff nấu x2 kích hoạt + cooldown ✅
- Tap nav Bản đồ → chuyển màn hình ✅
- Mở shop → mua nâng tầng → floor 2, trừ tiền, mở món Maki ✅
- Xe drive-thru spawn → tap collect +697 coin ✅
- Save/load qua localStorage giữa các lần tải trang ✅

Lưu ý duy nhất: Google Fonts (Bebas Neue/Lilita One) không tải được trong môi trường
test (proxy chặn tunnel) → game tự dùng font dự phòng, vẫn đọc tốt. Trên máy/thiết bị
thật có mạng thì font sẽ đúng như thiết kế.

## Ghi chú môi trường

- Chromium có sẵn trên VM (`/opt/meta-chromium/chrome` v152) **không chạy được headless**
  (dump-dom/screenshot trả về rỗng) và remote-debugging không mở port → đã dùng
  Playwright + Chromium riêng để test visual.
