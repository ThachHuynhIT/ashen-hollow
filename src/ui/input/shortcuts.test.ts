import { describe, expect, it } from 'vitest';
import { SHORTCUTS, type ShortcutContext } from '../../data/shortcuts';
import { resolveShortcut, shortcutLabel, type ShortcutFlags } from './shortcuts';

const FREE: ShortcutFlags = {
  helpOpen: false,
  mandatoryOpen: false,
  sideModalOpen: false,
  summaryOpen: false,
  repeat: false,
  editable: false,
  modified: false,
};
const flags = (over: Partial<ShortcutFlags> = {}): ShortcutFlags => ({ ...FREE, ...over });
const CONTEXTS: ShortcutContext[] = ['menu', 'kingSelect', 'planning', 'battle', 'runEnd'];

describe('shortcut_modal_priority', () => {
  it('F1 and H toggle help in every context, ahead of every modal guard', () => {
    for (const context of CONTEXTS) {
      for (const key of ['F1', 'h', 'H']) {
        expect(resolveShortcut(key, context, flags()), `${context} ${key}`).toBe('help.toggle');
        expect(resolveShortcut(key, context, flags({ mandatoryOpen: true })), `${context} ${key} mandatory`).toBe('help.toggle');
        expect(resolveShortcut(key, context, flags({ sideModalOpen: true })), `${context} ${key} side`).toBe('help.toggle');
        expect(resolveShortcut(key, context, flags({ summaryOpen: true })), `${context} ${key} summary`).toBe('help.toggle');
      }
    }
  });

  it('while Help is open only F1, H and Escape are heard', () => {
    for (const context of CONTEXTS) {
      expect(resolveShortcut('F1', context, flags({ helpOpen: true }))).toBe('help.toggle');
      expect(resolveShortcut('h', context, flags({ helpOpen: true }))).toBe('help.toggle');
      expect(resolveShortcut('Escape', context, flags({ helpOpen: true }))).toBe('cancel');
      for (const key of ['Enter', '1', '2', '3', '4', 's', 'r', 'd', 'l', 'p', ' ', 'b']) {
        expect(resolveShortcut(key, context, flags({ helpOpen: true })), `${context} ${key}`).toBeNull();
      }
    }
  });

  it('ignores repeats, editable targets and modifier chords, F1 included', () => {
    for (const bad of [{ repeat: true }, { editable: true }, { modified: true }]) {
      expect(resolveShortcut('F1', 'planning', flags(bad))).toBeNull();
      expect(resolveShortcut('1', 'planning', flags(bad))).toBeNull();
    }
  });

  it('a mandatory modal hears only confirm, a side modal only cancel', () => {
    expect(resolveShortcut('Enter', 'planning', flags({ mandatoryOpen: true }))).toBe('confirm');
    expect(resolveShortcut('Escape', 'planning', flags({ mandatoryOpen: true }))).toBeNull();
    expect(resolveShortcut('1', 'planning', flags({ mandatoryOpen: true }))).toBeNull();
    expect(resolveShortcut('Escape', 'planning', flags({ sideModalOpen: true }))).toBe('cancel');
    expect(resolveShortcut('r', 'planning', flags({ sideModalOpen: true }))).toBeNull();
  });
});

describe('existing_bindings_unchanged', () => {
  const expectKeys = (context: ShortcutContext, f: ShortcutFlags, table: Record<string, string>): void => {
    for (const [key, action] of Object.entries(table)) {
      expect(resolveShortcut(key, context, f), `${context} ${key}`).toBe(action);
    }
  };

  it('king select', () => {
    expectKeys('kingSelect', FREE, { '1': 'select.1', '2': 'select.2', '3': 'select.3', Enter: 'confirm', Escape: 'back' });
  });

  it('planning', () => {
    expectKeys('planning', FREE, {
      '1': 'select.1', '2': 'select.2', '3': 'select.3', '4': 'select.4',
      r: 'reroll', R: 'reroll', s: 'sell', S: 'sell', d: 'deck', D: 'deck', l: 'calendar', L: 'calendar',
      Enter: 'confirm', Escape: 'cancel',
    });
  });

  it('battle, with and without the summary', () => {
    expectKeys('battle', FREE, {
      p: 'pause', P: 'pause', '1': 'speed.1', '2': 'speed.2', '3': 'speed.3', ' ': 'intervene', b: 'intervene', B: 'intervene', Escape: 'cancel',
    });
    expect(resolveShortcut('Enter', 'battle', FREE)).toBeNull();
    expectKeys('battle', flags({ summaryOpen: true }), { Enter: 'confirm', ' ': 'confirm' });
    expect(resolveShortcut('p', 'battle', flags({ summaryOpen: true }))).toBeNull();
  });

  it('run end', () => {
    expectKeys('runEnd', FREE, { Enter: 'newRun', Escape: 'back' });
  });

  it('the menu has no keys of its own beyond Help', () => {
    for (const key of ['1', 'Enter', 'Escape', ' ']) expect(resolveShortcut(key, 'menu', FREE)).toBeNull();
  });
});

describe('the table itself', () => {
  it('no_conflicting_keys_per_context: a key maps to one action unless its conditions differ', () => {
    for (const context of [...CONTEXTS, 'help' as const]) {
      const seen = new Map<string, string>();
      for (const def of SHORTCUTS.filter((d) => d.contexts.includes(context))) {
        for (const key of def.keys) {
          const slot = `${key.toLowerCase()}|${def.when ?? 'free'}`;
          expect(seen.has(slot), `${context} ${slot} used by ${seen.get(slot)} and ${def.id}`).toBe(false);
          seen.set(slot, def.id);
        }
      }
    }
  });

  it('ids are unique and every def has a Vietnamese label', () => {
    expect(new Set(SHORTCUTS.map((d) => d.id)).size).toBe(SHORTCUTS.length);
    for (const d of SHORTCUTS) expect(d.labelVi.length, d.id).toBeGreaterThan(0);
  });

  it('shortcutLabel names the keys of a def, and is empty for an unknown id', () => {
    expect(shortcutLabel('help')).toBe('F1 / H');
    expect(shortcutLabel('battle.intervene')).toBe('Space / B');
    expect(shortcutLabel('nope')).toBe('');
  });
});
