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

# TEST REPORT — Rebuild màn tháp dọc (tower)

Ngày: 2026-10-18 (đợt 2) | Môi trường: VM Linux, node v24, Chromium for Testing v156 headless 390×844

## 1. Test sim bằng node (`node test/sim.test.js`)

**Kết quả: 15/15 PASS** ✅ (viết lại toàn bộ cho mô hình tháp)

| # | Test | Kết quả |
|---|---|---|
| 1 | Game mới: 1 tầng level 0, save v2 | PASS |
| 2 | Tick 60s: thu nhập passive, không NaN | PASS |
| 3 | Thu nhập nhiều tầng cộng dồn đúng công thức 8·(lv+1)^1.4·mult | PASS |
| 4 | addFloor: 500 → 1600 (×3.2^n), tối đa 8 tầng, 8 tầng mở dragon roll | PASS |
| 5 | upgradeFloor x1/x10/MAX đúng tổng giá curve, cap Lv.10, thiếu tiền fail | PASS |
| 6 | tapChefFloor: buff riêng từng tầng + cooldown riêng | PASS |
| 7 | tapBoost: x2 toàn tháp 30s, cooldown 5 phút | PASS |
| 8 | Drive-thru cần 3 tầng mới mua plot; xe spawn → collect đúng | PASS |
| 9 | Milestone theo tổng coin kiếm được (earn1k → 5 gem) | PASS |
| 10 | Save/load v2 roundtrip giữ nguyên | PASS |
| 11 | Migration save v1 `{floor:n}` → `floors=[{level:n}]`, giữ coins/gems/staff/plots/settings | PASS |
| 12 | Offline 10h → cap đúng 8h | PASS |
| 13 | Load file hỏng → null, không crash | PASS |
| 14 | hireStaff: reqFloor tính theo số tầng tháp | PASS |
| 15 | MAX không vượt Lv.10 dù nhiều tiền | PASS |

Trong lúc test phát hiện & đã fix: test migration dùng gap 2 phút nên kích hoạt offline
(đúng logic game) → sửa test dùng gap 30s.

## 2. Syntax check (`node --check` cho 7 file js)

config, sim, assets, render, ui, input, main — **tất cả OK** ✅

## 3. Visual test — headless Chromium 390×844

Hook `?test=` trong main.js: `tower1`, `tower4`, `popup-floor`, `popup-settings`,
`popup-offline`, `shop`, `debug-store`. Lệnh mẫu:
`xvfb-run -a ~/workspace/pwchrome/chrome-linux64/chrome --headless --disable-gpu
--no-sandbox --hide-scrollbars --window-size=390,844 --virtual-time-budget=15000
--screenshot=/tmp/shot-tower1.png "http://localhost:8901/?test=tower1"`

| Màn | Kết quả xem bằng mắt |
|---|---|
| Tháp 1 tầng | PASS — trời gradient + mây + skyline, thanh THÊM TẦNG, biển "TẦNG 1 · LV0" + +8/s, nút clipboard, đầu bếp, khách + bubble món, thang máy (ray + cabin Lift Guy), tầng trệt CashierL1 + DRIVE THRU, 3 xe chạy, nav BOOST/Bản đồ/Shop |
| Tháp 4 tầng (cuộn) | PASS — 4 tầng xếp chồng đúng thứ tự, mỗi tầng đúng ảnh Floor_Lv{level}, biển tên + thu nhập/s, nút nâng cấp, đầu bếp + 2 khách/tầng |
| Popup nâng tầng | PASS — khung mái ngói, tiêu đề "TẦNG 2", bảng KẾT QUẢ (Lv.5→Lv.6 +1, 500→620 +24%), ô yêu cầu coin, x1/x10/MAX (x1 xanh đang chọn), nút NÂNG CẤP |
| Popup settings | PASS — 3 nút Music/Sound/Vibra kit, thanh volume kéo được, CHIA SẺ / GAME KHÁC |
| Popup offline | PASS — đống coin + gem, +12.5K coin, "vắng mặt 2 giờ 0 phút", nút NHẬN X2 · 5 gem (xanh) + NHẬN (cam) |
| Shop modal | PASS — khung mái ngói, Nhân sự (Đầu bếp/Phục vụ/Thu ngân/Giao hàng + giá), Thực đơn 6 món + icon, Boost gem |
| Màn bản đồ (regression) | PASS — đảo + plots + khóa + nhãn "4/6 tầng", không vỡ |

Bug phát hiện & đã fix qua screenshot:
1. `content-box.png` của kit có **bullet nâu baked sẵn** trong ảnh → hiện vệt đen lạ trong
   bảng KẾT QUẢ → đổi `.res-box` sang nền CSS thuần (ghi chú trong css).
2. Nút BOOST nav chỉ hiện nền cam trống (kit tách `Boost_Icon.png` riêng) → overlay icon
   tia sét + chữ BOOST; thêm `boostIcon` vào manifest/extract script/MANIFEST.
3. Bubble món của khách **trống** — icon pack bản trắng tàng hình trên bubble trắng →
   lót đĩa nền tối `#4a2f1d` sau icon (giống style shop).
4. Nút "NHẬN" popup offline bị nhỏ xíu (thiếu class size) → thêm `.kbtn.big` + size mặc
   định cho `.kbtn`.
5. Nút "NHẬN X2" bị xuống dòng → nới rộng `.kbtn.blue` 220px + `white-space: nowrap`.
6. Chữ "SUSHI TOWN" tràn badge HUD → giảm 11px.
7. Biển tên tầng chạm thanh THÊM TẦNG → dời xuống 6px.

## 4. Console JS

`--enable-logging=stderr` khi chụp: **không có lỗi console** (chỉ có log dbus/soda noise
của môi trường container, không liên quan game). ✅

## 5. Extract script

`./tools/extract-assets.sh ~/workspace/assets-sushi/kit ~/workspace/game-icon-pack`
chạy thử OK: **403 files, 7.9MB** (tăng 1 file `ui/boost-icon.png` so với trước).
File `boost-icon.png` copy ra identical với file kit gốc (verify bằng `cmp`).

## Ghi chú môi trường

- `/opt/meta-chromium/chrome` không chụp headless được → dùng
  `~/workspace/pwchrome/chrome-linux64/chrome` (v156) + `xvfb-run`.
- Google Fonts trong môi trường test có thể không tải (proxy) → font dự phòng; trên
  máy thật có mạng sẽ đúng Bebas Neue/Lilita One.
- Emoji hệ thống không có trong container → game **không dùng emoji** ở UI/canvas nữa
  (bubble món dùng icon pack, các chỗ khác dùng ảnh kit).
