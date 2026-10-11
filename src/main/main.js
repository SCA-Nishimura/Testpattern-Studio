'use strict';

const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const isDev = process.argv.includes('--dev');

/** @type {BrowserWindow|null} */
let controlWin = null;
/** @type {BrowserWindow|null} */
let outputWin = null;

/** 最後にコントロール側から受け取った描画ステート。出力窓の初期化時に流し込む。 */
let lastState = null;

const PRELOAD = path.join(__dirname, 'preload.js');

/** --dev 時にレンダラの console / 例外をターミナルへ流す */
function forwardConsole(win, tag) {
  // Electron 37 以降は details オブジェクト 1 引数、それ以前は (event, level, message, line, source)
  win.webContents.on('console-message', (...args) => {
    const d = args[0] && typeof args[0].message === 'string'
      ? args[0]
      : { level: args[1], message: args[2], lineNumber: args[3], sourceId: args[4] };
    console.log(`[${tag}:${d.level}] ${d.message}  (${d.sourceId || ''}:${d.lineNumber || ''})`);
  });
  win.webContents.on('render-process-gone', (_e, d) => console.error(`[${tag}] render-process-gone`, d));
  win.webContents.on('did-fail-load', (_e, code, desc, url) => console.error(`[${tag}] did-fail-load`, code, desc, url));
}

function createControlWindow() {
  controlWin = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#15171c',
    title: 'TestPattern Studio',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  controlWin.setMenuBarVisibility(false);
  controlWin.loadFile(path.join(__dirname, '..', 'renderer', 'control', 'index.html'));
  if (isDev) {
    controlWin.webContents.openDevTools({ mode: 'detach' });
    forwardConsole(controlWin, 'control');
  }

  controlWin.on('closed', () => {
    controlWin = null;
    closeOutputWindow();
  });
}

function serializeDisplays() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    index: i,
    label: `Display ${i + 1}`,
    bounds: d.bounds,
    size: d.size,
    scaleFactor: d.scaleFactor,
    rotation: d.rotation,
    // 実ピクセル解像度（OS スケーリングを戻した値）
    nativeWidth: Math.round(d.size.width * d.scaleFactor),
    nativeHeight: Math.round(d.size.height * d.scaleFactor),
    internal: d.internal,
    isPrimary: d.id === primaryId,
  }));
}

function findDisplay(displayId) {
  const all = screen.getAllDisplays();
  return all.find((d) => d.id === displayId) || screen.getPrimaryDisplay();
}

function openOutputWindow(displayId) {
  const display = findDisplay(displayId);

  if (outputWin && !outputWin.isDestroyed()) {
    // 既存窓を対象ディスプレイへ移動して貼り直す。
    // Windows では全画面の解除が反映されてから移動しないと元の画面に留まるため、
    // 解除 → 移動 → 再全画面を 1 tick ずつ分けて行う。
    const win = outputWin;
    win.setFullScreen(false);
    setTimeout(() => {
      if (win.isDestroyed()) return;
      win.setBounds(display.bounds);
      setTimeout(() => {
        if (win.isDestroyed()) return;
        win.setFullScreen(true);
        win.moveTop();
        win.focus();
      }, 60);
    }, 60);
    return { ok: true, moved: true, displayId: display.id, bounds: display.bounds };
  }

  // Windows では fullscreen:true をコンストラクタで渡すと x/y が無視され、
  // プライマリディスプレイで全画面化されてしまう。必ず「対象の座標に置いてから」
  // 全画面にすること。
  outputWin = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    fullscreen: false,
    show: false,
    backgroundColor: '#000000',
    title: 'TestPattern Output',
    skipTaskbar: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  // レンダラの keydown が届かない状況（フォーカス喪失直後など）でも閉じられるようにする
  outputWin.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && (input.key === 'Escape' || input.key === 'F11')) closeOutputWindow();
  });

  outputWin.once('ready-to-show', () => {
    if (!outputWin || outputWin.isDestroyed()) return;
    // 対象ディスプレイへ確実に載せてから全画面化する
    outputWin.setBounds(display.bounds);
    outputWin.show();
    outputWin.setFullScreen(true);
    outputWin.moveTop();
    outputWin.focus();
  });

  outputWin.loadFile(path.join(__dirname, '..', 'renderer', 'output', 'output.html'));
  if (isDev) forwardConsole(outputWin, 'output');
  outputWin.on('closed', () => {
    outputWin = null;
    if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('output:closed');
  });

  return { ok: true, moved: false, displayId: display.id, bounds: display.bounds };
}

function closeOutputWindow() {
  if (outputWin && !outputWin.isDestroyed()) outputWin.close();
  outputWin = null;
}

app.whenReady().then(() => {
  createControlWindow();

  const pushDisplays = () => {
    const payload = serializeDisplays();
    if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('displays:changed', payload);
  };
  screen.on('display-added', pushDisplays);
  screen.on('display-removed', pushDisplays);
  screen.on('display-metrics-changed', pushDisplays);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

app.on('window-all-closed', () => app.quit());

/* ---------------------------------------------------------------- IPC */

ipcMain.handle('displays:list', () => serializeDisplays());

ipcMain.handle('output:open', (_e, displayId) => openOutputWindow(displayId));

ipcMain.handle('output:close', () => {
  closeOutputWindow();
  return { ok: true };
});

ipcMain.handle('output:isOpen', () => !!(outputWin && !outputWin.isDestroyed()));

/** コントロール → 出力窓へステートを転送 */
ipcMain.on('state:push', (_e, state) => {
  lastState = state;
  if (outputWin && !outputWin.isDestroyed()) outputWin.webContents.send('state:apply', state);
});

/** 出力窓の初期化完了時、最後のステートを要求してくる */
ipcMain.handle('state:pull', () => lastState);

/** 出力窓から「閉じたい」要求（Esc / F11） */
ipcMain.on('output:requestClose', () => closeOutputWindow());

/** PNG 保存 */
ipcMain.handle('export:png', async (_e, { dataUrl, suggestedName }) => {
  const parent = controlWin && !controlWin.isDestroyed() ? controlWin : undefined;
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    title: 'テストパターンを PNG で保存',
    defaultPath: suggestedName || 'testpattern.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

  const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return { ok: true, filePath };
});
