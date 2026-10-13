(() => {
  const fields = [...document.querySelectorAll('.board-field')];
  if (!fields.length) return;
  const board = document.querySelector('.game-board');
  const status = document.querySelector('#game-status');
  const title = document.querySelector('#story-title');
  const copy = document.querySelector('#story-copy');
  const media = document.querySelector('#story-media');
  const actions = document.querySelector('#story-actions');
  const hand = document.querySelector('#hand-dialog');
  const roll = document.querySelector('#roll-dice');
  const cube = document.querySelector('#dice-cube');
  const stage = document.querySelector('#dice-stage');
  const dieResult = document.querySelector('#dice-result');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion:reduce)');
  const pawn = document.createElement('span');
  pawn.className = 'pawn'; pawn.setAttribute('aria-hidden','true');
  const visited = new Set([0]);
  let position = 0, busy = false, rx = -18, ry = -26, questionIndex = 0;
  const topics = [
    {type:'Dein Startfeld',title:'Schön, dass du da bist.',text:['Hier führen kleine Schritte zu meinen Projekten, meiner Geschichte und den Dingen, die mich begeistern.','Eine Zahl auf dem Würfel bewegt deine Figur. Meine Arbeiten hast du als Karten auf der Hand.'],hand:true},
    {type:'Ein Stück meiner Geschichte',title:'Mein Weg war kein gerader.',text:['Zuerst habe ich mit Kindern und Jugendlichen gearbeitet. Später habe ich Wirtschaftsinformatik studiert und bin in die IT-Sicherheit gegangen.','Menschen verstehen und Technik sinnvoll einsetzen: Beides interessiert mich bis heute.']},
    {type:'Website-Projekt',title:'DARMbalance',image:'darmbalance',project:'darmbalance',text:['Eine persönliche Website für Christine Lohmüller und ihre Gesundheitsbegleitung. Das Angebot erklären, die Person zeigen und den Weg zum Kontakt erleichtern.']},
    {type:'Was mich begeistert',title:'Gemeinsam am Tisch.',text:['Brettspiele gehören zu mir. Gemeinsam entdecken, Entscheidungen treffen und ins Gespräch kommen.','Diese Begeisterung steckt auch in Ludonect, meinem eigenen Kennenlernspiel.'],project:'ludonect'},
    {type:'Website-Projekt',title:'IMPULSPACE',image:'impulspace',project:'impulspace',text:['Andrea Hornung gibt Impulse für eine sichere digitale Zukunft. Die Website verbindet ihre Person mit Vorträgen, Seminaren und Kursen. Deutsche und englische Seiten sind vorhanden.']},
    {type:'Mein Werkzeug',title:'KI hilft beim Ausprobieren.',text:['Ich verfolge die Entwicklung von KI mit Begeisterung und erstelle Websites mit KI-Unterstützung.','Ich entscheide, was zum Projekt passt, und prüfe das Ergebnis. Das Werkzeug ersetzt für mich nicht das Verständnis für die Menschen hinter einer Website.']},
    {type:'Abseits des Bildschirms',title:'Sport gehört dazu.',text:['Sport begeistert mich und ist ein Ausgleich zu meiner Arbeit am Bildschirm.','So bleibt zwischen Projekten auch Raum für etwas anderes.']},
    {type:'Website-Projekt',title:'ZAHN 360',image:'zahn360',project:'zahn360',text:['Ein Meisterlabor für Zahntechnik in Weinheim. Drei Perspektiven finden ihren Platz: Patienten, zahnärztliche Praxen und Menschen, die dort arbeiten möchten.']},
    {type:'Eine kleine Fragenkarte',title:'Was soll deine Website tun?',text:['Informieren? Vertrauen schaffen? Ein Angebot erklären? Oder Menschen zusammenbringen?','Ein guter Ausgangspunkt ist die Frage, was ein Besucher nach dem Anschauen verstanden haben soll.'],contact:true},
    {type:'Zusammenarbeit',title:'Erst verstehen, dann bauen.',text:['Was machst du und wen möchtest du erreichen? Daraus entstehen Struktur, Textideen und eine visuelle Richtung.','Ich entwickle den Entwurf mit KI-Unterstützung weiter. Gemeinsam schauen wir auf Inhalte, Bedienung und Darstellung.'],contact:true},
    {type:'Mein eigenes Webprodukt',title:'Ludonect',project:'ludonect',text:['Ein Kennenlernspiel für Spieleabende, Workshops und Teams. Alle beantworten persönliche Fragen mit einer Zahl und schätzen sich gegenseitig ein.','So wird aus einer Web-App ein Anlass, miteinander ins Gespräch zu kommen.']},
    {type:'Neue Möglichkeiten',title:'Eine Idee darf sich verändern.',text:['Ich probiere gern unterschiedliche Richtungen aus. Eine erste Website-Idee muss nicht gleich die endgültige sein.','Der nächste Entwurf macht oft klarer, welche Sprache und Gestaltung wirklich passen.'],hand:true},
    {type:'Aktuell in der Entwurfsphase',title:'Verschönerei',image:'verschoenerei',project:'verschoenerei',text:['Ein neuer Auftritt für Haut, Haare und Nägel. Verschiedene Entwürfe helfen dabei, eine passende Richtung für den Salon zu finden.','Hier siehst du eine Designstudie, keinen abgeschlossenen Relaunch.']},
    {type:'Eine andere Perspektive',title:'Für wen ist deine Website?',text:['Ein Besucher kennt deine Arbeit noch nicht. Was braucht er, um zu verstehen, was du anbietest?','Ein Perspektivwechsel ist oft hilfreicher als noch ein zusätzlicher Abschnitt.'],contact:true},
    {type:'Jetzt bist du dran',title:'Was möchtest du zeigen?',text:['Dein Unternehmen, dein Angebot oder eine Idee, die eine Website bekommen soll.','Beschreib kurz, was dir wichtig ist. Im Prototyp kannst du den Text für später vorbereiten.'],contact:true},
    {type:'Noch eine Runde?',title:'Neugier kennt keinen Endpunkt.',text:['Du kannst weiterwürfeln, ein anderes Feld wählen oder deine Handkarten noch einmal ansehen.','Jede Arbeit und jedes Feld ist auch ohne Würfeln direkt zugänglich.'],hand:true,reset:true}
  ];
  function action(label, attributes) {
    const button = document.createElement('button');
    button.className = 'button'; button.textContent = label;
    Object.entries(attributes).forEach(([key,value]) => button.setAttribute(key,value));
    actions.append(button);
  }
  function renderStory(index) {
    const topic = topics[index];
    document.querySelector('#story-type').textContent = topic.type;
    title.textContent = topic.title;
    copy.replaceChildren(); media.replaceChildren(); actions.replaceChildren();
    const paragraphs = index === 8 ? [
      ['Was sollen Besucher über dich verstehen?','Welcher Teil deiner Arbeit sollte sofort sichtbar sein?','Wie soll sich deine Website anfühlen?'][questionIndex++ % 3],
      'Nimm diese Frage als Anstoß für dein eigenes Projekt.'
    ] : topic.text;
    paragraphs.forEach(text => {const p = document.createElement('p'); p.textContent = text; copy.append(p);});
    if (topic.image) {
      const image = document.createElement('img'); image.src = `assets/${topic.image}.jpg`;
      image.alt = `Lokale Website-Ansicht von ${topic.title}`; image.width = 1440; image.height = 1000; media.append(image);
    }
    if(topic.project) action('Projektkarte ansehen',{'data-project':topic.project});
    if(topic.hand) action('Meine Handkarten ansehen',{'data-hand':''});
    if(topic.contact) action('Projekt besprechen',{'data-contact':''});
    if(topic.reset) action('Zurück zum Start',{'data-reset':''});
    const illustration = index === 10 || index === 3;
    if(illustration && !topic.image){
      const symbol = document.createElement('div'); symbol.className='story-game-symbol'; symbol.textContent='?  0–100  !'; symbol.setAttribute('aria-hidden','true'); media.append(symbol);
    }
  }
  function setPosition(index, discover = true) {
    position = (index + fields.length) % fields.length;
    if(discover)visited.add(position);
    fields.forEach((field,i) => {
      field.classList.toggle('is-current',i===position);
      field.classList.toggle('is-visited',visited.has(i));
      field.setAttribute('aria-pressed',String(i===position));
      if(i===position)field.setAttribute('aria-current','step'); else field.removeAttribute('aria-current');
    });
    fields[position].append(pawn);
    board.dataset.position = position;
    document.querySelector('#discovered').textContent = `${visited.size} von 16 Feldern entdeckt`;
    if(discover)renderStory(position);
  }
  function selectField(index) {
    if(busy)return;
    setPosition(index);
    status.textContent = `Du stehst auf Feld ${position + 1}: ${topics[position].title}`;
  }
  function setBusy(value) {
    busy=value; board.setAttribute('aria-busy',String(value));
    roll.disabled=value; roll.textContent=value?'Deine Figur zieht …':'Würfeln & ziehen';
    fields.forEach(field => field.disabled=value);
    document.querySelector('#reset-game').disabled=value;
  }
  function orientDie() {cube.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg)`;}
  const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
  async function rollDice() {
    if(busy)return;
    setBusy(true);
    const value=1+Math.floor(Math.random()*6);
    const rotations={1:[0,0],2:[0,-90],3:[-90,0],4:[90,0],5:[0,90],6:[0,180]};
    const roundsX=Math.ceil(rx/360)+2,roundsY=Math.ceil(ry/360)+3;
    rx=roundsX*360+rotations[value][0]-14;ry=roundsY*360+rotations[value][1]-16;
    orientDie();
    dieResult.textContent=`${value} gewürfelt. ${value===1?'Ein Feld':value+' Felder'} weiter.`;
    dieResult.dataset.value=value;
    stage.setAttribute('aria-label',`Würfel: ${value}. Mit Maus, Finger oder Pfeiltasten drehbar.`);
    status.textContent=`Du hast ${value} gewürfelt. Deine Figur zieht weiter.`;
    if(!reduceMotion.matches)await pause(650);
    for(let i=0;i<value;i++){
      setPosition(position+1,false);
      if(!reduceMotion.matches)await pause(135);
    }
    setPosition(position,true);
    status.textContent=`${value} gewürfelt. Du stehst auf Feld ${position+1}: ${topics[position].title}`;
    setBusy(false);
  }
  function reset() {
    if(busy)return;
    visited.clear();visited.add(0);questionIndex=0;setPosition(0);
    rx=-18;ry=-26;orientDie();
    dieResult.textContent='Dein erster Zug wartet.';delete dieResult.dataset.value;
    status.textContent='Neue Runde. Du stehst wieder auf dem Startfeld.';
    stage.setAttribute('aria-label','Drehbarer Würfel. Mit Maus, Finger oder Pfeiltasten drehen.');
  }
  fields.forEach((field,i)=>field.addEventListener('click',()=>selectField(i)));
  roll.addEventListener('click',rollDice);
  document.querySelector('#reset-game').addEventListener('click',reset);
  const projectFields={darmbalance:2,impulspace:4,zahn360:7,ludonect:10,verschoenerei:12};
  document.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-hand],a[href="#arbeiten"]');
    if(trigger){event.preventDefault();if(!busy)hand.showModal();}
    if(event.target.closest('[data-reset]'))reset();
    const card=event.target.closest('.hand-card[data-project]');
    if(card&&!busy)selectField(projectFields[card.dataset.project]);
  });
  let drag=null;
  stage.addEventListener('pointerdown',event=>{
    if(busy||event.button!==0)return;
    drag={x:event.clientX,y:event.clientY,rx,ry,id:event.pointerId};
    stage.setPointerCapture(event.pointerId);stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    rx=drag.rx-(event.clientY-drag.y)*.8;ry=drag.ry+(event.clientX-drag.x)*.8;orientDie();
  });
  function endDrag(){drag=null;stage.classList.remove('is-dragging');}
  stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);stage.addEventListener('lostpointercapture',endDrag);
  stage.addEventListener('keydown',event=>{
    if(busy)return;
    const changes={ArrowLeft:[0,-20],ArrowRight:[0,20],ArrowUp:[-20,0],ArrowDown:[20,0]};
    if(changes[event.key]){event.preventDefault();rx+=changes[event.key][0];ry+=changes[event.key][1];orientDie();}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();rollDice();}
  });
  setPosition(0);
})();
