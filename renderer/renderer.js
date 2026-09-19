const api = window.api;

const DEFAULT_TEMPLATE = {
  serverName: 'My Community',
  welcome: {
    message: 'Welcome to the community! Read the rules and say hi in #welcome.',
    embed: {
      title: '',
      description: 'Thanks for joining! The best way to support the channel is to hit subscribe and turn on notifications.'
    }
  },
  roles: [
    { name: 'Moderator', color: '#ed4245', hoist: true, perms: ['ManageMessages', 'ManageRoles', 'KickMembers', 'BanMembers', 'MoveMembers', 'MuteMembers', 'DeafenMembers'] },
    { name: 'VIP', color: '#f0b232', hoist: true, perms: ['SendMessages', 'Connect', 'Speak', 'UseExternalEmojis'] },
    { name: 'Member', color: '#5865f2', hoist: false, perms: ['SendMessages', 'Connect', 'Speak', 'ReadMessageHistory'] }
  ],
  categories: [
    {
      name: 'WELCOME',
      channels: [
        { type: 'text', name: 'welcome', topic: 'First things first - say hi!', welcome: true },
        { type: 'text', name: 'rules', topic: 'Read before posting.', slowmode: 30 }
      ]
    },
    {
      name: 'VIDEO TALK',
      channels: [
        { type: 'text', name: 'announcements', topic: 'New uploads & live streams.' },
        { type: 'text', name: 'video-discussion', topic: 'Talk about the latest uploads.' },
        { type: 'text', name: 'suggestions', topic: 'Video ideas and feedback.' }
      ]
    },
    {
      name: 'COMMUNITY',
      channels: [
        { type: 'text', name: 'general-chat', topic: 'Anything goes (follow the rules).' },
        { type: 'text', name: 'memes' },
        { type: 'text', name: 'introductions', topic: 'Tell us about yourself!' }
      ]
    },
    {
      name: 'VOICE CHANNELS',
      channels: [
        { type: 'voice', name: 'Lounge', userLimit: 0 },
        { type: 'voice', name: 'Gaming' },
        { type: 'voice', name: 'Watch Along' }
      ]
    }
  ]
};

const BASIC_TEMPLATE = {
  serverName: 'My Community',
  roles: [
    { name: 'Member', color: '#5865f2', hoist: false, perms: [] }
  ],
  categories: [
    { name: 'TEXT', channels: [{ type: 'text', name: 'general' }, { type: 'text', name: 'announcements', welcome: true }] },
    { name: 'VOICE', channels: [{ type: 'voice', name: 'General' }] }
  ]
};

let state = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
let botReady = false;
let guilds = [];

const $ = (id) => document.getElementById(id);

function log(msg, cls) {
  const div = document.createElement('div');
  div.textContent = msg;
  if (cls) div.classList.add(cls);
  const box = $('log');
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function setDot(id, cls) {
  const dot = $(id);
  if (dot) dot.className = 'dot ' + cls;
}

function setStatusText(id, text) { $(id).textContent = text; }

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}

/* ---------- Layout editor ---------- */

function addCategory() {
  const name = prompt('Category name:', 'NEW CATEGORY') || 'NEW CATEGORY';
  state.categories.push({ name, channels: [] });
  renderEditor();
}

function addChannel(catIdx, type) {
  const name = prompt((type === 'voice' ? 'Voice channel' : 'Text channel') + ' name:', '');
  if (!name) return;
  const ch = { type, name };
  if (type === 'text') { ch.topic = ''; }
  state.categories[catIdx].channels.push(ch);
  renderEditor();
}

function moveCat(idx, delta) {
  const target = idx + delta;
  if (target < 0 || target >= state.categories.length) return;
  const [c] = state.categories.splice(idx, 1);
  state.categories.splice(target, 0, c);
  renderEditor();
}

function moveChan(catIdx, idx, delta) {
  const chans = state.categories[catIdx].channels;
  const target = idx + delta;
  if (target < 0 || target >= chans.length) return;
  const [c] = chans.splice(idx, 1);
  chans.splice(target, 0, c);
  renderEditor();
}

