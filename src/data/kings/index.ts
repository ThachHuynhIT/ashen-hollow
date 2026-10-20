import type { KingDef } from '../types';
import { STONE } from './stone';
import { WHEAT } from './wheat';

/** Các vua chơi được trong G1. */
export const KINGS_G1: readonly KingDef[] = [WHEAT];

/** Các vua có nội dung đầy đủ cho G2 (thêm vua mới ở đây khi nội dung của họ xong). */
export const KINGS_G2: readonly KingDef[] = [WHEAT, STONE];
