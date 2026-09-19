const { EmbedBuilder } = require('discord.js');

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

class YouTubeNotifier {
  constructor(client, opts, store) {
    this.client = client;
    this.opts = {
      channel: opts.channel || '',
      apiKey: opts.apiKey || '',
      guildId: opts.guildId || '',
      channelName: opts.channelName || 'announcements',
      intervalMin: Math.max(2, parseInt(opts.intervalMin) || 10),
      message: opts.message || '<@&{role}> **NEW VIDEO!**',
      role: opts.role || ''
    };
    this.store = store;
    this.status = 'stopped';
    this.onLog = () => {};
    this.onStatus = () => {};
    this.timer = null;
    this.lastVideoId = store.get('ytLastVideoId') || null;
    this.resolvedChannelId = null;
  }

  static extractVideoIds(xml) {
    const items = [];
    const re = /<entry>([\s\S]*?)<\/entry>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const vid = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const title = decodeEntities((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      const published = decodeEntities((block.match(/<published>([^<]+)<\/published>/) || [])[1]);
      if (vid) items.push({ id: vid[1], title, published });
    }
    return items;
  }

  async resolveChannelId(input) {
    const src = String(input || '').trim();
    if (!src) return null;
    const direct = src.match(/(UC[\w-]{22})/);
    if (direct) return direct[1];

    let url = src;
    if (!/^https?:\/\//.test(url)) {
      const handle = src.replace(/^@/, '');
      url = `https://www.youtube.com/@${handle}`;
    }
    const page = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    const m = page.match(/"channelId":"(UC[\w-]{22})"/);
    return m ? m[1] : null;
  }

  async fetchLatest() {
    if (!this.resolvedChannelId) {
      this.resolvedChannelId = await this.resolveChannelId(this.opts.channel);
    }
    if (!this.resolvedChannelId) {
      this.onStatus('error');
      throw new Error('Could not resolve YouTube channel. Use the full channel URL or a UC... ID.');
    }
    const feed = `https://www.youtube.com/feeds/videos.xml?channel_id=${this.resolvedChannelId}`;
    const xml = await (await fetch(feed, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    const items = YouTubeNotifier.extractVideoIds(xml);
    return items.length ? items[0] : null;
  }

  async postVideo(video) {
    const guild = this.client.guilds.cache.get(this.opts.guildId);
    if (!guild) throw new Error('Notifier guild not found. Make sure the bot is in it.');
    await guild.channels.fetch();
    const channel = guild.channels.cache.find((c) => c.name.toLowerCase() === String(this.opts.channelName).toLowerCase());
    if (!channel) throw new Error(`Channel "#${this.opts.channelName}" not found for notifications.`);

    let content = '';
    if (this.opts.role) {
      const role = guild.roles.cache.find((r) => r.name.toLowerCase() === String(this.opts.role).toLowerCase());
      content = role ? `<@&${role.id}>` : '';
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(video.title || 'New video!')
      .setURL(`https://www.youtube.com/watch?v=${video.id}`)
      .setThumbnail(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`)
      .setImage(`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`)
      .setFooter({ text: 'YouTube Notification' })
      .setTimestamp();

    await channel.send({ content, embeds: [embed] });
  }

  async pollOnce(firstRun) {
    try {
      const video = await this.fetchLatest();
      if (!video) {
        this.onLog('No videos found in feed (channel may be empty).');
        return;
      }
      this.onLog(`Latest video: ${video.title}`);

      if (this.lastVideoId === null) {
        this.lastVideoId = video.id;
        this.store.set('ytLastVideoId', video.id);
        if (!firstRun) this.onLog('Synced baseline - new uploads will be announced.');
        else this.onLog('Baseline set - new uploads will be announced.');
        return;
      }
      if (video.id !== this.lastVideoId) {
        this.lastVideoId = video.id;
        this.store.set('ytLastVideoId', video.id);
        await this.postVideo(video);
        this.onLog(`Announced "${video.title}"`);
      } else {
        this.onLog('No new uploads');
      }
    } catch (err) {
      this.onLog(`Notifier error: ${err.message}`);
      this.onStatus('error');
    }
    this.onStatus('running');
  }

  start() {
    this.stop();
    this.status = 'running';
    this.onStatus('running');
    const first = async () => { await this.pollOnce(true); this.timer = setInterval(() => this.pollOnce(false), this.opts.intervalMin * 60000); };
    first();
  }

  stop() {
    this.status = 'stopped';
    this.onStatus('stopped');
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}

module.exports = { YouTubeNotifier };