function renderEditor() {
  const root = $('layoutEditor');
  root.innerHTML = '';
  $('serverName').value = state.serverName || '';

  state.categories.forEach((cat, ci) => {
    const wrap = document.createElement('div');
    wrap.className = 'cat';

    const head = document.createElement('div');
    head.className = 'cat-head';
    const title = document.createElement('b');
    title.textContent = `# ${cat.name}`;
    const btns = document.createElement('div');
    btns.className = 'icon-btns';
    const mk = (label, fn, cls) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = label;
      if (cls) b.className = cls;
      b.onclick = fn;
      return b;
    };
    btns.appendChild(mk('⬆', () => moveCat(ci, -1)));
    btns.appendChild(mk('⬇', () => moveCat(ci, 1)));
    btns.appendChild(mk('✕', () => { state.categories.splice(ci, 1); renderEditor(); }));
    head.appendChild(title);
    head.appendChild(btns);
    wrap.appendChild(head);

    const body = document.createElement('div');
    body.className = 'cat-body';

    cat.channels.forEach((ch, chi) => {
      const row = document.createElement('div');
      row.className = 'chan';

      const prefix = document.createElement('span');
      prefix.textContent = ch.type === 'voice' ? '🔊' : '#';
      prefix.style.color = 'var(--muted)';
      row.appendChild(prefix);

      const name = document.createElement('input');
      name.type = 'text';
      name.value = ch.name;
      name.placeholder = 'channel name';
      name.oninput = () => { ch.name = name.value; };
      row.appendChild(name);

      if (ch.type === 'text') {
        const topic = document.createElement('input');
        topic.type = 'text';
        topic.className = 'wide';
        topic.placeholder = 'topic (optional)';
        topic.value = ch.topic || '';
        topic.oninput = () => { ch.topic = topic.value; };
        row.appendChild(topic);

        const slow = document.createElement('input');
        slow.type = 'number';
        slow.min = '0';
        slow.max = '21600';
        slow.value = ch.slowmode ?? 0;
        slow.style.width = '64px';
        slow.title = 'Slowmode seconds';
        slow.oninput = () => { ch.slowmode = parseInt(slow.value) || 0; };
        row.appendChild(slow);

        const wl = document.createElement('label');
        wl.className = 'tiny';
        const wlBox = document.createElement('input');
        wlBox.type = 'checkbox';
        wlBox.checked = !!ch.welcome;
        wlBox.onchange = () => { ch.welcome = wlBox.checked; };
        wl.appendChild(wlBox);
        wl.appendChild(document.createTextNode(' welcome'));
        row.appendChild(wl);
      } else {
        const ul = document.createElement('input');
        ul.type = 'number';
        ul.min = '0';
        ul.max = '99';
        ul.value = ch.userLimit ?? 0;
        ul.style.width = '56px';
        ul.title = 'User limit (0 = unlimited)';
        ul.oninput = () => { ch.userLimit = parseInt(ul.value) || 0; };
        const lbl = document.createElement('label');
        lbl.className = 'tiny';
        lbl.appendChild(document.createTextNode('limit '));
        lbl.appendChild(ul);
        row.appendChild(lbl);
      }

      const ib = document.createElement('div');
      ib.className = 'icon-btns';
      const mkb = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; return b; };
      ib.appendChild(mkb('⬆', () => moveChan(ci, chi, -1)));
      ib.appendChild(mkb('⬇', () => moveChan(ci, chi, 1)));
      ib.appendChild(mkb('✕', () => { cat.channels.splice(chi, 1); renderEditor(); }));
      row.appendChild(ib);

      body.appendChild(row);
    });

    const addBtns = document.createElement('div');
    addBtns.style.display = 'flex';
    addBtns.style.gap = '6px';
    addBtns.style.marginTop = '4px';
    const a1 = document.createElement('button');
    a1.className = 'mini';
    a1.textContent = '+ # text channel';
    a1.onclick = () => addChannel(ci, 'text');
    const a2 = document.createElement('button');
    a2.className = 'mini';
    a2.textContent = '+ 🔊 voice channel';
    a2.onclick = () => addChannel(ci, 'voice');
    addBtns.appendChild(a1);
    addBtns.appendChild(a2);
    body.appendChild(addBtns);

    wrap.appendChild(body);
    root.appendChild(wrap);
  });

  renderRoles();
}

