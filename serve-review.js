const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const BASE_DIR = path.join(__dirname);

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // Handle POST save-selection (instant auto-save per tap from phone or desktop)
  if (req.method === 'POST' && req.url === '/api/save-selection') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const assetsDir = path.join(BASE_DIR, 'assets');
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

        const selPath = path.join(assetsDir, 'selections.json');
        let current = {};
        if (fs.existsSync(selPath)) {
          try { current = JSON.parse(fs.readFileSync(selPath, 'utf8')); } catch (e) {}
        }
        if (payload.selections) {
          current = { ...current, ...payload.selections };
        } else if (payload.page && payload.code) {
          current[payload.page] = payload.code;
        }

        fs.writeFileSync(selPath, JSON.stringify(current, null, 2));

        if (payload.page && payload.code) {
          const pageStr = String(payload.page).padStart(2, '0');
          const srcFile = path.join(BASE_DIR, 'pages_review', `page_${pageStr}_${payload.code}.png`);
          const destFile = path.join(assetsDir, `page_${pageStr}.png`);
          if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, destFile);
          }
        }

        console.log(`[Auto-Save] Live choice saved: Page ${payload.page} -> Option ${payload.code}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, selections: current }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Handle POST commit-selections
  if (req.method === 'POST' && req.url === '/api/commit-selections') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const selections = JSON.parse(body); // { 1: "a", 2: "b", ... }
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

        fs.writeFileSync(path.join(assetsDir, 'selections.json'), JSON.stringify(selections, null, 2));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, results }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Handle static file serving
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') reqUrl = '/review.html';

  const filePath = path.join(BASE_DIR, decodeURIComponent(reqUrl));

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

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Comic Review Dashboard running at http://localhost:${PORT}/review.html`);
});
