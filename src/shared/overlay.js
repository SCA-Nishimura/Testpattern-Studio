/* 全パターン共通のオーバーレイ（解像度 / ID / セーフエリア等） */
'use strict';

(function () {
  const U = TP.u;

  TP.OVERLAY_DEFAULTS = {
    enabled: true,
    showResolution: true,
    showFps: false,
    text: '',
    fontScale: 100,
    color: '#ffff00',
    position: 'bottom-left',
    safe90: false,
    safe80: false,
    aspectGuide: 'none',
    centerCross: false,
    thirds: false,
    sections: false,
    sectionCount: 2,
    sectionText: '',
    sectionSize: 40,
    sectionOpacity: 40,
    sectionY: 50,
    sectionColor: '#ffffff',
    sectionDividers: false,
  };

  /** 区画ラベルの既定文字。2 分割なら L/R、3 分割なら L/C/R。 */
  function defaultSectionLabels(n) {
    if (n === 2) return ['L', 'R'];
    if (n === 3) return ['L', 'C', 'R'];
    return Array.from({ length: n }, (_, i) => String(i + 1));
  }

  /** カンマ / 空白区切りの指定を n 個に揃える。足りない分は既定値で補う。 */
  function resolveSectionLabels(text, n) {
    const def = defaultSectionLabels(n);
    if (!text || !String(text).trim()) return def;
    const given = String(text).split(/[,\s、]+/).map((s) => s.trim()).filter(Boolean);
    return Array.from({ length: n }, (_, i) => (given[i] != null ? given[i] : def[i]));
  }

  TP.ASPECT_GUIDES = [
    { v: 'none', l: 'なし' },
    { v: '1.333', l: '4:3' },
    { v: '1.778', l: '16:9' },
    { v: '1.85', l: '1.85:1 (Flat)' },
    { v: '2.39', l: '2.39:1 (Scope)' },
    { v: '1.6', l: '16:10' },
  ];

  TP.OVERLAY_POSITIONS = [
    { v: 'top-left', l: '左上' }, { v: 'top-center', l: '上中央' }, { v: 'top-right', l: '右上' },
    { v: 'middle-left', l: '左中央' }, { v: 'center', l: '中央' }, { v: 'middle-right', l: '右中央' },
    { v: 'bottom-left', l: '左下' }, { v: 'bottom-center', l: '下中央' }, { v: 'bottom-right', l: '右下' },
  ];

  function anchor(pos, w, h, pad) {
    const [v, hh] = pos.split('-');
    const x = hh === 'left' ? pad : hh === 'right' ? w - pad : w / 2;
    const y = v === 'top' ? pad : v === 'bottom' ? h - pad : h / 2;
    const align = hh === 'left' ? 'left' : hh === 'right' ? 'right' : 'center';
    const baseline = v === 'top' ? 'top' : v === 'bottom' ? 'bottom' : 'middle';
    return { x, y, align, baseline };
  }

  /** パターン描画後の Canvas にオーバーレイを重ねる */
  TP.drawOverlay = function (ctx, env) {
    const o = env.overlay;
    if (!o || !o.enabled) return;
    const { w, h } = env;
    const ref = Math.max(0.35, U.scaleRef(w, h));
    const lw = Math.max(1, Math.round(2 * ref));

    /* --- 区画ラベル（L / R 等）---
       マルチ画面でどの面を見ているかを示すもの。パターンを潰さないよう
       半透明で、ガイドや文字より先に描いて下に敷く。 */
    if (o.sections) {
      const n = U.clamp(Math.round(o.sectionCount) || 2, 1, 16);
      const labels = resolveSectionLabels(o.sectionText, n);
      const fs = (o.sectionSize / 100) * h;

      ctx.save();
      ctx.globalAlpha = U.clamp(o.sectionOpacity / 100, 0, 1);
      ctx.fillStyle = o.sectionColor;
      ctx.font = '700 ' + Math.max(8, Math.round(fs)) + 'px "Consolas", "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 中央固定だとボアサイト等の中央ターゲットと重なるため縦位置を可変にする
      const ly = (U.clamp(o.sectionY == null ? 50 : o.sectionY, 0, 100) / 100) * h;
      for (let i = 0; i < n; i++) {
        ctx.fillText(labels[i], ((i + 0.5) * w) / n, ly);
      }
      ctx.restore();

      if (o.sectionDividers && n > 1) {
        ctx.save();
        ctx.globalAlpha = U.clamp(o.sectionOpacity / 100, 0, 1);
        ctx.fillStyle = o.sectionColor;
        for (let i = 1; i < n; i++) U.vLine(ctx, (i * w) / n, 0, h, lw);
        ctx.restore();
      }
    }

    /* --- ガイド枠 --- */
    const frame = (fw, fh, color, label) => {
      const x0 = (w - fw) / 2;
      const y0 = (h - fh) / 2;
      ctx.fillStyle = color;
      U.hLine(ctx, x0, y0, fw, lw);
      U.hLine(ctx, x0, y0 + fh, fw, lw);
      U.vLine(ctx, x0, y0, fh, lw);
      U.vLine(ctx, x0 + fw, y0, fh, lw);
      if (label) {
        const fs = 18 * ref;
        U.outlinedText(ctx, label, x0 + fs * 0.4, y0 + fs * 0.3, fs, color, '#000', 'left', 'top');
      }
    };

    if (o.safe90) frame(w * 0.9, h * 0.9, '#00e5ff', 'SAFE 90%');
    if (o.safe80) frame(w * 0.8, h * 0.8, '#00ff6a', 'SAFE 80%');

    if (o.aspectGuide && o.aspectGuide !== 'none') {
      const ar = parseFloat(o.aspectGuide);
      if (Number.isFinite(ar) && ar > 0) {
        const cur = w / h;
        let fw = w;
        let fh = h;
        if (ar > cur) fh = w / ar; else fw = h * ar;
        const g = TP.ASPECT_GUIDES.find((x) => x.v === o.aspectGuide);
        frame(fw, fh, '#ff9500', g ? g.l : o.aspectGuide);
      }
    }

    if (o.thirds) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 1; i <= 2; i++) {
        U.vLine(ctx, (i * w) / 3, 0, h, 1);
        U.hLine(ctx, 0, (i * h) / 3, w, 1);
      }
    }

    if (o.centerCross) {
      ctx.fillStyle = '#ff3b30';
      const len = Math.min(w, h) * 0.08;
      U.hLine(ctx, w / 2 - len / 2, h / 2, len, lw * 2);
      U.vLine(ctx, w / 2, h / 2 - len / 2, len, lw * 2);
    }

    /* --- テキスト --- */
    const lines = [];
    if (o.text) lines.push(o.text);
    if (o.showResolution) {
      lines.push(env.w + ' x ' + env.h + '  (' + TP.aspectLabel(env.w, env.h) + ')');
    }
    if (o.showFps) {
      lines.push((env.fps ? env.fps.toFixed(1) : '--') + ' fps');
    }
    if (!lines.length) return;

    const baseFs = 30 * ref * (o.fontScale / 100);
    const bigFs = o.text ? baseFs * 1.9 : baseFs;
    const pad = Math.max(8, baseFs * 0.7);
    const a = anchor(o.position, w, h, pad);

    const sizes = lines.map((_, i) => (o.text && i === 0 ? bigFs : baseFs));
    const totalH = sizes.reduce((s, v) => s + v * 1.25, 0);

    let y = a.baseline === 'top' ? a.y : a.baseline === 'bottom' ? a.y - totalH : a.y - totalH / 2;
    for (let i = 0; i < lines.length; i++) {
      U.outlinedText(ctx, lines[i], a.x, y, sizes[i], o.color, '#000', a.align, 'top');
      y += sizes[i] * 1.25;
    }
  };
})();
