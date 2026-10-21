# Lộ trình — Crowned Kingdoms

Game đổi thể loại từ colony sim sang **roguelite xây vương quốc + tự động đánh**. Toàn bộ thiết kế nằm trong [spec tổng](superpowers/specs/2026-10-16-crowned-kingdoms-design.md); spec chia thành 6 dự án con G0–G5, mỗi dự án con có plan riêng trong `docs/superpowers/plans/` và kết thúc bằng một bản chạy được. Lịch sử colony sim (Phase 0–1) vẫn còn trong git (nhánh `phase1-core-loop` được lưu trữ, không merge).

Điều kiện chung của mọi "Done khi": `npm run lint && npm run typecheck && npm test && npm run build` exit 0. Thứ tự phụ thuộc: **G0 → G1 → G2 → G3 → G4 → G5**; trong G5, âm thanh và juice có thể làm song song từ sau G2, cân bằng chỉ sau G4.

| G   | Tên                                                   | Nội dung chính                                                                                                                                                                                                                   | Done khi                                                                                                                                                                            |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0  | Nền UI & dọn dẹp                                      | Xoá colony sim, chuyển hạ tầng sang `src/core`, gỡ `bitecs`; `UI_PALETTE` + art UI, `layout.ts`, texture `ui`, `ContentBox`/`Tooltip`, menu kiểu Stardew; bảng màu Hearth 32; ESLint deterministic; tài liệu                     | Không còn file colony; không import `src/sim`; test `uiArt` + `layout` + `PALETTE` pass; menu đúng §10.2 ở 1280×720 và 375×812; ESLint chặn `phaser`/`Math.random` trong `src/game` |
| G1  | Lõi chơi được (ván ngắn 10 năm)                       | `RunState` + `applyCommand`, vòng năm, `composeArmy`, trận §8 (trừ boss), can thiệp, Vua Lúa Mì + 4 thẻ trung lập + Thổ Phỉ; `RealmScene`, `PlanningHudScene`, `BattleHudScene`, `RunEndScene` tối giản; headless + bot `random` | Chơi trọn ván 10 năm ở hai bố cục; test deterministic + benchmark pass; headless 3 seed; xem trước đạo quân khớp trận                                                               |
| G2  | Chiều sâu: bùa, lân cận, cấp, vàng, 3 vua, chinh phục | Cấp, Bùa, lân cận, vàng đầy đủ, đổi bài, mua ô; Vua Lúa Mì/Đá Núi/Phép Thuật; `KingSelectScene`, bảng Bộ bài, lịch + Trinh sát; ván 15 năm, chinh phục                                                                           | Ba vua chơi tới năm 15; mỗi thẻ G2 có test; chinh phục hai vua trong một ván thử; bố cục §10.3–10.6 đúng hai kích thước                                                             |
| G3  | Ván đầy đủ: hội đồng, nhiệm vụ, boss, 30 năm, lưu ván | Lịch đầy đủ, Liên Quân, sắc lệnh, nhiệm vụ, 3 boss; dữ liệu phía địch của 6 vua còn lại; lưu ván IndexedDB, nút "Tiếp tục"                                                                                                       | Headless 30 năm 3 vua × 3 seed; chơi tay qua boss 1 và một hội đồng; tải lại trang khôi phục đúng §9.3                                                                              |
| G4  | Đủ 9 vua, perk, meta-progression                      | 6 vua còn lại, 27 perk, hai thẻ trung lập meta; Điểm Vương Miện, thông thạo, mở khoá, độ khó Gai; `CrownsScene`                                                                                                                  | 9 vua chơi được; Du Mục khoá đúng điều kiện; mở khoá còn sau khi tải lại trang; headless 9 vua × 3 seed                                                                             |
| G5  | Cân bằng, âm thanh, juice, mobile, đóng gói           | `tools/balance.ts` + bot `greedy`; âm thanh và nhạc sinh bằng code, juice, `SettingsScene`; safe-area, chặn kéo-làm-mới; PWA                                                                                                     | Toàn bộ "Done khi" §1 của spec (tỉ lệ thắng của bot 35–65% mỗi vua, chênh lệch ≤ 15 điểm %)                                                                                         |

## Trạng thái

