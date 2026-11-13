import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler, parseMarket} from './worker.mjs';

const stamp = '2026-11-13T10:00:00.000Z';
const store = {id: 'e_1906832', name: 'expert Hoffmann', city: 'Köln'};
const payload = {webcode: '36411100248', store: 'e_1906832',
  price: {storeId: '1906832', bruttoPrice: 399, onlineAvailability: 'AVAILABLE',
    shipmentArray: [{shipmentType: 'PKG', shipmentBruttoPrice: 0, shipmentCurrency: 'EUR'}]},
  promotionPrice: {checkoutPrice: 354.9}};
const env = {ALLOWED_ORIGIN: 'https://g-schenk.de', REQUEST_LIMITER: {limit: async () => ({success: true})}};
const request = (query = '?webcode=36411100248&markets=1906832', headers = {Origin: env.ALLOWED_ORIGIN}) =>
  new Request('https://service.example/compare' + query, {headers});

test('maps final direct-discount price, separate shipping, and confirmed market', () => {
  const value = parseMarket(store, payload, '1906832', '36411100248', stamp);
  assert.equal(value.status, 'ok'); assert.equal(value.gross_price, 354.9);
  assert.equal(value.base_price, 399); assert.equal(value.shipping[0].gross, 0);
  assert.equal(value.currency, 'EUR');
});
test('a different product or missing price never becomes a bargain', () => {
  assert.equal(parseMarket(store, {...payload, webcode: '99999999999'}, '1906832', '36411100248', stamp).status, 'error');
  for (const bruttoPrice of [null, true, 0, -1, Infinity, NaN]) {
    const value = parseMarket(store, {...payload, price: {...payload.price, bruttoPrice}}, '1906832', '36411100248', stamp);
    assert.equal(value.status, 'error'); assert.equal(value.gross_price, null);
  }
});
test('different outer or inner market is unconfirmed', () => {
  for (const changed of [{...payload, store: 'e_999'}, {...payload, price: {...payload.price, storeId: '999'}}]) {
    assert.equal(parseMarket(store, changed, '1906832', '36411100248', stamp).status, 'unconfirmed');
  }
});
test('unknown shipping stays unknown rather than free', () => {
  const value = parseMarket(store, {...payload, price: {...payload.price, shipmentArray: null}}, '1906832', '36411100248', stamp);
  assert.deepEqual(value.shipping, []); assert.equal(value.currency, null);
});
test('hostile origins, write requests, arbitrary products and oversized batches never reach Expert', async () => {
  let calls = 0;
  const handle = createHandler({fetchImpl: async () => { calls++; throw Error(); }});
  assert.equal((await handle(request('', {Origin: 'https://evil.example'}), env)).status, 403);
  assert.equal((await handle(new Request('https://service.example/compare', {method: 'POST', headers: {Origin: env.ALLOWED_ORIGIN}}), env)).status, 405);
  for (const query of ['?webcode=https://evil.example&markets=1', '?webcode=36411100248&markets=1,2,3,4,5,6', '?webcode=36411100248&markets=../../etc']) {
    assert.equal((await handle(request(query), env)).status, 400);
  }
  assert.equal(calls, 0);
});
test('service fails closed without limiter and respects throttling', async () => {
  let calls = 0;
  const handle = createHandler({fetchImpl: async () => {calls++;}});
  assert.equal((await handle(request(), {})).status, 503);
  const response = await handle(request(), {...env, REQUEST_LIMITER: {limit: async () => ({success: false})}});
  assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(calls, 0);
});
test('fixed upstream URLs and CORS response, no cookie forwarding', async () => {
  const calls = [];
  const handle = createHandler({now: () => new Date(stamp), fetchImpl: async (url, options) => {
    calls.push({url, options});
    return Response.json(url.includes('/api/store?') ? store : payload);
  }});
  const response = await handle(request(), env);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGIN);
  assert.equal((await response.json()).markets[0].gross_price, 354.9);
  assert.equal(calls.length, 2);
  for (const call of calls) {assert.equal(new URL(call.url).origin, 'https://production.brntgs.expert.de'); assert.equal(call.options.redirect, 'error'); assert.equal(call.options.headers.Cookie, undefined);}
});
test('upstream throttling stops the batch without retrying or requesting the next market', async () => {
  let calls = 0;
  const handle = createHandler({fetchImpl: async () => {calls++; return new Response('', {status: 429});}});
  assert.equal((await handle(request('?webcode=36411100248&markets=1906832,1907031'), env)).status, 429);
  assert.equal(calls, 1);
});
test('cached market keeps its actual retrieval date and avoids upstream requests', async () => {
  const value = parseMarket(store, payload, '1906832', '36411100248', stamp);
  const handle = createHandler({now: () => new Date('2026-11-13T10:05:00Z'), cache: {match: async () => Response.json(value)},
    fetchImpl: async () => {throw Error('must not fetch');}});
  const response = await handle(request(), env);
  const result = (await response.json()).markets[0];
  assert.equal(result.retrieved_at, stamp); assert.equal(result.cached, true);
});
