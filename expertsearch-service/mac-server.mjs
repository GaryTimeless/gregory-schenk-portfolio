// Temporary, loopback-only API. It never serves files from the Mac.
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createHandler} from './worker.mjs';

export function createTemporaryServer({expiresAt, fetchImpl = fetch, now = () => Date.now(),
  maxCalls = 3000, minDelayMs = 250, requestLimit = 60} = {}) {
  if (!Number.isFinite(expiresAt) || expiresAt <= now()) throw new Error('A future expiry is required');
  let calls = 0, busy = 0, lastFetch = 0;
  let fetchQueue = Promise.resolve();
  const requests = [], answers = new Map();
  const cache = {
    async match(key) {
      const entry = answers.get(key.url);
      if (!entry || entry.expires <= now()) { answers.delete(key.url); return undefined; }
      return new Response(entry.body);
    },
    async put(key, response) {
      for (const [k,v] of answers) if (v.expires <= now()) answers.delete(k);
      if (answers.size >= 2000) answers.delete(answers.keys().next().value);
      answers.set(key.url, {body: await response.text(), expires: now() + 600000});
    },
  };
  const limitedFetch = async (url, options) => {
    // Serialize and space all upstream calls, including simultaneous visitors.
    const task = fetchQueue.then(async () => {
      if (now() >= expiresAt || calls >= maxCalls) return new Response('', {status:429});
      const pause = Math.max(0, minDelayMs - (now() - lastFetch));
      if (pause) await new Promise(resolve => setTimeout(resolve, pause));
      calls++; lastFetch = now();
      return fetchImpl(url, options);
    });
    fetchQueue = task.catch(() => {});
    return task;
  };
  const handle = createHandler({fetchImpl: limitedFetch, cache, now: () => new Date(now())});
  const limiter = {async limit() {
    while (requests.length && requests[0] <= now() - 60000) requests.shift();
    if (requests.length >= requestLimit) return {success:false};
    requests.push(now()); return {success:true};
  }};
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if (origin === 'https://g-schenk.de') headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status, data) => {res.writeHead(status, headers);res.end(JSON.stringify(data));};
    if (origin !== 'https://g-schenk.de') {reply(403,{error:'Diese Anfrage ist nicht freigegeben.'});return;}
    if (now() >= expiresAt) {reply(503,{error:'Die vorübergehende Live-Suche ist beendet.'});return;}
    if (req.method === 'GET' && req.url === '/status') {
      reply(200,{available:true,expires_at:new Date(expiresAt).toISOString()});return;
    }
    if (!['GET','OPTIONS'].includes(req.method)) {reply(405,{error:'Nur Leseabfragen sind möglich.'});return;}
    if (busy >= 2) {reply(429,{error:'Es laufen bereits Preisabfragen. Bitte später erneut versuchen.'});return;}
    busy++;
    try {
      const request = new Request(new URL(req.url,'http://127.0.0.1'),{method:req.method,headers:req.headers});
      const result = await handle(request,{REQUEST_LIMITER:limiter},{waitUntil:promise=>promise.catch(()=>{})});
      res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());
    } catch {if (!res.headersSent)reply(502,{error:'Die Suche konnte nicht abgeschlossen werden.'});else res.end();}
    finally {busy--;}
  });
  server.requestTimeout = 180000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const expiresAt = Date.parse(process.env.EXPERTSEARCH_EXPIRES_AT || '');
  const server = createTemporaryServer({expiresAt});
  server.listen(8776,'127.0.0.1',()=>console.log(`ExpertSearch API on loopback :8776, expires ${new Date(expiresAt).toISOString()}`));
  const stop = () => {server.close();server.closeAllConnections();setTimeout(()=>process.exit(0),100).unref();};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
  setTimeout(stop,Math.max(1,expiresAt-Date.now()));
}
