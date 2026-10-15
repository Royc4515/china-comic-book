const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 3456;
const BASE_DIR = path.join(__dirname);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml'
};

// The reader serves optimised WebP copies (assets/web/). When a page variant is picked in the
// review tool the matching copy is rebuilt in the background so the reader never shows a stale page.
function regenerateWeb(pageNumbers) {
  const args = [path.join('scripts', 'optimize-images.mjs'), ...pageNumbers.map((n) => `--page=${n}`)];
  const child = spawn(process.execPath, args, { cwd: BASE_DIR, stdio: 'inherit' });
  child.on('error', (err) => console.warn(`[optimize] could not start: ${err.message}`));
  child.on('exit', (code) => { if (code) console.warn(`[optimize] exited with code ${code} (is "npm install" done?)`); });
}


const MAX_BODY_BYTES = 64 * 1024;
const isPage = (n) => Number.isInteger(n) && n >= 1 && n <= 12;
const isCode = (c) => typeof c === 'string' && /^[a-z]$/.test(c);

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

/** Keeps only { "1".."12": "a".."z" } so user input can never become part of a file path. */
function cleanSelections(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (isPage(Number(k)) && isCode(v)) out[String(Number(k))] = v;
    }
  }
  return out;
}

/** POSTs must come from this server's own pages: a browser on another site sends a different Origin. */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // curl / non-browser clients
  try { return new URL(origin).host === req.headers.host; } catch (err) { return false; }
}

function readJson(req, res, handler) {
  if (!sameOrigin(req)) return sendJson(res, 403, { success: false, error: 'cross-origin request refused' });
  let body = '';
  let size = 0;
  let aborted = false;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      aborted = true;
      sendJson(res, 413, { success: false, error: 'payload too large' });
      req.destroy();
      return;
    }
    body += chunk;
  });
  req.on('end', () => {
    if (aborted) return;
    try {
      handler(JSON.parse(body));
    } catch (err) {
      sendJson(res, err instanceof SyntaxError ? 400 : 500, { success: false, error: err.message });
    }
  });
}

const server = http.createServer((req, res) => {
  // Handle POST save-selection (instant auto-save per tap from phone or desktop)
  if (req.method === 'POST' && req.url === '/api/save-selection') {
    readJson(req, res, (payload) => {
      const assetsDir = path.join(BASE_DIR, 'assets');
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

      const selPath = path.join(assetsDir, 'selections.json');
      let current = {};
      if (fs.existsSync(selPath)) {
        try { current = JSON.parse(fs.readFileSync(selPath, 'utf8')); } catch (e) { /* start fresh */ }
      }
      const page = Number(payload.page);
      const code = payload.code;
      const hasChoice = isPage(page) && isCode(code);
      if (payload.selections) current = { ...current, ...cleanSelections(payload.selections) };
      else if (hasChoice) current[String(page)] = code;
      else return sendJson(res, 400, { success: false, error: 'page must be 1-12 and code a single letter' });

      fs.writeFileSync(selPath, JSON.stringify(current, null, 2));

      if (hasChoice) {
        const pageStr = String(page).padStart(2, '0');
        const srcFile = path.join(BASE_DIR, 'pages_review', `page_${pageStr}_${code}.png`);
        const destFile = path.join(assetsDir, `page_${pageStr}.png`);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, destFile);
          regenerateWeb([page]);
        }
      }

      console.log(`[Auto-Save] Live choice saved: Page ${hasChoice ? page : '(batch)'} -> Option ${hasChoice ? code : '-'}`);
      sendJson(res, 200, { success: true, selections: current });
    });
    return;
  }

  // Handle POST commit-selections
  if (req.method === 'POST' && req.url === '/api/commit-selections') {
    readJson(req, res, (raw) => {
      const selections = cleanSelections(raw); // { 1: "a", 2: "b", ... }
      const assetsDir = path.join(BASE_DIR, 'assets');
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

      const results = [];
      for (let i = 1; i <= 12; i++) {
        const pageStr = String(i).padStart(2, '0');
        const choice = selections[i] || 'a';
        const srcFile = path.join(BASE_DIR, 'pages_review', `page_${pageStr}_${choice}.png`);
        const destFile = path.join(assetsDir, `page_${pageStr}.png`);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, destFile);
          results.push({ page: i, choice, file: `page_${pageStr}.png`, status: 'copied' });
        }
      }
      if (results.length) regenerateWeb(results.map((r) => r.page));

      fs.writeFileSync(path.join(assetsDir, 'selections.json'), JSON.stringify(selections, null, 2));
      sendJson(res, 200, { success: true, results });
    });
    return;
  }

  // Handle static file serving
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') reqUrl = '/review.html';

  let filePath;
  try {
    filePath = path.resolve(BASE_DIR, '.' + decodeURIComponent(reqUrl));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  // The server listens on the LAN (for phone testing): never serve anything outside the project.
  if (filePath !== BASE_DIR && !filePath.startsWith(BASE_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // Byte ranges: iOS Safari will not play <audio>/<video> from a server that ignores them.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    const size = stat.size;
    let start = range[1] ? Number(range[1]) : Math.max(size - Number(range[2]), 0);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Comic Review Dashboard running at http://localhost:${PORT}/review.html`);
});
