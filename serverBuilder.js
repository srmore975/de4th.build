const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, Colors } = require('discord.js');

const PERM_MAP = {
  ViewChannel: PermissionFlagsBits.ViewChannel,
  SendMessages: PermissionFlagsBits.SendMessages,
  ManageMessages: PermissionFlagsBits.ManageMessages,
  EmbedLinks: PermissionFlagsBits.EmbedLinks,
  AttachFiles: PermissionFlagsBits.AttachFiles,
  ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
  MentionEveryone: PermissionFlagsBits.MentionEveryone,
  AddReactions: PermissionFlagsBits.AddReactions,
  Connect: PermissionFlagsBits.Connect,
  Speak: PermissionFlagsBits.Speak,
  MoveMembers: PermissionFlagsBits.MoveMembers,
  MuteMembers: PermissionFlagsBits.MuteMembers,
  DeafenMembers: PermissionFlagsBits.DeafenMembers,
  KickMembers: PermissionFlagsBits.KickMembers,
  BanMembers: PermissionFlagsBits.BanMembers,
  Administrator: PermissionFlagsBits.Administrator,
  ManageRoles: PermissionFlagsBits.ManageRoles,
  ManageChannels: PermissionFlagsBits.ManageChannels,
  ManageGuild: PermissionFlagsBits.ManageGuild,
  ManageWebhooks: PermissionFlagsBits.ManageWebhooks,
  CreateInstantInvite: PermissionFlagsBits.CreateInstantInvite,
  ChangeNickname: PermissionFlagsBits.ChangeNickname,
  Stream: PermissionFlagsBits.Stream,
  PrioritySpeaker: PermissionFlagsBits.PrioritySpeaker,
  UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
  UseExternalStickers: PermissionFlagsBits.UseExternalStickers,
  SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
  SendTTSMessages: PermissionFlagsBits.SendTTSMessages,
  SendVoiceMessages: PermissionFlagsBits.SendVoiceMessages,
  UseApplicationCommands: PermissionFlagsBits.UseApplicationCommands
};

