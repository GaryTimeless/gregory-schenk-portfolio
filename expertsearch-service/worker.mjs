// Fixed, read-only Expert adapter. No arbitrary upstream URLs, cookies or accounts.
const UPSTREAM = 'https://production.brntgs.expert.de';
const TTL = 600;
const normalizeId = value => String(value ?? '').replace(/^e_/, '');
const validMoney = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

class UpstreamError extends Error {
  constructor(status, path, code = 'UPSTREAM_HTTP') { super('Die Preisquelle ist momentan nicht erreichbar.'); this.status = status; this.path = path; this.code = code; }
}

export function parseMarket(store, payload, id, webcode, retrievedAt) {
  const result = {
    market_id: id, market_name: null, market_city: null, status: 'error',
    identity_confirmed: false, gross_price: null, currency: null, shipping: [],
    availability_online: null, availability_store: null, retrieved_at: retrievedAt,
    webcode, error: null, notes: [],
    price_source: `${UPSTREAM}/api/pricepds?webcode=${webcode}&storeId=e_${id}`,
  };
  if (!store || normalizeId(store.id) !== id || typeof store.name !== 'string') {
    result.error = 'Der Markt konnte nicht eindeutig bestätigt werden.';
    return result;
  }
  result.market_name = store.name;
  result.market_city = typeof store.city === 'string' ? store.city : null;
  const price = payload?.price;
  if (String(payload?.webcode ?? '') !== webcode || !price) {
    result.error = 'Die Preisantwort gehört nicht eindeutig zum gesuchten Produkt.';
    return result;
  }
  if (!validMoney(price.bruttoPrice) || price.bruttoPrice <= 0) {
    result.error = 'Für dieses Produkt ist kein gültiger Preis verfügbar.';
    return result;
  }
  // checkoutPrice includes direct discounts when supplied; cashback stays separate.
  const checkout = payload.promotionPrice?.checkoutPrice;
  result.gross_price = validMoney(checkout) && checkout > 0 ? checkout : price.bruttoPrice;
  result.price_kind = result.gross_price === checkout ? 'checkoutPrice' : 'bruttoPrice';
  result.base_price = price.bruttoPrice;
  result.availability_online = typeof price.onlineAvailability === 'string' ? price.onlineAvailability : null;
  result.availability_store = typeof price.storeAvailability === 'string' ? price.storeAvailability : null;
  result.on_display = price.itemOnDisplay?.onDisplay === true;
  result.shipping = (Array.isArray(price.shipmentArray) ? price.shipmentArray : [])
    .filter(s => s && validMoney(s.shipmentBruttoPrice) && typeof s.shipmentCurrency === 'string')
    .map(s => ({type: typeof s.shipmentType === 'string' ? s.shipmentType : null,
      gross: s.shipmentBruttoPrice, currency: s.shipmentCurrency}));
  const currencies = new Set(result.shipping.map(s => s.currency));
  result.currency = typeof price.currency === 'string' ? price.currency
    : currencies.size === 1 ? result.shipping[0].currency : null;
  const matches = normalizeId(payload.store) === id
    && (price.storeId == null || normalizeId(price.storeId) === id);
  result.identity_confirmed = matches;
  result.status = matches ? 'ok' : 'unconfirmed';
  if (!matches) result.notes.push('Die Marktzuordnung in der Preisantwort ist nicht eindeutig.');
  return result;
}

