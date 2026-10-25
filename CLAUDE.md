# Laser-Zeichen-App für Kinder

## Ziel
Eigenständige Web-App (PWA) für Kinder von 6–10 Jahren auf dem iPad. Sie gestalten Grafiken
für den Laser xTool S1 (Pappelsperrholz 3 mm) aus Formen, fertigen Grafiken, Text und
Freihandzeichnungen und exportieren sie als SVG (Teilen-Menü / Download / ZIP). Die Lehrkraft
öffnet die Dateien in xTool Creative Space. Die App muss verteilbar sein (statische Dateien).

## Technik
- Entwicklung unter Windows, kein Mac vorhanden
- Web-App für Safari auf dem iPad, als Home-Bildschirm-App im Vollbild, nur Querformat
- HTML, CSS, TypeScript, gebaut mit Vite (Tests: Vitest); Ausgabe dist/ = statische Webseite
- KEIN Server nötig: Speicher auf dem Gerät (IndexedDB, src/storage.ts), Offline über Service
  Worker (scripts/make-sw.mjs), Pfade relativ (base './')
- Einstellungen je Gerät (Lehrkraft-Bereich); Standardwerte in public/config.json
- Bilder-Bibliothek: Grafiken/<Thema>/*.svg wird beim Bauen eingepackt (scripts/build-library.mjs)
- Senden an den PC ist vorerst AUSGEKLAMMERT. server/ (Node, ohne Abhängigkeiten) bleibt für
  später bzw. zum lokalen Ausliefern (start.bat, wlan-einrichten.bat, autostart-installieren.bat)
- Bibliotheken nur nach Rückfrage -> bisher keine Laufzeit-Bibliothek: Vereinigung, Glättung,
  Schrift, SVG-Import, ZIP sind selbst geschrieben
- Touch und Apple Pencil über Pointer Events
- Alle Maße intern in Millimetern
- Kernlogik (Geometrie, SVG-Export, Speicher, ZIP) mit Tests absichern

## Design (MINT2Go-CD)
- Farben aus dem Logo: Grün #98C227, Orange #F0A030, Pink #E01070, Hellblau #38B8E8, Dunkelblau #3757A9, Schiefer #4D597C
- Schrift Jost (@fontsource-variable/jost, OFL), Logo public/mint2go-logo.png, Zierelemente src/decor.ts, Tokens in :root von src/style.css
- Laserfarben (Rot/Blau/Schwarz) NICHT ans CD anpassen: sie sind die Linienfarben der SVG-Ebenen

## Zeichenfläche
- Pro Arbeit (design.surface): unendlich (free) oder Werkstück rect/ellipse/shape mit Maßen in mm (src/surface.ts, src/surfaceDialog.ts)
- Auswahl beim Anlegen einer neuen Arbeit und per Taste im Editor; Standardmaße = Settings.plate; Export-Größe = Fläche (free: Inhaltsrahmen)
- Teile über dem Werkstück: rotes Warnzeichen, kein Zwang; alte Arbeiten ohne surface -> Standardrechteck

## Maße und Online-Suche
- Maße-Leiste unter der Fläche (src/editor.ts, src/numpad.ts): Breite/Höhe in mm, Drehung, Schloss = Seitenverhältnis
- Bildersuche (src/online.ts, src/onlineSearch.ts): Iconify-API, DE->EN-Wörterbuch, Kinder-Blockliste,
  erlaubte Sammlungen in public/config.json (onlineSearch). SVG Repo geprüft: keine API, Bot-Sperre (429) -> nicht nutzbar

## Export
- Taste "Exportieren": Teilen-Menü auf Touch-Geräten (navigator.share mit Datei), sonst Download
- Galerie: je Arbeit exportieren, alle Arbeiten eines Kindes als ZIP; Lehrkraft-Bereich: alle Kinder
- Dateiname: <Kindname>_<Datum>_<Uhrzeit>.svg

## Bearbeitungsarten (feste Farben, nie ändern ohne Rückfrage)
- Schneiden: Linie, Farbe ROT (#FF0000), Werkzeug-Icon Schere
- Gravieren: Linie, Farbe BLAU (#0000FF), Werkzeug-Icon Stift
- Flächengravur: Füllung, Farbe SCHWARZ (#000000), Icon Farbrolle

## SVG-Export
- width/height in mm, viewBox in mm
- Nur Pfade (Text in Pfade umwandeln), keine Bilder, keine Effekte
- Überlappende Formen gleicher Art vereinen, keine doppelten Schnittlinien
- Flächengravur nur für geschlossene Formen
- Dateiname: <Kindname>_<Datum>_<Uhrzeit>.svg

## Kindgerechte Oberfläche
- Keine Texte nötig, alles über Icons; Touchflächen mindestens 60 px
- Rückgängig immer sichtbar, Löschen nur mit Bestätigung
- Arbeitsfläche entspricht der echten Plattengröße
- Kein Zoomen der Seite, kein Textmarkieren, kein Herunterziehen
- Lehrkraft-Einstellungen versteckt hinter langem Druck

## Arbeitsweise
- Immer nur die aktuelle Phase umsetzen, vorher kurzen Plan zeigen
- Nach jeder Phase: Tests laufen lassen, Git-Commit, Abschnitt Stand aktualisieren
- Bei Unklarheit fragen statt raten

## Phasen
0 Vorab-Tests · 1 Projektgerüst · 2 Arbeitsfläche + Formen ·
3 Werkzeuge · 4 SVG-Export · 5 Senden · 6 Profile + Speichern ·
7 Text · 8 Grafik-Bibliothek · 9 Freihandzeichnen ·
10 Lehrkraft-Bereich · 11 Klassentest

## Code-Überblick
- src/geometry.ts: Ringe, Vereinigung (unionShapes), Glättung, Marching Squares
- src/model.ts: Element/Entwurf, Treffertest, Rückgängig (History)
- src/shapes.ts, src/graphics.ts, src/text.ts: Formen, Grafik-Bibliothek, Blockschrift
- src/svgImport.ts: Import von SVG-Dateien der offenen Bibliothek (eigener Pfad-/Transform-Parser, Ordner Grafiken/<Thema>/*.svg, API /api/library)
- src/storage.ts: IndexedDB-Speicher (Profile, Arbeiten, Einstellungen, eigene SVGs); src/exporter.ts + src/zip.ts: Export/ZIP
- src/svgExport.ts: Export für XCS
- src/editor.ts: Arbeitsfläche, Gesten, Zeichnen, Export, Autospeichern
- src/screens.ts: Profile + Galerie; src/teacher.ts: Lehrkraft-Bereich
- server/server.mjs: optionaler Server (nicht von der App benutzt); tests/: Vitest

## Stand
25.10.2026 (Design): Oberfläche im MINT2Go-CD (Logo, Farben, Jost, Zahnräder, Schaltkreis-Linie, neues App-Symbol). Browser-Sichtprüfung ok.
25.10.2026 (Zeichenfläche): Unendlich/Rechteck/Kreis-Oval/Dreieck/Stern/Herz/eigener Umriss je Arbeit, Warnzeichen bei Überstand,
Export in Flächengröße, App aktualisiert sich selbst (Service-Worker-Wechsel nur außerhalb des Editors). 74 Tests grün, im Browser geprüft.
Offen: Schwenken/Zoomen auf der unendlichen Fläche (aktuell wächst die Ansicht automatisch); Fläche ändern ist nicht Teil von Rückgängig.
25.10.2026 (später): Maße in mm editierbar (Zahlentastatur), Online-Bildersuche über Iconify. 65 Tests grün,
im Browser geprüft (echte Iconify-Anfrage "Katze", Import, Breite/Höhe/Drehung, Schloss, Mindestmaß, Rückgängig).
Nicht auf iPad getestet. Silhouetten farbiger Emoji verlieren innere Details (weiße Flächen = Hintergrund).
25.10.2026: App zur eigenständigen, verteilbaren PWA umgebaut (lokaler Speicher, Export statt
Senden, Offline-Cache, Bibliothek eingebacken). Tests (npm test) und Build (npm run build) laufen;
im Browser-Vorschaufenster geprüft: Profil/Arbeit anlegen, Neuladen (Arbeit bleibt), Bibliothek,
Export per Download und per (simuliertem) Teilen-Menü, ZIP, Service-Worker-Cache. ZIP öffnet sich
mit Windows (Expand-Archive).
NOCH NICHT AUF ECHTER HARDWARE GETESTET: Teilen-Menü/Dateien-App und Offline-Start auf dem iPad,
Zwei-Finger-Gesten, Apple Pencil, XCS-Import (Phase 0), Klassentest (Phase 11).
Offen: Hosting (https) festlegen; Lizenz weiterer Grafiken; ob/wie später "Senden" zurückkommt.
Git-Repository wurde noch nicht angelegt / nichts committet.
