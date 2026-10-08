import { RESOURCE_IDS, type ResourceId } from '../../data/resources';

const assertAmount = (n: number): void => {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid resource amount ${n}`);
};

/** The colony's shared store. Changes only when goods are dropped off or taken out. */
export class Stockpile {
  private readonly amounts: Record<ResourceId, number>;

  constructor(initial: Readonly<Partial<Record<ResourceId, number>>>) {
    this.amounts = Object.fromEntries(RESOURCE_IDS.map((r) => [r, initial[r] ?? 0])) as Record<
      ResourceId,
      number
    >;
  }

  get(resource: ResourceId): number {
    return this.amounts[resource];
  }

  has(resource: ResourceId, amount: number): boolean {
    return this.amounts[resource] >= amount;
  }

  add(resource: ResourceId, amount: number): void {
    assertAmount(amount);
    this.amounts[resource] += amount;
  }

  /** Take up to `amount`; returns how much was actually taken. */
  take(resource: ResourceId, amount: number): number {
    assertAmount(amount);
    const taken = Math.min(amount, this.amounts[resource]);
    this.amounts[resource] -= taken;
    return taken;
  }

  snapshot(): Record<ResourceId, number> {
    return { ...this.amounts };
  }
}
