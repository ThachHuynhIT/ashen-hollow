import type { AttackSpec, CardDef, EffectDef, Level, Scalar } from '../../data/types';

/** Nội dung mô tả thẻ; cùng hình dạng với TooltipContent nhưng game không import ui. */
export interface CardDescription {
  readonly title: string;
  readonly lines: readonly string[];
}

/** Thay `{key}` bằng giá trị; ném lỗi nếu thiếu giá trị. */
export function resolvePlaceholders(text: string, values: Readonly<Record<string, number>>): string {
  return text.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = values[key];
    if (v === undefined) throw new Error(`Missing placeholder value: ${key}`);
    return String(v);
  });
}

function attackValues(attack: AttackSpec): Record<string, number> {
  const out: Record<string, number> = { dmg: attack.dmg, range: attack.range };
  const slow = attack.onHit?.find((h) => h.type === 'slow');
  if (slow) out.slowPct = slow.pct;
  return out;
}

const scalarAt = (value: Scalar, level: Level): number =>
  typeof value === 'number' ? value : (value[level - 1] ?? 0);

function effectValues(effects: readonly EffectDef[], level: Level): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of effects) {
    if (e.type === 'spawn') out.count = e.count[level - 1] ?? 0;
    else if (e.type === 'gold') out.gold = scalarAt(e.amount, level);
    else if (e.type === 'tower' || e.type === 'pulse') Object.assign(out, attackValues(e.attack));
  }
  return out;
}

export function describeCard(def: CardDef, level: Level = 1): CardDescription {
  let values: Record<string, number> = {};
  if (def.kind === 'troop' || def.kind === 'tower' || def.kind === 'economy' || def.kind === 'support') {
    values = effectValues(def.effects, level);
  }
  else if (def.kind === 'throne') values = { ...attackValues(def.attack), ...effectValues(def.passive, level) };
  else if (def.kind === 'enchantment') {
    // `{pct}` = the percentage of the first percentage modifier the enchantment gives per stack.
    const pct = def.perStack.find((e) => e.type === 'stat' && e.mode === 'pct');
    if (pct && pct.type === 'stat') values = { pct: scalarAt(pct.value, level) };
  } else if (def.kind === 'tome') {
    const sacrifice = def.actions.find((a) => a.type === 'sacrifice');
    if (sacrifice && sacrifice.type === 'sacrifice') values = { gold: sacrifice.goldPerLevel };
  }
  return { title: def.nameVi, lines: [resolvePlaceholders(def.textVi, values)] };
}
