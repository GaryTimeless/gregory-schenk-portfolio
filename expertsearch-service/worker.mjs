// Fixed, read-only Expert adapter. No arbitrary upstream URLs, cookies or accounts.
const UPSTREAM = 'https://production.brntgs.expert.de';
const TTL = 600;
const normalizeId = value => String(value ?? '').replace(/^e_/, '');
const validMoney = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

class UpstreamError extends Error {
  constructor(status) { super('Die Preisquelle ist momentan nicht erreichbar.'); this.status = status; }
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

export function createHandler({fetchImpl = fetch, cache, now = () => new Date()} = {}) {
  async function readUpstream(path, params) {
    const url = new URL(path, UPSTREAM);
    url.search = new URLSearchParams(params).toString();
    const response = await fetchImpl(url.toString(), {
      headers: {Accept: 'application/json'}, redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new UpstreamError(response.status);
    const body = await response.text();
    if (body.length > 1000000) throw new UpstreamError(502);
    try { return JSON.parse(body); } catch { throw new UpstreamError(502); }
  }

  return async function handle(request, env = {}, ctx = {waitUntil() {}}) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://g-schenk.de';
    const origin = request.headers.get('Origin');
    const headers = {'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff'};
    if (origin === allowedOrigin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    }
    const reply = (data, status = 200, extra = {}) =>
      new Response(JSON.stringify(data), {status, headers: {...headers, ...extra}});
    if (origin !== allowedOrigin) return reply({error: 'Diese Anfrage ist nicht freigegeben.'}, 403);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (request.method !== 'GET') return reply({error: 'Nur Leseabfragen sind möglich.'}, 405, {Allow: 'GET, OPTIONS'});
    if (url.pathname !== '/compare') return reply({error: 'Nicht gefunden.'}, 404);
    const webcode = url.searchParams.get('webcode') || '';
    const ids = [...new Set((url.searchParams.get('markets') || '').split(',').map(normalizeId))];
    if (!/^\d{6,15}$/.test(webcode) || !ids.length || ids.length > 5 || ids.some(id => !/^\d{1,12}$/.test(id))) {
      return reply({error: 'Bitte ein gültiges Produkt und höchstens fünf Märkte je Abfrage angeben.'}, 400);
    }
    // Deployment fails closed unless its request-limiting binding is configured.
    if (!env.REQUEST_LIMITER?.limit) return reply({error: 'Die Live-Suche wird noch eingerichtet.'}, 503);
    try {
      const {success} = await env.REQUEST_LIMITER.limit({key: 'expertsearch-public'});
      if (!success) return reply({error: 'Es laufen gerade viele Abfragen. Bitte in einer Minute erneut versuchen.'}, 429, {'Retry-After': '60'});
    } catch { return reply({error: 'Die Live-Suche ist vorübergehend nicht verfügbar.'}, 503); }
    const markets = [];
    for (const id of ids) {
      const key = new Request(`${url.origin}/cached-market/v1/${webcode}/${id}`);
      const stored = cache && await cache.match(key);
      if (stored) {
        const value = await stored.json();
        // Do not trust a development cache or stale cache implementation blindly.
        const age = now().getTime() - Date.parse(value.retrieved_at);
        if (age >= 0 && age < TTL * 1000) { markets.push({...value, cached: true}); continue; }
      }
      try {
        const store = await readUpstream('/api/store', {storeId: `e_${id}`});
        const payload = await readUpstream('/api/pricepds', {webcode, storeId: `e_${id}`});
        const result = parseMarket(store, payload, id, webcode, now().toISOString());
        markets.push(result);
        if (cache && result.status !== 'error') {
          ctx.waitUntil(cache.put(key, new Response(JSON.stringify(result), {
            headers: {'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TTL}`},
          })));
        }
      } catch (error) {
        // Stop all further requests on denial, throttling, or a source failure.
        const status = error instanceof UpstreamError && error.status === 429 ? 429 : 502;
        return reply({error: status === 429
          ? 'Die Preisquelle begrenzt gerade Abfragen. Bitte später erneut versuchen.'
          : 'Die Preisquelle antwortet momentan nicht zuverlässig. Bitte später erneut versuchen.',
          markets, retrieved_at: now().toISOString()}, status, status === 429 ? {'Retry-After': '60'} : {});
      }
    }
    return reply({webcode, retrieved_at: now().toISOString(), markets});
  };
}

export default {fetch(request, env, ctx) {
  return createHandler({cache: caches.default})(request, env, ctx);
}};
