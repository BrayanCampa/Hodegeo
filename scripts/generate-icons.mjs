// Genera los PNG 192/512 de la PWA sin dependencias externas (solo Node: zlib).
// Dibuja un bastón estilizado sobre fondo azul marino.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');

const NAVY = [11, 31, 58, 255];
const ORANGE = [255, 122, 26, 255];
const WHITE = [255, 255, 255, 255];

function crc32(bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const N = size;
  const ax = 0.34 * N;
  const ay = 0.86 * N;
  const bx = 0.63 * N;
  const by = 0.28 * N;
  const shaftW = 0.075 * N;
  const headR = 0.13 * N;
  const innerR = 0.07 * N;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let color = NAVY;
      const dLine = distToSegment(x, y, ax, ay, bx, by);
      const dHead = Math.hypot(x - bx, y - by);
      // Mango (anillo) + cuerpo del bastón.
      if (dHead < headR && dHead > innerR) color = ORANGE;
      else if (dLine < shaftW) color = ORANGE;
      // Un casquillo blanco en la punta inferior.
      const dTip = Math.hypot(x - ax, y - ay);
      if (dTip < 0.09 * N) color = WHITE;
      const i = (y * N + x) * 4;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = color[3];
    }
  }
  return encodePng(N, N, rgba);
}

mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = render(size);
  const file = join(outDir, `pwa-${size}.png`);
  writeFileSync(file, png);
  console.log(`Generado ${file} (${png.length} bytes)`);
}