class ServerBuilder {
  constructor(token, lastGuildId) {
    this.token = token;
    this.lastGuildId = lastGuildId || null;
    this.status = 'offline';
    this.onStatus = () => {};
    this.onLog = () => {};
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      failIfNotExists: true
    });
  }

  async start(token) {
    if (token) this.token = token;
    this.status = 'connecting';
    this.onStatus('connecting');
    this.client.on('ready', () => {
      this.status = 'ready';
      this.onLog(`Logged in as ${this.client.user.tag}`);
      this.onStatus('ready');
    });
    this.client.on('error', (err) => {
      this.onLog(`Bot error: ${err.message}`);
    });
    await this.client.login(this.token);
    return true;
  }

  stop() {
    this.status = 'offline';
    this.client.destroy();
  }

  getInviteUrl() {
    const clientId = this.client?.user?.id || '';
    if (!clientId) return null;
    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${ServerBuilder.INVITE_PERMISSIONS}&scope=bot`;
  }

  async listGuilds() {
    const list = [];
    for (const g of this.client.guilds.cache.values()) {
      list.push({
        id: g.id,
        name: g.name,
        icon: g.iconURL({ size: 64 })
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  toColor(hex) {
    if (!hex) return null;
    const h = String(hex).replace('#', '').padEnd(6, '0').slice(0, 6);
    const n = parseInt(h, 16);
    return Number.isNaN(n) ? undefined : n;
  }

  async resolveChannelByName(guild, name, type) {
    await guild.channels.fetch();
    return guild.channels.cache.find((c) => c.name.toLowerCase() === String(name).toLowerCase() && c.type === type);
  }

  async resolveRoleByName(guild, name) {
    await guild.roles.fetch();
    return guild.roles.cache.find((r) => r.name.toLowerCase() === String(name).toLowerCase() && !r.managed);
  }

  async sendWelcome(guild, channelName, welcome) {
    const ch = await this.resolveChannelByName(guild, channelName, ChannelType.GuildText);
    if (!ch) throw new Error(`Welcome channel "${channelName}" not found.`);
    const parts = [];
    if (welcome.embed) parts.push({
      color: Colors.Blurple,
      title: welcome.embed.title || 'Welcome!',
      description: welcome.embed.description || '',
      thumbnail: welcome.embed.thumbnail || null,
      image: welcome.embed.image || null,
      footer: { text: welcome.embed.footer || '' }
    });
    await ch.send({ content: welcome.text || '', embeds: parts });
  }

  async build(guildId, layout) {
    const guild = await this.client.guilds.fetch(guildId);
    let steps = 0;
    let errors = 0;
    const created = [];
    const reused = [];
    const fail = [];

    try {
      await guild.channels.fetch();
      await guild.roles.fetch();

      if (layout.serverName) {
        try { await guild.setName(layout.serverName); steps++; created.push(`Server renamed to "${layout.serverName}"`); }
        catch (e) { fail.push(`Rename server: ${e.message}`); errors++; }
      }

      const roleMap = new Map();
      for (const r of layout.roles || []) {
        if (!r.name) continue;
        try {
          let role = await this.resolveRoleByName(guild, r.name);
          if (role) {
            reused.push(`Role "${r.name}" exists, using it.`);
          } else {
            const data = { name: r.name, reason: 'Server Builder' };
            if (r.color) data.color = this.toColor(r.color);
            if (r.hoist) data.hoist = true;
            if (r.mentionable) data.mentionable = true;
            if (r.permissions && r.permissions.length) {
              const ps = [];
              for (const p of r.permissions) {
                const flag = PERM_MAP[p];
                if (flag) ps.push(flag);
              }
              if (ps.length) data.permissions = ps;
            }
            role = await guild.roles.create(data);
            created.push(`Role "${r.name}" created`);
          }
          roleMap.set(r.name, role);
          steps++;
        } catch (e) { fail.push(`Role "${r.name}": ${e.message}`); errors++; }
      }

      for (const cat of layout.categories || []) {
        if (!cat.name) continue;
        try {
          let category = guild.channels.cache.find((c) => c.name.toLowerCase() === cat.name.toLowerCase() && c.type === ChannelType.GuildCategory);
          if (!category) {
            category = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, reason: 'Server Builder' });
            created.push(`Category "${cat.name}" created`);
          } else {
            reused.push(`Category "${cat.name}" exists, using it.`);
          }
          steps++;

          for (const ch of cat.channels || []) {
            if (!ch.name) continue;
            try {
              const type = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
              const lowerName = String(ch.name).toLowerCase();
              let channel = category.children.cache.find((c) => c.name.toLowerCase() === lowerName && c.type === type);
              if (!channel) {
                const data = {
                  name: ch.name,
                  type,
                  parent: category.id,
                  reason: 'Server Builder'
                };
                if (type === ChannelType.GuildText) {
                  if (ch.topic) data.topic = ch.topic;
                  if (ch.nsfw) data.nsfw = true;
                  if (ch.slowmode != null) data.rateLimitPerUser = Math.max(0, Math.min(21600, parseInt(ch.slowmode) || 0));
                } else {
                  if (ch.userLimit != null) data.userLimit = Math.max(0, Math.min(99, parseInt(ch.userLimit) || 0));
                }

                if (ch.private) {
                  data.overwrites = [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: roleMap.get('Moderator')?.id || roleMap.get('mod')?.id, allow: [PermissionFlagsBits.ViewChannel] }
                  ].filter((o) => o.id);
                }
                channel = await guild.channels.create(data);
                created.push(`Channel "#${ch.name}" created in ${cat.name}`);
              } else {
                reused.push(`Channel "#${ch.name}" exists, using it.`);
              }
              steps++;

              if (ch.welcome || layout.welcome) {
                const welcome = layout.welcome || {};
                try {
                  await this.sendWelcome(guild, ch.name, {
                    text: welcome.message || `Welcome to **${layout.serverName || guild.name}**!`,
                    embed: welcome.embed ? {
                      title: welcome.embed.title || `Welcome to ${layout.serverName || guild.name}!`,
                      description: welcome.embed.description || 'Make sure to read the rules and introduce yourself. Enjoy your stay!'
                    } : null
                  });
                  created.push(`Welcome message posted in #${ch.name}`);
                  steps++;
                } catch (e) { fail.push(`Welcome in #${ch.name}: ${e.message}`); errors++; }
              }
            } catch (e) { fail.push(`Channel "#${ch.name}": ${e.message}`); errors++; }
          }
        } catch (e) { fail.push(`Category "${cat.name}": ${e.message}`); errors++; }
      }
    } catch (e) {
      fail.push(`General: ${e.message}`); errors++;
    }

    return {
      steps,
      errors,
      created,
      reused,
      fail
    };
  }
}

ServerBuilder.INVITE_PERMISSIONS = 412317274689;

module.exports = { ServerBuilder };