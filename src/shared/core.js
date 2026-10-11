/* パターンレジストリと共通ユーティリティ。
   file:// 環境で ES Module の CORS 制約に当たらないよう、クラシックスクリプト +
   window.TP 名前空間で構成する。読み込み順は HTML 側の script タグ順に従う。 */
'use strict';

window.TP = window.TP || {};

TP.patterns = [];

TP.registerPattern = function (def) {
  if (TP.patterns.some((p) => p.id === def.id)) throw new Error(`duplicate pattern id: ${def.id}`);
  TP.patterns.push(def);
  return def;
};

TP.getPattern = function (id) {
  return TP.patterns.find((p) => p.id === id) || null;
};

TP.patternsByCategory = function (category) {
  return TP.patterns.filter((p) => p.category === category);
};

TP.defaultParams = function (def) {
  const out = {};
  for (const p of def.params || []) out[p.key] = p.default;
  return out;
};

/* ------------------------------------------------------------- 色 / 数値 */

const U = {};
TP.u = U;

/** 0-100 の IRE / % 値を 8bit ビデオレンジ(16-235)のグレーへ */
U.ireToRgb = function (ire) {
  const v = Math.round(16 + (219 * ire) / 100);
  const c = Math.max(0, Math.min(255, v));
  return `rgb(${c},${c},${c})`;
};

/** 0-100 の % 値をフルレンジ(0-255)のグレーへ */
U.pctToRgb = function (pct) {
  const c = Math.max(0, Math.min(255, Math.round((255 * pct) / 100)));
  return `rgb(${c},${c},${c})`;
};

U.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 画面サイズに対する相対値。1920x1080 を基準に線幅や文字サイズをスケールする */
U.scaleRef = (w, h) => Math.min(w / 1920, h / 1080);

U.fill = function (ctx, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
};

/** サブピクセルのにじみを避けるため整数ピクセルで縦線を引く */
U.vLine = function (ctx, x, y, h, lw) {
  ctx.fillRect(Math.round(x - lw / 2), Math.round(y), Math.max(1, Math.round(lw)), Math.round(h));
};

/** 同様に横線 */
U.hLine = function (ctx, x, y, w, lw) {
  ctx.fillRect(Math.round(x), Math.round(y - lw / 2), Math.round(w), Math.max(1, Math.round(lw)));
};

U.setFont = function (ctx, px, weight) {
  ctx.font = `${weight || 600} ${Math.max(6, Math.round(px))}px "Segoe UI", "Yu Gothic UI", Arial, sans-serif`;
};

/** 背景が何色でも読めるよう、縁取り付きテキスト */
U.outlinedText = function (ctx, text, x, y, px, fill, stroke, align, baseline) {
  U.setFont(ctx, px, 700);
  ctx.textAlign = align || 'left';
  ctx.textBaseline = baseline || 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, px * 0.14);
  ctx.strokeStyle = stroke || '#000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill || '#fff';
  ctx.fillText(text, x, y);
};

/** 等間隔の線位置を中央対称に並べる（0 と size も必ず含む） */
U.symmetricPositions = function (size, pitch) {
  const out = [];
  const center = size / 2;
  for (let x = center; x >= -0.5; x -= pitch) out.push(x);
  out.reverse();
  for (let x = center + pitch; x <= size + 0.5; x += pitch) out.push(x);
  return out;
};
