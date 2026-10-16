/**
 * UI palette — the deliberate exception to "every pixel from PALETTE": the interface is
 * warm and bright (wood frames, cream paper) so it reads over the world, the way Stardew
 * puts a wooden frame over every scene. World pixels still come from PALETTE (Hearth 32).
 * See docs/ART_STYLE.md.
 */
export const UI_PALETTE = {
  outline: 0x2b1408, // viền ngoài cùng, gần đen nâu
  woodDark: 0x5b2c0f, // bóng gỗ, rãnh vân
  wood: 0xb5651d, // thân gỗ
  woodLight: 0xe0a050, // gờ sáng, highlight vân
  cream: 0xf5deb3, // lõi panel
  creamDark: 0xd9b77a, // bóng trong lõi, viền ô hotbar
  creamLight: 0xfff4dc, // lõi tooltip, ô đang hover
  text: 0x3b1d0a, // chữ chính
  textShadow: 0xd9b77a, // bóng chữ (lệch +1,+1) trên nền kem
  gold: 0xf2c94c, // số tài nguyên, sao
  select: 0xd03a2c, // viền ô hotbar đang chọn (đỏ kiểu Stardew)
  good: 0x5a9e3a, // thanh nhu cầu đầy
  warn: 0xe08a1e, // thanh nhu cầu thấp
  bad: 0xb8322a, // thanh nhu cầu nguy hiểm, lỗi đặt
  sky: [0xf6b26b, 0xf08a5d, 0xb85c7a, 0x6b4a8a], // gradient trời menu, trên → dưới
} as const;

/** Every colour of UI_PALETTE in one flat list (the sky gradient expanded). */
export const UI_COLORS: readonly number[] = Object.values(UI_PALETTE).flatMap((value) =>
  typeof value === 'number' ? [value] : [...value],
);
