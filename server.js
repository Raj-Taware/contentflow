#!/usr/bin/env node
// ContentFlow — zero-dependency Node server: static files + JSON item API.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 4321;
const ROOT = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { items: [] };
  }
}

let data = loadData();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }, 100);
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => {
      buf += c;
      if (buf.length > 1e6) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { reject(e); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // API
  if (url.pathname.startsWith('/api/')) {
    try {
      if (url.pathname === '/api/items' && req.method === 'GET') {
        return sendJSON(res, 200, data.items);
      }
      if (url.pathname === '/api/items' && req.method === 'POST') {
        const body = await readBody(req);
        const item = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          title: (body.title || '').trim(),
          url: (body.url || '').trim(),
          type: body.type || 'article',
          tags: Array.isArray(body.tags) ? body.tags : [],
          priority: body.priority || 'normal',
          status: 'queue',
          addedAt: new Date().toISOString(),
          doneAt: null,
          thoughts: '',
          draft: '',
          scheduledFor: null,
          postedAt: null,
        };
        if (!item.title) return sendJSON(res, 400, { error: 'title required' });
        data.items.unshift(item);
        save();
        return sendJSON(res, 201, item);
      }
      const m = url.pathname.match(/^\/api\/items\/([^/]+)$/);
      if (m) {
        const item = data.items.find((i) => i.id === m[1]);
        if (!item) return sendJSON(res, 404, { error: 'not found' });
        if (req.method === 'PUT') {
          const body = await readBody(req);
          const allowed = ['title', 'url', 'type', 'tags', 'priority', 'status',
            'doneAt', 'thoughts', 'draft', 'scheduledFor', 'postedAt'];
          for (const k of allowed) if (k in body) item[k] = body[k];
          save();
          return sendJSON(res, 200, item);
        }
        if (req.method === 'DELETE') {
          data.items = data.items.filter((i) => i.id !== m[1]);
          save();
          return sendJSON(res, 200, { ok: true });
        }
      }
      return sendJSON(res, 404, { error: 'unknown endpoint' });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message });
    }
  }

  // Static
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(ROOT, file);
  if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    }
  }
  console.log(`ContentFlow running:`);
  console.log(`  Laptop:  http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  Phone:   http://${ip}:${PORT}  (same wifi)`);
});