export function createHandler({fetchImpl = fetch, cache, now = () => new Date(), log = () => {},
  upstreamTimeoutMs = 6000, batchTimeoutMs = 30000} = {}) {
  const emit = data => {try {log({at:now().toISOString(),...data});}catch { /* Logging must not break searches. */ }};
  async function readUpstream(path, params, batchSignal, requestSignal) {
    const url = new URL(path, UPSTREAM);
    url.search = new URLSearchParams(params).toString();
    try {
      const response = await fetchImpl(url.toString(), {
        headers: {Accept:'application/json'}, redirect:'error',
        signal:AbortSignal.any([AbortSignal.timeout(upstreamTimeoutMs),batchSignal,requestSignal]),
      });
      if (!response.ok) throw new UpstreamError(response.status,path,
        response.headers.get('x-expertsearch-error') === 'SESSION_BUDGET' ? 'SESSION_BUDGET' : 'UPSTREAM_HTTP');
      const body = await response.text();
      if (body.length > 1000000) throw new UpstreamError(502,path,'UPSTREAM_BODY_LIMIT');
      try {return JSON.parse(body);} catch {throw new UpstreamError(502,path,'UPSTREAM_INVALID_JSON');}
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      const wrapped = new UpstreamError(null,path,error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK');
      wrapped.reason = error?.cause?.code || error?.code || error?.name || 'unknown';
      throw wrapped;
    }
  }
  return async function handle(request, env = {}, ctx = {waitUntil() {}}) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://g-schenk.de';
    const origin = request.headers.get('Origin');
    const requestId = globalThis.crypto?.randomUUID?.() || String(Date.now());
    const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
      'Vary':'Origin','X-Content-Type-Options':'nosniff','X-Request-Id':requestId};
    if (origin === allowedOrigin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    }
    const started = Date.now();
    const reply = (data,status=200,extra={}) => {
      emit({event:'compare_response',request_id:requestId,http_status:status,
        duration_ms:Date.now()-started,market_count:data.markets?.length || 0,error_code:data.error_code || null});
      return new Response(JSON.stringify({...data,request_id:requestId}),{status,headers:{...headers,...extra}});
    };
    if (origin !== allowedOrigin) return reply({error:'Diese Anfrage ist nicht freigegeben.',error_code:'ORIGIN_FORBIDDEN'},403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'GET') return reply({error:'Nur Leseabfragen sind möglich.'},405,{Allow:'GET, OPTIONS'});
    if (url.pathname !== '/compare') return reply({error:'Nicht gefunden.'},404);
    const webcode = url.searchParams.get('webcode') || '';
    const ids = [...new Set((url.searchParams.get('markets') || '').split(',').map(normalizeId))];
    if (!/^\d{6,15}$/.test(webcode) || !ids.length || ids.length > 5 || ids.some(id => !/^\d{1,12}$/.test(id)))
      return reply({error:'Bitte ein gültiges Produkt und höchstens fünf Märkte je Abfrage angeben.'},400);
    if (!env.REQUEST_LIMITER?.limit) return reply({error:'Die Live-Suche wird noch eingerichtet.'},503);
    try {
      if (!(await env.REQUEST_LIMITER.limit({key:'expertsearch-public'})).success)
        return reply({error:'Es laufen gerade viele Abfragen. Bitte in einer Minute erneut versuchen.',error_code:'REQUEST_LIMIT'},429,{'Retry-After':'60'});
    } catch {return reply({error:'Die Live-Suche ist vorübergehend nicht verfügbar.'},503);}
    const markets = [];
    const batchSignal = AbortSignal.timeout(batchTimeoutMs);
    for (const id of ids) {
      if (request.signal.aborted) return reply({error:'Suche abgebrochen.',error_code:'CLIENT_ABORT'},499);
      const key = new Request(`${url.origin}/cached-market/v2/${webcode}/${id}`);
      try {
        const stored = cache && await cache.match(key);
        if (stored) {
          const value = await stored.json();
          const age = now().getTime()-Date.parse(value.retrieved_at);
          if (age >= 0 && age < TTL*1000) {markets.push({...value,cached:true});continue;}
        }
      } catch { /* A broken cache is a cache miss, not a failed comparison. */ }
      const marketStarted = Date.now();
      try {
        if (batchSignal.aborted) throw new UpstreamError(null,null,'BATCH_TIMEOUT');
        const store = await readUpstream('/api/store',{storeId:`e_${id}`},batchSignal,request.signal);
        const payload = await readUpstream('/api/pricepds',{webcode,storeId:`e_${id}`},batchSignal,request.signal);
        const result = parseMarket(store,payload,id,webcode,now().toISOString());
        result.retryable = false;
        markets.push(result);
        emit({event:'market_result',request_id:requestId,webcode,market_id:id,status:result.status,duration_ms:Date.now()-marketStarted});
        if (cache && result.status !== 'error') {
          ctx.waitUntil(cache.put(key,new Response(JSON.stringify(result),{
            headers:{'Content-Type':'application/json','Cache-Control':`public, max-age=${TTL}`},
          })).catch(()=>{}));
        }
      } catch (error) {
        const code = error.code || 'UPSTREAM_FAILURE';
        emit({event:'market_error',request_id:requestId,webcode,market_id:id,
          upstream_path:error.path || null,upstream_status:error.status ?? null,error_code:code,
          reason:error.reason || null,duration_ms:Date.now()-marketStarted});
        // Respect source access denials and throttling. Do not work around them.
        if (error.status === 403 || error.status === 429) return reply({
          error:error.status === 403 ? 'Die Preisquelle hat die Abfrage abgewiesen. Bitte später erneut versuchen.'
            : code === 'SESSION_BUDGET' ? 'Die Abfragegrenze dieser Sitzung ist erreicht.' : 'Die Preisquelle begrenzt gerade Abfragen. Bitte später erneut versuchen.',
          error_code:code,markets,retrieved_at:now().toISOString(),
        },error.status,error.status === 429 ? {'Retry-After':'60'} : {});
        // A DNS/socket failure affects the source connection, not one store.
        if (code === 'UPSTREAM_NETWORK') return reply({error:'Die Verbindung zur Preisquelle ist unterbrochen. Bereits geladene Ergebnisse bleiben erhalten.',
          error_code:code,markets,retrieved_at:now().toISOString()},503);
        // Missing stores/products, invalid responses and timeouts are explicit
        // per-market failures. Every other requested market is still processed.
        markets.push({market_id:id,webcode,market_name:null,market_city:null,status:'error',identity_confirmed:false,
          gross_price:null,currency:null,shipping:[],availability_online:null,availability_store:null,
          retrieved_at:now().toISOString(),error:error.status === 404 ? 'Dieser Markt oder Artikel wurde nicht gefunden.'
            : 'Dieser Markt konnte nicht zuverlässig abgefragt werden.',error_code:code,upstream_status:error.status ?? null,
          retryable:code === 'UPSTREAM_TIMEOUT' || code === 'BATCH_TIMEOUT' || (error.status >= 500 && code === 'UPSTREAM_HTTP'),notes:[]});
      }
    }
    return reply({webcode,retrieved_at:now().toISOString(),markets});
  };
}

export default {fetch(request, env, ctx) {
  return createHandler({cache: caches.default})(request, env, ctx);
}};
