/* tools/serve.js <port> [dir]  |  tiny static server for builds and screenshots (clean URLs like Vercel) */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(__dirname, '..'), port = +process.argv[2] || 8877;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2' };
http.createServer((req, rsp) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { rsp.writeHead(403); return rsp.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f)) { rsp.writeHead(404); return rsp.end('not found'); }
  rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(rsp);
}).listen(port, '127.0.0.1');
