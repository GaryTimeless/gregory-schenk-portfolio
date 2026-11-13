const EXAMPLE = 'https://www.expert.de/shop/unsere-produkte/haushalt-kuche/kaffee-teezubereitung/kaffeevollautomaten/36411100248-del-ecam-290-61-sb-kaffeevollautomat.html';
const money = new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR'});
export function product(value) {
  let url;
  try {url = new URL(value);} catch {throw new Error('Bitte füge eine vollständige Produktadresse von expert.de ein.');}
  if (url.protocol !== 'https:' || !['expert.de','www.expert.de'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('Bitte verwende eine HTTPS-Produktadresse von expert.de.');
  const match = url.pathname.match(/\/(\d{6,15})-[^/]+\.html$/);
  if (!match) throw new Error('In dieser Adresse wurde kein Produkt erkannt. Öffne das Produkt bei expert.de und kopiere seine Adresse.');
  url.search = ''; url.hash = '';
  return {url:url.href, webcode:match[1]};
}
export function total(offer) {
  if (offer.status !== 'ok' || !offer.identity_confirmed || offer.currency !== 'EUR' || !Number.isFinite(offer.gross_price) || offer.gross_price <= 0) return null;
  const shipping = offer.shipping?.find(s => s.type === 'PKG' && s.currency === 'EUR' && Number.isFinite(s.gross) && s.gross >= 0);
  return shipping ? offer.gross_price + shipping.gross : null;
}
export function csvCell(value) {const text = String(value ?? ''); return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"','""') + '"';}
export function liveAvailable(config, now=Date.now()) {return typeof config?.apiBase === 'string' && !!config.apiBase && (!config.expiresAt || (Number.isFinite(Date.parse(config.expiresAt)) && Date.parse(config.expiresAt)>now));}
export function isConfirmed(offer) {return offer.status === 'ok' && offer.identity_confirmed === true && Number.isFinite(offer.gross_price) && offer.gross_price > 0;}
const dateText = value => {const date=new Date(value); return Number.isNaN(date.getTime()) ? 'Abrufzeit unbekannt' : date.toLocaleString('de-DE', {dateStyle:'medium', timeStyle:'short'});};

async function init() {
  const $ = id => document.getElementById(id);
  const state = {config:null, markets:[], selected:new Set(), offers:[], product:null, saved:false, controller:null, run:0, time:null};
  const node = (tag, text, className) => {const item=document.createElement(tag); if(text != null)item.textContent=text; if(className)item.className=className; return item;};
  const error = message => {$('form-error').textContent=message; $('form-error').hidden=!message;};
  const selectedScope = () => document.querySelector('input[name=scope]:checked').value;
  function count() {$('selected-count').textContent=`(${state.selected.size})`; $('all-count').textContent=`(${state.markets.length})`;}
  function picker() {
    const filter=$('market-filter').value.toLocaleLowerCase('de');
    const visible=state.markets.filter(m=>`${m.name} ${m.city}`.toLocaleLowerCase('de').includes(filter));
    const fragment=document.createDocumentFragment();
    for(const market of visible) {
      const label=node('label',null,'market-option'); const check=document.createElement('input'); check.type='checkbox'; check.value=market.id; check.checked=state.selected.has(market.id);
      check.addEventListener('change',()=>{if(check.checked)state.selected.add(market.id); else state.selected.delete(market.id); count();});
      const text=node('span',market.name); text.append(node('small',market.city)); label.append(check,text); fragment.append(label);
    }
    if(!visible.length)fragment.append(node('p','Kein Markt unter diesem Namen oder Ort gefunden.','empty'));
    $('market-options').replaceChildren(fragment);
    return visible;
  }
  function articleLink(offer) {const url=new URL(state.product.url); url.searchParams.set('branch_id',offer.market_id); return url.href;}
  function offerNode(offer, confirmed) {
    const row=node('article',null,confirmed?'offer':'offer unconfirmed');
    const details=node('div'); details.append(node('h3',offer.market_name || `Markt ${offer.market_id}`),node('p',offer.market_city || 'Ort nicht bestätigt','city'));
    const online=offer.availability_online==='AVAILABLE'?'Online verfügbar':offer.availability_online==='NOT_AVAILABLE'?'Online nicht verfügbar':'Onlineverfügbarkeit nicht bestätigt';
    const local=offer.availability_store==='AVAILABLE'?'Im Markt verfügbar':offer.availability_store==='NOT_IN_STORE'?'Im Markt nicht vorrätig':'Marktbestand nicht bestätigt';
    details.append(node('p',`${online}. ${local}.`,'availability'));
    if(offer.on_display)details.append(node('p','Ausstellungsstück','availability'));
    row.append(details);
    const amount=node('div',null,'amount'); const value=total(offer);
    if(confirmed) {
      amount.append(node('p',offer.currency==='EUR'?money.format(value ?? offer.gross_price):`${offer.gross_price} ${offer.currency || '(Währung unbekannt)'}`,'total'));
      const breakdown=value==null?'Artikelpreis; Versandkosten nicht bestätigt.':`${money.format(offer.gross_price)} + ${money.format(value-offer.gross_price)} Versand`;
      amount.append(node('p',breakdown,'breakdown'));
      const link=node('a','Bei expert ansehen','buy'); link.href=articleLink(offer); link.target='_blank'; link.rel='noopener noreferrer'; amount.append(link);
    } else amount.append(node('p',offer.status==='unconfirmed'?'Nicht bestätigt':'Nicht auswertbar','breakdown'));
    amount.append(node('p',`Abgerufen: ${dateText(offer.retrieved_at)}`,'checked')); row.append(amount);
    if(!confirmed)row.append(node('p',offer.error || offer.notes?.join(' ') || 'Produkt- oder Marktzuordnung nicht bestätigt.','warning'));
    return row;
  }
  function render() {
    $('results-section').hidden=!state.product;
    if(!state.product)return;
    $('results-title').textContent=state.saved?'Gespeicherter Vergleich':'Dein Preisvergleich';
    const confirmed=state.offers.filter(isConfirmed);
    $('results-context').textContent=`Produkt ${state.product.webcode} · ${confirmed.length} bestätigte von ${state.offers.length} Marktantworten · Stand ${dateText(state.time)}`;
    $('snapshot-note').hidden=!state.saved;
    const shown=confirmed.filter(m=>!$('online-only').checked || m.availability_online==='AVAILABLE');
    shown.sort((a,b)=>(total(a)??Infinity)-(total(b)??Infinity) || a.gross_price-b.gross_price);
    $('offers').replaceChildren(...shown.map(m=>offerNode(m,true)));
    if(!shown.length)$('offers').append(node('p','Noch keine bestätigten Angebote für diese Auswahl.','empty'));
    const other=state.offers.filter(m=>!isConfirmed(m)); $('other-results').hidden=!other.length;
    $('other-summary').textContent=`${other.length} weitere Marktantwort${other.length===1?'':'en'} ohne bestätigten Preis`;
    $('other-offers').replaceChildren(...other.map(m=>offerNode(m,false)));
    $('export').disabled=!state.offers.length;
  }
  function stop() {state.controller?.abort(); state.controller=null; state.run++; $('cancel').disabled=true; $('submit').disabled=!liveAvailable(state.config);}
  function clearForInput() {stop(); state.product=null; state.offers=[]; $('results-section').hidden=true; $('progress-section').hidden=true; error('');}
  $('product-url').addEventListener('input',clearForInput);
  $('example').addEventListener('click',()=>{$('product-url').value=EXAMPLE; clearForInput(); $('product-url').focus();});
  $('market-filter').addEventListener('input',picker);
  $('select-visible').addEventListener('click',()=>{for(const m of picker())state.selected.add(m.id); count(); picker();});
  $('clear-selection').addEventListener('click',()=>{state.selected.clear(); count(); picker();});
  $('online-only').addEventListener('change',render);
  $('cancel').addEventListener('click',()=>{stop(); $('progress-label').textContent=`Abgebrochen. ${state.offers.length} Marktantworten bleiben sichtbar.`;});
  $('search-form').addEventListener('submit',async event=>{
    event.preventDefault(); error('');
    if(!liveAvailable(state.config)){error(state.config?.expiresAt?'Die vorübergehende Live-Suche ist beendet.':'Die Live-Suche wird noch eingerichtet.');return;}
    let sought; try{sought=product($('product-url').value);}catch(e){error(e.message);return;}
    const markets=selectedScope()==='all'?state.markets:state.markets.filter(m=>state.selected.has(m.id));
    if(!markets.length){error('Bitte wähle mindestens einen Markt aus.');return;}
    stop(); const run=state.run; const controller=new AbortController();state.controller=controller;
    state.product=sought; state.offers=[]; state.saved=false; state.time=new Date().toISOString();
    $('submit').disabled=true;$('cancel').disabled=false;$('progress-section').hidden=false;$('progress').max=markets.length;$('progress').value=0;
    const updateProgress=()=>{$('progress-label').textContent=`${state.offers.length} von ${markets.length} Märkten geprüft`;}; updateProgress();render();
    try {
      const size=Math.max(1,Math.min(5,state.config.batchSize || 5));
      for(let start=0;start<markets.length;start+=size) {
        if(controller.signal.aborted)break;
        const batch=markets.slice(start,start+size);
        const endpoint=new URL(state.config.apiBase.replace(/\/$/,'')+'/compare',location.href);
        endpoint.search=new URLSearchParams({webcode:sought.webcode,markets:batch.map(m=>m.id).join(',')});
        const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit'});
        if(!response.ok)throw new Error(response.status===429?'Die Abfragen werden gerade begrenzt. Bitte später erneut versuchen.':'Die Preissuche ist gerade nicht erreichbar. Bitte später erneut versuchen.');
        const data=await response.json();
        if(run!==state.run || controller.signal.aborted)return;
        if(String(data.webcode)!==sought.webcode || !Array.isArray(data.markets))throw new Error('Die Produktantwort konnte nicht eindeutig zugeordnet werden.');
        const ids=new Set(batch.map(m=>m.id)); const received=new Set();
        for(const offer of data.markets) {
          if(!offer || !ids.has(offer.market_id) || received.has(offer.market_id))throw new Error('Eine Marktantwort konnte nicht eindeutig zugeordnet werden.');
          received.add(offer.market_id);state.offers.push(offer);
        }
        if(received.size!==batch.length)throw new Error('Die Preisquelle hat nicht für alle angefragten Märkte geantwortet.');
        state.time=data.retrieved_at; $('progress').value=state.offers.length;updateProgress();render();
        // Pause between batches; AbortController also cancels this pause.
        if(start+size<markets.length)await new Promise((resolve,reject)=>{const done=()=>{controller.signal.removeEventListener('abort',cancel);resolve();}; const timer=setTimeout(done,2200); const cancel=()=>{clearTimeout(timer);reject(new DOMException('Abgebrochen','AbortError'));};controller.signal.addEventListener('abort',cancel,{once:true});});
      }
      if(run===state.run)$('progress-label').textContent=`Vergleich abgeschlossen. ${state.offers.length} Märkte geprüft.`;
    }catch(e){if(run===state.run && e.name!=='AbortError'){error(e.message || 'Die Suche konnte nicht abgeschlossen werden.');$('progress-label').textContent=`Suche unterbrochen. ${state.offers.length} Marktantworten bleiben sichtbar.`;}}
    finally {if(run===state.run){state.controller=null;$('submit').disabled=false;$('cancel').disabled=true;}}
  });
  $('export').addEventListener('click',()=>{
    const rows=[['Markt','Ort','Status','Artikelpreis','Währung','Gesamtpreis mit Paketversand','Online verfügbar','Abrufzeit','Produktseite'],...state.offers.filter(m=>!$('online-only').checked || m.availability_online==='AVAILABLE').map(m=>[m.market_name,m.market_city,isConfirmed(m)?'bestätigt':m.status,isConfirmed(m)?m.gross_price:'',m.currency,total(m)??'',m.availability_online,m.retrieved_at,articleLink(m)])];
    const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const link=node('a');link.href=url;link.download=`expertsearch-${state.product.webcode}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  try {
    const load=async file=>{const response=await fetch(file,{cache:'no-store'});if(!response.ok)throw new Error();return response.json();};
    const [config,list]=await Promise.all([load('./config.json'),load('./markets.json')]);
    state.config=config;
    state.markets=list.markets.filter(m=>/^\d+$/.test(m.id)&&typeof m.name==='string'&&typeof m.city==='string');
    state.selected=new Set(config.defaultMarkets.filter(id=>state.markets.some(m=>m.id===id))); count();picker();
    $('submit').disabled=!liveAvailable(config);
    $('live-note').textContent=liveAvailable(config)?(config.expiresAt?`Vorübergehend verfügbar bis ${dateText(config.expiresAt)}. Ein Vergleich über die ganze Marktliste kann einige Minuten dauern.`:'Die Suche fragt die ausgewählten Märkte nacheinander ab. Ein Vergleich über die ganze Liste kann einige Minuten dauern.'):(config.expiresAt?'Die vorübergehende Live-Suche ist beendet. Unten findest du einen gespeicherten Vergleich.':'Die Live-Suche wird noch eingerichtet. Du kannst unten einen gespeicherten Vergleich ansehen.');
    if(config.expiresAt && liveAvailable(config))setTimeout(()=>{stop();$('submit').disabled=true;$('live-note').textContent='Die vorübergehende Live-Suche ist beendet. Bereits abgerufene Ergebnisse bleiben sichtbar.';},Math.max(1,Date.parse(config.expiresAt)-Date.now()));
    $('product-url').value=EXAMPLE;
    if(!liveAvailable(config)){try {const saved=await load('./snapshot.json');state.product=product(saved.product_url);state.offers=saved.markets;state.time=saved.retrieved_at;state.saved=true;render();}catch{$('live-note').textContent='Die Live-Suche wird noch eingerichtet.';}}
  }catch {error('Die Marktliste konnte nicht geladen werden. Bitte lade die Seite erneut.');$('live-note').hidden=true;}
}
if(typeof document!=='undefined')init();