**G0 ✔ · G1 ✔ · G2 ✔** — G2 chơi được trong trình duyệt: "Ván mới" → Chọn vua (Lúa Mì / Đá Núi / Phép Thuật) → ván 15 năm (vàng, đổi bài, bán bài, mua ô, cấp, Bùa, sách, lịch với hai vua địch và cờ hiệu, chinh phục), bố cục desktop 1280×720 và mobile 375×812. Tiếp theo: **G3** (ván 30 năm, hội đồng, nhiệm vụ, boss, lưu ván).

G2 theo plan `docs/superpowers/plans/2026-10-20-g2-depth.md` (G2a lõi, G2b trận + nội dung, G2c giao diện). Kiểm "Done khi": ba vua chạy trọn 15 năm headless (3 vua × 3 seed) và qua `RunController` + bus trong trình duyệt (Đá Núi thắng tới năm 15 và chinh phục một vua; Phép Thuật thua năm 12); mỗi thẻ G2 có test hiệu ứng (`cardCoverage.test.ts` kiểm mọi `CardId` có mặt trong test); chinh phục hai vua ở `conquest.test.ts`; đổi bài và mua ô trừ vàng đúng công thức (`commands.test.ts`); bố cục chọn vua, thưởng, chinh phục, Bộ bài, lịch có test hai kích thước.

G1 polish đã xong (plan `docs/superpowers/plans/2026-10-20-g2-depth.md`, Phần A): bài chưa dùng ở lại tay (chồng rút/bỏ), `discard` thay `skip`, trận tự bắt đầu sau khi chơi/bán thẻ (`RULES_G1.autoStart`, G2 tắt), Đá Tảng tự bắn (bật/tắt, chung hồi chiêu), Khai Hoang mở ô bất kỳ, camera chung hai pha + nền kín màn hình, nút Địch xem lại các đợt trong trận, bấm nhà/lính xem thông tin.

Việc còn lại / lỗ hổng đã biết từ G1 (làm ở lượt art/G5, không chặn G2):

- Nút Can Thiệp đang vuông (chưa có art nút riêng).
- Cân bằng G1 chưa đo: bot `random` thắng dễ; cân bằng thật thuộc G5 (`tools/balance.ts`).
- `src/platform` và `src/audio` vẫn chưa tạo (G3 lưu ván, G5 âm thanh).

Lỗ hổng đã biết sau G2 (không chặn G3):

- Art vẫn là placeholder sinh bằng code (chân dung vua, ảnh thẻ chỉ khác nhau bởi dấu hiệu nhỏ); khung panel/nút/thẻ dùng Kenney Pixel UI Pack (CC0), màu ngoài `UI_PALETTE` (ngoại lệ đã đăng ký trong `docs/ART_STYLE.md`).
- Trận mô phỏng đủ cơ chế G2b nhưng hiệu ứng xung/khiên/choáng mới chỉ xem bằng mắt; chưa có ảnh chụp đối chiếu.
- Kéo thả thẻ chưa thử bằng cảm ứng thật; cuộn hàng thẻ (Bộ bài, chọn vua) bằng bánh xe/kéo chuột.
- Minor G2a/G2b còn hoãn: luồng RNG lịch không lưu sau `pickEnemyKings`; bot `random` dùng hành động G2 dưới luật G1; chinh phục ở năm cuối của luật rút gọn không cho thẻ; tooltip Tim Núi chưa tính cấp; khiên yếu có thể ghi đè khiên mạnh; choáng/làm chậm kéo dài N−1 tick.
- Cân bằng: bot `random` thắng Lúa Mì 0/20, Đá Núi 17/20, Phép Thuật 11/20 — cân bằng thật là G5.

G2b (trận và nội dung 3 vua, chưa có giao diện — G2c): ba vua Lúa Mì / Đá Núi / Phép Thuật chạy trọn 15 năm headless (3 vua × 3 seed, deterministic); benchmark `stepBattle` 0,38 ms/tick (chuẩn) và 0,40 ms/tick (có xung, chuỗi, splash, khiên). Chỉ để tham khảo, cân bằng thật là G5: bot `random`, 20 seed mỗi vua ở luật G2, thắng ván Lúa Mì 0/20 (năm trung bình 7,8), Đá Núi 17/20 (14,3), Phép Thuật 11/20 (13,8).

## Kiểm thử mỗi G

- Vitest cho dữ liệu, luật và trận (spec §13.1–13.3).
- Trình duyệt: chụp màn hình các scene mới ở 1280×720 và 375×812; không chữ đè/tràn, vùng chạm ≥ 44 px, console không lỗi (spec §13.4).
