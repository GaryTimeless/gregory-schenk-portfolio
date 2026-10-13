const projects = {
  darmbalance: {
    title: 'DARMbalance', image: 'assets/darmbalance.jpg',
    intro: 'Eine Website für Christine Lohmüller und ihre Gesundheitsbegleitung. Persönliche Ansprache, ein erklärbares Angebot und ein klarer Weg zum Kontakt.',
    points: ['Das Angebot in verständliche Themen und Abschnitte gliedern.', 'Die Person hinter der Begleitung sichtbar machen.', 'Informationen, Leistungen und Kontakt in einem zusammenhängenden Auftritt verbinden.']
  },
  impulspace: {
    title: 'IMPULSPACE', image: 'assets/impulspace.jpg',
    intro: 'Andrea Hornung gibt Impulse für eine sichere digitale Zukunft. Die Website verbindet ihre Person mit Vorträgen, Seminaren und Kursen.',
    points: ['Unterschiedliche Formate übersichtlich vorstellen.', 'Fachthema und persönliche Biografie zusammenbringen.', 'Deutsche und englische Seiten für unterschiedliche Besucher anbieten.']
  },
  zahn360: {
    title: 'ZAHN 360', image: 'assets/zahn360.jpg',
    intro: 'Ein Meisterlabor für Zahntechnik in Weinheim. Die Website führt Patienten, zahnärztliche Praxen und Bewerber zu den für sie passenden Informationen.',
    points: ['Drei Besuchergruppen innerhalb eines Auftritts orientieren.', 'Qualität, Labor und digitale Abläufe verständlich zeigen.', 'Karriere und Kontakt als eigenständige Wege zugänglich machen.']
  },
  ludonect: {
    title: 'Ludonect',
    intro: 'Ein eigenes Webprodukt: ein Kennenlernspiel für Spieleabende, Workshops und Teams. Persönliche Fragen und gegenseitiges Einschätzen bringen Menschen ins Gespräch.',
    points: ['Eine Frage mit einer Zahl beantworten.', 'Einschätzen, wie die anderen geantwortet haben.', 'Antworten aufdecken und darüber ins Gespräch kommen.']
  },
  verschoenerei: {
    title: 'Verschönerei', image: 'assets/verschoenerei.jpg',
    intro: 'Aktuell in der Entwurfsphase: ein Relaunch für einen Salon in Weinheim. Haut, Haare und Nägel geben dem Auftritt seine Struktur.',
    points: ['Verschiedene Gestaltungsrichtungen vergleichen.', 'Die drei Angebotsbereiche als Ausgangspunkt nutzen.', 'Eine erste Richtung gemeinsam auswählen und weiterentwickeln.']
  }
};
const projectDialog = document.querySelector('#project-dialog');
function showProject(key) {
    const data = projects[key];
    if (!data) return;
    document.querySelector('#project-title').textContent = data.title;
    const body = document.querySelector('#project-body');
    body.replaceChildren();
    if (data.image) {
      const image = document.createElement('img');
      image.src = data.image;
      image.alt = `Ansicht des lokalen Website-Projekts ${data.title}`;
      image.width = 1440; image.height = 1000;
      body.append(image);
    }
    const intro = document.createElement('p'); intro.textContent = data.intro; body.append(intro);
    const heading = document.createElement('h3'); heading.textContent = key === 'ludonect' ? 'Das Spielprinzip' : 'Worum es im Projekt geht'; body.append(heading);
    const list = document.createElement('ul');
    data.points.forEach(point => {const item = document.createElement('li'); item.textContent = point; list.append(item);});
    body.append(list);
    const note = document.createElement('p'); note.className = 'prototype-note';
    note.textContent = key === 'verschoenerei' ? 'Entwurfsstand, kein abgeschlossener Relaunch. Die Zuordnung als viertes Website-Projekt ist noch zu bestätigen.' : key === 'ludonect' ? 'Dies ist eine Erklärung des Spielprinzips. Im Portfolio läuft keine Multiplayer-Partie.' : 'Portfolio-Textentwurf auf Basis der lokalen Projektdateien. Der genaue eigene Beitrag an Konzept, Gestaltung, Inhalten und Umsetzung wird vor Veröffentlichung ergänzt.';
    body.append(note);
    projectDialog.showModal();
}
document.addEventListener('click', event => {
  const project = event.target.closest('[data-project]');
  if (project) showProject(project.dataset.project);
  if (event.target.closest('[data-contact]')) document.querySelector('#contact-dialog').showModal();
});
document.querySelectorAll('[data-notes]').forEach(button => button.addEventListener('click', () => document.querySelector('#notes-dialog').showModal()));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
const contactForm = document.querySelector('#contact-form');
contactForm?.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(contactForm);
  const text = `Projektidee für Gregory Schenk\n\nProjekt: ${data.get('project')}\nVorhaben: ${data.get('type')}\n\n${data.get('idea')}\n\nLokal vorbereitet. Nicht versendet.\n`;
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'meine-projektidee.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  document.querySelector('#form-status').textContent = 'Dein Projekttext wurde als Download vorbereitet. Es wurde keine Nachricht verschickt.';
});
document.querySelectorAll('button[data-look]').forEach(button => {
  button.addEventListener('click', () => {
    const example = document.querySelector('#mini-site');
    if (!example) return;
    example.dataset.look = button.dataset.look;
    document.querySelectorAll('button[data-look]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    const names = {clear:'Klar',warm:'Warm',bold:'Mutig'};
    document.querySelector('#look-status').textContent = `Gestaltung: ${names[button.dataset.look]}`;
  });
});
