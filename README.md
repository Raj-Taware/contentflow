# ▶ ContentFlow

**Stop hoarding tabs. Start shipping takes.**

A Netflix-style queue for everything you want to read or watch — wired into a writing studio that turns what you consumed into posts for X. Self-hosted, zero dependencies, your data never leaves your machine.

🌐 **[Landing page →](https://raj-taware.github.io/contentflow/)**

---

## Quick start

```bash
git clone https://github.com/Raj-Taware/contentflow.git
cd contentflow
node server.js
```

Open **http://localhost:4321**. That's it — no `npm install`, no database, no config. Requires Node 18+.

### Use it from your phone

The server prints a `Phone: http://192.168.x.x:4321` line on startup. Open that URL on your phone (same wifi), then **Add to Home Screen** — it installs like a native app.

## How to use it

ContentFlow is one loop: **consume → think → publish**.

### 1. Queue — your content backlog
Add anything: articles, videos, papers, threads, podcasts, books. Each gets a link, tags, and a priority. Filter by type, search, high-priority floats to the top. When you finish something, hit **✓ Done**.

### 2. Studio — where consumed content becomes posts
Everything you mark done lands here. Open an item and:

1. **Dump your raw thoughts** — messy is fine, one idea per line works best
2. **Pick an angle** (insight / contrarian / story / question / listicle) and hit **Generate**
3. You get **hooks, bridges, and closers** built from *your own words* — the connective tissue of a good post, not the post itself. ContentFlow never ghostwrites. Your voice stays yours.
4. **Click any line** to drop it into your draft, weave your thoughts between them
5. **Schedule it** with a date, or **✓ Mark posted**

### 3. Reminders — consistency, enforced
Finished something 3+ days ago without writing about it? A banner calls you out at the top of the Studio. That's the feature.

### 4. Scheduled — your publishing calendar
All scheduled drafts sorted by date. Overdue ones flagged red.

## Your data

Everything lives in a single `data.json` file next to the server. Plain JSON — read it, back it up, edit it by hand, sync it with Dropbox. No accounts, no cloud, no telemetry. (`data.json` is gitignored, so your queue never ends up in a commit.)

## Run it on startup (Windows)

Press `Win+R`, type `shell:startup`, and drop in a shortcut with target:

```
node C:\path\to\contentflow\server.js
```

macOS/Linux: add the same command to your login items or a systemd user unit.

## Tech

- **Server:** one file, Node.js standard library only ([server.js](server.js))
- **Frontend:** vanilla JS, no build step ([public/](public))
- **Storage:** one JSON file
- Five files of code you can actually read.

## License

[MIT](LICENSE)
