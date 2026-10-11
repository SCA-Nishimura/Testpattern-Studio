/* 論理解像度オフスクリーンへの描画 → 表示 Canvas へのスケーリング転送 */
'use strict';

(function () {
  TP.SCALING_MODES = [
    { v: 'fit', l: 'Fit（アスペクト維持・全体表示）' },
    { v: 'native', l: 'Native 1:1（等倍・中央、はみ出しは切れる）' },
    { v: 'stretch', l: 'Stretch（全面に引き伸ばし）' },
  ];

  TP.Renderer = class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas 表示用 Canvas
     * @param {{ physicalPixels?: boolean }} [opts] physicalPixels: devicePixelRatio を掛けて実ピクセルで持つ
     */
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.opts = Object.assign({ physicalPixels: true }, opts || {});

      this.off = document.createElement('canvas');
      this.offCtx = this.off.getContext('2d', { alpha: false, willReadFrequently: true });

      this.state = null;
      this.frame = 0;
      this.startTime = performance.now();
      this.fps = 0;
      this._fpsSamples = [];
      this._raf = null;
      this._needsRedraw = true;

      // 表示 Canvas の実サイズが決まる / 変わるたびに描き直す。
      // 初回レイアウト前に clientWidth が 0 のまま描いてしまうのも防げる。
      this._onResize = () => { this._needsRedraw = true; this._tickOnce(); };
      window.addEventListener('resize', this._onResize);
      this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this._onResize) : null;
      if (this._ro) this._ro.observe(canvas);
    }

    destroy() {
      this.stop();
      window.removeEventListener('resize', this._onResize);
      if (this._ro) this._ro.disconnect();
    }

    setState(state) {
      const prev = this.state;
      this.state = state;
      if (!prev || prev.patternId !== state.patternId) {
        this.frame = 0;
        this.startTime = performance.now();
      }
      this._needsRedraw = true;
      if (this.isAnimated()) this.start();
      else { this.stop(); this._tickOnce(); }
    }

    isAnimated() {
      const s = this.state;
      if (!s) return false;
      const def = TP.getPattern(s.patternId);
      if (!def) return false;
      if (def.animated) return true;
      if (def.animatedIf && def.animatedIf(s.params || {})) return true;
      if (s.overlay && s.overlay.enabled && s.overlay.showFps) return true;
      return false;
    }

    start() {
      if (this._raf != null) return;
      const loop = (t) => {
        this._raf = requestAnimationFrame(loop);
        this._measureFps(t);
        this.frame++;
        this._draw();
      };
      this._raf = requestAnimationFrame(loop);
    }

    stop() {
      if (this._raf != null) cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    _tickOnce() {
      if (this.state) this._draw();
    }

    _measureFps(t) {
      const s = this._fpsSamples;
      s.push(t);
      while (s.length > 2 && t - s[0] > 1000) s.shift();
      if (s.length > 1) this.fps = ((s.length - 1) * 1000) / (t - s[0]);
    }

    /** 表示 Canvas のバッキングストアを実ピクセルに合わせる */
    _syncCanvasSize() {
      const dpr = this.opts.physicalPixels ? window.devicePixelRatio || 1 : 1;
      const cssW = this.canvas.clientWidth || this.canvas.width;
      const cssH = this.canvas.clientHeight || this.canvas.height;
      const pw = Math.max(1, Math.round(cssW * dpr));
      const ph = Math.max(1, Math.round(cssH * dpr));
      if (this.canvas.width !== pw || this.canvas.height !== ph) {
        this.canvas.width = pw;
        this.canvas.height = ph;
        this._needsRedraw = true;
      }
      return { pw, ph };
    }

    /** オフスクリーンにパターンを描き切る。静止パターンなら結果を再利用する。 */
    renderOffscreen() {
      const s = this.state;
      const def = TP.getPattern(s.patternId);
      if (!def) return null;

      const w = Math.max(1, Math.round(s.width));
      const h = Math.max(1, Math.round(s.height));
      if (this.off.width !== w || this.off.height !== h) {
        this.off.width = w;
        this.off.height = h;
        this._needsRedraw = true;
      }

      const animated = this.isAnimated();
      if (!animated && !this._needsRedraw) return this.off;

      const ctx = this.offCtx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      const env = {
        w, h,
        p: s.params || {},
        frame: this.frame,
        time: (performance.now() - this.startTime) / 1000,
        fps: this.fps,
        overlay: s.overlay,
      };

      ctx.clearRect(0, 0, w, h);
      def.draw(ctx, env);
      ctx.restore();

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      TP.drawOverlay(ctx, env);
      ctx.restore();

      this._needsRedraw = false;
      return this.off;
    }

    _draw() {
      const s = this.state;
      if (!s) return;
      const src = this.renderOffscreen();
      if (!src) return;

      const { pw, ph } = this._syncCanvasSize();
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, pw, ph);

      const mode = s.scaling || 'fit';
      let dw, dh, dx, dy;
      if (mode === 'stretch') {
        dw = pw; dh = ph; dx = 0; dy = 0;
      } else if (mode === 'native') {
        dw = src.width; dh = src.height;
        dx = Math.round((pw - dw) / 2);
        dy = Math.round((ph - dh) / 2);
      } else {
        const k = Math.min(pw / src.width, ph / src.height);
        dw = Math.round(src.width * k);
        dh = Math.round(src.height * k);
        dx = Math.round((pw - dw) / 2);
        dy = Math.round((ph - dh) / 2);
      }

      // 等倍 / 整数倍のときは最近傍、縮小時は滑らかに
      const integerScale = Math.abs(dw / src.width - Math.round(dw / src.width)) < 1e-6;
      ctx.imageSmoothingEnabled = !(mode === 'native' || (integerScale && dw >= src.width));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, src.width, src.height, dx, dy, dw, dh);
    }

    /** 論理解像度そのままの PNG データ URL */
    toPngDataUrl() {
      if (!this.state) return null;
      this._needsRedraw = true;
      const src = this.renderOffscreen();
      return src ? src.toDataURL('image/png') : null;
    }
  };
})();
