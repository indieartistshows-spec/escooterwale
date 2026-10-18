/* tools/serve.js <port> [dir]  |  tiny static server for builds and screenshots (clean URLs like Vercel) */
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(__dirname, '..'), port = +process.argv[2] || 8877;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2' };
http.createServer((req, rsp) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { rsp.writeHead(403); return rsp.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = fs.existsSync(path.join(f, 'index.html')) || !fs.existsSync(f + '.html') ? path.join(f, 'index.html') : f + '.html';
  if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f)) { rsp.writeHead(404); return rsp.end('not found'); }
  const type = TYPES[path.extname(f)] || 'application/octet-stream';
  // compress text like Vercel does, so local speed audits match production
  if (/text|javascript|json|svg/.test(type) && /\bbr\b/.test(req.headers['accept-encoding'] || '')) {
    rsp.writeHead(200, { 'content-type': type, 'content-encoding': 'br' });
    return fs.createReadStream(f).pipe(zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } })).pipe(rsp);
  }
  rsp.writeHead(200, { 'content-type': type });
  fs.createReadStream(f).pipe(rsp);
}).listen(port, '127.0.0.1');
