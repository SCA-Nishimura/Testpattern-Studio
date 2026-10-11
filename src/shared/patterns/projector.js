/* プロジェクタ調整系パターン（Vioso Testpattern Simulator 相当） */
'use strict';

(function () {
  const U = TP.u;

  const pColor = (key, label, def) => ({ key, label, type: 'color', default: def });
  const pNum = (key, label, def, min, max, step) => ({ key, label, type: 'number', default: def, min, max, step: step || 1 });
  const pBool = (key, label, def) => ({ key, label, type: 'bool', default: def });
  const pSel = (key, label, def, options) => ({ key, label, type: 'select', default: def, options });

  /* ------------------------------------------------ 1. グリッド / クロスハッチ */
  TP.registerPattern({
    id: 'grid',
    name: 'グリッド / クロスハッチ',
    category: 'projector',
    hint: '設置時の幾何歪み・ワープ調整の基準。分割数モードなら解像度を変えても升目の数が一定。',
    params: [
      pSel('mode', 'ピッチ指定', 'count', [
        { v: 'count', l: '分割数で指定（解像度非依存）' },
        { v: 'px', l: 'ピクセルピッチで指定' },
      ]),
      pNum('countX', '横分割数', 16, 1, 256),
      pNum('countY', '縦分割数', 9, 1, 256),
      pNum('pitch', 'ピッチ (px)', 100, 2, 4096),
      pNum('lineWidth', '線幅 (px)', 2, 1, 64),
      pColor('lineColor', '線の色', '#ffffff'),
      pColor('bgColor', '背景色', '#000000'),
      pBool('centerCross', '中央線を強調', true),
      pColor('centerColor', '中央線の色', '#ff3b30'),
      pBool('outerFrame', '外周枠を描く', true),
      pBool('labels', '升目座標ラベル', false),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, p.bgColor);

      let pitchX, pitchY;
      if (p.mode === 'count') {
        pitchX = w / Math.max(1, p.countX);
        pitchY = h / Math.max(1, p.countY);
      } else {
        pitchX = pitchY = Math.max(2, p.pitch);
      }

      const lw = Math.max(1, p.lineWidth);
      const xs = p.mode === 'count'
        ? Array.from({ length: p.countX + 1 }, (_, i) => i * pitchX)
        : U.symmetricPositions(w, pitchX);
      const ys = p.mode === 'count'
        ? Array.from({ length: p.countY + 1 }, (_, i) => i * pitchY)
        : U.symmetricPositions(h, pitchY);

      ctx.fillStyle = p.lineColor;
      for (const x of xs) U.vLine(ctx, U.clamp(x, lw / 2, w - lw / 2), 0, h, lw);
      for (const y of ys) U.hLine(ctx, 0, U.clamp(y, lw / 2, h - lw / 2), w, lw);

      if (p.outerFrame) {
        ctx.fillStyle = p.lineColor;
        U.vLine(ctx, lw / 2, 0, h, lw);
        U.vLine(ctx, w - lw / 2, 0, h, lw);
        U.hLine(ctx, 0, lw / 2, w, lw);
        U.hLine(ctx, 0, h - lw / 2, w, lw);
      }

      if (p.centerCross) {
        ctx.fillStyle = p.centerColor;
        const clw = lw * 2;
        U.vLine(ctx, w / 2, 0, h, clw);
        U.hLine(ctx, 0, h / 2, w, clw);
      }

      if (p.labels) {
        const fs = Math.min(pitchX, pitchY) * 0.22;
        if (fs >= 7) {
          ctx.fillStyle = p.lineColor;
          U.setFont(ctx, fs, 600);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          for (let cy = 0; cy < ys.length - 1; cy++) {
            for (let cx = 0; cx < xs.length - 1; cx++) {
              ctx.fillText(cx + ',' + cy, xs[cx] + fs * 0.3, ys[cy] + fs * 0.25);
            }
          }
        }
      }
    },
  });

  /* ------------------------------------------------------- 2. ドットグリッド */
  TP.registerPattern({
    id: 'dotgrid',
    name: 'ドットグリッド',
    category: 'projector',
    hint: 'ワープ用コントロールポイントの位置合わせ。十字形状はサブピクセル精度の目視合わせに向く。',
    params: [
      pNum('countX', '横分割数', 16, 1, 256),
      pNum('countY', '縦分割数', 9, 1, 256),
      pSel('shape', '形状', 'cross', [
        { v: 'cross', l: '十字' },
        { v: 'circle', l: '円' },
        { v: 'square', l: '四角' },
      ]),
      pNum('size', 'サイズ (px)', 24, 2, 512),
      pNum('lineWidth', '十字の線幅 (px)', 3, 1, 64),
      pColor('dotColor', 'ドットの色', '#ffffff'),
      pColor('bgColor', '背景色', '#000000'),
      pBool('includeEdges', '外周（0 行 / 0 列）も描く', true),
      pBool('centerMark', '中央を色分け', true),
      pColor('centerColor', '中央の色', '#ff3b30'),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, p.bgColor);
      const nx = Math.max(1, p.countX);
      const ny = Math.max(1, p.countY);
      const s = Math.max(2, p.size);
      const lw = Math.max(1, p.lineWidth);

      const i0 = p.includeEdges ? 0 : 1;
      const iN = p.includeEdges ? nx : nx - 1;
      const j0 = p.includeEdges ? 0 : 1;
      const jN = p.includeEdges ? ny : ny - 1;

      for (let j = j0; j <= jN; j++) {
        for (let i = i0; i <= iN; i++) {
          const x = U.clamp((i * w) / nx, s / 2, w - s / 2);
          const y = U.clamp((j * h) / ny, s / 2, h - s / 2);
          const isCenter = p.centerMark && i * 2 === nx && j * 2 === ny;
          ctx.fillStyle = isCenter ? p.centerColor : p.dotColor;

          if (p.shape === 'cross') {
            U.vLine(ctx, x, y - s / 2, s, lw);
            U.hLine(ctx, x - s / 2, y, s, lw);
          } else if (p.shape === 'square') {
            ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), Math.round(s), Math.round(s));
          } else {
            ctx.beginPath();
            ctx.arc(x, y, s / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
  });

  /* ------------------------------------------- 3. ブレンド領域グラデーション */
  TP.registerPattern({
    id: 'blend',
    name: 'ブレンド領域グラデーション',
    category: 'projector',
    hint: 'エッジブレンディングのオーバーラップ幅とガンマ確認。2 台で重ねて合計が均一な白になるのが正解。',
    params: [
      pNum('left', '左ブレンド幅 (%)', 15, 0, 50, 0.5),
      pNum('right', '右ブレンド幅 (%)', 15, 0, 50, 0.5),
      pNum('top', '上ブレンド幅 (%)', 0, 0, 50, 0.5),
      pNum('bottom', '下ブレンド幅 (%)', 0, 0, 50, 0.5),
      pNum('gamma', 'ブレンドガンマ', 2.2, 0.2, 5, 0.05),
      pNum('level', '最大レベル (%)', 100, 1, 100),
      pColor('color', '基準色', '#ffffff'),
      pBool('invert', '減衰方向を反転', false),
      pBool('showMarks', 'ブレンド境界線を表示', true),
    ],
    draw(ctx, { w, h, p }) {
      const img = ctx.createImageData(w, h);
      const d = img.data;

      const hex = p.color.replace('#', '');
      const cr = parseInt(hex.slice(0, 2), 16);
      const cg = parseInt(hex.slice(2, 4), 16);
      const cb = parseInt(hex.slice(4, 6), 16);
      const lvl = p.level / 100;
      const g = p.gamma;

      const wl = (p.left / 100) * w;
      const wr = (p.right / 100) * w;
      const wt = (p.top / 100) * h;
      const wb = (p.bottom / 100) * h;

      // 各辺の減衰係数の積を取り、コーナーでも連続になるようにする
      const rampX = new Float32Array(w);
      for (let x = 0; x < w; x++) {
        let a = 1;
        if (wl > 0 && x < wl) a *= (x + 0.5) / wl;
        if (wr > 0 && x > w - wr) a *= (w - x - 0.5) / wr;
        rampX[x] = a;
      }
      const rampY = new Float32Array(h);
      for (let y = 0; y < h; y++) {
        let a = 1;
        if (wt > 0 && y < wt) a *= (y + 0.5) / wt;
        if (wb > 0 && y > h - wb) a *= (h - y - 0.5) / wb;
        rampY[y] = a;
      }

      let i = 0;
      for (let y = 0; y < h; y++) {
        const ry = rampY[y];
        for (let x = 0; x < w; x++) {
          let a = rampX[x] * ry;
          if (p.invert) a = 1 - a;
          const v = Math.pow(U.clamp(a, 0, 1), 1 / g) * lvl;
          d[i++] = cr * v;
          d[i++] = cg * v;
          d[i++] = cb * v;
          d[i++] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      if (p.showMarks) {
        ctx.fillStyle = '#ff3b30';
        const lw = Math.max(1, Math.round(2 * Math.max(1, U.scaleRef(w, h))));
        if (wl > 0) U.vLine(ctx, wl, 0, h, lw);
        if (wr > 0) U.vLine(ctx, w - wr, 0, h, lw);
        if (wt > 0) U.hLine(ctx, 0, wt, w, lw);
        if (wb > 0) U.hLine(ctx, 0, h - wb, w, lw);

        const fs = 22 * Math.max(0.5, U.scaleRef(w, h));
        if (wl > 0) U.outlinedText(ctx, 'L ' + p.left + '% = ' + Math.round(wl) + 'px', wl + fs * 0.4, h * 0.5, fs, '#fff', '#000', 'left', 'middle');
        if (wr > 0) U.outlinedText(ctx, 'R ' + p.right + '% = ' + Math.round(wr) + 'px', w - wr - fs * 0.4, h * 0.5, fs, '#fff', '#000', 'right', 'middle');
        if (wt > 0) U.outlinedText(ctx, 'T ' + p.top + '% = ' + Math.round(wt) + 'px', w * 0.5, wt + fs * 0.4, fs, '#fff', '#000', 'center', 'top');
        if (wb > 0) U.outlinedText(ctx, 'B ' + p.bottom + '% = ' + Math.round(wb) + 'px', w * 0.5, h - wb - fs * 0.4, fs, '#fff', '#000', 'center', 'bottom');
      }
    },
  });

  /* ------------------------------------------- 4. エッジ / コーナーマーカー */
  TP.registerPattern({
    id: 'markers',
    name: 'エッジ / コーナーマーカー',
    category: 'projector',
    hint: '投写範囲の端が物理的にどこへ落ちているかの確認。オーバースキャン / 切れの検出。',
    params: [
      pSel('style', 'マーカー形状', 'L', [
        { v: 'L', l: 'L 字（コーナー）' },
        { v: 'cross', l: '十字（コーナー中心）' },
      ]),
      pNum('length', 'マーカー長 (%)', 8, 1, 50, 0.5),
      pNum('lineWidth', '線幅 (px)', 6, 1, 64),
      pColor('color', 'マーカーの色', '#ffffff'),
      pColor('bgColor', '背景色', '#000000'),
      pBool('edgeCenters', '各辺の中央にもマーカー', true),
      pBool('center', '画面中央に十字', true),
      pBool('frame', '外周 1px 枠', true),
      pBool('coordLabels', '四隅に座標ラベル', true),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, p.bgColor);
      ctx.fillStyle = p.color;
      const lw = Math.max(1, p.lineWidth);
      const len = (p.length / 100) * Math.min(w, h);

      // (x, y) はコーナー座標。sx / sy はそこから内側へ向かう符号。
      const corner = (x, y, sx, sy) => {
        if (p.style === 'cross') {
          U.hLine(ctx, x - len / 2, y, len, lw);
          U.vLine(ctx, x, y - len / 2, len, lw);
        } else {
          const yy = y + (sy > 0 ? lw / 2 : -lw / 2);
          const xx = x + (sx > 0 ? lw / 2 : -lw / 2);
          U.hLine(ctx, sx > 0 ? x : x - len, yy, len, lw);
          U.vLine(ctx, xx, sy > 0 ? y : y - len, len, lw);
        }
      };

      corner(0, 0, 1, 1);
      corner(w, 0, -1, 1);
      corner(0, h, 1, -1);
      corner(w, h, -1, -1);

      if (p.edgeCenters) {
        U.hLine(ctx, w / 2 - len / 2, lw / 2, len, lw);
        U.hLine(ctx, w / 2 - len / 2, h - lw / 2, len, lw);
        U.vLine(ctx, lw / 2, h / 2 - len / 2, len, lw);
        U.vLine(ctx, w - lw / 2, h / 2 - len / 2, len, lw);
      }

      if (p.center) {
        ctx.fillStyle = '#ff3b30';
        U.hLine(ctx, w / 2 - len / 2, h / 2, len, lw);
        U.vLine(ctx, w / 2, h / 2 - len / 2, len, lw);
        ctx.fillStyle = p.color;
      }

      if (p.frame) {
        U.vLine(ctx, 0.5, 0, h, 1);
        U.vLine(ctx, w - 0.5, 0, h, 1);
        U.hLine(ctx, 0, 0.5, w, 1);
        U.hLine(ctx, 0, h - 0.5, w, 1);
      }

      if (p.coordLabels) {
        const fs = 26 * Math.max(0.5, U.scaleRef(w, h));
        const pad = fs * 0.6 + lw;
        U.outlinedText(ctx, '0, 0', pad, pad, fs, p.color, '#000', 'left', 'top');
        U.outlinedText(ctx, (w - 1) + ', 0', w - pad, pad, fs, p.color, '#000', 'right', 'top');
        U.outlinedText(ctx, '0, ' + (h - 1), pad, h - pad, fs, p.color, '#000', 'left', 'bottom');
        U.outlinedText(ctx, (w - 1) + ', ' + (h - 1), w - pad, h - pad, fs, p.color, '#000', 'right', 'bottom');
      }
    },
  });

  /* ---------------------------------------------------------- 5. ジオメトリ */
  TP.registerPattern({
    id: 'geometry',
    name: 'ジオメトリ（同心円 / 対角線）',
    category: 'projector',
    hint: '樽型・糸巻き型の歪みとレンズ中心のずれを見る。円が真円に見えればアスペクトも正しい。',
    params: [
      pNum('rings', '円の本数', 8, 1, 64),
      pSel('basis', '円の基準', 'square', [
        { v: 'square', l: '真円（短辺基準）' },
        { v: 'fill', l: '楕円（画面比に追従）' },
      ]),
      pNum('lineWidth', '線幅 (px)', 3, 1, 64),
      pBool('diagonals', '対角線', true),
      pBool('midLines', '縦横中央線', true),
      pNum('radials', '放射線の本数', 0, 0, 64),
      pColor('color', '線の色', '#ffffff'),
      pColor('bgColor', '背景色', '#000000'),
      pBool('cornerCircle', '画面対角いっぱいの円も描く', true),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, p.bgColor);
      const cx = w / 2;
      const cy = h / 2;
      const lw = Math.max(1, p.lineWidth);
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      ctx.lineWidth = lw;

      const rMaxSq = Math.min(w, h) / 2;
      const rings = Math.max(1, p.rings);
      for (let i = 1; i <= rings; i++) {
        const t = i / rings;
        ctx.beginPath();
        if (p.basis === 'square') {
          ctx.arc(cx, cy, rMaxSq * t, 0, Math.PI * 2);
        } else {
          ctx.ellipse(cx, cy, (w / 2) * t, (h / 2) * t, 0, 0, Math.PI * 2);
        }
        ctx.stroke();
      }

      if (p.cornerCircle && p.basis === 'square') {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.hypot(w, h) / 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (p.diagonals) {
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(w, h);
        ctx.moveTo(w, 0); ctx.lineTo(0, h);
        ctx.stroke();
      }

      if (p.midLines) {
        U.vLine(ctx, cx, 0, h, lw);
        U.hLine(ctx, 0, cy, w, lw);
      }

      if (p.radials > 0) {
        const n = p.radials;
        const R = Math.hypot(w, h);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        }
        ctx.stroke();
      }
    },
  });

  /* ------------------------------------------------------ 6. フォーカスチャート */
  TP.registerPattern({
    id: 'focus',
    name: 'フォーカスチャート',
    category: 'projector',
    hint: '中央と四隅のピント差（像面湾曲）を見る。1px 市松がグレーに溶けたらピントが出ていない。',
    params: [
      pNum('patchSize', 'パッチサイズ (%)', 18, 2, 100, 0.5),
      pNum('checkPitch', '市松ピッチ (px)', 1, 1, 64),
      pSel('layout', '配置', '9', [
        { v: '9', l: '9 点（3x3）' },
        { v: '5', l: '5 点（四隅 + 中央）' },
        { v: '1', l: '中央のみ' },
      ]),
      pBool('lineBundle', '1px ライン束も入れる', true),
      pColor('bgColor', '背景色', '#808080'),
      pBool('labels', 'ラベル表示', true),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, p.bgColor);
      const ps = (p.patchSize / 100) * Math.min(w, h);
      const pitch = Math.max(1, Math.round(p.checkPitch));

      let points;
      if (p.layout === '1') points = [[0.5, 0.5]];
      else if (p.layout === '5') points = [[0.12, 0.12], [0.88, 0.12], [0.5, 0.5], [0.12, 0.88], [0.88, 0.88]];
      else points = [0.12, 0.5, 0.88].flatMap((y) => [0.12, 0.5, 0.88].map((x) => [x, y]));

      // 1px 市松を fillRect で描くと 4K では数十万回の呼び出しになるため、
      // パッチ 1 枚ぶんを ImageData で作って各点へ貼り付ける。
      const size = Math.max(4, Math.round(ps));
      const half = p.lineBundle ? Math.round(size / 2) : size;
      const hh = Math.round(size / 2);
      const patch = ctx.createImageData(size, size);
      const pd = patch.data;
      let i = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let on;
          if (x < half) {
            on = (Math.floor(x / pitch) + Math.floor(y / pitch)) % 2 === 0;
          } else if (y < hh) {
            on = (x - half) % 2 === 0;   // 縦 1px ライン
          } else {
            on = (y - hh) % 2 === 0;     // 横 1px ライン
          }
          const v = on ? 255 : 0;
          pd[i++] = v; pd[i++] = v; pd[i++] = v; pd[i++] = 255;
        }
      }

      const frameLw = Math.max(1, 2 * U.scaleRef(w, h));
      for (const pt of points) {
        const x0 = Math.round(U.clamp(pt[0] * w - size / 2, 0, Math.max(0, w - size)));
        const y0 = Math.round(U.clamp(pt[1] * h - size / 2, 0, Math.max(0, h - size)));
        ctx.putImageData(patch, x0, y0);
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = frameLw;
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
      }

      if (p.labels) {
        const fs = 22 * Math.max(0.5, U.scaleRef(w, h));
        U.outlinedText(ctx, '市松 ' + pitch + 'px' + (p.lineBundle ? ' / 1px ライン束' : ''), w / 2, h - fs * 0.4, fs, '#fff', '#000', 'center', 'bottom');
      }
    },
  });

  /* ----------------------------------------- 7. ブランキング / オーバースキャン */
  TP.registerPattern({
    id: 'blanking',
    name: 'ブランキング / オーバースキャン',
    category: 'projector',
    hint: '何 % が物理的に切れているかを読む。見えている一番外側の枠の数字が切れ量。',
    params: [
      pNum('step', '枠の刻み (%)', 1, 0.2, 10, 0.2),
      pNum('count', '枠の本数', 10, 1, 40),
      pNum('lineWidth', '線幅 (px)', 2, 1, 32),
      pColor('color', '線の色', '#ffffff'),
      pColor('bgColor', '背景色', '#000000'),
      pBool('labels', '% ラベル', true),
      pBool('altColor', '5% 毎に色を変える', true),
      pColor('color2', '強調色', '#ff3b30'),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, p.bgColor);
      const lw = Math.max(1, p.lineWidth);
      const fs = 20 * Math.max(0.5, U.scaleRef(w, h));

      for (let i = 1; i <= p.count; i++) {
        const pct = i * p.step;
        const ix = (pct / 100) * w;
        const iy = (pct / 100) * h;
        if (ix * 2 >= w || iy * 2 >= h) break;
        const major = p.altColor && Math.abs(pct / 5 - Math.round(pct / 5)) < 1e-6;
        ctx.fillStyle = major ? p.color2 : p.color;
        const l = lw * (major ? 2 : 1);
        U.hLine(ctx, ix, iy, w - ix * 2, l);
        U.hLine(ctx, ix, h - iy, w - ix * 2, l);
        U.vLine(ctx, ix, iy, h - iy * 2, l);
        U.vLine(ctx, w - ix, iy, h - iy * 2, l);

        if (p.labels) {
          const txt = (pct % 1 === 0 ? String(pct) : pct.toFixed(1)) + '%';
          U.outlinedText(ctx, txt, w / 2, iy + l, fs, major ? p.color2 : p.color, '#000', 'center', 'top');
        }
      }
    },
  });
})();
