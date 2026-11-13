import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../expertsearch/app.js', import.meta.url), 'utf8');
const resolvedSource=source.replace("from './transport.mjs'","from '"+new URL('../expertsearch/transport.mjs',import.meta.url).href+"'");
const {product, total, csvCell, isConfirmed, liveAvailable, pendingMarkets} = await import('data:text/javascript;base64,' + Buffer.from(resolvedSource).toString('base64'));
const offer = {status:'ok',identity_confirmed:true,gross_price:354.9,currency:'EUR',shipping:[{type:'PKG',gross:0,currency:'EUR'}]};
test('accepts only actual Expert HTTPS product URLs and removes old market selection', () => {
  const parsed = product('https://www.expert.de/shop/36411100248-machine.html?branch_id=123#info');
  assert.equal(parsed.webcode,'36411100248');assert.equal(parsed.url,'https://www.expert.de/shop/36411100248-machine.html');
  for(const input of ['javascript:alert(1)','https://evil.example/36411100248-a.html','https://expert.de.evil.example/36411100248-a.html','http://expert.de/36411100248-a.html','https://user@expert.de/36411100248-a.html','https://expert.de:1234/36411100248-a.html','https://expert.de/shop/search'])assert.throws(()=>product(input));
});
test('only confirmed prices can enter price ranking',()=>{
  assert.equal(isConfirmed(offer),true);
  for(const changed of [{status:'unconfirmed'},{identity_confirmed:false},{gross_price:0},{gross_price:null},{gross_price:NaN},{gross_price:Infinity}])assert.equal(isConfirmed({...offer,...changed}),false);
});
test('unknown shipping and currency do not become cheap totals',()=>{
  assert.equal(total(offer),354.9);
  assert.equal(total({...offer,shipping:[]}),null);
  assert.equal(total({...offer,currency:null}),null);
  assert.equal(total({...offer,status:'unconfirmed'}),null);
  assert.equal(total({...offer,shipping:[{type:'PKG',gross:6.99,currency:'EUR'}]}),361.89);
});
test('CSV escapes quotes and spreadsheet formulas from market labels',()=>{
  assert.equal(csvCell('a"b'),'"a""b"');
  assert.equal(csvCell('=HYPERLINK(1)'), '"\'=HYPERLINK(1)"');
  assert.equal(csvCell(null),'""');
});

test('temporary search expires without enabling stale backend URLs',()=>{
  assert.equal(liveAvailable({apiBase:'https://service.example',expiresAt:'2026-11-13T14:00:00Z'},Date.parse('2026-11-13T13:59:00Z')),true);
  assert.equal(liveAvailable({apiBase:'https://service.example',expiresAt:'2026-11-13T14:00:00Z'},Date.parse('2026-11-13T14:00:00Z')),false);
  assert.equal(liveAvailable({apiBase:''}),false);
  assert.equal(liveAvailable({apiBase:'https://service.example',expiresAt:'bad-date'}),false);
});

test('resume selects only missing or temporary failures while keeping confirmed results',()=>{
 assert.deepEqual(pendingMarkets(['1','2','3','4'],[{market_id:'1',status:'ok'},{market_id:'2',status:'error',retryable:false},{market_id:'3',status:'error',retryable:true}]),['3','4']);
});
