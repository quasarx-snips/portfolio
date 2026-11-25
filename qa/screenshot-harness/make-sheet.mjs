#!/usr/bin/env node
/**
 * qa/screenshot-harness/make-sheet.mjs — generates a self-contained dark contact sheet from the
 * PNGs produced by qa/screenshot-harness/capture.mjs.
 *
 * Zero npm dependencies (Node 22+). Images are embedded as base64 data URIs,
 * so the resulting HTML needs no network and no neighboring files.
 *
 * Usage:
 *   node qa/screenshot-harness/make-sheet.mjs [--dir=.qa/shots] [--out=.qa/contact-sheet.html]
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = {
    dir: path.join(SCRIPT_DIR, 'shots'),
    out: path.join(SCRIPT_DIR, 'contact-sheet.html'),
  };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      console.log('Usage: node qa/screenshot-harness/make-sheet.mjs [--dir=<shotsDir>] [--out=<htmlFile>]');
      process.exit(0);
    }
    const eq = raw.indexOf('=');
    if (!raw.startsWith('--') || eq === -1) {
      throw new Error(`Unknown option: ${raw} (expected --key=value, see --help)`);
    }
    const key = raw.slice(0, eq);
    const value = raw.slice(eq + 1);
    if (key === '--dir') opts.dir = value;
    else if (key === '--out') opts.out = value;
    else throw new Error(`Unknown option: ${key} (see --help)`);
    if (!value) throw new Error(`Option ${key} requires a value`);
  }
  return opts;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Read width/height straight from the PNG IHDR chunk. */
function pngDimensions(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24) return null;
  for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Parse capture.mjs naming: <prefix>-p<percent>.png | <prefix>-s<pixels>.png
 * (Also tolerates fraction-style progress like -p0.20 from older/manual runs.)
 */
