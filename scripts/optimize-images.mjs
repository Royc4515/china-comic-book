// Generates the mobile-optimised assets the reader loads:
//   assets/web/page_XX.webp   full page  (~896w)  - what the reader shows
//   assets/web/thumb_XX.webp  small thumb (~200w) - drawer, scrubber, ambient backdrop
//   assets/web/cover_0X.webp / thumb_cover_0X.webp
//   icons/*.png               PWA / home-screen icons cropped from cover 01
// The originals in assets/ are never touched. Run with: npm run optimize
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets');
const out = path.join(src, 'web');
const iconDir = path.join(root, 'icons');

const FULL = { width: 896, quality: 80, effort: 5 };
const THUMB = { width: 200, quality: 68, effort: 5 };

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function convert(file, name, { width, quality, effort }) {
  const dest = path.join(out, name);
  await sharp(path.join(src, file))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort })
    .toFile(dest);
  return (await stat(dest)).size;
}

async function icons() {
  await mkdir(iconDir, { recursive: true });
  const cover = path.join(src, 'cover_01.jpg');
  // Square crop centred on Roy so the icon survives circular/rounded masks.
  const crop = { left: 120, top: 200, width: 560, height: 560 };
  const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };
  for (const [name, size] of Object.entries(sizes)) {
    await sharp(cover).extract(crop).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(iconDir, name));
  }
  // Maskable: content kept inside the central 80% safe zone on a dark field.
  await sharp(cover)
    .extract(crop)
    .resize(410, 410)
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#0b0d14' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(iconDir, 'icon-maskable-512.png'));
}

// `--page=3` (repeatable) regenerates just those pages; used by serve-review.js after a variant is picked.
const onlyPages = process.argv.slice(2)
  .filter((a) => a.startsWith('--page='))
  .map((a) => String(Number(a.slice(7))).padStart(2, '0'));

async function main() {
  await mkdir(out, { recursive: true });
  let files = (await readdir(src)).filter((f) => /^(page_\d+\.png|cover_\d+\.jpg)$/.test(f)).sort();
  if (onlyPages.length) files = files.filter((f) => onlyPages.some((p) => f === `page_${p}.png`));
  let before = 0;
  let after = 0;
  for (const file of files) {
    const base = file.replace(/\.(png|jpg)$/, '');
    const thumbName = base.startsWith('cover') ? `thumb_${base}.webp` : `thumb_${base.replace('page_', '')}.webp`;
    const full = await convert(file, `${base}.webp`, FULL);
    const thumb = await convert(file, thumbName, THUMB);
    const orig = (await stat(path.join(src, file))).size;
    before += orig;
    after += full + thumb;
    console.log(`${file.padEnd(14)} ${kb(orig).padStart(7)} -> ${kb(full).padStart(6)} (+${kb(thumb)} thumb)`);
  }
  if (onlyPages.length) {
    console.log(`\nRegenerated ${files.length} page(s).`);
    return;
  }
  await icons();
  console.log(`\nTotal ${kb(before)} -> ${kb(after)} (${Math.round((1 - after / before) * 100)}% smaller). Icons written to icons/.`);
}

main().catch((err) => {
  console.error('optimize-images failed:', err);
  process.exit(1);
});
