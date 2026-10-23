import { readFile, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const contexts = [
  ['menu', 'Menu'],
  ['kingSelect', 'Chọn vua'],
  ['planning', 'Lên kế hoạch'],
  ['battle', 'Trong trận'],
  ['runEnd', 'Kết thúc ván'],
  ['help', 'Trợ giúp'],
];
const startMarker = '<!-- shortcuts:start -->';
const endMarker = '<!-- shortcuts:end -->';

const keyName = (key) => {
  if (key === ' ') return 'Space';
  if (key === 'Escape') return 'Esc';
  return key.length === 1 ? key.toUpperCase() : key;
};

/** Render the exact text between README markers, including surrounding newlines. */
export function renderShortcutsMarkdown(shortcuts) {
  const sections = contexts.map(([context, title]) => {
    const rows = shortcuts.filter((def) => def.contexts.includes(context)).map((def) => {
      const keys = def.keys.map(keyName).join(' / ');
      const note = def.when === 'summary' ? ' (khi bảng tóm tắt trận mở)' : '';
      return `| ${keys} | ${def.labelVi}${note} |`;
    });
    return [`### ${title}`, '', '| Phím | Hành động |', '| --- | --- |', ...rows].join('\n');
  });
  return `\n\n${sections.join('\n\n')}\n\n`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--check', '--print'].includes(arg)) || args.length > 1) {
    throw new Error('Cách dùng: node tools/sync-shortcuts.mjs [--check | --print]');
  }
  const source = await readFile(new URL('../src/data/shortcuts.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const { SHORTCUTS } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const markdown = renderShortcutsMarkdown(SHORTCUTS);
  if (args.includes('--print')) {
    process.stdout.write(markdown);
    return;
  }
  const readmeUrl = new URL('../README.md', import.meta.url);
  const readme = await readFile(readmeUrl, 'utf8');
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) {
    throw new Error(`README.md thiếu marker hoặc sai thứ tự: ${startMarker} / ${endMarker}`);
  }
  const contentStart = start + startMarker.length;
  const current = readme.slice(contentStart, end);
  if (current === markdown) return;
  if (args.includes('--check')) {
    const before = current.split('\n');
    const after = markdown.split('\n');
    const line = after.findIndex((text, index) => text !== before[index]);
    const first = line === -1 ? after.length : line;
    process.stderr.write([
      'README.md: bảng phím tắt chưa đồng bộ. Chạy node tools/sync-shortcuts.mjs',
      '--- README.md (hiện tại)',
      '+++ SHORTCUTS (mong đợi)',
      `@@ dòng ${first + 1} trong marker @@`,
      ...before.slice(first, first + 4).map((text) => `-${text}`),
      ...after.slice(first, first + 4).map((text) => `+${text}`),
      '',
    ].join('\n'));
    process.exitCode = 1;
    return;
  }
  await writeFile(readmeUrl, readme.slice(0, contentStart) + markdown + readme.slice(end));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`sync-shortcuts: ${error.message}\n`);
    process.exitCode = 1;
  });
}
