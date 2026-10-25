(() => {
  const current = location.pathname.match(/entwurf-([abc])\.html$/)?.[1];
  if (!current || document.getElementById('entwurf-switcher')) return;

  // Shadow DOM keeps this shared navigation independent of each draft's styling.
  const host = document.createElement('aside');
  host.id = 'entwurf-switcher';
  host.setAttribute('aria-label', 'Entwurfsauswahl');
  const root = host.attachShadow({ mode: 'open' });
  const designs = [
    ['a', 'Gastlich', 'Das gastliche Jugendstilhaus'],
    ['b', 'Klar & direkt', 'Einfach gut ankommen'],
    ['c', 'Gartenpause', 'Gartenpause in Karlsruhe'],
  ];
  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; z-index: 2147483000; left: 12px; top: 50%; transform: translateY(-50%); color-scheme: light; }
      * { box-sizing: border-box; }
      .panel { width: 132px; padding: 8px; border: 1px solid #d8cab7; border-radius: 14px; background: #fffcf5; box-shadow: 0 6px 30px #27140730; font: 12px/1.3 system-ui, sans-serif; color: #32251d; max-height: calc(100dvh - 24px); overflow-y: auto; }
      button { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 32px; border: 0; border-radius: 6px; padding: 5px 6px; background: transparent; color: #5b1715; font: 600 12px/1.3 system-ui, sans-serif; cursor: pointer; }
      button:hover { background: #f1e6d7; }
      button span:last-child { font-size: 16px; }
      nav { display: grid; gap: 7px; padding-top: 5px; }
      nav[hidden] { display: none; }
      a { display: block; padding: 4px; border: 2px solid transparent; border-radius: 8px; text-decoration: none; color: #32251d; background: #f0e9de; }
      a:hover { border-color: #c88205; background: #fff; }
      a[aria-current] { border-color: #8b0000; background: #fff; color: #8b0000; }
      img { display: block; width: 100%; height: 62px; object-fit: cover; object-position: top; border-radius: 3px; background: #e8dfd1; }
      .label { display: flex; align-items: center; gap: 5px; padding-top: 5px; white-space: nowrap; }
      .letter { display: inline-grid; place-items: center; min-width: 19px; height: 19px; border-radius: 4px; background: #fff; font-weight: 750; }
      a[aria-current] .letter { background: #8b0000; color: #fff; }
      :is(a,button):focus-visible { outline: 3px solid #175e9b; outline-offset: 2px; }
      @media (max-width: 900px) { :host { top: auto; bottom: max(12px, env(safe-area-inset-bottom)); transform: none; } }
      @media (prefers-reduced-motion: no-preference) { a,button { transition: background .15s, border-color .15s; } }
    </style>
    <div class="panel">
      <button type="button" aria-controls="designs" aria-expanded="true" title="Entwurfsauswahl einklappen">
        <span>Entwürfe</span><span class="indicator" aria-hidden="true">−</span>
      </button>
      <nav id="designs" aria-label="Zwischen den drei Entwürfen wechseln">
        ${designs.map(([key, label, title]) => `
          <a href="entwurf-${key}.html" ${key === current ? 'aria-current="page"' : ''} aria-label="Entwurf ${key.toUpperCase()}: ${title}${key === current ? ' (aktuell)' : ''}" title="${title}">
            <img src="previews/${key}-desktop.jpg" alt="" width="100" height="62">
            <span class="label"><span class="letter">${key.toUpperCase()}</span>${label}</span>
          </a>`).join('')}
      </nav>
    </div>`;
  const button = root.querySelector('button');
  const nav = root.querySelector('nav');
  const smallScreen = matchMedia('(max-width: 900px)');
  let manuallyToggled = false;
  const setOpen = (open) => {
    nav.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.title = `Entwurfsauswahl ${open ? 'einklappen' : 'ausklappen'}`;
    root.querySelector('.indicator').textContent = open ? '−' : '+';
  };
  setOpen(!smallScreen.matches);
  button.addEventListener('click', () => {
    manuallyToggled = true;
    setOpen(nav.hidden);
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !nav.hidden) {
      manuallyToggled = true;
      setOpen(false);
      button.focus();
    }
  });
  smallScreen.addEventListener('change', () => {
    if (!manuallyToggled) setOpen(!smallScreen.matches);
  });
  document.body.append(host);
})();
