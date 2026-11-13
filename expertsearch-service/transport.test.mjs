import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {BatchError, fetchBatch, abortableSleep} from '../expertsearch/transport.mjs';

const apiBase = 'https://service.example';
const webcode = '36411100248';
const marketIds = ['1906832', '1907031'];

function report(ids = marketIds, overrides = {}) {
  return {
    webcode,
    retrieved_at: '2026-11-13T10:00:00.000Z',
    markets: ids.map((id) => ({market_id: id, status: 'ok', identity_confirmed: true, gross_price: 399})),
    ...overrides,
  };
}

function isBatchError(kind, status, retryable) {
  return (err) => {
    assert.ok(err instanceof BatchError, `expected BatchError, got ${err?.constructor?.name}`);
    assert.equal(err.kind, kind);
    assert.equal(err.status, status);
    assert.equal(err.retryable, retryable);
    return true;
  };
}

test('Netzfehler dann Erfolg: genau ein Retry nach 1500ms und unveränderter Bericht', async () => {
  let calls = 0;
  const retries = [];
  const expected = report();
  const result = await fetchBatch({
    apiBase,
    webcode,
    marketIds,
    sleep: async () => {},
    onRetry: (info) => retries.push(info),
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('Load failed');
      return Response.json(expected);
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(retries, [{attempt: 2, delayMs: 1500}]);
  assert.deepEqual(result, expected);
});

test('HTTP 502 dann Erfolg: genau ein Retry', async () => {
  let calls = 0;
  const retries = [];
  const result = await fetchBatch({
    apiBase,
    webcode,
    marketIds,
    sleep: async () => {},
    onRetry: (info) => retries.push(info),
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return new Response('', {status: 502});
      return Response.json(report());
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(retries, [{attempt: 2, delayMs: 1500}]);
  assert.deepEqual(result, report());
});

test('dauerhafter HTTP 502 macht genau 2 Requests und endet als gateway-Fehler', async () => {
  let calls = 0;
  const retries = [];
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      sleep: async () => {},
      onRetry: (info) => retries.push(info),
      fetchImpl: async () => {
        calls += 1;
        return new Response('', {status: 502});
      },
    }),
    (err) => {
      isBatchError('gateway', 502, true)(err);
      assert.match(err.message, /502/);
      return true;
    },
  );
  assert.equal(calls, 2);
  assert.deepEqual(retries, [{attempt: 2, delayMs: 1500}]);
});

test('HTTP 403 wird nicht wiederholt und ist forbidden', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      sleep: async () => assert.fail('sleep must not be called'),
      fetchImpl: async () => {
        calls += 1;
        return new Response('', {status: 403});
      },
    }),
    (err) => {
      isBatchError('forbidden', 403, false)(err);
      assert.match(err.message, /403/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('HTTP 429 wird nicht wiederholt und ist throttled', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      sleep: async () => assert.fail('sleep must not be called'),
      fetchImpl: async () => {
        calls += 1;
        return new Response('', {status: 429});
      },
    }),
    (err) => {
      isBatchError('throttled', 429, false)(err);
      assert.match(err.message, /429/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('Abbruch während des Fetch endet als aborted ohne Retry', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      signal: controller.signal,
      sleep: async () => assert.fail('sleep must not be called'),
      fetchImpl: async () => {
        calls += 1;
        controller.abort();
        throw controller.signal.reason;
      },
    }),
    isBatchError('aborted', null, false),
  );
  assert.equal(calls, 1);
});

test('Abbruch während der Wartezeit endet als aborted ohne zweiten Request', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      signal: controller.signal,
      sleep: (ms, signal) => new Promise((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, {once: true});
        setTimeout(() => controller.abort(), 5);
      }),
      fetchImpl: async () => {
        calls += 1;
        return new Response('', {status: 502});
      },
    }),
    isBatchError('aborted', null, false),
  );
  assert.equal(calls, 1);
});

test('bereits abgebrochenes Signal wirft sofort aborted ohne Request', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      signal: controller.signal,
      fetchImpl: async () => {
        calls += 1;
        return Response.json(report());
      },
    }),
    isBatchError('aborted', null, false),
  );
  assert.equal(calls, 0);
});

