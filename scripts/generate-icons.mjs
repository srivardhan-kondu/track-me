/**
 * Renders the Track Me app icons to public/ as PNGs.
 *
 * Written by hand rather than pulled from a design tool so the icon stays in
 * the repo and regenerates deterministically. Shapes are rasterised with 6x
 * supersampling for clean edges at every size.
 *
 * The glyph — a ring caught mid-lap with its leading dot broken free — is the
 * same one src/components/layout/mark.tsx draws as an SVG. The numbers below
 * are that file's path data in arithmetic form; change one and change the
 * other.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/", import.meta.url));
mkdirSync(OUT, { recursive: true });

// An app icon cannot follow the theme, so it takes the dark-mode pairing:
// --accent over --accent-ink, the same tile the signed-in nav shows.
const TILE = [152, 120, 230];
const INK = [0, 10, 17];
const SS = 6; // supersampling factor

// Glyph geometry, in the 32-unit box the mark is drawn in.
const CX = 16;
const CY = 16;
const RING_R = 6.9;
const RING_W = 2.6;
// The ring runs anticlockwise from 118° round to 34°, leaving a gap at the top
// right; the dot sits in the middle of that gap, on the ring's own radius.
const ARC_FROM = 118;
const ARC_TO = 34;
const DOT_AT = 76;
const DOT_R = 1.85;

const onRing = (deg) => [
  CX + RING_R * Math.cos((deg * Math.PI) / 180),
  CY - RING_R * Math.sin((deg * Math.PI) / 180),
];

const CAP_A = onRing(ARC_FROM);
const CAP_B = onRing(ARC_TO);
const DOT = onRing(DOT_AT);

/** Signed-ish distance from a glyph-space point to the nearest inked shape. */
function distanceToGlyph(x, y) {
  const dot = Math.hypot(x - DOT[0], y - DOT[1]) - DOT_R;
  if (dot <= 0) return dot;

  // Angle measured anticlockwise from due east, with the y axis pointing down.
  let deg = (Math.atan2(CY - y, x - CX) * 180) / Math.PI;
  if (deg < 0) deg += 360;

  const stroke =
    deg >= ARC_FROM || deg <= ARC_TO
      ? Math.abs(Math.hypot(x - CX, y - CY) - RING_R) - RING_W / 2
      : // Past either end, the round cap is the closest part of the ring.
        Math.min(
          Math.hypot(x - CAP_A[0], y - CAP_A[1]),
          Math.hypot(x - CAP_B[0], y - CAP_B[1]),
        ) -
        RING_W / 2;

  return Math.min(dot, stroke);
}

/**
 * @param size    output edge length in pixels
 * @param radius  corner radius as a fraction of size (0 = full-bleed square)
 */
function render(size, radius) {
  const n = size * SS;
  const px = new Uint8Array(n * n * 4);

  const r = radius * n;
  const scale = n / 32;

  const inRoundedRect = (x, y) => {
    if (r <= 0) return true;
    const cx = Math.min(Math.max(x, r), n - r);
    const cy = Math.min(Math.max(y, r), n - r);
    return Math.hypot(x - cx, y - cy) <= r;
  };

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;

      if (!inRoundedRect(x + 0.5, y + 0.5)) {
        px[i + 3] = 0; // transparent outside the tile
        continue;
      }

      const ink = distanceToGlyph((x + 0.5) / scale, (y + 0.5) / scale) <= 0;
      const [r0, g0, b0] = ink ? INK : TILE;
      px[i] = r0;
      px[i + 1] = g0;
      px[i + 2] = b0;
      px[i + 3] = 255;
    }
  }

  // Box-filter down from the supersampled buffer.
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r0 = 0, g0 = 0, b0 = 0, a0 = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * n + (x * SS + sx)) * 4;
          const a = px[i + 3] / 255;
          r0 += px[i] * a;
          g0 += px[i + 1] * a;
          b0 += px[i + 2] * a;
          a0 += a;
        }
      }
      const count = SS * SS;
      const o = (y * size + x) * 4;
      out[o] = a0 ? Math.round(r0 / a0) : 0;
      out[o + 1] = a0 ? Math.round(g0 / a0) : 0;
      out[o + 2] = a0 ? Math.round(b0 / a0) : 0;
      out[o + 3] = Math.round((a0 / count) * 255);
    }
  }
  return out;
}

function png(rgba, size) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  // Prefix each scanline with filter type 0.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let TABLE;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[i] = c;
    }
  }
  let c = -1;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const ICONS = [
  // [file, size, cornerRadius]
  ["icon-32.png", 32, 0.28],
  ["icon-192.png", 192, 0.28],
  ["icon-512.png", 512, 0.28],
  // Maskable and Apple icons are re-masked by the platform, so the tile bleeds
  // to the edges. The glyph spans 51% of the tile, well inside either crop.
  ["icon-maskable-512.png", 512, 0],
  ["apple-touch-icon.png", 180, 0],
];

for (const [file, size, radius] of ICONS) {
  const buf = png(render(size, radius), size);
  writeFileSync(OUT + file, buf);
  console.log(`  ${file.padEnd(26)} ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
