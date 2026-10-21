import { describe, expect, it } from 'vitest';
import type { KingId } from '../../data/types';
import { CONTENT } from '../../game/cards/registry';
import { offerTitle } from './offerModel';

const name = (id: KingId) => CONTENT.king(id).nameVi;

describe('offerTitle', () => {
  it('names a plain reward', () => {
    expect(offerTitle({ kind: 'reward' }, name)).toBe('Phần thưởng — chọn 1 thẻ');
  });

  it('names the conquered king on a conquest offer', () => {
    expect(offerTitle({ kind: 'conquest', king: 'stone' }, name)).toBe(
      `Chinh phục ${CONTENT.king('stone').nameVi} — chọn 1 thẻ`,
    );
  });

  it('falls back to the plain title for a conquest offer without a king', () => {
    expect(offerTitle({ kind: 'conquest' }, name)).toBe('Chinh phục — chọn 1 thẻ');
  });
});
