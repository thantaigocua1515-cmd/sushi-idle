#!/usr/bin/env bash
# tools/extract-assets.sh — Copy đúng các file assets game cần từ sushi kit
# (và icon pack) vào thư mục assets/ của repo.
#
# Cách dùng (chạy trên máy của bạn):
#   ./tools/extract-assets.sh /đường/dẫn/tới/kit/đã/giải/nén [/đường/dẫn/tới/game-icon-pack]
#
# Ví dụ:
#   ./tools/extract-assets.sh ~/Downloads/sushi-restaurant-game-asset-kit ~/game-icon-pack
#
# Danh sách file đầy đủ xem ở assets/MANIFEST.txt
set -euo pipefail

KIT="${1:?Dùng: tools/extract-assets.sh <KIT_DIR> [ICONPACK_DIR]}"
ICONPACK="${2:-}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets"

[ -d "$KIT/Png" ] || { echo "LỖI: không thấy thư mục Png trong $KIT"; exit 1; }

copied=0
cp_one() { # $1 = đường dẫn nguồn (tương đối từ KIT), $2 = đường dẫn đích (tương đối từ assets/)
  mkdir -p "$OUT/$(dirname "$2")"
  cp -f "$KIT/$1" "$OUT/$2"
  copied=$((copied+1))
}

# Copy dãy frame có đánh số 00..N (dạng Tên_00.png)
seq_copy() { # $1=thư mục nguồn, $2=tiền tố tên file, $3=số frame, $4=thư mục đích, $5=tiền tố đích
  local i src
  for i in $(seq 0 $(( $3 - 1 ))); do
    src="$(printf '%s/%s_%02d.png' "$1" "$2" "$i")"
    cp_one "$src" "$4/$(printf '%s-%02d.png' "$5" "$i")"
  done
}

echo "== Floors (11) =="
for n in 0 1 2 3 4 5 6 7 8 9 10; do
  cp_one "Png/Floors/Floor_Lv$n.png" "floors/floor-lv$n.png"
done

echo "== Chef Guy (60) =="
seq_copy "Png/Chef Guy/Cooking"        "ChefGuy-Cooking"        20 "chef" "cooking"
seq_copy "Png/Chef Guy/Walk"           "ChefGuy-Walk"           20 "chef" "walk"
seq_copy "Png/Chef Guy/Walk Full Order" "ChefGuy-Walk Full Order" 20 "chef" "serve"

echo "== Cashier Girl (40) =="
seq_copy "Png/Cashier Girl" "ChashierGirl-animation" 40 "cashier" "anim"

echo "== Floor Girl / phục vụ (20) =="
seq_copy "Png/Floor Girl" "FloorGirl-animation" 20 "waiter" "anim"

echo "== Lift Guy / giao hàng (20) =="
seq_copy "Png/Lift Guy" "Lift Guy-animation" 20 "delivery" "anim"

echo "== Car drive-thru (200: 5 loại x 40) =="
for c in 1 2 3 4 5; do
  if [ "$c" = "1" ]; then out="car"; else out="car$c"; fi
  seq_copy "Png/Cars/Car$c/Move" "Cars-Car${c}_Move" 40 "$out" "move"
done

echo "== Cashiers — tòa tầng trệt SUSHI TOWER (6) =="
for n in 1 2 3 4 5 6; do
  cp_one "Png/Cashiers/CashierL$n.png" "cashiers/cashier-l$n.png"
done

echo "== Map (6) =="
cp_one "Png/Open Area Map/Area.png"               "map/island.png"
cp_one "Png/Open Area Map/Locked Building.png"    "map/locked.png"
cp_one "Png/Open Area Map/Available Building.png" "map/available.png"
cp_one "Png/Open Area Map/Lock.png"               "map/lock.png"
cp_one "Png/Open Area Map/NamePlate.png"          "map/nameplate.png"
cp_one "Png/Open Area Map/Clouds.png"             "map/clouds.png"

echo "== Shop / drive-thru tower (1) =="
cp_one "Png/Cashiers/CashierL3.png" "shop/tower.png"

