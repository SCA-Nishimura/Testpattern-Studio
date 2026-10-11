/* フォーカス / ボアサイト調整用パターン（Christie 等の内蔵テストパターン相当）

   ボアサイト調整は「レンズ光軸をスクリーン面に対して垂直に立てる」作業なので、
   中央 1 点ではなく画面全体で同時に見る必要がある。そのため各ターゲットには
   向きの異なる微細パターンを入れ、非点収差（縦線は合うのに横線が合わない）も
   同じ絵の中で判別できるようにしている。 */
'use strict';

(function () {
  const U = TP.u;

  const pColor = (key, label, def) => ({ key, label, type: 'color', default: def });
  const pNum = (key, label, def, min, max, step) => ({ key, label, type: 'number', default: def, min, max, step: step || 1 });
  const pBool = (key, label, def) => ({ key, label, type: 'bool', default: def });
  const pSel = (key, label, def, options) => ({ key, label, type: 'select', default: def, options });

  /** 配置プリセットを相対座標の配列へ */
  function layoutPoints(layout, inset) {
    const a = inset;
    const b = 1 - inset;
    if (layout === '1') return [[0.5, 0.5, 'CENTER']];
    if (layout === '5') {
      return [
        [a, a, 'TL'], [b, a, 'TR'],
        [0.5, 0.5, 'CENTER'],
        [a, b, 'BL'], [b, b, 'BR'],
      ];
    }
    if (layout === '9') {
      const out = [];
      const ys = [[a, 'T'], [0.5, 'M'], [b, 'B']];
      const xs = [[a, 'L'], [0.5, 'C'], [b, 'R']];
      for (const [y, yl] of ys) for (const [x, xl] of xs) out.push([x, y, yl + xl]);
      return out;
    }
    // 'edges': 四隅 + 各辺中央 + 中央
    return [
      [a, a, 'TL'], [0.5, a, 'T'], [b, a, 'TR'],
      [a, 0.5, 'L'], [0.5, 0.5, 'CENTER'], [b, 0.5, 'R'],
      [a, b, 'BL'], [0.5, b, 'B'], [b, b, 'BR'],
    ];
  }

  /* ------------------------------------------------------ 1. ボアサイト */
  TP.registerPattern({
    id: 'boresight',
    name: 'ボアサイト / フォーカスターゲット',
    category: 'projector',
    hint: 'レンズ光軸のチルト調整用。中央と四隅が「同時に」シャープになる点を探す。4 象限の向き違いで非点収差も判る。',
    params: [
      pSel('layout', 'ターゲット配置', '5', [
        { v: '5', l: '5 点（中央 + 四隅）= ボアサイト標準' },
        { v: '9', l: '9 点（3x3）' },
        { v: 'edges', l: '9 点（四隅 + 各辺中央 + 中央）' },
        { v: '1', l: '中央のみ' },
      ]),
      pNum('inset', '端からの距離 (%)', 10, 2, 45, 0.5),
      pNum('size', 'ターゲットサイズ (%)', 14, 3, 60, 0.5),
      pNum('pitch', '微細パターンのピッチ (px)', 1, 1, 16),
      pSel('coreType', '微細パターンの中身', '4dir', [
        { v: '4dir', l: '4 方位（縦 / 横 / 45° / 135°）= 非点収差を見る' },
        { v: 'mix', l: '市松 / 縦 / 横 / 45°' },
        { v: 'checker', l: '市松のみ（解像限界だけ見る）' },
      ]),
      pBool('ring', '外周の枠と十字を描く', true),
      pNum('lineWidth', '枠 / 十字の線幅 (px)', 2, 1, 32),
      pBool('labels', '位置ラベルを表示', true),
      pColor('bgColor', '背景色', '#000000'),
      pBool('dimField', 'ターゲット以外をわずかに明るくする', false),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, p.dimField ? '#0d0d0d' : p.bgColor);

      const size = Math.max(8, Math.round((p.size / 100) * Math.min(w, h)));
      const pitch = Math.max(1, Math.round(p.pitch));
      const lw = Math.max(1, p.lineWidth);

      // 幅 1px の 45° 線は (x+y)%2 となり市松と完全に一致してしまうため、
      // 斜め象限だけは最低 2px 幅にする。凡例にもその旨を出す。
      const dp = Math.max(2, pitch);
      const checker = (x, y) => (Math.floor(x / pitch) + Math.floor(y / pitch)) % 2 === 0;
      const vert = (x) => Math.floor(x / pitch) % 2 === 0;
      const horiz = (y) => Math.floor(y / pitch) % 2 === 0;
      const diag45 = (x, y) => (x + y) % (dp * 2) < dp;
      const diag135 = (x, y) => (((x - y) % (dp * 2)) + dp * 2) % (dp * 2) < dp;

      // 微細パターンのブロックは全ターゲットで同一なので 1 枚だけ作って使い回す
      const core = Math.max(4, Math.round(size * 0.62));
      const img = ctx.createImageData(core, core);
      const d = img.data;
      const half = Math.round(core / 2);
      let i = 0;
      for (let y = 0; y < core; y++) {
        for (let x = 0; x < core; x++) {
          const left = x < half;
          const top = y < half;
          let on;
          if (p.coreType === 'checker') {
            on = checker(x, y);
          } else if (p.coreType === 'mix') {
            on = top ? (left ? checker(x, y) : vert(x)) : (left ? horiz(y) : diag45(x, y));
          } else {
            on = top ? (left ? vert(x) : horiz(y)) : (left ? diag45(x, y) : diag135(x, y));
          }
          const v = on ? 255 : 0;
          d[i++] = v; d[i++] = v; d[i++] = v; d[i++] = 255;
        }
      }

      const pts = layoutPoints(p.layout, p.inset / 100);
      const fs = Math.max(9, 16 * Math.max(0.5, U.scaleRef(w, h)));

      for (const [rx, ry, label] of pts) {
        const cx = rx * w;
        const cy = ry * h;
        const x0 = Math.round(U.clamp(cx - core / 2, 0, Math.max(0, w - core)));
        const y0 = Math.round(U.clamp(cy - core / 2, 0, Math.max(0, h - core)));

        ctx.putImageData(img, x0, y0);

        if (p.ring) {
          ctx.fillStyle = '#ffffff';
          const s = size;
          const bx = x0 + core / 2;
          const by = y0 + core / 2;
          // 枠
          U.hLine(ctx, bx - s / 2, by - s / 2, s, lw);
          U.hLine(ctx, bx - s / 2, by + s / 2, s, lw);
          U.vLine(ctx, bx - s / 2, by - s / 2, s, lw);
          U.vLine(ctx, bx + s / 2, by - s / 2, s, lw);
          // 枠の外へ伸びる十字（粗い位置合わせ用）
          const arm = s * 0.3;
          U.hLine(ctx, bx - s / 2 - arm, by, arm, lw);
          U.hLine(ctx, bx + s / 2, by, arm, lw);
          U.vLine(ctx, bx, by - s / 2 - arm, arm, lw);
          U.vLine(ctx, bx, by + s / 2, arm, lw);
        }

        if (p.labels) {
          const by = y0 + core / 2;
          U.outlinedText(ctx, label, x0 + core / 2, by + size * 0.5 + fs * 0.6, fs, '#ffcc00', '#000', 'center', 'top');
        }
      }

      if (p.labels && p.coreType !== 'checker') {
        const diagNote = dp !== pitch ? '（斜めのみ ' + dp + 'px）' : '';
        const legend = p.coreType === 'mix'
          ? '各ターゲット: 左上=市松 / 右上=縦線 / 左下=横線 / 右下=45°'
          : '各ターゲット: 左上=縦線 / 右上=横線 / 左下=45° / 右下=135°';
        U.outlinedText(ctx, legend + '  ピッチ ' + pitch + 'px' + diagNote,
          w / 2, h - fs * 0.5, fs, '#ffffff', '#000', 'center', 'bottom');
      }
    },
  });

  /* ---------------------------------------------------- 2. ジーメンススター */
  TP.registerPattern({
    id: 'siemens',
    name: 'ジーメンススター（解像限界 / 非点収差）',
    category: 'projector',
    hint: '中心がグレーに潰れる円の直径が解像限界。潰れが楕円なら非点収差。フォーカスを詰める最後の一手。',
    params: [
      pSel('layout', '配置', '5', [
        { v: '5', l: '5 点（中央 + 四隅）' },
        { v: '1', l: '中央のみ（大きく）' },
        { v: '9', l: '9 点（3x3）' },
      ]),
      pNum('inset', '端からの距離 (%)', 12, 2, 45, 0.5),
      pNum('diameter', '直径 (%)', 18, 3, 90, 0.5),
      pNum('spokes', 'スポーク数（白黒の対の数）', 36, 4, 180),
      pBool('rings', '目盛りリングを描く', true),
      pNum('ringCount', '目盛りリングの本数', 4, 1, 12),
      pColor('bgColor', '背景色', '#000000'),
      pColor('fgColor', 'スポークの色', '#ffffff'),
      pBool('labels', 'ラベルを表示', true),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, p.bgColor);

      const dia = (p.diameter / 100) * Math.min(w, h);
      const r = dia / 2;
      const n = Math.max(4, Math.round(p.spokes));
      const pts = layoutPoints(p.layout, p.inset / 100);
      const fs = Math.max(9, 16 * Math.max(0.5, U.scaleRef(w, h)));

      for (const [rx, ry, label] of pts) {
        const cx = U.clamp(rx * w, r, w - r);
        const cy = U.clamp(ry * h, r, h - r);

        ctx.fillStyle = p.fgColor;
        for (let k = 0; k < n; k++) {
          const a0 = (k * 2 * Math.PI) / n;
          const a1 = a0 + Math.PI / n;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, a0, a1);
          ctx.closePath();
          ctx.fill();
        }

        if (p.rings) {
          ctx.strokeStyle = '#ff3b30';
          ctx.lineWidth = Math.max(1, 1.5 * U.scaleRef(w, h));
          for (let k = 1; k <= p.ringCount; k++) {
            const rr = (r * k) / (p.ringCount + 1);
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        if (p.labels) {
          U.outlinedText(ctx, label, cx, cy + r + fs * 0.5, fs, '#ffcc00', '#000', 'center', 'top');
        }
      }

      if (p.labels) {
        // スポークがちょうど 1px 幅になる半径 = 解像限界の目安
        const limitR = n / Math.PI / 2;
        const note = 'スポーク ' + n + ' 本 / 理論上 1px 幅になる半径 ≈ ' + limitR.toFixed(1) + 'px'
          + '  — グレーに潰れた円がこれより大きければフォーカス不足';
        U.outlinedText(ctx, note, w / 2, h - fs * 0.5, fs, '#ffffff', '#000', 'center', 'bottom');
      }
    },
  });

  /* ------------------------------------------------------- 3. コンバージェンス */
  TP.registerPattern({
    id: 'convergence',
    name: 'コンバージェンス（RGB 重ね合わせ）',
    category: 'projector',
    hint: '3 板機で「ピントが甘い」と感じる原因の多くは実はこれ。白線に色フリンジが出たらフォーカスでなく convergence のずれ。',
    params: [
      pSel('mode', 'モード', 'white', [
        { v: 'white', l: '白の細線（色フリンジを探す）' },
        { v: 'rgb', l: 'R / G / B を個別に表示' },
        { v: 'split', l: '画面を 3 分割して R / G / B' },
      ]),
      pSel('channel', '表示チャンネル（個別表示時）', 'r', [
        { v: 'r', l: 'R' }, { v: 'g', l: 'G' }, { v: 'b', l: 'B' },
      ]),
      pNum('countX', '横分割数', 16, 1, 128),
      pNum('countY', '縦分割数', 9, 1, 128),
      pNum('lineWidth', '線幅 (px)', 1, 1, 8),
      pBool('crosshairs', '9 点に拡大用クロスヘアを置く', true),
      pNum('crossSize', 'クロスヘアのサイズ (%)', 6, 1, 30, 0.5),
      pColor('bgColor', '背景色', '#000000'),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, p.bgColor);
      const lw = Math.max(1, Math.round(p.lineWidth));
      const nx = Math.max(1, p.countX);
      const ny = Math.max(1, p.countY);

      const drawGrid = (color, clipX0, clipX1) => {
        ctx.save();
        if (clipX0 != null) {
          ctx.beginPath();
          ctx.rect(clipX0, 0, clipX1 - clipX0, h);
          ctx.clip();
        }
        ctx.fillStyle = color;
        for (let i = 0; i <= nx; i++) U.vLine(ctx, U.clamp((i * w) / nx, lw / 2, w - lw / 2), 0, h, lw);
        for (let j = 0; j <= ny; j++) U.hLine(ctx, 0, U.clamp((j * h) / ny, lw / 2, h - lw / 2), w, lw);
        ctx.restore();
      };

      if (p.mode === 'split') {
        drawGrid('#ff0000', 0, w / 3);
        drawGrid('#00ff00', w / 3, (w * 2) / 3);
        drawGrid('#0000ff', (w * 2) / 3, w);
      } else if (p.mode === 'rgb') {
        drawGrid({ r: '#ff0000', g: '#00ff00', b: '#0000ff' }[p.channel]);
      } else {
        drawGrid('#ffffff');
      }

      if (p.crosshairs) {
        const s = (p.crossSize / 100) * Math.min(w, h);
        ctx.fillStyle = '#ffcc00';
        for (const ry of [0.1, 0.5, 0.9]) {
          for (const rx of [0.1, 0.5, 0.9]) {
            const cx = rx * w;
            const cy = ry * h;
            U.hLine(ctx, cx - s / 2, cy, s, lw);
            U.vLine(ctx, cx, cy - s / 2, s, lw);
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = Math.max(1, lw);
            ctx.strokeRect(Math.round(cx - s / 2) + 0.5, Math.round(cy - s / 2) + 0.5, Math.round(s), Math.round(s));
          }
        }
      }
    },
  });
})();
