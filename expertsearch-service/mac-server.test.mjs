import test from 'node:test';
import assert from 'node:assert/strict';
import {createTemporaryServer} from './mac-server.mjs';

async function running(t, options = {}) {
  const server = createTemporaryServer({expiresAt:Date.now()+60000,minDelayMs:0,...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  return `http://127.0.0.1:${server.address().port}`;
}
const headers={Origin:'https://g-schenk.de'};
test('temporary host exposes only the API, no local filesystem',async t=>{
  const base=await running(t);
  assert.equal((await fetch(base+'/status',{headers})).status,200);
  assert.equal((await fetch(base+'/status')).status,403);
  assert.equal((await fetch(base+'/../../etc/passwd',{headers})).status,404);
  assert.equal((await fetch(base+'/compare',{method:'POST',headers})).status,405);
});
test('expiry prevents all price queries',async t=>{
  let clock=Date.now();let calls=0;
  const base=await running(t,{expiresAt:clock+1000,now:()=>clock,fetchImpl:async()=>{calls++;}});
  clock+=1001;
  assert.equal((await fetch(base+'/compare?webcode=36411100248&markets=1906832',{headers})).status,503);
  assert.equal(calls,0);
});
test('the Mac cache avoids duplicate upstream reads',async t=>{
  let calls=0;
  const base=await running(t,{fetchImpl:async url=>{calls++;return Response.json(url.includes('/api/store?')
    ?{id:'e_1906832',name:'expert Hoffmann'}
    :{webcode:'36411100248',store:'e_1906832',price:{storeId:'1906832',bruttoPrice:354.9}});}});
  const url=base+'/compare?webcode=36411100248&markets=1906832';
  assert.equal((await fetch(url,{headers})).status,200);
  assert.equal((await (await fetch(url,{headers})).json()).markets[0].cached,true);
  assert.equal(calls,2);
});
test('request budget stops repeated queries',async t=>{
  const base=await running(t,{requestLimit:1,fetchImpl:async()=>Response.json({})});
  const url=base+'/compare?webcode=36411100248&markets=1906832';
  await fetch(url,{headers});
  assert.equal((await fetch(url,{headers})).status,429);
});
