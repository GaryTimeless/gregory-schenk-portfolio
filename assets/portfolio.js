const projects = {
  darmbalance: {
    title: 'DARMbalance', image: 'assets/darmbalance.jpg', url: 'https://my-darmbalance.de/',
    intro: 'Eine Website für Christine Lohmüller und ihre Gesundheitsbegleitung. Persönliche Ansprache, ein erklärbares Angebot und ein klarer Weg zum Kontakt.',
    points: ['Das Angebot in verständliche Themen und Abschnitte gliedern.', 'Die Person hinter der Begleitung sichtbar machen.', 'Informationen, Leistungen und Kontakt in einem zusammenhängenden Auftritt verbinden.']
  },
  impulspace: {
    title: 'IMPULSPACE', image: 'assets/impulspace.jpg', url: 'https://impulspace.com/',
    intro: 'Andrea Hornung gibt Impulse für eine sichere digitale Zukunft. Die Website verbindet ihre Person mit Vorträgen, Seminaren und Kursen.',
    points: ['Unterschiedliche Formate übersichtlich vorstellen.', 'Fachthema und persönliche Biografie zusammenbringen.', 'Deutsche und englische Seiten für unterschiedliche Besucher anbieten.']
  },
  zahn360: {
    title: 'ZAHN 360', image: 'assets/zahn360.jpg',
    intro: 'Ein Meisterlabor für Zahntechnik in Weinheim. Die Website führt Patienten, zahnärztliche Praxen und Bewerber zu den für sie passenden Informationen.',
    points: ['Drei Besuchergruppen innerhalb eines Auftritts orientieren.', 'Qualität, Labor und digitale Abläufe verständlich zeigen.', 'Karriere und Kontakt als eigenständige Wege zugänglich machen.']
  },
  ludonect: {
    title: 'Ludonect', mascot: 'assets/ludonect-otter.png', url: 'https://ludonect.de/',
    intro: 'Ein eigenes Webprodukt: ein Kennenlernspiel für Spieleabende, Workshops und Teams. Persönliche Fragen und gegenseitiges Einschätzen bringen Menschen ins Gespräch.',
    points: ['Eine Frage mit einer Zahl beantworten.', 'Einschätzen, wie die anderen geantwortet haben.', 'Antworten aufdecken und darüber ins Gespräch kommen.']
  },
  verschoenerei: {
    title: 'Verschönerei', image: 'assets/verschoenerei.jpg',
    intro: 'Ein neuer Webauftritt für einen Salon in Weinheim. Haut, Haare und Nägel geben dem Auftritt seine Struktur.',
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
      image.alt = `Ansicht des Website-Projekts ${data.title}`;
      image.width = 1440; image.height = 1000;
      body.append(image);
    }
    if (data.mascot) {
      const mascot = document.createElement('img');
      mascot.src = data.mascot;
      mascot.alt = 'Der Otter von Ludonect';
      mascot.className = 'project-mascot';
      mascot.width = 319; mascot.height = 340;
      body.append(mascot);
    }
    const intro = document.createElement('p'); intro.textContent = data.intro; body.append(intro);
    const heading = document.createElement('h3'); heading.textContent = key === 'ludonect' ? 'Das Spielprinzip' : 'Worum es im Projekt geht'; body.append(heading);
    const list = document.createElement('ul');
    data.points.forEach(point => {const item = document.createElement('li'); item.textContent = point; list.append(item);});
    body.append(list);
    if (key === 'ludonect') {
      const note = document.createElement('p');
      note.textContent = 'Das Projekt pausiert aktuell. Die Projektwebsite ist erreichbar, das Onlinespiel derzeit nicht verfügbar.';
      body.append(note);
    }
    if (key === 'verschoenerei') {
      const note = document.createElement('p');
      note.textContent = 'Dieses Projekt befindet sich aktuell in der Umsetzung.';
      body.append(note);
    }
    if (data.url) {
      const links = document.createElement('div');
      links.className = 'project-website';
      const link = document.createElement('a');
      link.className = 'button';
      link.href = data.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Website besuchen';
      link.setAttribute('aria-label', `${data.title}: Website besuchen (öffnet in neuem Tab)`);
      const address = document.createElement('span');
      address.className = 'project-website-address';
      address.textContent = new URL(data.url).hostname;
      links.append(link, address);
      body.prepend(links);
    }
    projectDialog.scrollTop = 0;
    projectDialog.showModal();
}

document.addEventListener('click', event => {
  const project = event.target.closest('[data-project]');
  if (project && projectDialog) showProject(project.dataset.project);
  const close = event.target.closest('[data-close]');
  if (close) close.closest('dialog')?.close();
});
projectDialog?.addEventListener('click', event => {
  if (event.target !== projectDialog) return;
  const rect = projectDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) projectDialog.close();
});
