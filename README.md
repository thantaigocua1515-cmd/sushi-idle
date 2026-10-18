# Sushi Idle — Webgame HTML5 idle nhà hàng sushi

Game idle giả lập nhà hàng sushi phong cách chill: khách tự vào, bếp tự nấu,
tiền tự chảy cả khi bạn offline. Xây bằng vanilla JS + Canvas, **tách sim/render**
(để sau này dễ nâng multiplayer như Sunny Farm).

## Chạy local

```bash
cd sushi-idle
python3 -m http.server 8000
# mở http://localhost:8000
```

> Mở trực tiếp file `index.html` cũng chạy được, nhưng nên dùng http server để
> tránh lỗi CORS khi tải ảnh.

## Cấu trúc

```
index.html            Khung game + HUD + modal
css/style.css         Giao diện (tone gỗ ấm theo kit)
js/config.js          Số liệu cân bằng (giá, thời gian, cost curve) — UMD
js/sim.js             Mô phỏng game: tick, khách, nấu, tiền, save/load — UMD, zero DOM
js/assets.js          Manifest + loader ảnh (browser)
js/render.js          Vẽ 2 màn hình canvas: Nhà hàng, Bản đồ (browser)
js/ui.js              HUD, bottom nav, shop modal, popup, toast (DOM)
js/input.js           Tap chuột/touch + phím tắt
js/main.js            Boot, game loop, đấu nối
assets/               Ảnh game (227 file, ~3.6MB) — xem assets/MANIFEST.txt
tools/extract-assets.sh  Script copy assets từ kit gốc vào assets/
test/sim.test.js      Test sim bằng node: `node test/sim.test.js`
```

## Gameplay (MVP)

- **3 màn hình**: Nhà hàng (side-view theo tầng), Bản đồ đảo (mở ô đất), Shop (nâng cấp).
- **Vòng lặp idle**: khách vào → gọi món → đầu bếp nấu → phục vụ bưng → thu ngân thu coin.
- **Tầng 1→10**: mỗi tầng đổi ảnh nhà hàng, thêm bàn, mở món mới, tăng hệ số thu nhập.
- **Nhân sự**: Đầu bếp / Phục vụ / Thu ngân / Giao hàng — thuê + nâng cấp, giá `base × 1.7^level`.
- **Drive-thru** (tầng ≥ 4 + mở ô đất): xe hơi chạy qua mang đơn lớn, chạm để nhận ngay.
- **Tương tác chill**: chạm đầu bếp = nấu x2 trong 10s (hồi 60s), chạm đồng coin bay = thưởng thêm.
- **Tiền**: coin (chính) + gem (thưởng mốc). Offline: tính thu nhập khi vắng mặt, cap 8 tiếng, popup chào mừng.
- **Lưu**: localStorage `sushi-idle-save-v1`, autosave 10 giây + khi ẩn tab.

## Assets & license

- Art: **CraftPix "Sushi Restaurant" freebie kit** — dùng được cả project thương mại,
  không bắt buộc ghi credit; **cấm bán/phân phối lại file assets gốc**.
- Icon món ăn: **Game Icon Pack v1.4** (bộ của bạn).
- Font: Bebas Neue + Lilita One (Google Fonts, miễn phí).

## Deploy

Xem `HUONG-DAN-SETUP.md` (tiếng Việt, từng bước: tạo repo → push assets → Vercel).