function parseShotName(name) {
  const m = /^(.+)-([ps])(\d+(?:\.\d+)?)\.png$/i.exec(name);
  if (!m) return { prefix: 'other', label: name, sortKey: `2-${name}` };
  const [, prefix, kind, numText] = m;
  const num = Number(numText);
  if (kind.toLowerCase() === 'p') {
    // "060" -> 60% (integer percent), "0.20" -> 0.20 (fraction)
    const isFraction = numText.includes('.');
    const fraction = isFraction ? num : num / 100;
    return {
      prefix,
      label: `progress ${fraction.toFixed(2)} (${Math.round(fraction * 100)}%)`,
      sortKey: `0-${fraction.toFixed(4)}`,
    };
  }
  return {
    prefix,
    label: `scrollY ${num}px`,
    sortKey: `1-${String(num).padStart(8, '0')}`,
  };
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dir = path.resolve(opts.dir);
  const outFile = path.resolve(opts.out);

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read shots directory ${dir}: ${err.message}`);
  }

  const names = entries
    .filter((e) => e.isFile() && /\.png$/i.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  if (names.length === 0) {
    throw new Error(`No PNG files found in ${dir} — run node qa/screenshot-harness/capture.mjs first.`);
  }

  // Group by prefix, preserving a readable order.
  const groups = new Map();
  let totalBytes = 0;
  for (const name of names) {
    const filePath = path.join(dir, name);
    const buf = readFileSync(filePath);
    const bytes = statSync(filePath).size;
    totalBytes += bytes;
    const dims = pngDimensions(buf);
    const meta = parseShotName(name);
    if (!groups.has(meta.prefix)) groups.set(meta.prefix, []);
    groups.get(meta.prefix).push({
      name,
      label: meta.label,
      sortKey: meta.sortKey,
      bytes,
      dims,
      dataUri: `data:image/png;base64,${buf.toString('base64')}`,
    });
  }
  for (const shots of groups.values()) {
    shots.sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'en', { numeric: true }));
  }

  const timestamp = new Date().toISOString();
  const groupKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const sections = groupKeys
    .map((prefix) => {
      const shots = groups.get(prefix);
      const cards = shots
        .map((shot) => {
          const dimNote = shot.dims ? `${shot.dims.width}×${shot.dims.height}` : 'unknown size';
          return `
        <figure class="shot">
          <div class="frame"><img loading="lazy" src="${shot.dataUri}" alt="${escapeHtml(shot.name)}"></div>
          <figcaption>
            <span class="label">${escapeHtml(shot.label)}</span>
            <span class="meta">${escapeHtml(shot.name)} · ${dimNote} · ${formatBytes(shot.bytes)}</span>
          </figcaption>
        </figure>`;
        })
        .join('');
      return `
    <section class="group">
      <h2>${escapeHtml(prefix)} <span class="count">${shots.length} shot${shots.length === 1 ? '' : 's'}</span></h2>
      <div class="grid">${cards}
      </div>
    </section>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Palace of Many Worlds — QA Contact Sheet</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #101014;
    --panel: #17171d;
    --panel-2: #1d1d25;
    --text: #e8e6e1;
    --muted: #9b98a3;
    --line: #2a2a33;
    --accent: #c9a86a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 15px/1.5 "Segoe UI", system-ui, -apple-system, sans-serif;
    padding: 32px clamp(16px, 4vw, 56px) 64px;
  }
  header { border-bottom: 1px solid var(--line); padding-bottom: 20px; margin-bottom: 28px; }
  h1 { font-size: clamp(20px, 3vw, 28px); margin: 0 0 6px; letter-spacing: 0.01em; }
  h1 .accent { color: var(--accent); }
  .summary { color: var(--muted); margin: 0; }
  .summary code { color: var(--text); background: var(--panel-2); padding: 1px 6px; border-radius: 4px; }
  .group { margin: 0 0 36px; }
  .group h2 {
    font-size: 17px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--accent); margin: 0 0 14px;
    display: flex; align-items: baseline; gap: 12px;
  }
  .group h2 .count { color: var(--muted); font-size: 13px; letter-spacing: 0.02em; text-transform: none; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 18px;
  }
  .shot {
    margin: 0; background: var(--panel); border: 1px solid var(--line);
    border-radius: 10px; overflow: hidden; display: flex; flex-direction: column;
  }
  .frame { background: var(--panel-2); aspect-ratio: 16 / 10; display: flex; align-items: center; justify-content: center; }
  .frame img { width: 100%; height: 100%; object-fit: contain; display: block; }
  figcaption { padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 2px; }
  .label { font-weight: 600; color: var(--text); }
  .meta { color: var(--muted); font-size: 12.5px; word-break: break-all; }
  footer { color: var(--muted); font-size: 13px; border-top: 1px solid var(--line); padding-top: 16px; }
</style>
</head>
<body>
<header>
  <h1>The Palace of Many Worlds <span class="accent">· QA contact sheet</span></h1>
  <p class="summary">
    ${names.length} screenshot${names.length === 1 ? '' : 's'} · ${formatBytes(totalBytes)} total ·
    ${groupKeys.length} prefix group${groupKeys.length === 1 ? '' : 's'} · generated ${escapeHtml(timestamp)}<br>
    source: <code>${escapeHtml(dir)}</code>
  </p>
</header>
${sections}
<footer>
  Self-contained (all images embedded, no network requests). Generated by <code>node qa/screenshot-harness/make-sheet.mjs</code>.
</footer>
</body>
</html>
`;

  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, 'utf8');
  console.log(
    `[sheet] wrote ${outFile}  (${names.length} image${names.length === 1 ? '' : 's'}, ` +
      `${groupKeys.length} group${groupKeys.length === 1 ? '' : 's'}, ${formatBytes(html.length)} html)`
  );
  for (const prefix of groupKeys) {
    console.log(`[sheet]   group "${prefix}": ${groups.get(prefix).length} shot(s)`);
  }
}

try {
  main();
  process.exit(0);
} catch (err) {
  console.error(`[sheet] FAILED: ${err?.message ?? err}`);
  if (process.env.QA_DEBUG && err?.stack) console.error(err.stack);
  process.exit(1);
}