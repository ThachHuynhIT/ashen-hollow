# Chín Vương Miện — Game Design Document (rút gọn)

> Bản tóm tắt sống của thiết kế. Nguồn chuẩn cho mọi con số, luật và nội dung: [spec tổng](superpowers/specs/2026-10-16-nine-crowns-design.md). Khi một cơ chế thay đổi, sửa spec trước, rồi file này, rồi code.
> Lộ trình: [ROADMAP.md](ROADMAP.md) · Quy chuẩn hình ảnh: [ART_STYLE.md](ART_STYLE.md)

## Elevator pitch

Bạn là vua của một vương quốc nhỏ trên bàn cờ 5×5. Mỗi năm rút 3 thẻ, chơi 1 thẻ — dựng trại lính, tháp cung, ruộng lúa, gắn bùa — rồi xem quân mình **tự động đánh** với đạo quân của một vua láng giềng trong 30–60 giây trên cánh đồng quanh vương quốc. Sống qua năm 30 là thắng; mất hết 3 mạng là thua.

**Thể loại:** roguelite xây vương quốc + tự động đánh · 2D pixel art · fantasy ấm áp, dễ thương (lính chibi, đồng lúa, giao diện gỗ + giấy kem kiểu Stardew Valley) · web-first, PWA. Tên tạm "Chín Vương Miện" (_Nine Crowns_); repo và package vẫn là `ashen-hollow`.

## Vòng một năm (spec §3.2)

Đầu năm (thuế, tăng trưởng, rút bài) → **Lập kế hoạch** (xem lịch và trinh sát đạo quân địch, đổi bài, mở ô, chơi đúng 1 thẻ hoặc bỏ lượt) → **Trận** tự động → Sau trận → Thưởng (thắng: chọn 1 trong 3 thẻ) → Chinh phục (thắng một vua ở lần tấn công thứ 3) → Hội đồng (năm 5, 10, 15, 20, 25: chọn 1 sắc lệnh) → Lưu.

## Các hệ thống chính

| Hệ thống                 | Tóm tắt                                                                                                                        | Spec      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Ván                      | 30 năm, 3 mạng, vàng (thuế, thắng trận, chinh phục, bỏ lượt); boss năm 10/20/30                                                | §3        |
| Bàn cờ                   | 5×5, mở sẵn 3×3 giữa, Ngai ở tâm; mở thêm ô bằng vàng/sách phép/sắc lệnh; lân cận trực giao                                    | §4        |
| Thẻ                      | Ngai · Lính · Tháp · Kinh tế/Hỗ trợ · Bùa (cộng dồn) · Sách phép; chơi trùng = lên cấp (tối đa 5); hiệu ứng mô tả bằng dữ liệu | §4–§5     |
| Vua                      | 9 vua: Lúa Mì, Đá Núi, Phép Thuật, Rừng Xanh, Thuỷ Triều, Lò Rèn, Đồng Hồ, Ánh Trăng, Du Mục — mỗi vua 1 Ngai + 9 thẻ + 3 perk | §6        |
| Kẻ địch                  | 6 vua địch mỗi ván theo lịch cố định, Thổ Phỉ, Liên Quân; ngân sách quân tăng 15%/năm; xem trước chính xác từng đợt            | §3.5–§3.6 |
| Trận                     | Mô phỏng deterministic 10 tick/s trên cánh đồng 384 px; lính sinh từ ô, tháp bắn, địch vào từ mép; một kỹ năng can thiệp       | §8        |
| Sắc lệnh, nhiệm vụ, boss | 18 sắc lệnh, 13 nhiệm vụ, 3 boss                                                                                               | §7        |
| Meta                     | Điểm Vương Miện cuối ván mở vua, perk, thẻ và độ khó Gai 0–5                                                                   | §9.1–§9.2 |
| Lưu                      | IndexedDB: ván giữa các năm + meta                                                                                             | §9.3      |

## Thắng / Thua

- **Thua trận:** Ngai về 0 máu → mất 1 mạng. **Thua ván:** hết mạng.
- **Thắng ván:** sống qua năm 30 (thắng boss 3 = "Vương Miện Vàng").

## Nguyên tắc kỹ thuật

- **Luật tách khỏi hiển thị.** `src/game` (luật), `src/data` (dữ liệu), `src/core` (hạ tầng thuần) không import Phaser hay `scenes/render/ui/platform/audio`; `src/data` không import `src/game` (ESLint chặn).
- **Deterministic.** Không `Math.random`, `Date.now`, `performance.now`, `Math.hypot/sin/cos/tan/atan2/exp/log/pow` trong `src/game`, `src/core`, `src/data`; ngẫu nhiên đi qua `Rng` + `hashSeed` theo luồng (`'draw'`, `'army'`, …). Cùng `BattleSetup` + cùng lệnh can thiệp → cùng kết quả từng bit.
- **Data-driven.** Mọi con số gameplay ở `src/data/*`.

## Trạng thái

G0 (nền UI & dọn dẹp) xong: colony sim đã xoá, hạ tầng chuyển sang `src/core`, UI kiểu Stardew (khung gỗ, tooltip), menu chính, bảng màu Hearth 32. Chưa chơi được — "Ván mới" mở ở G1. Xem [ROADMAP.md](ROADMAP.md).
