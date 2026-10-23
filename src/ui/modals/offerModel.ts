import type { KingId } from '../../data/types';
import type { CardOfferState } from '../../game/run/state';

/** Title of the reward / conquest picker (§10.6). */
export const offerTitle = (
  offers: Pick<CardOfferState, 'kind' | 'king'>,
  kingName: (id: KingId) => string,
): string =>
  offers.kind === 'conquest'
    ? `Chinh phục${offers.king ? ` ${kingName(offers.king)}` : ''} — chọn 1 thẻ`
    : 'Phần thưởng — chọn 1 thẻ';