function renderRoles() {
  const root = $('layoutEditor');
  const sec = document.createElement('div');
  sec.style.marginTop = '16px';
  sec.innerHTML = '<h3 style="display:inline">Roles</h3>';

  state.roles.forEach((role, ri) => {
    const row = document.createElement('div');
    row.className = 'role-row';
    row.style.marginTop = '6px';

    const sw = document.createElement('span');
    sw.className = 'colorbox';
    sw.style.background = role.color || '#5865f2';
    row.appendChild(sw);

    const name = document.createElement('input');
    name.type = 'text';
    name.value = role.name;
    name.placeholder = 'role name';
    name.oninput = () => { role.name = name.value; };
    row.appendChild(name);

    const color = document.createElement('input');
    color.type = 'color';
    color.value = role.color || '#5865f2';
    color.title = 'Role color';
    color.style.padding = '0';
    color.style.width = '34px';
    color.oninput = () => { role.color = color.value; sw.style.background = color.value; };
    row.appendChild(color);

    const hoist = document.createElement('label');
    hoist.className = 'tiny';
    const ho = document.createElement('input');
    ho.type = 'checkbox';
    ho.checked = !!role.hoist;
    ho.onchange = () => { role.hoist = ho.checked; };
    hoist.appendChild(ho);
    hoist.appendChild(document.createTextNode(' hoist'));
    row.appendChild(hoist);

    const perms = document.createElement('input');
    perms.type = 'text';
    perms.placeholder = 'perms: SendMessages, Connect, ...';
    perms.style.maxWidth = '280px';
    perms.value = (role.perms || []).join(', ');
    perms.oninput = () => { role.perms = perms.value.split(',').map(s => s.trim()).filter(Boolean); };
    row.appendChild(perms);

    const ib = document.createElement('div');
    ib.className = 'icon-btns';
    const d = document.createElement('button');
    d.textContent = '✕';
    d.onclick = () => { state.roles.splice(ri, 1); renderEditor(); };
    ib.appendChild(d);
    row.appendChild(ib);

    sec.appendChild(row);
  });

  const add = document.createElement('button');
  add.className = 'mini';
  add.style.marginTop = '6px';
  add.textContent = '+ add role';
  add.onclick = () => { state.roles.push({ name: 'New Role', color: '#5865f2', hoist: false, perms: [] }); renderEditor(); };
  sec.appendChild(add);

  root.appendChild(sec);
}

/* ---------- Export / Import ---------- */

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'server-layout.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.categories || !Array.isArray(parsed.categories)) throw new Error('not a valid layout');
      state = parsed;
      state.welcome = state.welcome || DEFAULT_TEMPLATE.welcome;
      renderEditor();
      log('Layout imported.');
    } catch (e) { log('Import failed: ' + e.message, 'err'); }
  };
  reader.readAsText(file);
}

/* ---------- Guild handling ---------- */

function fillGuilds(list, selectId) {
  const sel = $(selectId);
  sel.innerHTML = '';
  list.forEach(g => {
    const o = document.createElement('option');
    o.value = g.id;
    o.textContent = g.name;
    sel.appendChild(o);
  });
  if (!list.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '— bot not in any server —';
    sel.appendChild(o);
  }
  return sel;
}

async function refreshGuilds() {
  if (!botReady) { log('Bot is not ready yet.', 'err'); return; }
  guilds = await api.listGuilds();
  fillGuilds(guilds, 'guildSelect');
  fillGuilds(guilds, 'ytGuild');
}

/* ---------- Setup ---------- */

