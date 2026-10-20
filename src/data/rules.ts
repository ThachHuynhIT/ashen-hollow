/** Luật một ván (spec §3.2, §14): số năm, lịch kẻ địch, và trận có tự bắt đầu hay không. */
export interface Rules {
  readonly years: number;
  /** `raiders`: mọi năm Thổ Phỉ (G1); `short`: 15 năm với 2 vua địch (G2). */
  readonly calendar: 'raiders' | 'short';
  /** Trận tự bắt đầu sau khi chơi/bán thẻ (G1); từ G2 tắt để còn đổi bài, mua ô. */
  readonly autoStart: boolean;
}

export const RULES_G1: Rules = { years: 10, calendar: 'raiders', autoStart: true };
export const RULES_G2: Rules = { years: 15, calendar: 'short', autoStart: false };
