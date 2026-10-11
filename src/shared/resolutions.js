'use strict';

TP.RESOLUTIONS = [
  { group: '16:9', items: [
    { w: 1280, h: 720, label: '1280 x 720 (HD 720p)' },
    { w: 1600, h: 900, label: '1600 x 900' },
    { w: 1920, h: 1080, label: '1920 x 1080 (Full HD)' },
    { w: 2560, h: 1440, label: '2560 x 1440 (WQHD)' },
    { w: 3840, h: 2160, label: '3840 x 2160 (4K UHD)' },
    { w: 7680, h: 4320, label: '7680 x 4320 (8K UHD)' },
  ]},
  { group: '16:10 / 商用プロジェクタ', items: [
    { w: 1280, h: 800, label: '1280 x 800 (WXGA)' },
    { w: 1920, h: 1200, label: '1920 x 1200 (WUXGA)' },
    { w: 2560, h: 1600, label: '2560 x 1600 (WQXGA)' },
    { w: 1366, h: 768, label: '1366 x 768 (WXGA)' },
  ]},
  { group: 'DCI / シネマ', items: [
    { w: 2048, h: 1080, label: '2048 x 1080 (DCI 2K)' },
    { w: 4096, h: 2160, label: '4096 x 2160 (DCI 4K)' },
    { w: 1998, h: 1080, label: '1998 x 1080 (DCI Flat)' },
    { w: 2048, h: 858, label: '2048 x 858 (DCI Scope)' },
  ]},
  { group: '4:3 / 5:4', items: [
    { w: 1024, h: 768, label: '1024 x 768 (XGA)' },
    { w: 1400, h: 1050, label: '1400 x 1050 (SXGA+)' },
    { w: 1600, h: 1200, label: '1600 x 1200 (UXGA)' },
    { w: 1280, h: 1024, label: '1280 x 1024 (SXGA)' },
  ]},
  { group: 'ウルトラワイド / マルチ', items: [
    { w: 2560, h: 1080, label: '2560 x 1080 (UW-FHD)' },
    { w: 3440, h: 1440, label: '3440 x 1440 (UW-QHD)' },
    { w: 3840, h: 1080, label: '3840 x 1080 (2画面 FHD 横並び)' },
    { w: 5120, h: 1440, label: '5120 x 1440 (2画面 WQHD)' },
    { w: 3840, h: 2400, label: '3840 x 2400 (2画面 WUXGA)' },
  ]},
];

TP.RES_MIN = 64;
TP.RES_MAX = 16384;

TP.validateResolution = function (w, h) {
  const W = Math.round(Number(w));
  const H = Math.round(Number(h));
  if (!Number.isFinite(W) || !Number.isFinite(H)) return { ok: false, msg: '数値を入力してください' };
  if (W < TP.RES_MIN || H < TP.RES_MIN) return { ok: false, msg: `${TP.RES_MIN} 以上を指定してください` };
  if (W > TP.RES_MAX || H > TP.RES_MAX) return { ok: false, msg: `${TP.RES_MAX} 以下を指定してください` };
  return { ok: true, w: W, h: H };
};

/** 1920x1080 → "16:9" のような簡易アスペクト表記 */
TP.aspectLabel = function (w, h) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(w, h) || 1;
  let aw = w / g;
  let ah = h / g;
  if (aw > 64 || ah > 64) {
    const r = w / h;
    return `${r.toFixed(2)}:1`;
  }
  return `${aw}:${ah}`;
};