async function init() {
  const settings = await api.getSettings();
  if (settings.botToken) log('Saved encrypted bot token found - click Start to reconnect.');
  if (settings.lastGuildId) log('Last used server id: ' + settings.lastGuildId);

  document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));
  document.querySelectorAll('.link').forEach(a => {
    a.onclick = (e) => { e.preventDefault(); api.openExternal(a.dataset.url); };
  });

  $('startBot').onclick = async () => {
    const token = $('tokenInput').value.trim();
    if (!token) { log('Paste a bot token first.', 'err'); return; }
    $('startBot').disabled = true;
    setStatusText('botStatusText', 'Connecting...');
    setDot('botDot', 'connecting');
    const res = await api.startBot(token);
    if (res.ok) { log('Bot started.'); await refreshGuilds(); }
    else log('Start failed: ' + res.error, 'err');
    $('startBot').disabled = false;
  };

  $('stopBot').onclick = async () => {
    await api.stopBot();
    botReady = false;
    setStatusText('botStatusText', 'Bot offline');
    setDot('botDot', 'off');
    $('inviteBtn').disabled = true;
    log('Bot stopped.');
  };

  $('inviteBtn').onclick = async () => {
    const r = await api.getInvite();
    if (!r.ok) { log(r.error, 'err'); return; }
    api.openExternal(r.url);
    log('Invite link opened in browser. Pick your server and authorize.');
  };

  /* builder */
  $('addCategory').onclick = addCategory;
  $('serverName').oninput = () => { state.serverName = $('serverName').value; };
  $('refreshGuilds').onclick = refreshGuilds;
  $('youtuberTpl').onclick = () => { state = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE)); renderEditor(); };
  $('noFrills').onclick = () => { state = JSON.parse(JSON.stringify(BASIC_TEMPLATE)); renderEditor(); };
  $('exportJson').onclick = exportJson;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  fileInput.onchange = (e) => { if (e.target.files[0]) importJson(e.target.files[0]); };
  document.body.appendChild(fileInput);
  $('importJson').onclick = () => fileInput.click();

  $('buildBtn').onclick = async () => {
    const guildId = $('guildSelect').value;
    if (!guildId) { log('Select a target server first.', 'err'); return; }
    state.serverName = $('serverName').value;
    $('buildBtn').disabled = true;
    $('buildProgress').textContent = 'Building... this can take a while.';
    try {
      const report = await api.buildServer(guildId, state);
      $('buildProgress').textContent = `Done: ${report.steps} steps, ${report.errors} errors.`;
      const box = $('buildReport');
      box.classList.remove('hidden');
      box.innerHTML = '';
      report.created.forEach(c => { const d = document.createElement('div'); d.className = 'ok'; d.textContent = '✓ ' + c; box.appendChild(d); });
      report.reused.forEach(c => { const d = document.createElement('div'); d.textContent = '↻ ' + c; box.appendChild(d); });
      report.fail.forEach(c => { const d = document.createElement('div'); d.className = 'err'; d.textContent = '✗ ' + c; box.appendChild(d); });
      log('Build complete with ' + report.errors + ' error(s).');
    } catch (e) {
      $('buildProgress').textContent = 'Build failed.';
      log('Build error: ' + e.message, 'err');
    }
    $('buildBtn').disabled = false;
  };

  /* youtube */
  $('ytStart').onclick = async () => {
    const opts = {
      channel: $('ytChannel').value.trim(),
      guildId: $('ytGuild').value,
      channelName: $('ytChannelName').value.trim() || 'announcements',
      role: $('ytRole').value.trim(),
      intervalMin: parseInt($('ytInterval').value) || 10
    };
    if (!opts.channel) { log('Enter a YouTube channel URL.', 'err'); return; }
    if (!opts.guildId) { log('Select a server for notifications.', 'err'); return; }
    const r = await api.startNotifier(opts);
    if (r.ok) log('Notifier started.');
    else log('Notifier failed: ' + r.error, 'err');
  };
  $('ytStop').onclick = async () => { await api.stopNotifier(); log('Notifier stopped.'); };

  api.onLog(m => {
    log(m, m.includes('error') || m.includes('failed') ? 'err' : m.startsWith('✓') ? 'ok' : '');
  });

  api.onBotStatus(s => {
    botReady = s === 'ready';
    $('inviteBtn').disabled = !botReady;
    setDot('botDot', s === 'ready' ? 'on' : s === 'connecting' ? 'connecting' : s === 'error' ? 'error' : 'off');
    setStatusText('botStatusText',
      s === 'ready' ? 'Bot online' :
      s === 'connecting' ? 'Connecting...' :
      s === 'error' ? 'Bot error' : 'Bot offline');
    if (s === 'ready') { refreshGuilds(); }
  });

  api.onNotifierStatus(s => {
    setDot('ytDot', s === 'running' ? 'on' : s === 'error' ? 'error' : 'off');
    setStatusText('ytStatusText',
      s === 'running' ? 'Notifier on' :
      s === 'error' ? 'Notifier error' : 'Notifier off');
  });

  renderEditor();
  switchTab('setup');
}

init();