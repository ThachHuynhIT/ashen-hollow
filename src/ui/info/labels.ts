import type { DamageType, UnitBehaviourDef, UnitTag } from '../../data/types';

const DAMAGE_LABELS: Record<DamageType, string> = {
  physical: 'vật lý',
  fire: 'lửa',
  magic: 'phép',
};

const TAG_LABELS: Record<UnitTag, string> = {
  melee: 'cận chiến',
  ranged: 'tầm xa',
  flying: 'bay',
  siege: 'công thành',
  boss: 'trùm',
  summon: 'triệu hồi',
  human: 'người',
  beast: 'thú',
  undead: 'xác sống',
  clockwork: 'máy móc',
  golem: 'người đá',
  mage: 'pháp sư',
  pirate: 'hải tặc',
  cavalry: 'kỵ binh',
  construct: 'nhân tạo',
};

export const damageTypeLabel = (t: DamageType): string => DAMAGE_LABELS[t];

export const unitTagLabel = (t: UnitTag): string => TAG_LABELS[t];

export function behaviourLabel(b: UnitBehaviourDef): string {
  switch (b.type) {
    case 'reviveOnce':
      return `Sống lại một lần với ${b.hpPct}% máu`;
    case 'enrage':
      return `Dưới ${b.belowHpPct}% máu: +${b.dmgPct}% sát thương`;
    case 'rampDmg':
      return `Mỗi giây +${b.pctPerSecond}% sát thương, tối đa ${b.cap}%`;
    case 'rampAttackSpeed':
      return `Mỗi giây +${b.pctPerSecond}% tốc đánh, tối đa ${b.cap}%`;
    case 'stepBuff':
      return `Mỗi ${b.everyTicks} nhịp: +${b.dmgPct}% sát thương và +${b.speedPct}% tốc di chuyển, tối đa ${b.maxStacks} lớp`;
    case 'charge':
      return `Đòn đầu: ×${b.dmgMult} sát thương, đẩy ${b.knockback} px, choáng ${b.stunTicks} nhịp`;
    case 'kite':
      return `Lùi khi hồi đòn nếu địch gần hơn ${b.distance} px`;
    case 'healAura':
      return `Hồi ${b.hpPerSec} máu mỗi giây cho lính cùng phe trong ${b.radius} px`;
    case 'deathSpawn':
      return `Khi chết triệu hồi ${b.count} lính`;
    case 'killHeal':
      return `Hạ địch hồi ${b.hp} máu`;
    case 'soulScaling':
      return `Mỗi lính cùng phe đã chết: +${b.pctPerSoul}% máu và sát thương`;
    case 'boss':
      return 'Trùm có kỹ năng riêng';
    default: {
      const exhaustive: never = b;
      return exhaustive;
    }
  }
}
