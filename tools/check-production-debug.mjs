#!/usr/bin/env node
// Fails (exit 1) when a production build contains the DEV year-jump preview: its marker strings, its texts
// or a chunk named after it. Usage: node tools/check-production-debug.mjs [dist-dir]   |   --self-test
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const MARKERS = ['DEV_PREVIEW_ONLY_JUMP', 'Xem thử (DEV)', 'BẢN XEM THỬ', 'registerPreview', 'createPreviewRun'];
const NAME_PARTS = ['registerPreview', 'previewRun', 'DevJumpPanel'];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** Problems found in `dir`, one string each (file and what was seen). */
export const scan = (dir) => {
  const found = [];
  for (const file of walk(dir)) {
    const base = file.slice(dir.length + 1);
    for (const part of NAME_PARTS) if (base.includes(part)) found.push(`${base}: chunk named after ${part}`);
    if (!/\.(js|mjs|html|css|json|map)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of MARKERS) if (text.includes(m)) found.push(`${base}: contains "${m}"`);
  }
  return found;
};

const selfTest = () => {
  const root = mkdtempSync(join(tmpdir(), 'dbg-'));
  try {
    mkdirSync(join(root, 'clean'));
    writeFileSync(join(root, 'clean', 'index.js'), 'console.log("hello");');
    mkdirSync(join(root, 'dirty'));
    writeFileSync(join(root, 'dirty', 'app.js'), 'const x="DEV_PREVIEW_ONLY_JUMP";');
    writeFileSync(join(root, 'dirty', 'registerPreview-abc.js'), 'export{}');
    const clean = scan(join(root, 'clean'));
    const dirty = scan(join(root, 'dirty'));
    if (clean.length !== 0) throw new Error(`clean fixture flagged: ${clean.join('; ')}`);
    if (dirty.length < 2) throw new Error(`dirty fixture not detected: ${dirty.join('; ')}`);
    console.log('self-test ok');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    const dir = process.argv[2] ?? 'dist';
    const problems = scan(dir);
    if (problems.length > 0) {
      console.error(`Debug preview found in ${dir}:\n${problems.map((p) => `  ${p}`).join('\n')}`);
      process.exit(1);
    }
    console.log(`No debug preview in ${dir}.`);
  }
}
