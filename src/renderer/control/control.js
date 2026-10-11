'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = 'testpattern-studio.state.v1';

  const CATEGORY_LABELS = {
    projector: 'プロジェクタ調整',
    video: '映像品質',
    dynamic: '動的パターン',
  };
  const CATEGORY_ORDER = ['projector', 'video', 'dynamic'];

  /* ------------------------------------------------------------- ステート */

  const state = {
    patternId: 'grid',
    paramsByPattern: {},
    width: 1920,
    height: 1080,
    scaling: 'fit',
    displayId: null,
    overlay: Object.assign({}, TP.OVERLAY_DEFAULTS),
    tone: Object.assign({}, TP.TONE_DEFAULTS),
    previewFullRes: false,
  };

  let displays = [];
  let outputOpen = false;
  const tone = new TP.ToneGenerator();

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') {
        Object.assign(state, s, {
          overlay: Object.assign({}, TP.OVERLAY_DEFAULTS, s.overlay || {}),
          tone: Object.assign({}, TP.TONE_DEFAULTS, s.tone || {}),
          paramsByPattern: s.paramsByPattern || {},
        });
      }
    } catch (e) {
      // 壊れた保存値は無視して初期値で立ち上げる
    }
    if (!TP.getPattern(state.patternId)) state.patternId = TP.patterns[0].id;
  }

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      // 保存できなくても動作には影響しない
    }
  }

  function currentDef() {
    return TP.getPattern(state.patternId);
  }

  function currentParams() {
    const def = currentDef();
    const stored = state.paramsByPattern[def.id];
    const merged = Object.assign(TP.defaultParams(def), stored || {});
    state.paramsByPattern[def.id] = merged;
    return merged;
  }

  /* ------------------------------------------------------------ レンダラ */

  const preview = new TP.Renderer($('preview'), { physicalPixels: false });

  function renderState() {
    return {
      patternId: state.patternId,
      params: currentParams(),
      width: state.width,
      height: state.height,
      scaling: state.scaling,
      overlay: state.overlay,
    };
  }

  function apply(opts) {
    const rs = renderState();

    // プレビューは常に等倍 or 全体表示。Fit/Stretch/Native は出力窓側の設定。
    const canvas = $('preview');
    if (state.previewFullRes) {
      canvas.classList.add('full-res');
      canvas.style.aspectRatio = '';
      canvas.style.width = state.width + 'px';
      canvas.style.height = state.height + 'px';
    } else {
      canvas.classList.remove('full-res');
      canvas.style.aspectRatio = state.width + ' / ' + state.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
    }
    document.querySelector('.preview-wrap').classList.toggle('scroll-mode', state.previewFullRes);

    preview.setState(Object.assign({}, rs, { scaling: state.previewFullRes ? 'native' : 'fit' }));
    window.tp.pushState(rs);

    updateMeta();
    if (!opts || !opts.skipPersist) persist();
  }

  function updateMeta() {
    const def = currentDef();
    $('previewName').textContent = def.name;
    $('previewHint').textContent = def.hint || '';
    const mode = TP.SCALING_MODES.find((m) => m.v === state.scaling);
    $('previewMeta').textContent =
      state.width + ' x ' + state.height + '  /  ' + TP.aspectLabel(state.width, state.height) +
      '  /  ' + (state.width * state.height / 1e6).toFixed(2) + ' MPixel' +
      '  /  出力スケーリング: ' + (mode ? mode.l : state.scaling);
  }

  /* --------------------------------------------------- フォーム部品ビルダ */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function fieldStacked(labelText, ...controls) {
    const f = el('div', 'field is-stacked');
    f.appendChild(el('label', null, labelText));
    const row = el('div', 'field-row');
    controls.forEach((c) => row.appendChild(c));
    f.appendChild(row);
    return f;
  }

  function fieldCheck(labelText, input) {
    const f = el('div', 'field is-check');
    const id = 'chk_' + Math.random().toString(36).slice(2, 9);
    input.id = id;
    const lab = el('label', null, labelText);
    lab.setAttribute('for', id);
    f.appendChild(input);
    f.appendChild(lab);
    return f;
  }

  function selectEl(options, value, onChange) {
    const s = el('select', 'ctl ctl-full');
    for (const o of options) {
      const opt = el('option', null, o.l);
      opt.value = o.v;
      s.appendChild(opt);
    }
    s.value = String(value);
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  function numberEl(def, value, onChange) {
    const n = el('input', 'ctl ctl-num');
    n.type = 'number';
    if (def.min != null) n.min = def.min;
    if (def.max != null) n.max = def.max;
    n.step = def.step || 1;
    n.value = value;

    let range = null;
    if (def.min != null && def.max != null) {
      range = el('input');
      range.type = 'range';
      range.min = def.min;
      range.max = def.max;
      range.step = def.step || 1;
      range.value = value;
    }

    const commit = (raw, from) => {
      let v = Number(raw);
      if (!Number.isFinite(v)) return;
      if (def.min != null) v = Math.max(def.min, v);
      if (def.max != null) v = Math.min(def.max, v);
      if (from !== 'num') n.value = v;
      if (range && from !== 'range') range.value = v;
      onChange(v);
    };

    n.addEventListener('input', () => commit(n.value, 'num'));
    n.addEventListener('blur', () => commit(n.value, 'blur'));
    if (range) range.addEventListener('input', () => commit(range.value, 'range'));

    return { number: n, range };
  }

  function colorEl(value, onChange) {
    const c = el('input', 'ctl');
    c.type = 'color';
    c.value = value;
    c.addEventListener('input', () => onChange(c.value));
    return c;
  }

  function boolEl(value, onChange) {
    const b = el('input');
    b.type = 'checkbox';
    b.checked = !!value;
    b.addEventListener('change', () => onChange(b.checked));
    return b;
  }

  /** パターン / オーバーレイ共通のパラメータ行生成 */
  function buildParamRow(def, value, onChange) {
    if (def.type === 'bool') return fieldCheck(def.label, boolEl(value, onChange));
    if (def.type === 'select') return fieldStacked(def.label, selectEl(def.options, value, onChange));
    if (def.type === 'color') {
      const f = el('div', 'field');
      f.appendChild(el('label', null, def.label));
      f.appendChild(colorEl(value, onChange));
      return f;
    }
    const { number, range } = numberEl(def, value, onChange);
    return range ? fieldStacked(def.label, range, number) : fieldStacked(def.label, number);
  }

  /* ---------------------------------------------------------- パターン一覧 */

  function buildPatternList() {
    const host = $('patternList');
    host.textContent = '';
    for (const cat of CATEGORY_ORDER) {
      const items = TP.patternsByCategory(cat);
      if (!items.length) continue;
      host.appendChild(el('div', 'cat-head', CATEGORY_LABELS[cat] || cat));
      for (const def of items) {
        const b = el('button', 'pattern-item', def.name);
        b.dataset.id = def.id;
        b.title = def.hint || def.name;
        b.addEventListener('click', () => {
          state.patternId = def.id;
          markActivePattern();
          buildParamForm();
          apply();
        });
        host.appendChild(b);
      }
    }
    markActivePattern();
  }

  function markActivePattern() {
    for (const b of document.querySelectorAll('.pattern-item')) {
      b.classList.toggle('is-active', b.dataset.id === state.patternId);
    }
  }

  /* ------------------------------------------------------- パラメータフォーム */

  function buildParamForm() {
    const def = currentDef();
    const params = currentParams();
    const host = $('paramForm');
    host.textContent = '';

    if (def.hint) {
      host.appendChild(el('div', 'form-note', def.hint));
    }
    if (!def.params || !def.params.length) {
      host.appendChild(el('div', 'form-note', 'このパターンに調整項目はありません。'));
      return;
    }

    for (const pdef of def.params) {
      host.appendChild(buildParamRow(pdef, params[pdef.key], (v) => {
        params[pdef.key] = v;
        apply();
      }));
    }
  }

  $('resetParams').addEventListener('click', () => {
    const def = currentDef();
    state.paramsByPattern[def.id] = TP.defaultParams(def);
    buildParamForm();
    apply();
  });

  /* ---------------------------------------------------- オーバーレイフォーム */

  function buildOverlayForm() {
    const o = state.overlay;
    const host = $('overlayForm');
    host.textContent = '';

    host.appendChild(el('div', 'form-note', 'どのパターンにも共通で重ねる情報表示とガイド枠。出力窓・PNG にもそのまま反映される。'));

    const defs = [
      { key: 'enabled', label: 'オーバーレイを有効にする', type: 'bool' },
      { key: 'showResolution', label: '解像度を表示', type: 'bool' },
      { key: 'showFps', label: '実測 fps を表示（常時再描画になる）', type: 'bool' },
      { key: 'text', label: '任意テキスト（プロジェクタ ID 等）', type: 'text', placeholder: '例: PJ-01 / LEFT' },
      { key: 'fontScale', label: '文字サイズ (%)', type: 'number', min: 20, max: 400, step: 5 },
      { key: 'color', label: '文字色', type: 'color' },
      { key: 'position', label: '表示位置', type: 'select', options: TP.OVERLAY_POSITIONS },
      { section: '区画ラベル（L / R 等）' },
      { key: 'sections', label: '区画ラベルを表示', type: 'bool' },
      { key: 'sectionCount', label: '分割数', type: 'number', min: 1, max: 16, step: 1 },
      { key: 'sectionText', label: 'ラベル（カンマ区切り / 空欄なら自動）', type: 'text', placeholder: '空欄 = 2分割:L,R  3分割:L,C,R' },
      { key: 'sectionSize', label: '文字サイズ（画面高の %）', type: 'number', min: 2, max: 90, step: 1 },
      { key: 'sectionOpacity', label: '不透明度 (%)', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'sectionY', label: '縦位置（上端 0 / 中央 50 / 下端 100）', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'sectionColor', label: '文字色', type: 'color' },
      { key: 'sectionDividers', label: '分割位置に区切り線', type: 'bool' },

      { section: 'ガイド' },
      { key: 'safe90', label: 'セーフエリア 90%', type: 'bool' },
      { key: 'safe80', label: 'セーフエリア 80%', type: 'bool' },
      { key: 'aspectGuide', label: 'アスペクト枠', type: 'select', options: TP.ASPECT_GUIDES },
      { key: 'centerCross', label: '中央十字', type: 'bool' },
      { key: 'thirds', label: '三分割線', type: 'bool' },
    ];

    for (const d of defs) {
      if (d.section) {
        host.appendChild(el('div', 'form-section', d.section));
        continue;
      }
      if (d.type === 'text') {
        const input = el('input', 'ctl ctl-full');
        input.type = 'text';
        input.value = o[d.key] || '';
        if (d.placeholder) input.placeholder = d.placeholder;
        input.addEventListener('input', () => { o[d.key] = input.value; apply(); });
        host.appendChild(fieldStacked(d.label, input));
        continue;
      }
      host.appendChild(buildParamRow(d, o[d.key], (v) => { o[d.key] = v; apply(); }));
    }
  }

  /* ---------------------------------------------------------- 音声フォーム */

  function buildAudioForm() {
    const t = state.tone;
    const host = $('audioForm');
    host.textContent = '';

    host.appendChild(el('div', 'form-note', 'PC の既定のオーディオ出力（HDMI を既定にしていれば HDMI）へ送出する。レベルは dBFS 指定。'));

    host.appendChild(buildParamRow(
      { key: 'waveform', label: '波形', type: 'select', options: TP.TONE_WAVEFORMS },
      t.waveform, (v) => { t.waveform = v; onToneChange(); buildAudioForm(); },
    ));

    const isNoise = t.waveform === 'white' || t.waveform === 'pink';

    if (!isNoise) {
      const chips = el('div', 'chips');
      for (const f of TP.TONE_FREQ_PRESETS) {
        const c = el('button', 'chip', f >= 1000 ? f / 1000 + 'k' : String(f));
        if (Math.abs(t.freq - f) < 0.001 && !t.sweep) c.classList.add('is-active');
        c.addEventListener('click', () => {
          t.freq = f;
          t.sweep = false;
          onToneChange();
          buildAudioForm();
        });
        chips.appendChild(c);
      }
      host.appendChild(fieldStacked('周波数プリセット (Hz)', chips));

      host.appendChild(buildParamRow(
        { key: 'freq', label: '周波数 (Hz)', type: 'number', min: 20, max: 20000, step: 1 },
        t.freq, (v) => { t.freq = v; onToneChange(); },
      ));
    }

    host.appendChild(buildParamRow(
      { key: 'levelDb', label: 'レベル (dBFS)', type: 'number', min: -60, max: 0, step: 0.5 },
      t.levelDb, (v) => { t.levelDb = v; onToneChange(); updateAudioStatus(); },
    ));

    host.appendChild(buildParamRow(
      { key: 'route', label: '出力チャンネル', type: 'select', options: TP.TONE_ROUTES },
      t.route, (v) => { t.route = v; onToneChange(); buildAudioForm(); },
    ));

    if (t.route === 'alt') {
      host.appendChild(buildParamRow(
        { key: 'altInterval', label: '交互切替の間隔 (秒)', type: 'number', min: 0.2, max: 10, step: 0.1 },
        t.altInterval, (v) => { t.altInterval = v; onToneChange(); },
      ));
    }

    if (!isNoise) {
      host.appendChild(el('div', 'form-section', 'スイープ'));
      host.appendChild(buildParamRow(
        { key: 'sweep', label: '周波数スイープを使う', type: 'bool' },
        t.sweep, (v) => { t.sweep = v; onToneChange(); buildAudioForm(); },
      ));
      if (t.sweep) {
        host.appendChild(buildParamRow({ key: 'sweepFrom', label: '開始 (Hz)', type: 'number', min: 20, max: 20000, step: 1 },
          t.sweepFrom, (v) => { t.sweepFrom = v; onToneChange(); }));
        host.appendChild(buildParamRow({ key: 'sweepTo', label: '終了 (Hz)', type: 'number', min: 20, max: 20000, step: 1 },
          t.sweepTo, (v) => { t.sweepTo = v; onToneChange(); }));
        host.appendChild(buildParamRow({ key: 'sweepSeconds', label: '所要時間 (秒)', type: 'number', min: 0.5, max: 120, step: 0.5 },
          t.sweepSeconds, (v) => { t.sweepSeconds = v; onToneChange(); }));
        host.appendChild(buildParamRow({ key: 'sweepLog', label: '対数スイープ（聴感的に等速）', type: 'bool' },
          t.sweepLog, (v) => { t.sweepLog = v; onToneChange(); }));
        host.appendChild(buildParamRow({ key: 'sweepLoop', label: 'ループ再生', type: 'bool' },
          t.sweepLoop, (v) => { t.sweepLoop = v; onToneChange(); }));
      }
    }

    if (t.levelDb > -6) {
      host.appendChild(el('div', 'form-warn', '警告: -6 dBFS を超えるレベルです。スピーカー・耳の保護のため、出力先の音量を先に絞ってください。'));
    }

    updateAudioStatus();
  }

  function onToneChange() {
    tone.update(state.tone);
    persist();
  }

  function updateAudioStatus() {
    const t = state.tone;
    const parts = [];
    parts.push(tone.playing ? '再生中' : '停止中');
    if (tone.sampleRate) parts.push(tone.sampleRate + ' Hz');
    if (tone.channelCount) parts.push('出力 ' + tone.channelCount + ' ch');
    parts.push(t.levelDb.toFixed(1) + ' dBFS');
    $('audioStatus').textContent = parts.join('  /  ');
    $('toneBtn').textContent = tone.playing ? 'テストトーン停止' : 'テストトーン再生';
    $('toneBtn').classList.toggle('is-on', tone.playing);
  }

  $('toneBtn').addEventListener('click', () => {
    if (!tone.playing) {
      tone.cfg = Object.assign({}, state.tone);
      tone.start();
    } else {
      tone.stop();
    }
    updateAudioStatus();
  });

  /* ------------------------------------------------------------ 解像度 UI */

  function buildResPresets() {
    const sel = $('resPreset');
    sel.textContent = '';
    const custom = el('option', null, '任意入力');
    custom.value = 'custom';
    sel.appendChild(custom);
    for (const g of TP.RESOLUTIONS) {
      const og = document.createElement('optgroup');
      og.label = g.group;
      for (const it of g.items) {
        const o = el('option', null, it.label);
        o.value = it.w + 'x' + it.h;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
    sel.addEventListener('change', () => {
      if (sel.value === 'custom') return;
      const [w, h] = sel.value.split('x').map(Number);
      setResolution(w, h);
    });
  }

  function syncResUI() {
    $('resW').value = state.width;
    $('resH').value = state.height;
    const key = state.width + 'x' + state.height;
    const sel = $('resPreset');
    sel.value = [...sel.options].some((o) => o.value === key) ? key : 'custom';
    $('resInfo').textContent = TP.aspectLabel(state.width, state.height);
  }

  function setResolution(w, h) {
    const v = TP.validateResolution(w, h);
    if (!v.ok) {
      $('resInfo').textContent = v.msg;
      return false;
    }
    state.width = v.w;
    state.height = v.h;
    syncResUI();
    apply();
    return true;
  }

  function hookResInputs() {
    const commit = () => {
      const ok = setResolution($('resW').value, $('resH').value);
      $('resW').classList.toggle('invalid', !ok);
      $('resH').classList.toggle('invalid', !ok);
    };
    for (const id of ['resW', 'resH']) {
      $(id).addEventListener('change', commit);
      $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
    }
  }

  $('resFromDisplay').addEventListener('click', () => {
    const d = displays.find((x) => x.id === state.displayId) || displays[0];
    if (!d) return;
    setResolution(d.nativeWidth, d.nativeHeight);
  });

  /* ---------------------------------------------------------- 出力ディスプレイ */

  function buildScalingSelect() {
    const sel = $('scalingSel');
    sel.textContent = '';
    for (const m of TP.SCALING_MODES) {
      const o = el('option', null, m.l.replace(/（.*/, ''));
      o.value = m.v;
      o.title = m.l;
      sel.appendChild(o);
    }
    sel.value = state.scaling;
    sel.addEventListener('change', () => { state.scaling = sel.value; apply(); });
  }

  function renderDisplays(list) {
    displays = list;
    const sel = $('displaySel');
    const prev = state.displayId;
    sel.textContent = '';
    for (const d of list) {
      const tags = [];
      if (d.isPrimary) tags.push('プライマリ');
      if (d.internal) tags.push('内蔵');
      if (d.scaleFactor !== 1) tags.push(Math.round(d.scaleFactor * 100) + '%');
      const o = el('option', null,
        d.label + ' — ' + d.nativeWidth + 'x' + d.nativeHeight + (tags.length ? ' (' + tags.join('/') + ')' : ''));
      o.value = String(d.id);
      sel.appendChild(o);
    }
    const found = list.find((d) => d.id === prev);
    const chosen = found || list.find((d) => !d.isPrimary) || list[0];
    if (chosen) {
      state.displayId = chosen.id;
      sel.value = String(chosen.id);
    }
  }

  $('displaySel').addEventListener('change', () => {
    state.displayId = Number($('displaySel').value);
    persist();
    if (outputOpen) window.tp.openOutput(state.displayId);
  });

  function flashMeta(msg) {
    $('previewMeta').textContent = msg;
    setTimeout(updateMeta, 3000);
  }

  async function toggleOutput() {
    try {
      if (outputOpen) {
        await window.tp.closeOutput();
        outputOpen = false;
        flashMeta('出力を停止しました');
      } else {
        const res = await window.tp.openOutput(state.displayId);
        outputOpen = true;
        window.tp.pushState(renderState());
        const d = displays.find((x) => x.id === state.displayId);
        flashMeta('出力中: ' + (d ? d.label + ' (' + d.nativeWidth + 'x' + d.nativeHeight + ')' : 'display ' + state.displayId)
          + (res && res.bounds ? '  @ ' + res.bounds.x + ',' + res.bounds.y : '')
          + '  — 閉じるには Esc または F5');
      }
    } catch (e) {
      outputOpen = await window.tp.isOutputOpen();
      flashMeta('出力の切り替えに失敗しました: ' + (e && e.message ? e.message : e));
    }
    syncOutputBtn();
  }

  function syncOutputBtn() {
    const b = $('outputBtn');
    b.textContent = outputOpen ? '出力停止 (F5 / Esc)' : '出力開始 (F5)';
    b.classList.toggle('is-on', outputOpen);
  }

  $('outputBtn').addEventListener('click', toggleOutput);
  window.tp.onOutputClosed(() => { outputOpen = false; syncOutputBtn(); });

  /* ------------------------------------------------------------- PNG 書き出し */

  $('exportBtn').addEventListener('click', async () => {
    const url = preview.toPngDataUrl();
    if (!url) return;
    const def = currentDef();
    const name = def.id + '_' + state.width + 'x' + state.height + '.png';
    const res = await window.tp.exportPng({ dataUrl: url, suggestedName: name });
    if (res && res.ok) {
      $('previewMeta').textContent = '保存しました: ' + res.filePath;
      setTimeout(updateMeta, 2500);
    }
  });

  /* ---------------------------------------------------------------- タブ */

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      for (const t of document.querySelectorAll('.tab')) t.classList.toggle('is-active', t === tab);
      for (const p of document.querySelectorAll('.tabpane')) {
        p.classList.toggle('is-active', p.dataset.pane === tab.dataset.tab);
      }
    });
  }

  /* ----------------------------------------------------------- キーボード */

  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
    if (e.key === 'F5') { e.preventDefault(); toggleOutput(); return; }
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); $('exportBtn').click(); return; }
    if (!typing && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const ids = TP.patterns.map((p) => p.id);
      const i = ids.indexOf(state.patternId);
      const next = ids[(i + (e.key === 'ArrowDown' ? 1 : ids.length - 1)) % ids.length];
      state.patternId = next;
      markActivePattern();
      buildParamForm();
      apply();
    }
  });

  /* ----------------------------------------------------------------- 起動 */

  $('previewFullRes').addEventListener('change', (e) => {
    state.previewFullRes = e.target.checked;
    apply();
  });

  async function init() {
    loadStored();
    buildResPresets();
    buildScalingSelect();
    hookResInputs();
    buildPatternList();
    buildParamForm();
    buildOverlayForm();
    buildAudioForm();
    syncResUI();
    $('previewFullRes').checked = state.previewFullRes;

    renderDisplays(await window.tp.listDisplays());
    window.tp.onDisplaysChanged(renderDisplays);
    outputOpen = await window.tp.isOutputOpen();
    syncOutputBtn();

    apply({ skipPersist: true });
  }

  init();
})();
