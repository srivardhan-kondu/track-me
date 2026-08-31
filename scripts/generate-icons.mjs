/**
 * Renders the Track Me app icons to public/ as PNGs.
 *
 * Written by hand rather than pulled from a design tool so the icon stays in
 * the repo and regenerates deterministically. Shapes are rasterised with 4x
 * supersampling for clean edges at every size.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const BRAND = [61, 111, 229]; // the primary blue, matching --primary
const WHITE = [255, 255, 255];
const SS = 4; // supersampling factor

/** The lucide "activity" pulse, in a 24x24 viewBox. */
const PULSE = [
  [22, 12], [18, 12], [15, 21], [9, 3], [6, 12], [2, 12],
];

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * @param size    output edge length in pixels
 * @param radius  corner radius as a fraction of size (0 = square)
 * @param inset   glyph inset as a fraction of size, for maskable safe area
 */
function render(size, radius, inset) {
  const n = size * SS;
  const px = new Uint8Array(n * n * 4);

  const r = radius * n;
  const strokeW = 0.075 * n; // pulse line thickness
  const scale = (1 - 2 * inset) * n / 24;
  const offset = inset * n;

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

      // Background.
      px[i] = BRAND[0];
      px[i + 1] = BRAND[1];
      px[i + 2] = BRAND[2];
      px[i + 3] = 255;

      // Pulse glyph, in glyph-space coordinates.
      const gx = (x + 0.5 - offset) / scale;
      const gy = (y + 0.5 - offset) / scale;

      let best = Infinity;
      for (let s = 0; s < PULSE.length - 1; s++) {
        best = Math.min(best, distanceToSegment(gx, gy, PULSE[s], PULSE[s + 1]));
        if (best * scale <= strokeW / 2) break;
      }

      if (best * scale <= strokeW / 2) {
        px[i] = WHITE[0];
        px[i + 1] = WHITE[1];
        px[i + 2] = WHITE[2];
      }
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
  // [file, size, cornerRadius, glyphInset]
  ["icon-192.png", 192, 0.22, 0.22],
  ["icon-512.png", 512, 0.22, 0.22],
  // Maskable icons are cropped to a circle by the launcher, so the glyph sits
  // inside the 80% safe area and the tile bleeds to the edges.
  ["icon-maskable-512.png", 512, 0, 0.29],
  ["apple-touch-icon.png", 180, 0, 0.22],
];

for (const [file, size, radius, inset] of ICONS) {
  const buf = png(render(size, radius, inset), size);
  writeFileSync(OUT + file, buf);
  console.log(`  ${file.padEnd(26)} ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
