# ExpertSearch unter g-schenk.de

## Richtung und Umfang

13.11.2026: Unterseite des bestehenden Portfolios im selben Repository, kein Domainumzug. Kompaktes Werkzeug mit Produktadresse, Marktauswahl und einer ruhigen Vergleichsliste. Vorhandene lokale Syne-Schrift, g-Marke und Pfirsichflächen bleiben erkennbar. Farben: Pfirsich #f3e6dd, Papier #fffaf6, Petrol #183f45, gedämpftes Grün #52665f, Linie #d7d6cb. Links bündig, Preise rechts, Fehlermeldungen bei den Ergebnissen. Keine dekorativen Kennzahlen oder Marketingsektionen. Ein großes Formular und klare Preiszeilen dienen der konkreten Suche; dadurch bleibt die Seite ein Werkzeug innerhalb des Portfolios.

## Stand

Frontend, Pages-Build und optionaler Worker-Adapter sind vorbereitet. Noch kein Produktionsbackend ausgewählt/gestartet. `expertsearch/config.json` enthält absichtlich eine leere apiBase. Die Seite zeigt in diesem Zustand ausdrücklich einen gespeicherten Vergleich mit dessen Abrufdatum und deaktiviert Liveabfragen. Sie ist damit noch kein fertig freigegebener Live-Preisvergleich.

DeepCode-Run `20261113T090042Z-ca678f18` (deepseek-v4-pro, Thinking low) erreichte nach 420 Sekunden den Timeout ohne gelieferte Frontenddateien; Codex hat die Oberfläche übernommen. Keine zweite kostenpflichtige Worker-Runde gestartet. Der ursprüngliche Prototyp und die Marktlistenanalyse bleiben als Vorarbeit erhalten.

## Dateien und Veröffentlichung

`expertsearch/` wird vom bestehenden `scripts/build_pages.py` nach `_site/expertsearch/` kopiert. Die bisherige Portfolio-Startseite, CNAME und Vorschauablaufsteuerung bleiben erhalten. Backend-Code unter `expertsearch-service/` wird nicht nach `_site` kopiert.

Der optionale Live-Dienst wird in expertsearch-service/README.md beschrieben. Für volle Nutzung benötigt er ein ausgewähltes Hostingkonto und seine HTTPS-URL in config.json. Geplanter Nutzerlink bleibt https://g-schenk.de/expertsearch/. Datenschutzangaben vor Aktivierung an den tatsächlichen Backendanbieter anpassen.

Die 361er-Marktliste stammt aus DJGorex/expert-checker und ist eine datierte Ausgangsliste, keine aktuelle Vollständigkeitsgarantie. Gespeicherte Preise sind keine Livepreise. Ein unbestätigter Marktpreis wird nie als günstigstes bestätigtes Angebot angezeigt.
