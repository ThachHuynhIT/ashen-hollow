/** Exclusive claims on targets (one tree, one blueprint to build, one wild glowcap). */
export class Reservations {
  private readonly byTarget = new Map<number, number>();

  /** Claim `target` for `colonist`; false if someone else holds it. */
  reserve(target: number, colonist: number): boolean {
    const holder = this.byTarget.get(target);
    if (holder !== undefined && holder !== colonist) return false;
    this.byTarget.set(target, colonist);
    return true;
  }

  holder(target: number): number | undefined {
    return this.byTarget.get(target);
  }

  /** Free, or held by `by`. */
  isFree(target: number, by?: number): boolean {
    const holder = this.byTarget.get(target);
    return holder === undefined || holder === by;
  }

  release(target: number, colonist: number): void {
    if (this.byTarget.get(target) === colonist) this.byTarget.delete(target);
  }

  releaseColonist(colonist: number): void {
    for (const [target, holder] of this.byTarget) {
      if (holder === colonist) this.byTarget.delete(target);
    }
  }

  /** Forget a target entirely (it was removed from the world). */
  forgetTarget(target: number): void {
    this.byTarget.delete(target);
  }
}
