# Hướng dẫn setup Sushi Idle (từng bước)

> Code đã build xong trong thư mục `sushi-idle/`. Bạn chỉ cần làm 6 bước dưới đây
> để đưa game lên GitHub + Vercel. Tool của mình không push được file binary nên
> bước push assets bạn làm giúp mình 1 lần duy nhất.

## Bước 1 — Tạo repo GitHub trống

1. Vào github.com → New repository
2. Tên: `sushi-idle`, chọn **Public**, **không** tick "Add a README"
3. Create repository → copy link HTTPS, ví dụ:
   `https://github.com/thantaigocua1515-cmd/sushi-idle.git`

## Bước 2 — Clone về máy

```bash
git clone https://github.com/thantaigocua1515-cmd/sushi-idle.git
cd sushi-idle
```

## Bước 3 — Copy code vào

Copy **toàn bộ nội dung** thư mục `sushi-idle/` (mình gửi) vào thư mục repo vừa clone,
ghi đè nếu hỏi. Cấu trúc sau khi copy:

```
sushi-idle/
  index.html  css/  js/  assets/  tools/  test/
  README.md  HUONG-DAN-SETUP.md  TEST-REPORT.md
```

## Bước 4 — Giải nén kit + chạy script extract assets

Thư mục `assets/` mình gửi **đã có sẵn 227 file** dùng được ngay. Nếu sau này bạn
đổi/thêm assets từ kit gốc thì mới cần bước này:

```bash
# giải nén file zip kit ra một thư mục, ví dụ ~/kit-sushi
./tools/extract-assets.sh ~/kit-sushi ~/game-icon-pack
```

- Tham số 1 (bắt buộc): thư mục kit đã giải nén (chứa thư mục `Png/`)
- Tham số 2 (tùy chọn): thư mục Game Icon Pack (để lấy icon món ăn)
- Script chỉ copy đúng các file game cần (liệt kê ở `assets/MANIFEST.txt`)

## Bước 5 — Push lên GitHub

```bash
git add .
git commit -m "Sushi Idle MVP"
git branch -M main
git push -u origin main
```

> Lần push đầu có ~3.6MB ảnh, đợi một chút là xong. Từ lần sau code thay đổi
> thì push bình thường.

## Bước 6 — Deploy lên Vercel

1. Vào vercel.com → Add New → Project → Import repo `sushi-idle`
2. Framework Preset: **Other** (không cần build gì cả, web tĩnh)
3. Deploy → xong, bạn có link `sushi-idle.vercel.app`

Mỗi lần push code mới lên GitHub, Vercel tự deploy lại.

## Chơi thử nhanh trên máy (trước khi deploy)

```bash
python3 -m http.server 8000
# mở http://localhost:8000 trên trình duyệt / điện thoại cùng wifi
```

## Gỡ lỗi thường gặp

| Hiện tượng | Cách xử |
|---|---|
| Ảnh không hiện / màn hình đen | Mở DevTools (F12) → Console xem file nào 404; chạy lại `tools/extract-assets.sh` |
| Chữ xấu, không đúng font | Cần mạng để tải Google Fonts (Bebas Neue, Lilita One) |
| Muốn chơi lại từ đầu | DevTools → Application → Local Storage → xóa key `sushi-idle-save-v1` |
| Game lag trên máy yếu | Giảm `devicePixelRatio` trong `js/main.js` (dòng `Math.min(2.5, ...)`) |