echo "== UI kit (23) =="
cp_one "Png/Ui and PopUp/Btn_Green.png"         "ui/btn-green.png"
cp_one "Png/Ui and PopUp/Btn_Green Pressed.png" "ui/btn-green-pressed.png"
cp_one "Png/Ui and PopUp/Btn_Blue.png"          "ui/btn-blue.png"
cp_one "Png/Ui and PopUp/Btn_Blue_Off.png"      "ui/btn-blue-off.png"
cp_one "Png/Ui and PopUp/Btn_Orange.png"        "ui/btn-orange.png"
cp_one "Png/Ui and PopUp/Btn_Orange_Small.png"  "ui/btn-orange-small.png"
cp_one "Png/Ui and PopUp/Btn_Close.png"         "ui/btn-close.png"
cp_one "Png/Ui and PopUp/CoinIcon.png"          "ui/coin.png"
cp_one "Png/Ui and PopUp/GemsIcon.png"           "ui/gems.png"
cp_one "Png/Ui and PopUp/HudCoinBar.png"        "ui/hud-coin-bar.png"
cp_one "Png/Ui and PopUp/PopUp_Box.png"         "ui/popup-box.png"
cp_one "Png/Ui and PopUp/ContentBox.png"        "ui/content-box.png"
cp_one "Png/Ui and PopUp/ManyUpgradeBox.png"    "ui/upgrade-box.png"
cp_one "Png/Ui and PopUp/ShopIcon.png"          "ui/shop-icon.png"
cp_one "Png/Ui and PopUp/MapIcon.png"           "ui/map-icon.png"
cp_one "Png/Ui and PopUp/ArrowUpgrade.png"      "ui/arrow-upgrade.png"
cp_one "Png/Ui and PopUp/Btn_Music.png"         "ui/btn-music.png"
cp_one "Png/Ui and PopUp/Btn_Music_Off.png"     "ui/btn-music-off.png"
cp_one "Png/Ui and PopUp/Btn_Sound.png"         "ui/btn-sound.png"
cp_one "Png/Ui and PopUp/Btn_Sound_Off.png"     "ui/btn-sound-off.png"
cp_one "Png/Ui and PopUp/GemsPlusBar.png"       "ui/gems-plus-bar.png"
cp_one "Png/Ui and PopUp/HubAreaBar.png"        "ui/hub-area-bar.png"
cp_one "Png/Ui and PopUp/Area Box.png"          "ui/area-box.png"
cp_one "Png/Ui and PopUp/BtnUp.png"             "ui/btn-up.png"
cp_one "Png/Ui and PopUp/SettingIcon.png"       "ui/setting-icon.png"
cp_one "Png/Ui and PopUp/Btn_Boost.png"         "ui/btn-boost.png"
cp_one "Png/Ui and PopUp/Boost_Icon.png"        "ui/boost-icon.png"
cp_one "Png/Ui and PopUp/Btn_Vibra.png"        "ui/btn-vibra.png"
cp_one "Png/Ui and PopUp/Btn_Vibra_Off.png"    "ui/btn-vibra-off.png"
cp_one "Png/Ui and PopUp/VolumeBar_Bg.png"     "ui/volume-bar-bg.png"
cp_one "Png/Ui and PopUp/VolumeBar_Yellow.png" "ui/volume-bar-yellow.png"
cp_one "Png/Ui and PopUp/VolumeBar_Btn.png"    "ui/volume-bar-btn.png"
cp_one "Png/Ui and PopUp/RequermentBox.png"    "ui/requirement-box.png"

echo "== Menu icons từ Game Icon Pack (6) =="
# Chấp nhận cả 2 kiểu giải nén: có hoặc không có thư mục png/ ở trên cùng
IP=""
if [ -n "$ICONPACK" ] && [ -d "$ICONPACK/png/no-padding/128px/white" ]; then
  IP="$ICONPACK/png/no-padding/128px/white"
elif [ -n "$ICONPACK" ] && [ -d "$ICONPACK/no-padding/128px/white" ]; then
  IP="$ICONPACK/no-padding/128px/white"
fi
if [ -n "$IP" ]; then
  mkdir -p "$OUT/menu"
  cp -f "$IP/5-food/onigiri.png"  "$OUT/menu/nigiri.png"      && copied=$((copied+1))
  cp -f "$IP/5-food/rice.png"     "$OUT/menu/maki.png"        && copied=$((copied+1))
  cp -f "$IP/4-nature/fish.png"   "$OUT/menu/temaki.png"      && copied=$((copied+1))
  cp -f "$IP/5-food/zongzi.png"   "$OUT/menu/uramaki.png"     && copied=$((copied+1))
  cp -f "$IP/4-nature/shrimp.png" "$OUT/menu/sashimi.png"     && copied=$((copied+1))
  cp -f "$IP/5-food/bowl.png"     "$OUT/menu/dragon-roll.png" && copied=$((copied+1))
else
  echo "  (bỏ qua: không truyền ICONPACK_DIR hoặc sai cấu trúc — game vẫn chạy, icon món ăn sẽ vẽ dự phòng)"
fi

echo ""
echo "Xong! Đã copy $copied file vào $OUT"
du -sh "$OUT"
