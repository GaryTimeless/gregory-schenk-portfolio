# ExpertSearch unter g-schenk.de

## Richtung und Umfang

13.11.2026: Unterseite des bestehenden Portfolios im selben Repository, kein Domainumzug. Kompaktes Werkzeug mit Produktadresse, Marktauswahl und einer ruhigen Vergleichsliste. Vorhandene lokale Syne-Schrift, g-Marke und Pfirsichflächen bleiben erkennbar. Farben: Pfirsich #f3e6dd, Papier #fffaf6, Petrol #183f45, gedämpftes Grün #52665f, Linie #d7d6cb. Links bündig, Preise rechts, Fehlermeldungen bei den Ergebnissen. Keine dekorativen Kennzahlen oder Marketingsektionen. Ein großes Formular und klare Preiszeilen dienen der konkreten Suche; dadurch bleibt die Seite ein Werkzeug innerhalb des Portfolios.

## Stand

Greg hat die vorübergehende Nutzung seines MacBooks ausdrücklich beauftragt. Der API-Dienst läuft für einen begrenzten Zeitraum ausschließlich auf Loopback, erreichbar über Cloudflare Quick Tunnel ohne Konto. `expertsearch/config.json` enthält dessen temporäre HTTPS-Adresse und expiresAt. Nach Ablauf deaktiviert die Oberfläche Liveabfragen und kennzeichnet den gespeicherten Vergleich. Der Supervisor beendet API, Tunnel und Schlafverhinderung automatisch. Kein Dauerbetrieb oder automatischer Neustart.

DeepCode-Run `20261113T090042Z-ca678f18` (deepseek-v4-pro, Thinking low) erreichte nach 420 Sekunden den Timeout ohne gelieferte Frontenddateien; Codex hat die Oberfläche übernommen. Keine zweite kostenpflichtige Worker-Runde gestartet. Der ursprüngliche Prototyp und die Marktlistenanalyse bleiben als Vorarbeit erhalten.

## Dateien und Veröffentlichung

`expertsearch/` wird vom bestehenden `scripts/build_pages.py` nach `_site/expertsearch/` kopiert. Die bisherige Portfolio-Startseite, CNAME und Vorschauablaufsteuerung bleiben erhalten. Backend-Code unter `expertsearch-service/` wird nicht nach `_site` kopiert.

Der temporäre Mac-Dienst wird in expertsearch-service/README.md beschrieben. Nutzerlink: https://g-schenk.de/expertsearch/. Datenschutzangaben wurden um den tatsächlich verwendeten Quick Tunnel und den lokalen Abfrageablauf ergänzt. Ein Cloudflare Worker bleibt nur eine vorbereitete Alternative und wurde nicht bereitgestellt.

Die 361er-Marktliste stammt aus DJGorex/expert-checker und ist eine datierte Ausgangsliste, keine aktuelle Vollständigkeitsgarantie. Gespeicherte Preise sind keine Livepreise. Ein unbestätigter Marktpreis wird nie als günstigstes bestätigtes Angebot angezeigt.

## Fehlerfestigkeit · 13.11.2026

Ein Verbindungsabbruch im Quick Tunnel kann als HTTP 502 ohne CORS-Header erscheinen. Die Oberfläche wiederholt einen vorübergehend fehlgeschlagenen Fünferblock einmal; danach bleiben Fehler als eigene Marktantworten sichtbar und die nächsten Märkte werden verarbeitet. Nach drei aufeinanderfolgenden ausgefallenen Blöcken pausiert die Suche. „Nicht erreichte Märkte weiterprüfen“ lädt nur fehlende oder vorübergehend fehlgeschlagene Märkte nach und erhält erfolgreiche Ergebnisse. 403/429 werden nicht automatisch wiederholt.

Der Adapter begrenzt Upstream-Anfragen auf sechs Sekunden und einen Block auf 30 Sekunden. Einzelne 404/5xx/ungültige Antworten stoppen andere Märkte nicht. DNS-/Socketfehler erhalten eine ausdrückliche 503-Antwort mit CORS. Das private API-Log enthält nun Anfrage-ID, Markt-ID, Fehlercode, Upstream-Pfad/-Status und Dauer; keine Besucher-IP, Cookies oder Zugangsdaten. Tunnel-Logs können weiterhin technische Verbindungsdaten enthalten und bleiben außerhalb des öffentlichen Builds.
