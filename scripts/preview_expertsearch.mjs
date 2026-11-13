// Local QA only: serves _site and the Worker adapter, with a strict live-request cap.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHandler} from '../expertsearch-service/worker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../_site');
const port = 8774;
const origin = `http://127.0.0.1:${port}`;
const fixtures = process.argv.includes('--fixtures');
const snapshot = JSON.parse(await readFile(path.join(root, 'expertsearch/snapshot.json'), 'utf8'));
let upstreamCalls = 0;
const handle = createHandler({fetchImpl: async (url, options) => {
  if (++upstreamCalls > 20) return new Response('', {status: 429});
  if (!fixtures) return fetch(url, options);
  const id = new URL(url).searchParams.get('storeId').replace(/^e_/, '');
  const market = snapshot.markets.find(m => m.market_id === id);
  if (!market) return new Response('', {status: 404});
  if (new URL(url).pathname === '/api/store') return Response.json({id: `e_${id}`, name: market.market_name, city: market.market_city});
  return Response.json({webcode: snapshot.webcode, store: `e_${id}`, price: {
    storeId: market.status === 'unconfirmed' ? '1906888' : id, bruttoPrice: market.gross_price,
    onlineAvailability: market.availability_online, storeAvailability: market.availability_store,
    shipmentArray: market.shipping.map(s => ({shipmentType: s.type, shipmentBruttoPrice: s.gross, shipmentCurrency: s.currency})),
  }});
}});
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.pathname === '/expertsearch/config.json') {
      const config = JSON.parse(await readFile(path.join(root, 'expertsearch/config.json'), 'utf8'));
      config.apiBase = '/expertsearch/api';
      res.writeHead(200, {'Content-Type': types['.json'], 'Cache-Control': 'no-store'}); res.end(JSON.stringify(config)); return;
    }
    if (url.pathname.startsWith('/expertsearch/api/')) {
      const target = new URL(url); target.pathname = url.pathname.replace('/expertsearch/api', '');
      const headers = new Headers(req.headers); if (!headers.has('Origin')) headers.set('Origin', origin);
      const result = await handle(new Request(target, {method: req.method, headers}), {
        ALLOWED_ORIGIN: origin, REQUEST_LIMITER: {limit: async () => ({success: true})},
      });
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text()); return;
    }
    const suffix = url.pathname.endsWith('/') ? 'index.html' : '';
    const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname) + suffix);
    if (!filename.startsWith(root + path.sep)) {res.writeHead(403); res.end(); return;}
    const body = await readFile(filename);
    res.writeHead(200, {'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); res.end(body);
  } catch { res.writeHead(404); res.end('Nicht gefunden.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`${origin}/expertsearch/ (${fixtures ? 'fixture QA, not live data' : 'live QA, max 20 upstream calls'})`));
