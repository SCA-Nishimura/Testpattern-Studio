'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tp', {
  /* ディスプレイ */
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  onDisplaysChanged: (cb) => {
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on('displays:changed', h);
    return () => ipcRenderer.removeListener('displays:changed', h);
  },

  /* 出力窓 */
  openOutput: (displayId) => ipcRenderer.invoke('output:open', displayId),
  closeOutput: () => ipcRenderer.invoke('output:close'),
  isOutputOpen: () => ipcRenderer.invoke('output:isOpen'),
  requestOutputClose: () => ipcRenderer.send('output:requestClose'),
  onOutputClosed: (cb) => {
    const h = () => cb();
    ipcRenderer.on('output:closed', h);
    return () => ipcRenderer.removeListener('output:closed', h);
  },

  /* ステート同期 */
  pushState: (state) => ipcRenderer.send('state:push', state),
  pullState: () => ipcRenderer.invoke('state:pull'),
  onStateApply: (cb) => {
    const h = (_e, state) => cb(state);
    ipcRenderer.on('state:apply', h);
    return () => ipcRenderer.removeListener('state:apply', h);
  },

  /* 書き出し */
  exportPng: (payload) => ipcRenderer.invoke('export:png', payload),
});
