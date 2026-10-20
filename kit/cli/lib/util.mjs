// Small helpers shared by the mds modules. No dependencies.
import fs from 'node:fs';
import path from 'node:path';

export const toPosix = (p) => p.split(path.sep).join('/');

export function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
}

export function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

export function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function listDir(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).sort(byName); } catch { return []; }
}

/** Every .md file under dir (recursive, dot-folders skipped), sorted. */
export function walkMd(dir) {
  const out = [];
  for (const e of listDir(dir)) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(p));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Write only when the bytes differ. Returns true when the file was written. */
export function writeIfChanged(file, text) {
  let old = null;
  try { old = fs.readFileSync(file, 'utf8'); } catch { /* new file */ }
  if (old === text) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return true;
}

export function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of listDir(src)) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}

/** ids.slug: NFKD fold, drop marks, lowercase, runs outside a-z0-9 → -, trim, cut 60. */
export function slugify(name, fallback) {
  let s = String(name).normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 60) s = s.slice(0, 60).replace(/-+$/, '');
  return s || fallback;
}

export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)(?:-([a-z0-9-]+))?$/.exec(v || '');
  return m ? { major: +m[1], minor: +m[2], label: m[3] || '' } : null;
}

/** versions sort: major, minor numerically; a labelled exploration after its unlabelled version. */
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return a < b ? -1 : a > b ? 1 : 0;
  if (x.major !== y.major) return x.major - y.major;
  if (x.minor !== y.minor) return x.minor - y.minor;
  if (x.label === y.label) return 0;
  if (x.label === '') return -1;
  if (y.label === '') return 1;
  return x.label < y.label ? -1 : 1;
}

/**
 * Split str at every top-level occurrence of sep (outside [], () and "…").
 * Returns [{ text, start }] with start offsets into str. max = maximum number of splits.
 */
export function splitTop(str, sep, max = Infinity) {
  const out = [];
  let sq = 0, par = 0, inQ = false, last = 0, splits = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inQ) {
      if (c === '\\') { i++; continue; }
      if (c === '"') inQ = false;
      continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === '[') sq++;
    else if (c === ']') sq = Math.max(0, sq - 1);
    else if (c === '(') par++;
    else if (c === ')') par = Math.max(0, par - 1);
    else if (sq === 0 && par === 0 && splits < max && str.startsWith(sep, i)) {
      out.push({ text: str.slice(last, i), start: last });
      i += sep.length - 1;
      last = i + 1;
      splits++;
    }
  }
  out.push({ text: str.slice(last), start: last });
  return out;
}

export function unquote(v) {
  return v.replace(/\\(.)/g, '$1');
}

export function quote(v) {
  return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

export const escapeCell = (s) => String(s).replace(/\|/g, '\\|');

/** Relative link path from one file to another ('' when it is the same file). */
export function relLink(fromFile, toFile) {
  if (path.resolve(fromFile) === path.resolve(toFile)) return '';
  return toPosix(path.relative(path.dirname(fromFile), toFile));
}

export function cut(text, max) {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return chars.slice(0, max - 1).join('').trimEnd() + '…';
}

export const pad6 = (n) => String(n).padStart(6, '0');

export function sortBy(arr, ...keys) {
  return arr.sort((a, b) => {
    for (const k of keys) {
      const x = k(a), y = k(b);
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  });
}

/**
 * Run fn holding <root>/.mds.lock, so two agents writing one project in parallel do not clobber
 * _ids.md or generated files. Waits up to 30 s; a lock older than 2 min is stale and removed.
 */
export function withLock(root, fn) {
  const lock = path.join(root, '.mds.lock');
  fs.mkdirSync(root, { recursive: true });
  const until = Date.now() + 30000;
  for (;;) {
    try { fs.mkdirSync(lock); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let age = 0;
      try { age = Date.now() - fs.statSync(lock).mtimeMs; } catch { continue; }
      if (age > 120000) { fs.rmSync(lock, { recursive: true, force: true }); continue; }
      if (Date.now() > until) throw Object.assign(new Error(`another mds command is writing ${root} (.mds.lock) — retry, or delete .mds.lock if no mds is running`), { locked: true });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
  try { return fn(); } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}
