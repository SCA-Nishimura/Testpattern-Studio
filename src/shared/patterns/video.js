/* 映像品質系パターン（NDI Test Patterns 相当） */
'use strict';

(function () {
  const U = TP.u;

  const pColor = (key, label, def) => ({ key, label, type: 'color', default: def });
  const pNum = (key, label, def, min, max, step) => ({ key, label, type: 'number', default: def, min, max, step: step || 1 });
  const pBool = (key, label, def) => ({ key, label, type: 'bool', default: def });
  const pSel = (key, label, def, options) => ({ key, label, type: 'select', default: def, options });

  const rgb = (r, g, b) => 'rgb(' + r + ',' + g + ',' + b + ')';

  /** 振幅 % で 7 本のカラーバー色を作る（フルレンジ 0-255 基準） */
  function barColors(amp) {
    const v = Math.round((255 * amp) / 100);
    return [
      rgb(v, v, v), // gray
      rgb(v, v, 0), // yellow
      rgb(0, v, v), // cyan
      rgb(0, v, 0), // green
      rgb(v, 0, v), // magenta
      rgb(v, 0, 0), // red
      rgb(0, 0, v), // blue
    ];
  }

  /* ----------------------------------------------------- SMPTE カラーバー */
  TP.registerPattern({
    id: 'smpte',
    name: 'SMPTE カラーバー',
    category: 'video',
    hint: 'SMPTE ECR 1-1978 相当の 7:1:2 構成。上段 75% バー / 中段リバースバー / 下段 PLUGE。',
    params: [
      pNum('amplitude', '上段バー振幅 (%)', 75, 10, 100),
      pBool('labels', '区分ラベルを表示', false),
    ],
    draw(ctx, { w, h, p }) {
      const cols = barColors(p.amplitude);
      const hTop = Math.round(h * 0.6667);
      const hMid = Math.round(h * 0.0833);
      const yMid = hTop;
      const yBot = hTop + hMid;
      const hBot = h - yBot;

      // 上段: 7 本バー
      for (let i = 0; i < 7; i++) {
        const x0 = Math.round((i * w) / 7);
        const x1 = Math.round(((i + 1) * w) / 7);
        ctx.fillStyle = cols[i];
        ctx.fillRect(x0, 0, x1 - x0, hTop);
      }

      // 中段: リバースバー（blue, black, magenta, black, cyan, black, gray）
      const amp = Math.round((255 * p.amplitude) / 100);
      const black = rgb(16, 16, 16);
      const mid = [rgb(0, 0, amp), black, rgb(amp, 0, amp), black, rgb(0, amp, amp), black, rgb(amp, amp, amp)];
      for (let i = 0; i < 7; i++) {
        const x0 = Math.round((i * w) / 7);
        const x1 = Math.round(((i + 1) * w) / 7);
        ctx.fillStyle = mid[i];
        ctx.fillRect(x0, yMid, x1 - x0, hMid);
      }

      // 下段: -I / 100% white / +Q / black / PLUGE(-4,0,+4 IRE) / black
      const seg = (i) => [Math.round((i * w) / 6), Math.round(((i + 1) * w) / 6)];
      const bot = [
        rgb(0, 33, 76),      // -I
        rgb(255, 255, 255),  // 100% white
        rgb(54, 0, 125),     // +Q
        black,
        null,                // PLUGE (3 分割)
        black,
      ];
      for (let i = 0; i < 6; i++) {
        const s = seg(i);
        if (bot[i]) {
          ctx.fillStyle = bot[i];
          ctx.fillRect(s[0], yBot, s[1] - s[0], hBot);
        } else {
          const pl = [U.ireToRgb(-4), U.ireToRgb(0), U.ireToRgb(4)];
          const span = s[1] - s[0];
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = pl[k];
            const a = s[0] + Math.round((k * span) / 3);
            const b = s[0] + Math.round(((k + 1) * span) / 3);
            ctx.fillRect(a, yBot, b - a, hBot);
          }
        }
      }

      if (p.labels) {
        const fs = 18 * Math.max(0.5, U.scaleRef(w, h));
        const names = ['-I', '100% W', '+Q', 'BLACK', 'PLUGE', 'BLACK'];
        for (let i = 0; i < 6; i++) {
          const s = seg(i);
          U.outlinedText(ctx, names[i], (s[0] + s[1]) / 2, yBot + fs * 0.4, fs, '#fff', '#000', 'center', 'top');
        }
      }
    },
  });

  /* --------------------------------------------------------- カラーバー各種 */
  TP.registerPattern({
    id: 'bars',
    name: 'カラーバー（100% / 75% / EBU）',
    category: 'video',
    hint: '彩度・色相の基準。100% バーは信号クリップの確認、75% バーは放送基準の確認に使う。',
    params: [
      pSel('variant', '規格', 'ebu', [
        { v: 'ebu', l: 'EBU 8 バー（白〜黒）' },
        { v: 'std7', l: '標準 7 バー（グレー先頭）' },
        { v: 'arib', l: 'ARIB 風（上段バー + 下段ベタ）' },
      ]),
      pNum('amplitude', '振幅 (%)', 100, 10, 100),
      pBool('vertical', 'バーを横方向（90° 回転）にする', false),
      pBool('pluge', '下部に PLUGE 帯を付ける', false),
      pNum('plugeHeight', 'PLUGE 帯の高さ (%)', 12, 3, 40),
    ],
    draw(ctx, { w, h, p }) {
      const amp = Math.round((255 * p.amplitude) / 100);
      let cols;
      if (p.variant === 'ebu') {
        cols = [
          rgb(amp, amp, amp), rgb(amp, amp, 0), rgb(0, amp, amp), rgb(0, amp, 0),
          rgb(amp, 0, amp), rgb(amp, 0, 0), rgb(0, 0, amp), rgb(0, 0, 0),
        ];
      } else {
        cols = barColors(p.amplitude);
      }

      const barH = p.pluge ? Math.round(h * (1 - p.plugeHeight / 100)) : h;

      const n = cols.length;
      if (p.vertical) {
        for (let i = 0; i < n; i++) {
          const y0 = Math.round((i * barH) / n);
          const y1 = Math.round(((i + 1) * barH) / n);
          ctx.fillStyle = cols[i];
          ctx.fillRect(0, y0, w, y1 - y0);
        }
      } else {
        for (let i = 0; i < n; i++) {
          const x0 = Math.round((i * w) / n);
          const x1 = Math.round(((i + 1) * w) / n);
          ctx.fillStyle = cols[i];
          ctx.fillRect(x0, 0, x1 - x0, barH);
        }
      }

      if (p.variant === 'arib') {
        // 下段に 黒 / 白 / 50% グレー のベタを並べる
        const y0 = Math.round(barH * 0.75);
        const trio = [U.ireToRgb(0), rgb(255, 255, 255), U.pctToRgb(50)];
        for (let i = 0; i < 3; i++) {
          const x0 = Math.round((i * w) / 3);
          const x1 = Math.round(((i + 1) * w) / 3);
          ctx.fillStyle = trio[i];
          ctx.fillRect(x0, y0, x1 - x0, barH - y0);
        }
      }

      if (p.pluge) {
        const y0 = barH;
        const ph = h - barH;
        ctx.fillStyle = U.ireToRgb(0);
        ctx.fillRect(0, y0, w, ph);
        const ires = [-4, -2, 0, 2, 4];
        const bw = w / 12;
        const startX = w / 2 - (bw * ires.length) / 2;
        for (let i = 0; i < ires.length; i++) {
          ctx.fillStyle = U.ireToRgb(ires[i]);
          ctx.fillRect(Math.round(startX + i * bw), y0, Math.ceil(bw), ph);
        }
        ctx.fillStyle = 'rgb(255,255,255)';
        ctx.fillRect(0, y0, Math.round(bw), ph);
      }
    },
  });

  /* ---------------------------------------------------------- グレースケール */
  TP.registerPattern({
    id: 'grayscale',
    name: 'グレースケール / ランプ',
    category: 'video',
    hint: '階調つぶれ・バンディング・ガンマの確認。16 ステップで各段が識別できるのが正常。',
    params: [
      pSel('steps', 'ステップ数', '16', [
        { v: '0', l: '連続（リニアランプ）' },
        { v: '5', l: '5 段' },
        { v: '11', l: '11 段' },
        { v: '16', l: '16 段' },
        { v: '32', l: '32 段' },
        { v: '256', l: '256 段（1 階調ずつ）' },
      ]),
      pSel('dir', '方向', 'h', [
        { v: 'h', l: '横（左→右）' },
        { v: 'v', l: '縦（上→下）' },
        { v: 'hv', l: '横 + 反転の 2 段' },
      ]),
      pNum('gamma', 'ガンマ', 1, 0.2, 4, 0.05),
      pSel('range', 'レンジ', 'full', [
        { v: 'full', l: 'フルレンジ 0-255' },
        { v: 'video', l: 'ビデオレンジ 16-235' },
      ]),
      pBool('labels', '数値ラベル', true),
    ],
    draw(ctx, { w, h, p }) {
      const steps = parseInt(p.steps, 10);
      const toLevel = (t) => {
        const g = Math.pow(U.clamp(t, 0, 1), p.gamma);
        return p.range === 'video' ? Math.round(16 + 219 * g) : Math.round(255 * g);
      };

      const band = (y0, bh, invert) => {
        if (steps === 0) {
          const img = ctx.createImageData(w, bh);
          const d = img.data;
          const row = new Uint8Array(w);
          for (let x = 0; x < w; x++) {
            let t = (x + 0.5) / w;
            if (invert) t = 1 - t;
            row[x] = toLevel(t);
          }
          let i = 0;
          for (let y = 0; y < bh; y++) {
            for (let x = 0; x < w; x++) {
              const v = row[x];
              d[i++] = v; d[i++] = v; d[i++] = v; d[i++] = 255;
            }
          }
          ctx.putImageData(img, 0, y0);
        } else {
          for (let i = 0; i < steps; i++) {
            let t = steps === 1 ? 0 : i / (steps - 1);
            if (invert) t = 1 - t;
            const v = toLevel(t);
            const x0 = Math.round((i * w) / steps);
            const x1 = Math.round(((i + 1) * w) / steps);
            ctx.fillStyle = rgb(v, v, v);
            ctx.fillRect(x0, y0, x1 - x0, bh);
          }
          if (p.labels && steps <= 32) {
            const fs = Math.min((w / steps) * 0.3, bh * 0.2, 48 * Math.max(0.5, U.scaleRef(w, h)));
            if (fs >= 7) {
              for (let i = 0; i < steps; i++) {
                let t = steps === 1 ? 0 : i / (steps - 1);
                if (invert) t = 1 - t;
                const v = toLevel(t);
                const cx = ((i + 0.5) * w) / steps;
                U.outlinedText(ctx, String(v), cx, y0 + bh - fs * 0.4, fs, v > 128 ? '#000' : '#fff', v > 128 ? '#fff' : '#000', 'center', 'bottom');
              }
            }
          }
        }
      };

      if (p.dir === 'v') {
        // 縦方向は行ごとに塗る。steps === 0 なら 1 行 = 1 階調の連続ランプになる。
        const n = steps === 0 ? h : steps;
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0 : i / (n - 1);
          const v = toLevel(t);
          const y0 = Math.round((i * h) / n);
          const y1 = Math.round(((i + 1) * h) / n);
          ctx.fillStyle = rgb(v, v, v);
          ctx.fillRect(0, y0, w, y1 - y0);
        }
        if (p.labels && steps > 0 && steps <= 32) {
          const fs = Math.min((h / steps) * 0.5, 40 * Math.max(0.5, U.scaleRef(w, h)));
          if (fs >= 7) {
            for (let i = 0; i < steps; i++) {
              const v = toLevel(steps === 1 ? 0 : i / (steps - 1));
              const cy = ((i + 0.5) * h) / steps;
              U.outlinedText(ctx, String(v), fs * 0.5, cy, fs,
                v > 128 ? '#000' : '#fff', v > 128 ? '#fff' : '#000', 'left', 'middle');
            }
          }
        }
        return;
      }

      if (p.dir === 'hv') {
        const hh = Math.round(h / 2);
        band(0, hh, false);
        band(hh, h - hh, true);
      } else {
        band(0, h, false);
      }
    },
  });

  /* ------------------------------------------------------------------ 単色 */
  TP.registerPattern({
    id: 'solid',
    name: '単色ベタ',
    category: 'video',
    hint: 'ドット欠け・輝度ムラ・色ムラ・ランプの焼きつき確認。白 100% は輝度測定の基準。',
    params: [
      pSel('preset', 'プリセット', 'white', [
        { v: 'white', l: '白 100%' },
        { v: 'gray50', l: 'グレー 50%' },
        { v: 'gray18', l: 'グレー 18%（中庸グレー）' },
        { v: 'black', l: '黒 0%' },
        { v: 'videoblack', l: 'ビデオ黒 (16,16,16)' },
        { v: 'red', l: '赤' },
        { v: 'green', l: '緑' },
        { v: 'blue', l: '青' },
        { v: 'cyan', l: 'シアン' },
        { v: 'magenta', l: 'マゼンタ' },
        { v: 'yellow', l: 'イエロー' },
        { v: 'custom', l: '任意色 / 任意レベル' },
      ]),
      pColor('custom', '任意色', '#ffffff'),
      pNum('level', '任意レベル (%)（任意色に乗算）', 100, 0, 100, 0.5),
      pBool('showValue', 'RGB 値を表示', true),
    ],
    draw(ctx, { w, h, p }) {
      const map = {
        white: [255, 255, 255], gray50: [128, 128, 128], gray18: [46, 46, 46],
        black: [0, 0, 0], videoblack: [16, 16, 16],
        red: [255, 0, 0], green: [0, 255, 0], blue: [0, 0, 255],
        cyan: [0, 255, 255], magenta: [255, 0, 255], yellow: [255, 255, 0],
      };
      let c;
      if (p.preset === 'custom') {
        const hex = p.custom.replace('#', '');
        const k = p.level / 100;
        c = [0, 2, 4].map((i) => Math.round(parseInt(hex.substr(i, 2), 16) * k));
      } else {
        c = map[p.preset] || [255, 255, 255];
      }
      U.fill(ctx, w, h, rgb(c[0], c[1], c[2]));

      if (p.showValue) {
        const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
        const fs = 34 * Math.max(0.5, U.scaleRef(w, h));
        U.outlinedText(ctx, 'R' + c[0] + ' G' + c[1] + ' B' + c[2], w / 2, h / 2, fs,
          lum > 128 ? '#000' : '#fff', lum > 128 ? '#fff' : '#000', 'center', 'middle');
      }
    },
  });

  /* ----------------------------------------------------------------- PLUGE */
  TP.registerPattern({
    id: 'pluge',
    name: 'PLUGE（黒レベル調整）',
    category: 'video',
    hint: '黒レベル(ブライトネス)調整用。-2/-4 IRE が沈み、+2/+4 IRE がぎりぎり見える状態が正解。',
    params: [
      pNum('pedestal', 'ペデスタル (IRE)', 0, -10, 20, 0.5),
      pNum('barWidth', 'バー幅 (%)', 7, 2, 25, 0.5),
      pBool('whiteRef', '白リファレンスを表示', true),
      pBool('labels', 'IRE ラベル', true),
    ],
    draw(ctx, { w, h, p }) {
      U.fill(ctx, w, h, U.ireToRgb(p.pedestal));
      const ires = [-4, -2, 0, 2, 4];
      const bw = (p.barWidth / 100) * w;
      const total = bw * ires.length;
      const x0 = w / 2 - total / 2;
      const y0 = h * 0.2;
      const bh = h * 0.6;
      const fs = 20 * Math.max(0.5, U.scaleRef(w, h));

      for (let i = 0; i < ires.length; i++) {
        const ire = p.pedestal + ires[i];
        ctx.fillStyle = U.ireToRgb(ire);
        const a = Math.round(x0 + i * bw);
        const b = Math.round(x0 + (i + 1) * bw);
        ctx.fillRect(a, Math.round(y0), b - a, Math.round(bh));
        if (p.labels) {
          const s = (ires[i] > 0 ? '+' : '') + ires[i];
          U.outlinedText(ctx, s + ' IRE', (a + b) / 2, y0 + bh + fs * 0.5, fs, '#888', '#000', 'center', 'top');
        }
      }

      if (p.whiteRef) {
        ctx.fillStyle = 'rgb(255,255,255)';
        ctx.fillRect(0, Math.round(y0), Math.round(bw), Math.round(bh));
        ctx.fillRect(Math.round(w - bw), Math.round(y0), Math.round(bw), Math.round(bh));
      }
    },
  });

  /* ------------------------------------------------------------ マルチバースト */
  TP.registerPattern({
    id: 'multiburst',
    name: 'マルチバースト',
    category: 'video',
    hint: '高域の解像感・ケーブル減衰の確認。右端（細かい側）までコントラストが保たれていれば健全。',
    params: [
      pNum('blocks', 'ブロック数', 8, 2, 24),
      pNum('minPitch', '最小ピッチ (px)', 1, 1, 32),
      pNum('maxPitch', '最大ピッチ (px)', 32, 2, 512),
      pNum('amplitude', '振幅 (%)', 100, 10, 100),
      pBool('grayBase', 'ベースを 50% グレーにする', false),
      pBool('labels', 'ピッチラベル', true),
    ],
    draw(ctx, { w, h, p }) {
      const base = p.grayBase ? 128 : 0;
      const amp = Math.round((255 * p.amplitude) / 100);
      const hi = p.grayBase ? U.clamp(base + amp / 2, 0, 255) : amp;
      const lo = p.grayBase ? U.clamp(base - amp / 2, 0, 255) : 0;
      U.fill(ctx, w, h, rgb(base, base, base));

      const n = Math.max(2, p.blocks);
      const fs = 20 * Math.max(0.5, U.scaleRef(w, h));
      for (let i = 0; i < n; i++) {
        // 最大ピッチ → 最小ピッチへ対数的に刻む
        const t = n === 1 ? 0 : i / (n - 1);
        const pitch = Math.max(1, Math.round(p.maxPitch * Math.pow(p.minPitch / p.maxPitch, t)));
        const x0 = Math.round((i * w) / n);
        const x1 = Math.round(((i + 1) * w) / n);
        ctx.fillStyle = rgb(lo, lo, lo);
        ctx.fillRect(x0, 0, x1 - x0, h);
        ctx.fillStyle = rgb(hi, hi, hi);
        for (let x = x0; x < x1; x += pitch * 2) {
          ctx.fillRect(x, 0, Math.min(pitch, x1 - x), h);
        }
        if (p.labels) {
          U.outlinedText(ctx, pitch + 'px', (x0 + x1) / 2, h - fs * 0.4, fs, '#fff', '#000', 'center', 'bottom');
        }
      }
    },
  });

  /* --------------------------------------------------------------- ゾーンプレート */
  TP.registerPattern({
    id: 'zoneplate',
    name: 'ゾーンプレート',
    category: 'video',
    hint: 'スケーラ・デインタレース処理のエイリアシング検出。偽の同心円模様（モアレ）が出たら処理に問題あり。',
    params: [
      pNum('scale', 'スケール', 1, 0.05, 8, 0.05),
      pNum('phase', '位相 (deg)', 0, 0, 360),
      pSel('mode', 'モード', 'circular', [
        { v: 'circular', l: '同心円（r^2）' },
        { v: 'hyper', l: '双曲（x*y）' },
        { v: 'sweep', l: '水平スイープ' },
      ]),
      pBool('color', 'RGB 位相差を付ける', false),
    ],
    draw(ctx, { w, h, p }) {
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const cx = w / 2;
      const cy = h / 2;
      const norm = Math.min(w, h) / 2;
      const k = (p.scale * Math.PI * 60) / (norm * norm);
      const ph = (p.phase * Math.PI) / 180;
      let i = 0;
      for (let y = 0; y < h; y++) {
        const dy = y - cy;
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          let a;
          if (p.mode === 'hyper') a = k * dx * dy * 2;
          else if (p.mode === 'sweep') a = (p.scale * Math.PI * dx * dx) / (w * 2);
          else a = k * (dx * dx + dy * dy);
          if (p.color) {
            d[i++] = 127.5 * (1 + Math.sin(a + ph));
            d[i++] = 127.5 * (1 + Math.sin(a + ph + 2.094));
            d[i++] = 127.5 * (1 + Math.sin(a + ph + 4.188));
          } else {
            const v = 127.5 * (1 + Math.sin(a + ph));
            d[i++] = v; d[i++] = v; d[i++] = v;
          }
          d[i++] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
  });

  /* ------------------------------------------------------------- RGB 分解 */
  TP.registerPattern({
    id: 'rgbsplit',
    name: 'RGB 単色面',
    category: 'video',
    hint: '画素単位の色ムラ・サブピクセル欠け・パネル色域の確認。自動切替でフリッカー確認にも使える。',
    animatedIf: (p) => p.auto,
    params: [
      pSel('channel', 'チャンネル', 'r', [
        { v: 'r', l: 'R のみ' },
        { v: 'g', l: 'G のみ' },
        { v: 'b', l: 'B のみ' },
        { v: 'w', l: '白' },
      ]),
      pNum('level', 'レベル (%)', 100, 1, 100),
      pBool('auto', '自動切替', false),
      pNum('interval', '切替間隔 (秒)', 2, 0.1, 30, 0.1),
      pBool('label', 'チャンネル名を表示', true),
    ],
    draw(ctx, { w, h, p, time }) {
      const order = ['r', 'g', 'b', 'w'];
      let ch = p.channel;
      if (p.auto) ch = order[Math.floor(time / Math.max(0.1, p.interval)) % 4];
      const v = Math.round((255 * p.level) / 100);
      const c = { r: [v, 0, 0], g: [0, v, 0], b: [0, 0, v], w: [v, v, v] }[ch];
      U.fill(ctx, w, h, rgb(c[0], c[1], c[2]));
      if (p.label) {
        const fs = 56 * Math.max(0.5, U.scaleRef(w, h));
        U.outlinedText(ctx, ch.toUpperCase() + ' ' + p.level + '%', w / 2, h / 2, fs, '#fff', '#000', 'center', 'middle');
      }
    },
  });
})();
