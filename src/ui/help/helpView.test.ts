import { describe, expect, it } from 'vitest';
import {
  EMPTY_CARDS_TEXT,
  cycleFilter,
  initialHelpView,
  selectEntry,
  setHelpTab,
  type HelpView,
} from './helpView';

const OWNERS = ['neutral', 'wheat', 'stone'] as const;

describe('help_filters_preserve_selection_on_resize', () => {
  it('keeps tab, filters and the chosen entry through a tab round trip', () => {
    let v: HelpView = initialHelpView();
    v = cycleFilter(v, 'owner', OWNERS);
    v = cycleFilter(v, 'level', OWNERS);
    v = selectEntry(v, 'wheat_militia');
    const back = setHelpTab(setHelpTab(v, 'units'), 'cards');
    expect(back.filter).toEqual(v.filter);
    expect(back.entryId).toBe('wheat_militia');
    expect(back.scroll).toBe(0); // a tab change resets the scroll
  });

  it('cycles owner through all then each owner and back to all', () => {
    let v = initialHelpView();
    const seen: string[] = [v.filter.owner];
    for (let i = 0; i < OWNERS.length + 1; i++) {
      v = cycleFilter(v, 'owner', OWNERS);
      seen.push(v.filter.owner);
    }
    expect(seen).toEqual(['all', 'neutral', 'wheat', 'stone', 'all']);
  });

  it('levels run 1 to 5 and wrap', () => {
    let v = initialHelpView();
    const levels: number[] = [v.filter.level];
    for (let i = 0; i < 5; i++) {
      v = cycleFilter(v, 'level', OWNERS);
      levels.push(v.filter.level);
    }
    expect(levels).toEqual([1, 2, 3, 4, 5, 1]);
  });

  it('a filter change resets the scroll and the chosen entry', () => {
    const v = selectEntry({ ...initialHelpView(), scroll: 120 }, 'x');
    const next = cycleFilter(v, 'kind', OWNERS);
    expect(next.scroll).toBe(0);
    expect(next.entryId).toBeNull();
  });

  it('has the empty-result text', () => {
    expect(EMPTY_CARDS_TEXT).toBe('Không có thẻ phù hợp.');
  });
});