test('fremder Webcode in der Antwort ist invalid und wird nicht wiederholt', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      sleep: async () => assert.fail('sleep must not be called'),
      fetchImpl: async () => {
        calls += 1;
        return Response.json(report(marketIds, {webcode: '99999999999'}));
      },
    }),
    isBatchError('invalid', 200, false),
  );
  assert.equal(calls, 1);
});

test('fehlende Markt-ID in der Antwort ist invalid und wird nicht wiederholt', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      sleep: async () => assert.fail('sleep must not be called'),
      fetchImpl: async () => {
        calls += 1;
        return Response.json(report(['1906832']));
      },
    }),
    isBatchError('invalid', 200, false),
  );
  assert.equal(calls, 1);
});

test('doppelte Markt-ID in der Antwort ist invalid und wird nicht wiederholt', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      sleep: async () => assert.fail('sleep must not be called'),
      fetchImpl: async () => {
        calls += 1;
        return Response.json(report(['1906832', '1906832']));
      },
    }),
    isBatchError('invalid', 200, false),
  );
  assert.equal(calls, 1);
});

test('fremde Markt-ID in der Antwort ist invalid und wird nicht wiederholt', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      sleep: async () => assert.fail('sleep must not be called'),
      fetchImpl: async () => {
        calls += 1;
        return Response.json(report(['1906832', '999999']));
      },
    }),
    isBatchError('invalid', 200, false),
  );
  assert.equal(calls, 1);
});

test('ungültiges JSON ist invalid und wird nicht wiederholt', async () => {
  let calls = 0;
  await assert.rejects(
    fetchBatch({
      apiBase,
      webcode,
      marketIds,
      sleep: async () => assert.fail('sleep must not be called'),
      fetchImpl: async () => {
        calls += 1;
        return new Response('kein json', {status: 200});
      },
    }),
    isBatchError('invalid', 200, false),
  );
  assert.equal(calls, 1);
});

test('status:error und unconfirmed je Markt sind gültige Antworten ohne Transport-Retry', async () => {
  let calls = 0;
  const data = {
    webcode,
    retrieved_at: '2026-11-13T10:00:00.000Z',
    markets: [
      {market_id: '1906832', status: 'error'},
      {market_id: '1907031', status: 'unconfirmed'},
    ],
  };
  const result = await fetchBatch({
    apiBase,
    webcode,
    marketIds,
    sleep: async () => assert.fail('sleep must not be called'),
    fetchImpl: async () => {
      calls += 1;
      return Response.json(data);
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, data);
});

test('fragt ausschließlich apiBase/compare mit URLSearchParams und credentials:omit ab', async () => {
  const controller = new AbortController();
  let seen;
  await fetchBatch({
    apiBase: 'https://service.example/',
    webcode,
    marketIds,
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      seen = {url, options};
      return Response.json(report());
    },
  });
  const parsed = new URL(seen.url);
  assert.equal(parsed.origin + parsed.pathname, 'https://service.example/compare');
  assert.equal(parsed.searchParams.get('webcode'), webcode);
  assert.equal(parsed.searchParams.get('markets'), '1906832,1907031');
  assert.equal(seen.options.credentials, 'omit');
  assert.ok(seen.options.signal instanceof AbortSignal);controller.abort();
});

test('abortableSleep verwirft sofort bei bereits abgebrochenem Signal', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(abortableSleep(60_000, controller.signal), (err) => err.name === 'AbortError');
});

test('abortableSleep bricht bei neuem Abbruch ab und räumt Listener auf', async () => {
  const controller = new AbortController();
  const promise = abortableSleep(60_000, controller.signal);
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(promise, (err) => err.name === 'AbortError');
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('abortableSleep löst normal auf und räumt den Listener auf', async () => {
  const controller = new AbortController();
  await abortableSleep(5, controller.signal);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('a hanging request has a deadline and exactly one retry',async()=>{
 let calls=0;
 await assert.rejects(fetchBatch({apiBase,webcode,marketIds,timeoutMs:5,sleep:async()=>{},fetchImpl:async(url,{signal})=>{
  calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Timeout','AbortError')),{once:true}));
 }}),isBatchError('network',null,true));
 assert.equal(calls,2);
});
