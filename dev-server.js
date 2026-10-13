// Локальний сервер для перегляду вітрини: node dev-server.js  (http://localhost:3000)
// Віддає web/index.html і виконує web/api/order.js так само, як Vercel.
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PORT = process.env.PORT || 3000;
const WEB = path.join(__dirname, 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    const file = path.join(WEB, url.pathname + '.js');
    if (!file.startsWith(WEB) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    try {
      const mod = await import(pathToFileURL(file).href + '?t=' + Date.now());
      await mod.default(req, res);
    } catch (e) { console.error(e); res.statusCode = 500; res.end('error'); }
    return;
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname;
  const file = path.join(WEB, rel);
  if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Вітрина: http://localhost:${PORT}`));
