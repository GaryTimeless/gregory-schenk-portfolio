# Gregory Schenk · Portfolio

Offizielle persönliche Portfolio-Website von Gregory Schenk.

**Website:** https://g-schenk.de/

Statisches HTML, CSS und JavaScript. Die Hauptseite nutzt direkte E-Mail-Links an gregoryschenk@me.com. Impressum und Datenschutz sind als eigene Seiten erreichbar. Keine Analysewerkzeuge oder eingebetteten externen Schriften. Alle Referenzen öffnen Projektdetails im Popup; vorhandene Website-Links stehen im jeweiligen Popup. Ludonect ist als pausiertes Projekt gekennzeichnet.

GitHub Pages veröffentlicht über `.github/workflows/pages.yml` das erzeugte Verzeichnis `_site`. Die Datei `CNAME` enthält die eigene Domain und muss erhalten bleiben. Frühere Gestaltungsrichtungen sind ausschließlich im Git-Branch `archiv/portfolio-entwuerfe` aufbewahrt und werden nicht über GitHub Pages veröffentlicht.

Die unverlinkte Kundenvorschau unter `/kundenprojekt/` ist öffentlich und ohne Passwort abrufbar. Sie trägt `noindex`; das ist kein Zugriffsschutz. Ihr vorgesehener Zeitraum steht in `preview-source/manifest.json`. Der Build nimmt nach Ablauf die Projektseiten und Bilder aus der veröffentlichten Ausgabe und zeigt nur noch eine Abschlussseite. Geplante GitHub-Läufe am 8. November lösen die Entfernung aus; sie können sich verzögern oder ausfallen. Bei Bedarf Workflow manuell starten. Es gibt keine Zusage einer minutengenauen Sperrung.

Die Kundenvorschau ist ausdrücklich ohne Passwort und ohne eigenes Repository-Secret veröffentlicht. Ihre HTML-Dateien und Bilder liegen unter `preview-source/pension-anita/` im öffentlichen Repository. Die Ablaufsteuerung entfernt die Dateien aus der ausgelieferten Website, nicht aus der Git-Historie oder bereits gespeicherten Kopien.

`python3 scripts/build_pages.py` erzeugt die Ausgabe ohne zusätzliche Bibliotheken oder Schlüssel. Die bisherigen Portfolio-Dateien werden unverändert kopiert.

Lokal mit `python3 -m http.server 8768 --bind 127.0.0.1` öffnen.

Die lokal eingebundene Schrift Syne steht unter der SIL Open Font License; siehe `assets/Syne-OFL.txt`.


## ExpertSearch-Unterseite (vorbereitet)

`expertsearch/` ergänzt die statische Ausgabe um `/expertsearch/`: Produktadresse,
Marktauswahl aus 361 hinterlegten Filialen, sortierte Ergebnisse und CSV-Export.
Eine leere `expertsearch/config.json`-Eigenschaft `apiBase` deaktiviert Liveabfragen
und kennzeichnet das gespeicherte Beispiel mit seinem tatsächlichen Abrufdatum.
GitHub Pages allein kann die Expert-API wegen deren CORS-Beschränkung nicht
im Browser abfragen. Der vorbereitete optionale Serverdienst und seine noch
offene Hostingauswahl stehen in [expertsearch-service/README.md](expertsearch-service/README.md).

Prüfungen: `node --test expertsearch-service/worker.test.mjs scripts/expertsearch.test.mjs`.
Für lokale UI- und Live-QA: erst Pages-Build ausführen, dann
`node scripts/preview_expertsearch.mjs` (nur Loopback, maximal 20 Expert-Aufrufe).
Mit `--fixtures` stattdessen synthetische Testantworten verwenden. Der Dienst-Code
wird nicht mit der Pages-Ausgabe ausgeliefert. Kein neuer Produktionsdienst ist
hierdurch gestartet. [Projektstand und Gestaltung](docs/expertsearch.md).
