# De4th.build

An Electron desktop app (Windows) that helps YouTubers automate their Discord community setup:

- **Server Builder** — gives your Discord bot a layout (roles, categories, text/voice channels, welcome message) and it creates everything for you.
- **Template editor** — visual editor with a ready-made YouTuber template you can tweak, export, and re-import.
- **YouTube Notifier** — watches your channel (no API key needed, public RSS) and posts a rich embed to a channel whenever you upload. First run sets a baseline so old videos don't spam.

## Built apps (in `dist/`)

| File | What it is |
|------|-----------|
| `De4th.build Setup 1.0.0.exe` | Installer (lets you pick install dir, makes a shortcut) |
| `De4th.build 1.0.0.exe` | Portable exe (runs anywhere, no install) |

## How to use

1. Create a bot at https://discord.com/developers/applications (New Application → Bot → Reset Token).
2. In the app: **Setup tab** → paste the token → **Start bot**.
3. Click **Invite bot to your server** — pick your server when the browser opens.
4. Create an (empty) server on Discord if you don't have one yet, and invite the bot into it.
5. **Server Builder tab** → pick the server, tweak the layout → **Build server now**.
6. **YouTube Notifier tab** → paste your channel URL/@handle, choose the announce channel → **Start notifier**.

> Note: a bot token cannot *create* a brand-new Discord server (Discord only allows that with a user account). The app sets up everything inside a server you create and add the bot to.

## Development

```bash
npm install
npm start        # run in dev
npm run dist     # build installer + portable exe into dist/
```

## Notes

- Your bot token is stored encrypted on your PC (Windows DPAPI). It is only sent to the Discord API.
- `signAndEditExecutable` is disabled in `package.json` so the build works without Code Signing certificates / symlink privileges; the default Electron icon is used.
- The notifier only runs while the app is open.