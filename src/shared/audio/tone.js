/* テストトーン発生器（WebAudio）
   Sine / Square / Triangle / Saw / White / Pink + 周波数スイープ + L/R ルーティング */
'use strict';

(function () {
  const dbToLin = (db) => Math.pow(10, db / 20);

  TP.TONE_WAVEFORMS = [
    { v: 'sine', l: 'Sine（正弦波）' },
    { v: 'square', l: 'Square（矩形波）' },
    { v: 'triangle', l: 'Triangle（三角波）' },
    { v: 'sawtooth', l: 'Sawtooth（鋸歯状波）' },
    { v: 'white', l: 'White Noise' },
    { v: 'pink', l: 'Pink Noise' },
  ];

  TP.TONE_FREQ_PRESETS = [40, 100, 440, 1000, 3150, 10000, 15000];

  TP.TONE_ROUTES = [
    { v: 'both', l: 'L + R（両チャンネル）' },
    { v: 'left', l: 'L のみ' },
    { v: 'right', l: 'R のみ' },
    { v: 'alt', l: 'L / R 交互（ch 確認）' },
  ];

  TP.TONE_DEFAULTS = {
    waveform: 'sine',
    freq: 1000,
    levelDb: -18,
    route: 'both',
    altInterval: 1.5,
    sweep: false,
    sweepFrom: 20,
    sweepTo: 20000,
    sweepSeconds: 10,
    sweepLog: true,
    sweepLoop: true,
  };

  /** ノイズ用バッファを生成（2 秒ぶんをループ再生する） */
  function makeNoiseBuffer(ctx, kind) {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === 'pink') {
      // Paul Kellet の近似フィルタ
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  TP.ToneGenerator = class ToneGenerator {
    constructor() {
      this.ctx = null;
      this.playing = false;
      this.cfg = Object.assign({}, TP.TONE_DEFAULTS);
      this._nodes = null;
      this._altTimer = null;
      this._sweepTimer = null;
      this._altSide = 0;
    }

    get sampleRate() {
      return this.ctx ? this.ctx.sampleRate : null;
    }

    get channelCount() {
      return this.ctx ? this.ctx.destination.maxChannelCount : null;
    }

    _ensureCtx() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    /** 設定を更新。再生中なら必要に応じて作り直す。 */
    update(cfg) {
      const prev = this.cfg;
      this.cfg = Object.assign({}, this.cfg, cfg);
      if (!this.playing) return;

      const needsRebuild =
        prev.waveform !== this.cfg.waveform ||
        prev.sweep !== this.cfg.sweep ||
        prev.sweepFrom !== this.cfg.sweepFrom ||
        prev.sweepTo !== this.cfg.sweepTo ||
        prev.sweepSeconds !== this.cfg.sweepSeconds ||
        prev.sweepLog !== this.cfg.sweepLog ||
        prev.sweepLoop !== this.cfg.sweepLoop;

      if (needsRebuild) {
        this.stop();
        this.start();
        return;
      }
      this._applyLevel();
      this._applyRoute();
      this._applyFreq();
    }

    start() {
      if (this.playing) return;
      const ctx = this._ensureCtx();
      const c = this.cfg;

      const master = ctx.createGain();
      master.gain.value = 0;

      const gL = ctx.createGain();
      const gR = ctx.createGain();
      const merger = ctx.createChannelMerger(2);
      gL.connect(merger, 0, 0);
      gR.connect(merger, 0, 1);
      merger.connect(master);
      master.connect(ctx.destination);

      let source;
      let osc = null;
      if (c.waveform === 'white' || c.waveform === 'pink') {
        source = ctx.createBufferSource();
        source.buffer = makeNoiseBuffer(ctx, c.waveform);
        source.loop = true;
      } else {
        osc = ctx.createOscillator();
        osc.type = c.waveform;
        osc.frequency.value = c.sweep ? c.sweepFrom : c.freq;
        source = osc;
      }
      source.connect(gL);
      source.connect(gR);
      source.start();

      this._nodes = { master, gL, gR, merger, source, osc };
      this.playing = true;

      this._applyRoute();
      // クリックノイズを避けて 20ms でフェードイン
      const lin = dbToLin(c.levelDb);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(lin, ctx.currentTime + 0.02);

      if (c.sweep && osc) this._startSweep();
      if (c.route === 'alt') this._startAlt();
    }

    stop() {
      this._stopAlt();
      this._stopSweep();
      if (!this.playing || !this._nodes) {
        this.playing = false;
        return;
      }
      const { master, source } = this._nodes;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.03);
      try { source.stop(t + 0.05); } catch (e) { /* 既に停止済み */ }
      const nodes = this._nodes;
      setTimeout(() => {
        try { nodes.master.disconnect(); } catch (e) { /* no-op */ }
      }, 120);
      this._nodes = null;
      this.playing = false;
    }

    toggle() {
      if (this.playing) this.stop(); else this.start();
      return this.playing;
    }

    _applyLevel() {
      if (!this._nodes) return;
      const t = this.ctx.currentTime;
      const g = this._nodes.master.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(dbToLin(this.cfg.levelDb), t + 0.02);
    }

    _applyFreq() {
      const n = this._nodes;
      if (!n || !n.osc || this.cfg.sweep) return;
      const t = this.ctx.currentTime;
      n.osc.frequency.cancelScheduledValues(t);
      n.osc.frequency.setTargetAtTime(this.cfg.freq, t, 0.01);
    }

    _applyRoute() {
      const n = this._nodes;
      if (!n) return;
      const t = this.ctx.currentTime;
      const set = (node, v) => {
        node.gain.cancelScheduledValues(t);
        node.gain.setValueAtTime(node.gain.value, t);
        node.gain.linearRampToValueAtTime(v, t + 0.01);
      };
      const r = this.cfg.route;
      if (r === 'left') { set(n.gL, 1); set(n.gR, 0); this._stopAlt(); }
      else if (r === 'right') { set(n.gL, 0); set(n.gR, 1); this._stopAlt(); }
      else if (r === 'alt') { this._startAlt(); }
      else { set(n.gL, 1); set(n.gR, 1); this._stopAlt(); }
    }

    _startAlt() {
      this._stopAlt();
      const step = () => {
        const n = this._nodes;
        if (!n) return;
        const t = this.ctx.currentTime;
        const l = this._altSide === 0 ? 1 : 0;
        n.gL.gain.setTargetAtTime(l, t, 0.005);
        n.gR.gain.setTargetAtTime(1 - l, t, 0.005);
        this._altSide = 1 - this._altSide;
        if (this.onAltChange) this.onAltChange(l ? 'L' : 'R');
      };
      step();
      this._altTimer = setInterval(step, Math.max(100, this.cfg.altInterval * 1000));
    }

    _stopAlt() {
      if (this._altTimer) clearInterval(this._altTimer);
      this._altTimer = null;
    }

    _startSweep() {
      this._stopSweep();
      const run = () => {
        const n = this._nodes;
        if (!n || !n.osc) return;
        const c = this.cfg;
        const t = this.ctx.currentTime;
        const f = n.osc.frequency;
        const from = Math.max(1, c.sweepFrom);
        const to = Math.max(1, c.sweepTo);
        f.cancelScheduledValues(t);
        f.setValueAtTime(from, t);
        if (c.sweepLog) f.exponentialRampToValueAtTime(to, t + c.sweepSeconds);
        else f.linearRampToValueAtTime(to, t + c.sweepSeconds);
      };
      run();
      if (this.cfg.sweepLoop) {
        this._sweepTimer = setInterval(run, Math.max(200, this.cfg.sweepSeconds * 1000));
      }
    }

    _stopSweep() {
      if (this._sweepTimer) clearInterval(this._sweepTimer);
      this._sweepTimer = null;
    }
  };
})();
