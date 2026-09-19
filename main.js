const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('./store');
const { ServerBuilder } = require('./serverBuilder');
const { YouTubeNotifier } = require('./youTubeNotifier');

let win = null;
const store = new Store();
let builder = null;
let notifier = null;

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  if (win && !win.isDestroyed()) win.webContents.send('log', line);
  console.log(line);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'De4th.build',
    backgroundColor: '#1e1f22',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function pushBotStatus(status) {
  if (win && !win.isDestroyed()) win.webContents.send('bot-status', status);
}

function buildOrLoadBuilder() {
  const token = store.get('botToken');
  if (!token) return null;
  if (!builder || builder.token !== token) {
    if (builder) builder.client.destroy();
    builder = new ServerBuilder(token, store.get('lastGuildId'));
    builder.onStatus = pushBotStatus;
    builder.onLog = log;
    builder.start();
  }
  return builder;
}

ipcMain.handle('settings:get', () => {
  return {
    botToken: store.get('botToken') ? true : false,
    notifier: store.get('notifier') || null,
    lastGuildId: store.get('lastGuildId') || ''
  };
});

ipcMain.handle('settings:save', (e, data) => {
  if (data.botToken) store.set('botToken', data.botToken.trim());
  if (data.lastGuildId !== undefined) store.set('lastGuildId', data.lastGuildId);
  if (data.notifier) store.set('notifier', data.notifier);
  if (data.notifier === null) store.set('notifier', null);
  return true;
});

ipcMain.handle('bot:start', async (e, token) => {
  store.set('botToken', token.trim());
  builder = new ServerBuilder(token.trim(), store.get('lastGuildId'));
  builder.onStatus = pushBotStatus;
  builder.onLog = log;
  try {
    await builder.start();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('bot:stop', async () => {
  if (builder) { builder.stop(); builder = null; }
  return true;
});

ipcMain.handle('bot:status', () => (builder ? builder.status : 'offline'));

ipcMain.handle('bot:invite', () => {
  const b = buildOrLoadBuilder();
  if (!b) return { ok: false, error: 'Start the bot first (Setup tab).' };
  const url = b.getInviteUrl();
  if (!url) return { ok: false, error: 'Bot not ready yet. Try again in a moment.' };
  return { ok: true, url };
});

ipcMain.handle('guild:list', async () => {
  const b = buildOrLoadBuilder();
  if (!b) return [];
  const list = await b.listGuilds();
  if (list && list.length) store.set('lastGuildId', list[0].id);
  return list;
});

ipcMain.handle('server:build', async (e, guildId, layout) => {
  const b = buildOrLoadBuilder();
  if (!b) throw new Error('Start the bot first (Setup tab).');
  store.set('lastGuildId', guildId);
  const res = await b.build(guildId, layout);
  log(`Build finished: ${res.steps} steps, ${res.errors} errors.`);
  return res;
});

const LAYOUT_DIR = () => path.join(app.getPath('userData'), 'layouts');
ipcMain.handle('layout:save', (e, layout, name) => {
  fs.mkdirSync(LAYOUT_DIR(), { recursive: true });
  fs.writeFileSync(path.join(LAYOUT_DIR(), name), JSON.stringify(layout, null, 2));
  return true;
});
ipcMain.handle('layout:list', () => {
  try { return fs.readdirSync(LAYOUT_DIR()).filter((f) => f.endsWith('.json')); }
  catch { return []; }
});
ipcMain.handle('layout:load', (e, name) => {
  return JSON.parse(fs.readFileSync(path.join(LAYOUT_DIR(), name), 'utf8'));
});

ipcMain.handle('yt:start', async (e, opts) => {
  const b = buildOrLoadBuilder();
  if (!b) return { ok: false, error: 'Start the bot first (Setup tab).' };
  notifier = new YouTubeNotifier(b.client, opts, store);
  notifier.onLog = log;
  notifier.onStatus = (s) => win && !win.isDestroyed() && win.webContents.send('yt-status', s);
  notifier.start();
  return { ok: true };
});

ipcMain.handle('yt:stop', async () => {
  if (notifier) { notifier.stop(); notifier = null; }
  return true;
});

ipcMain.handle('yt:status', () => (notifier ? notifier.status : 'stopped'));

ipcMain.handle('shell:open', async (e, url) => { shell.openExternal(url); return true; });

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (builder) builder.stop();
  if (notifier) notifier.stop();
  if (process.platform !== 'darwin') app.quit();
});