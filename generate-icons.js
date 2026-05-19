/**
 * Générateur d'icônes PNG pour ElanProtect
 * Pur Node.js — aucune dépendance externe
 * Usage : node generate-icons.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Chunk PNG ──────────────────────────────────────────
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// ── Créer PNG RGBA ─────────────────────────────────────
function createPNG(w, h, pixels) {
  // pixels : Uint8Array de taille w*h*4 (RGBA)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0); ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; ihdrData[9] = 6; // RGBA

  // Scanlines avec octet de filtre 0
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const pi = (y * w + x) * 4;
      const ri = y * (1 + w * 4) + 1 + x * 4;
      raw[ri] = pixels[pi]; raw[ri+1] = pixels[pi+1];
      raw[ri+2] = pixels[pi+2]; raw[ri+3] = pixels[pi+3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── Dessin du pixel ────────────────────────────────────
// Couleurs ElanProtect : bleu #1E40AF
const BG = [0x1E, 0x40, 0xAF]; // bleu
const WH = [255, 255, 255];     // blanc

function sdf_roundedRect(px, py, w, h, r) {
  // Distance signée au bord d'un rectangle arrondi centré en (w/2, h/2)
  const qx = Math.abs(px - w / 2) - (w / 2 - r);
  const qy = Math.abs(py - h / 2) - (h / 2 - r);
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - r;
}

function sdf_circle(px, py, cx, cy, r) {
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) - r;
}

function sdf_rect(px, py, cx, cy, hw, hh) {
  const qx = Math.abs(px - cx) - hw;
  const qy = Math.abs(py - cy) - hh;
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2);
}

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function drawPixel(x, y, w, h) {
  const aa = 1.5; // anti-aliasing radius
  const s = w / 192; // scale

  // Fond : rectangle arrondi
  const bgSDF = sdf_roundedRect(x, y, w, h, w * 0.18);
  if (bgSDF > aa) return [0, 0, 0, 0]; // transparent

  // Alpha du fond (anti-aliasing des coins)
  const bgAlpha = Math.round(255 * lerp(1, 0, (bgSDF + aa) / (2 * aa)));

  // ── Dessin de la poignée de main stylisée ──
  // Deux arcs qui se croisent = deux ellipses + un centre
  const cx = w / 2, cy = h / 2;
  const lx = (x - cx) / s, ly = (y - cy) / s;

  // Bras gauche : rectangle diagonal haut-gauche → centre-bas
  const arm1 = sdf_rect(x / s, y / s, cx / s - 14, cy / s - 8, 32, 9);
  // Bras droit  : rectangle diagonal bas-gauche → centre-haut
  const arm2 = sdf_rect(x / s, y / s, cx / s + 14, cy / s + 8, 32, 9);
  // Cercle central (jonction des mains)
  const center = sdf_circle(x, y, cx, cy, 20 * s);
  // Barre horizontale
  const bar = sdf_rect(x, y, cx, cy, 48 * s, 9 * s);

  // Union des formes blanches
  const whiteSDF = Math.min(arm1 * s, arm2 * s, center, bar);
  const inWhite = whiteSDF < aa;

  let r, g, b, a;
  if (inWhite) {
    // Zone blanche
    const wAlpha = Math.round(255 * lerp(1, 0, (whiteSDF + aa) / (2 * aa)));
    const blend = Math.min(wAlpha, bgAlpha) / 255;
    r = Math.round(lerp(BG[0], WH[0], blend));
    g = Math.round(lerp(BG[1], WH[1], blend));
    b = Math.round(lerp(BG[2], WH[2], blend));
    a = bgAlpha;
  } else {
    [r, g, b] = BG;
    a = bgAlpha;
  }
  return [r, g, b, a];
}

// ── Générer une taille ─────────────────────────────────
function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = drawPixel(x, y, size, size);
      const i = (y * size + x) * 4;
      pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
    }
  }
  return createPNG(size, size, pixels);
}

// ── Main ───────────────────────────────────────────────
const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

console.log('🎨 Génération des icônes ElanProtect...');
[192, 512].forEach(size => {
  console.log(`  ⏳ ${size}x${size}...`);
  const png = generateIcon(size);
  const out = path.join(dir, `icon-${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`  ✅ icons/icon-${size}.png (${Math.round(png.length / 1024)} KB)`);
});
console.log('✅ Icônes générées avec succès !');
