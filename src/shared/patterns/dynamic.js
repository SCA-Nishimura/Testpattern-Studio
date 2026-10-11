/* 動的パターン（フレーム落ち / 遅延 / 残像の確認） */
'use strict';

(function () {
  const U = TP.u;

  const pColor = (key, label, def) => ({ key, label, type: 'color', default: def });
  const pNum = (key, label, def, min, max, step) => ({ key, label, type: 'number', default: def, min, max, step: step || 1 });
  const pBool = (key, label, def) => ({ key, label, type: 'bool', default: def });
  const pSel = (key, label, def, options) => ({ key, label, type: 'select', default: def, options });

  /* ------------------------------------------------------------- スクロール */
  TP.registerPattern({
    id: 'scroll',
    name: 'スクロールバー',
    category: 'dynamic',
    animated: true,
    hint: 'フレーム落ち・ジャダーの目視検出。等速でなめらかに流れていればコマ落ちなし。',
    params: [
      pNum('speed', '速度 (px/frame)', 8, 0.1, 200, 0.1),
      pSel('dir', '方向', 'left', [
        { v: 'left', l: '左へ' },
        { v: 'right', l: '右へ' },
        { v: 'up', l: '上へ' },
        { v: 'down', l: '下へ' },
      ]),
      pNum('barWidth', 'バー幅 (px)', 60, 1, 1024),
      pColor('color1', '色 1', '#ffffff'),
      pColor('color2', '色 2', '#000000'),
      pBool('tick', '固定の目盛りを重ねる', true),
    ],
    draw(ctx, { w, h, p, frame }) {
      const vertical = p.dir === 'up' || p.dir === 'down';
      const sign = p.dir === 'left' || p.dir === 'up' ? -1 : 1;
      const bw = Math.max(1, p.barWidth);
      const period = bw * 2;
      const span = vertical ? h : w;
      const offset = ((frame * p.speed * sign) % period + period) % period;

      U.fill(ctx, w, h, p.color2);
      ctx.fillStyle = p.color1;
      for (let s = -period + offset; s < span + period; s += period) {
        if (vertical) ctx.fillRect(0, Math.round(s), w, Math.round(bw));
        else ctx.fillRect(Math.round(s), 0, Math.round(bw), h);
      }

      if (p.tick) {
        ctx.fillStyle = '#ff3b30';
        const n = 10;
        const tl = Math.min(w, h) * 0.05;
        for (let i = 0; i <= n; i++) {
          if (vertical) U.hLine(ctx, 0, (i * h) / n, tl, 3);
          else U.vLine(ctx, (i * w) / n, 0, tl, 3);
        }
      }
    },
  });

  /* ----------------------------------------------------------- 動くボックス */
  TP.registerPattern({
    id: 'movingbox',
    name: '動くボックス',
    category: 'dynamic',
    animated: true,
    hint: '表示遅延・残像（オーバードライブ）の確認。LED プロセッサのフレーム遅延の目視比較にも使える。',
    params: [
      pNum('size', 'ボックスサイズ (%)', 8, 1, 50, 0.5),
      pNum('speed', '速度 (画面幅/秒)', 0.5, 0.02, 5, 0.02),
      pSel('path', '軌道', 'bounce', [
        { v: 'bounce', l: '往復（左右）' },
        { v: 'circle', l: '円運動' },
        { v: 'perimeter', l: '外周一周' },
        { v: 'diagonal', l: '斜め往復' },
      ]),
      pColor('boxColor', 'ボックスの色', '#ffffff'),
      pColor('bgColor', '背景色', '#000000'),
      pBool('trailGrid', '位置参照グリッドを表示', true),
    ],
    draw(ctx, { w, h, p, time }) {
      U.fill(ctx, w, h, p.bgColor);

      if (p.trailGrid) {
        ctx.fillStyle = 'rgba(128,128,128,0.45)';
        for (let i = 1; i < 10; i++) {
          U.vLine(ctx, (i * w) / 10, 0, h, 1);
          U.hLine(ctx, 0, (i * h) / 10, w, 1);
        }
      }

      const s = (p.size / 100) * Math.min(w, h);
      const t = time * p.speed;
      let x, y;
      if (p.path === 'circle') {
        const r = Math.min(w, h) / 2 - s / 2;
        const a = t * Math.PI * 2;
        x = w / 2 + Math.cos(a) * r;
        y = h / 2 + Math.sin(a) * r;
      } else if (p.path === 'perimeter') {
        const per = ((t % 1) + 1) % 1;
        const W = w - s;
        const H = h - s;
        const total = 2 * (W + H);
        let d = per * total;
        if (d < W) { x = s / 2 + d; y = s / 2; }
        else if ((d -= W) < H) { x = w - s / 2; y = s / 2 + d; }
        else if ((d -= H) < W) { x = w - s / 2 - d; y = h - s / 2; }
        else { d -= W; x = s / 2; y = h - s / 2 - d; }
      } else {
        const tri = (u) => { const q = ((u % 2) + 2) % 2; return q < 1 ? q : 2 - q; };
        x = s / 2 + tri(t) * (w - s);
        y = p.path === 'diagonal' ? s / 2 + tri(t) * (h - s) : h / 2;
      }

      ctx.fillStyle = p.boxColor;
      ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), Math.round(s), Math.round(s));
    },
  });

  /* ---------------------------------------------------------- フレームカウンタ */
  TP.registerPattern({
    id: 'framecounter',
    name: 'フレームカウンタ',
    category: 'dynamic',
    animated: true,
    hint: 'カメラ撮影での遅延実測用。1 フレームごとに数字とフラッシュが変わるので写真 1 枚で遅延が読める。',
    params: [
      pNum('digits', '桁数', 6, 1, 12),
      pNum('fontSize', '文字サイズ (画面高の %)', 28, 2, 90, 0.5),
      pColor('textColor', '文字色', '#ffffff'),
      pColor('bgColor', '背景色', '#000000'),
      pBool('flash', '毎フレーム反転するフラッシュ帯', true),
      pBool('binary', 'フレーム番号のバイナリ表示', true),
      pBool('showTime', '経過時間 / 実測 fps も表示', true),
    ],
    draw(ctx, { w, h, p, frame, time, fps }) {
      U.fill(ctx, w, h, p.bgColor);

      const fs = (p.fontSize / 100) * h;
      const num = String(frame % Math.pow(10, p.digits)).padStart(p.digits, '0');
      U.outlinedText(ctx, num, w / 2, h / 2, fs, p.textColor, '#000', 'center', 'middle');

      if (p.flash) {
        const on = frame % 2 === 0;
        ctx.fillStyle = on ? '#ffffff' : '#000000';
        ctx.fillRect(0, 0, w, Math.round(h * 0.06));
        ctx.fillStyle = on ? '#000000' : '#ffffff';
        ctx.fillRect(0, Math.round(h * 0.94), w, Math.round(h * 0.06));
      }

      if (p.binary) {
        const bits = 16;
        const bw = w / bits;
        const bh = h * 0.05;
        const y0 = h * 0.08;
        for (let i = 0; i < bits; i++) {
          const bit = (frame >> (bits - 1 - i)) & 1;
          ctx.fillStyle = bit ? '#ffffff' : '#303030';
          ctx.fillRect(Math.round(i * bw) + 1, Math.round(y0), Math.round(bw) - 2, Math.round(bh));
        }
      }

      if (p.showTime) {
        const sub = fs * 0.22;
        const txt = time.toFixed(2) + ' s   /   ' + (fps ? fps.toFixed(1) : '--') + ' fps';
        U.outlinedText(ctx, txt, w / 2, h / 2 + fs * 0.62, sub, p.textColor, '#000', 'center', 'top');
      }
    },
  });
})();
