# G3e — Quyết định và brief mỹ thuật

Nguồn: yêu cầu chủ dự án ngày **23/10/2026** và plan [G3e — UX, Help và nâng cấp pixel art](../../superpowers/plans/2026-10-23-g3e-ux-and-art.md), mục “Lựa chọn đã chốt”, “Quyết định”, “Global Constraints” và Task E1 Step 3.

## Bốn lựa chọn đã chốt — 23/10/2026

1. **Art:** tự sinh bằng code, giữ ô logic 32 px, nới màu; không nhập pack ngoài đợt này. Giữ sân logic 384 px và phép tính mô phỏng; kích thước hình theo metadata. Khung Kenney đã có chỉ là fallback hiện hữu, không phải pack mới được nhập trong G3e.
2. **Cấp:** 5 icon sao pixel kèm nhãn “Cấp N/5”; sao đã đạt tô đầy, các sao còn lại rỗng.
3. **Help:** modal overlay, mở bằng F1 hoặc H từ menu và trong ván; chưa có tìm kiếm.
4. **Mobile:** tối ưu đầy đủ phần chức năng mới ở 375 × 812 trong task E8 cuối cùng; các task trước vẫn giữ bố cục mobile không hỏng.

Bốn lựa chọn đã được xác nhận, không hỏi duyệt lại. Việc chốt hướng art không đồng nghĩa nghiệm thu mẫu mỹ thuật từng bộ.

## Brief và cổng duyệt từng bộ

Luật chung: fantasy ấm áp, tự sinh bằng code; màu/kích thước theo metadata mở, giữ pixel look theo [ART_STYLE.md](../../ART_STYLE.md). Không nhập pack ngoài mới; Kenney hiện hữu chỉ là fallback. Giữ ô logic 32 px, sân logic 384 px, luật mô phỏng và tên frame. Công trình 32×40, Ngai 32×48 và lính theo `UnitDef.sprite` hiện tại là lựa chọn triển khai G3e.

| Bộ | Brief | Cổng duyệt trước adopt |
|---|---|---|
| **E6a — Đất/ô/công trình/tranh thẻ** | Nền bớt nhiễu, mái/chất liệu và dấu phe rõ, tranh thẻ nhận diện đúng công trình/chủ. Mẫu đủ 5 terrain × 16 mask, 3 trạng thái ô, mọi công trình/Ngai/tranh thẻ theo owner; không tạo portrait Ngai G4 giả. | Chủ dự án duyệt mẫu ở 1×/2×/3× trên nền sáng/tối trước khi nối painter vào atlas/runtime. |
| **E6b — Lính/boss/animation** | Motif theo UnitId, silhouette/outline rõ trên cỏ, vũ khí và động tác đúng tag; đủ phe và hoạt ảnh. Bóng alpha có khai báo. | Chủ dự án duyệt toàn unit matrix ở native/integer zoom, boss đặt cạnh nhà/quân để so scale, trước khi nối runtime. |
| **E6c — FX/icon/sao/atlas** | FX contour pixel sắc, mũi tên có sẵn 8 hướng không xoay; icon dễ đọc, 5 sao đầy/rỗng kèm “Cấp N/5”. Mẫu ghi alpha/bóng; atlas đủ/unique frame, một `sprites` ≤ 4096 mỗi chiều. | Chủ dự án duyệt sheet FX/icon/sao native và integer zoom trước khi nối FX/icon/atlas và sao vào panel; kiểm đủ frame, ngân sách atlas và hiệu năng theo plan. |
| **E7a — Khung/nút/thẻ/menu/chữ** | Gỗ/giấy kem, khung và trạng thái dễ phân biệt; sheet panel/button/card 4 rarity/slot/bar/tooltip/menu, đủ enabled/disabled/hover/down và chữ Việt thật. Giữ `FONT_UI`, `createPanel`, `createButton`, `ContentBox`, `Tooltip`; menu dither/parallax nguyên, không blur/glow. | Chủ dự án duyệt sheet UI trước khi nối skin vào runtime; metadata qua `uiFrameDef`, Kenney CC0 đã đăng ký giữ fallback. |

Thứ tự: **E1 chốt brief → E6a mẫu → duyệt → E6b mẫu → duyệt → E6c mẫu → duyệt → E7a mẫu → duyệt**. Mỗi bộ chỉ nối vào atlas/runtime sau khi bộ đó được duyệt. Nếu chờ duyệt, dừng phần adopt, ghi trạng thái; không đánh dấu hoàn thành hoặc tạo bộ tiếp theo.

## Trạng thái

Đã ghi bốn lựa chọn và brief ở phần tài liệu E1. Các bộ E6a/E6b/E6c/E7a chưa được ghi nhận duyệt mẫu trong tài liệu này; không coi brief là bằng chứng nghiệm thu art.
