const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),
  startBot: (token) => ipcRenderer.invoke('bot:start', token),
  stopBot: () => ipcRenderer.invoke('bot:stop'),
  botStatus: () => ipcRenderer.invoke('bot:status'),
  getInvite: () => ipcRenderer.invoke('bot:invite'),
  listGuilds: () => ipcRenderer.invoke('guild:list'),
  buildServer: (guildId, layout) => ipcRenderer.invoke('server:build', guildId, layout),
  saveLayout: (layout, name) => ipcRenderer.invoke('layout:save', layout, name),
  listLayouts: () => ipcRenderer.invoke('layout:list'),
  loadLayout: (name) => ipcRenderer.invoke('layout:load', name),
  startNotifier: (opts) => ipcRenderer.invoke('yt:start', opts),
  stopNotifier: () => ipcRenderer.invoke('yt:stop'),
  notifierStatus: () => ipcRenderer.invoke('yt:status'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  onLog: (cb) => ipcRenderer.on('log', (_e, m) => cb(m)),
  onBotStatus: (cb) => ipcRenderer.on('bot-status', (_e, s) => cb(s)),
  onNotifierStatus: (cb) => ipcRenderer.on('yt-status', (_e, s) => cb(s))
});