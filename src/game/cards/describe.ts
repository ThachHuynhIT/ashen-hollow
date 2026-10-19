import type { AttackSpec, CardDef, EffectDef, Level } from '../../data/types';

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

function effectValues(effects: readonly EffectDef[], level: Level): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of effects) {
    if (e.type === 'spawn') out.count = e.count[level - 1] ?? 0;
    else Object.assign(out, attackValues(e.attack));
  }
  return out;
}

export function describeCard(def: CardDef, level: Level = 1): CardDescription {
  let values: Record<string, number> = {};
  if (def.kind === 'troop' || def.kind === 'tower') values = effectValues(def.effects, level);
  else if (def.kind === 'throne') values = { ...attackValues(def.attack), ...effectValues(def.passive, level) };
  return { title: def.nameVi, lines: [resolvePlaceholders(def.textVi, values)] };
}
