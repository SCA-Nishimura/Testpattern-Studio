/* build/icon.ico を生成する（依存なし / 256x256 32bpp の非圧縮 ICO）。
   アイコンはカラーバー + グリッド線というアプリの中身そのままの意匠。
   使い方: node tools/make-icon.js */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const S = 256;

const BARS = [
  [192, 192, 192], [192, 192, 0], [0, 192, 192], [0, 192, 0],
  [192, 0, 192], [192, 0, 0], [0, 0, 192],
];

/** RGBA ピクセルバッファを作る */
function render() {
  const px = Buffer.alloc(S * S * 4);
  const set = (x, y, r, g, b, a) => {
    const i = (y * S + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };

  const radius = 42;
  const inside = (x, y) => {
    // 角丸の内側判定
    const cx = Math.min(x, S - 1 - x);
    const cy = Math.min(y, S - 1 - y);
    if (cx >= radius || cy >= radius) return true;
    const dx = radius - cx;
    const dy = radius - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inside(x, y)) { set(x, y, 0, 0, 0, 0); continue; }

      let c;
      if (y < S * 0.62) {
        c = BARS[Math.min(BARS.length - 1, Math.floor((x / S) * BARS.length))];
      } else if (y < S * 0.72) {
        const k = Math.floor((x / S) * 7);
        c = k % 2 === 0 ? [20, 20, 20] : [160, 160, 160];
      } else {
        const t = x / S;
        const v = Math.round(16 + 219 * t);
        c = [v, v, v];
      }

      // グリッド線を重ねる
      const onGrid = x % 32 === 0 || y % 32 === 0;
      const onCenter = x === S / 2 || y === S / 2;
      if (onCenter) c = [255, 59, 48];
      else if (onGrid) c = [255, 255, 255];

      set(x, y, c[0], c[1], c[2], 255);
    }
  }
  return px;
}

function buildIco(px) {
  const xorSize = S * S * 4;
  const maskRow = Math.ceil(S / 8 / 4) * 4;
  const maskSize = maskRow * S;

  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);      // biSize
  header.writeInt32LE(S, 4);        // biWidth
  header.writeInt32LE(S * 2, 8);    // biHeight (XOR + AND)
  header.writeUInt16LE(1, 12);      // biPlanes
  header.writeUInt16LE(32, 14);     // biBitCount
  header.writeUInt32LE(0, 16);      // biCompression = BI_RGB
  header.writeUInt32LE(xorSize + maskSize, 20);

  // BMP は下から上。ピクセルは BGRA。
  const xor = Buffer.alloc(xorSize);
  for (let y = 0; y < S; y++) {
    const src = (S - 1 - y) * S * 4;
    for (let x = 0; x < S; x++) {
      const s = src + x * 4;
      const d = (y * S + x) * 4;
      xor[d] = px[s + 2];
      xor[d + 1] = px[s + 1];
      xor[d + 2] = px[s];
      xor[d + 3] = px[s + 3];
    }
  }

  // 32bpp ではアルファが使われるため AND マスクは全 0 でよい
  const mask = Buffer.alloc(maskSize, 0);
  const image = Buffer.concat([header, xor, mask]);

  const dir = Buffer.alloc(6 + 16);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(1, 4);
  dir.writeUInt8(0, 6);             // width 256 は 0 で表す
  dir.writeUInt8(0, 7);             // height 同上
  dir.writeUInt8(0, 8);
  dir.writeUInt8(0, 9);
  dir.writeUInt16LE(1, 10);
  dir.writeUInt16LE(32, 12);
  dir.writeUInt32LE(image.length, 14);
  dir.writeUInt32LE(22, 18);

  return Buffer.concat([dir, image]);
}

const out = path.join(__dirname, '..', 'build', 'icon.ico');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buildIco(render()));
console.log('wrote', out, fs.statSync(out).size, 'bytes');
