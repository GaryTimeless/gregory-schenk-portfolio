export class BatchError extends Error {
  constructor(message,{kind='invalid',retryable=false,status=null}={}) {
    super(message);this.name='BatchError';this.kind=kind;this.retryable=retryable;this.status=status;
  }
}
const aborted = () => new BatchError('Die Suche wurde abgebrochen.',{kind:'aborted'});
export function abortableSleep(ms,signal) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Abgebrochen','AbortError'));return;}
    let timer;
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
    const cancel=()=>{cleanup();reject(new DOMException('Abgebrochen','AbortError'));};
    timer=setTimeout(()=>{cleanup();resolve();},ms);
    signal?.addEventListener('abort',cancel,{once:true});
  });
}
function validate(data,webcode,ids,status) {
  const invalid=()=>new BatchError('Die Antwort konnte keinem vollständigen Marktvergleich zugeordnet werden.',{kind:'invalid',status});
  if(!data || String(data.webcode)!==webcode || !Array.isArray(data.markets))throw invalid();
  const seen=new Set();
  for(const offer of data.markets) {
    if(!offer || !ids.includes(offer.market_id) || seen.has(offer.market_id))throw invalid();
    seen.add(offer.market_id);
  }
  if(seen.size!==ids.length)throw invalid();
  return data;
}
export async function fetchBatch({apiBase,webcode,marketIds,signal,fetchImpl=fetch,sleep=abortableSleep,onRetry=()=>{},timeoutMs=40000}) {
  if(signal?.aborted)throw aborted();
  const endpoint=new URL(apiBase.replace(/\/$/,'')+'/compare',globalThis.location?.href || 'http://localhost/');
  endpoint.search=new URLSearchParams({webcode,markets:marketIds.join(',')});
  for(let attempt=1;attempt<=2;attempt++) {
    if(signal?.aborted)throw aborted();
    const attemptController=new AbortController();
    let timedOut=false;
    const forwardAbort=()=>attemptController.abort(signal.reason);
    signal?.addEventListener('abort',forwardAbort,{once:true});
    const timer=setTimeout(()=>{timedOut=true;attemptController.abort();},timeoutMs);
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',forwardAbort);};
    try {
      let response;
      try {response=await fetchImpl(endpoint.href,{signal:attemptController.signal,credentials:'omit',cache:'no-store'});}
      catch(e) {
        if(signal?.aborted)throw aborted();
        if(timedOut)throw new BatchError('Der Preisabfrage-Dienst antwortet zu lange nicht. Deine Ergebnisse bleiben erhalten.',{kind:'network',retryable:true});
        if(e?.name==='AbortError')throw aborted();
        throw new BatchError('Die Verbindung zum Preisabfrage-Dienst ist unterbrochen. Deine Ergebnisse bleiben erhalten.',{kind:'network',retryable:true});
      }
      if(signal?.aborted)throw aborted();
      if(!response.ok) {
        const status=response.status;
        const kind=status===403?'forbidden':status===429?'throttled':[502,503,504].includes(status)?'gateway':'invalid';
        const message=status===403?'Die Preisquelle oder der Abfragedienst hat den Zugriff abgewiesen (403).'
          :status===429?'Die Abfragen werden gerade begrenzt. Bitte später fortsetzen (429).'
          :`Der Preisabfrage-Dienst ist vorübergehend nicht erreichbar (${status}). Deine Ergebnisse bleiben erhalten.`;
        throw new BatchError(message,{kind,status,retryable:kind==='gateway'});
      }
      let data;
      try {data=await response.json();}catch(e) {
        if(signal?.aborted)throw aborted();
        if(timedOut)throw new BatchError('Der Preisabfrage-Dienst antwortet zu lange nicht. Deine Ergebnisse bleiben erhalten.',{kind:'network',retryable:true});
        if(e?.name==='AbortError')throw aborted();
        throw new BatchError('Der Preisabfrage-Dienst hat keine lesbare Antwort geliefert.',{kind:'invalid',status:response.status});
      }
      if(signal?.aborted)throw aborted();
      return validate(data,String(webcode),marketIds,response.status);
    } catch(error) {
      cleanup();
      if(signal?.aborted || error?.kind==='aborted' || error?.name==='AbortError')throw aborted();
      if(!(error instanceof BatchError) || !error.retryable || attempt===2)throw error;
      onRetry({attempt:2,delayMs:1500});
      try {await sleep(1500,signal);}catch(e) {
        if(signal?.aborted)throw aborted();
        if(timedOut)throw new BatchError('Der Preisabfrage-Dienst antwortet zu lange nicht. Deine Ergebnisse bleiben erhalten.',{kind:'network',retryable:true});
        if(e?.name==='AbortError')throw aborted();
        throw e;
      }
    } finally {cleanup();}
  }
}
