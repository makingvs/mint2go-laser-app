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
- Keine vorgefertigten Bilder: Bild-Upload (Foto -> Umrisse, src/trace.ts, src/imageDialog.ts) und SVG-Upload; Online-Suche (Iconify)
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

## Bedienung (Regeln)
- Jeder Export/Download verlangt einen vom Benutzer selbst eingetippten Dateinamen, KEIN Vorschlag (src/saveDialog.ts, sanitizeFileName); Speichern startet direkt im Tipp auf ✓ (Teilen-Menü braucht eine Benutzeraktion)
- Text-Teile merken Schrift/Wortlaut (El.text) und sind über die Taste "Schrift" nachträglich änderbar (replaceText)
- Layout: Größen über CSS-Variablen je Fensterhöhe (:root + @media max-height 760/640); nach Layout-Änderungen auf mehreren Größen prüfen (Überdeckungen/Abschneiden)

- Tastatur: deutsches Layout QWERTZ (src/keyboard.ts) für Text und Suche
- Seitenverhältnis-Sperre (Schloss) gilt auch fürs Ziehen an den Ecken; aufgehoben = freies Strecken
- Nichts darf Inhalte überdecken: keine absolut positionierten Tasten über scrollenden Listen (Info-Symbol im Kopfbereich)

## Schriften und Lizenzen (verbindlich)
- Text: Block (eigene Strichschrift) + 7 Webschriften (src/fonts.ts), alle SIL OFL 1.1 ohne Reserved Font Name; Text wird per Canvas gezeichnet und mit src/trace.ts zu Umrissen
- Neue Schrift/Bildquelle NUR mit: Lizenzdatei in public/licenses/ (scripts/copy-licenses.mjs für Schriften), Eintrag in THIRD-PARTY-NOTICES.md,
  Eintrag in FONTS bzw. SET_CREDITS, @font-face in style.css. tests/licenses.test.ts prüft das.
- Online-Bildersuche: nur Fluent Emoji (MIT, Microsoft). Noto Emoji ausgeschlossen (widersprüchliche Lizenz: OFL-Datei vs. Apache laut README/Iconify)
- In der App: Info-Symbol (Startseite, unten links) -> Seite "Lizenzen & Quellen" (src/licenses.ts)
- Linke Leiste: 3 Gruppen (Formen+Freihand | Bild/SVG/Suche | Text); Formen über Auswahl (openShapes), 29 Formen in src/shapes.ts (SHAPE_GROUPS)
- Alle Werkzeugtasten tragen die Schrift unter dem Symbol (lab() in src/dom.ts, Klasse .labeled)

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
- src/shapes.ts, src/text.ts: Grundformen, Blockschrift; src/trace.ts: Bild -> Umrisse
- src/svgImport.ts: Import von SVG-Dateien (eigener Pfad-/Transform-Parser)
- src/storage.ts: IndexedDB-Speicher (Profile, Arbeiten, Einstellungen); src/exporter.ts + src/zip.ts: Export/ZIP
- src/svgExport.ts: Export für XCS
- src/editor.ts: Arbeitsfläche, Gesten, Zeichnen, Export, Autospeichern
- src/screens.ts: Profile + Galerie; src/teacher.ts: Lehrkraft-Bereich
- server/server.mjs: optionaler Server (nicht von der App benutzt); tests/: Vitest

## Geführter Modus (Laser-Werkstatt)
- 20 Projekte aus der MINT2Go Laser-Werkstatt, gezeichnet in der App statt im xTool Studio; Daten `src/guided/projects.ts`, reine Prüflogik `src/guided/engine.ts` (Snapshot-Prüfungen, testbar)
- Coach-Leiste im Editor (`coach.ts`), Auswahl-Bildschirm (`werkstatt.ts`), Fenster (`dialogs.ts`); Fortschritt in `Design.guide`
- Vorlagen (SVG in mm: rot = Schneiden, blau = Gravieren) über `svgToTemplate`; neue Taste Mitte
- Farben/Typen bleiben fest (Schneiden rot, Gravieren blau, Füllen schwarz)

## 3D-Druck-App (app3d/, eigene App im selben Repo)
- Ziel: wie die Laser-App, aber für den 3D-Drucker. Kinder zeichnen (Formen/Freihand/Text/SVG) und geben Höhe (Extrusion) UND kombinieren 3D-Grundkörper (vereinen/ausschneiden). Export STL + 3MF (Dateiname vom Kind getippt, wie bei der Laser-App)
- three.js (MIT) ist die einzige Laufzeit-Bibliothek der 3D-App (vom Nutzer freigegeben, nur für die Ansicht); Geometrie/Mesh/STL/3MF selbst schreiben. Für Vereinen/Ausschneiden (CSG) VOR Phase 4 nochmal fragen (Bibliothek oder selbst)
- Aufbau: app3d/index.html + app3d/src/ (Quellen), app3d/public/ (Manifest, Icons, config.json mit Bett/Düse); Build `vite.3d.config.ts` -> dist/3d/ mit eigenem Service Worker (`node scripts/make-sw.mjs 3d`, eigener Cache-Name)
- Befehle: `npm run dev:3d` (Port 5174), `npm run build` baut beide Apps; Tests liegen in tests/ (importieren aus ../app3d/src)
- Koordinaten: Ursprung Mitte Druckbett, x rechts, y hinten, z oben (z = 0 ist das Bett), Maße in mm
- Reine Logik ohne three.js (testbar): app3d/src/bed.ts (Bauraum), app3d/src/orbit.ts (Kamera); Ansicht: app3d/src/view3d.ts
- Phasen 3D: 1 Gerüst + Ansicht · 2 Körper platzieren/skalieren/drehen · 3 Zeichnen + Höhe · 4 Kombinieren (CSG) · 5 Export STL/3MF + Druckprüfung · 6 Profile/Galerie/Speichern/Lehrkraft · 7 Feinschliff/Klassentest
- Offen: Druckermodell (Standard 220 x 220 x 250 mm, Düse 0,4 mm in app3d/public/config.json), eigenes App-Symbol für 3D (aktuell Kopie der Laser-App)

## Stand
27.10.2026 (3D Phase 1): Gerüst der 3D-App (app3d/): eigener Build nach dist/3d/ mit eigenem Service Worker, 3D-Ansicht mit three.js (Druckbett mit Raster, Bauraum-Rahmen, Testwürfel), Kamera per Touch (1 Finger drehen, 2 Finger zoomen/verschieben, Maus: Ziehen/Rad/Umschalt), Haus-Taste = Ansicht zurücksetzen. 118 Tests grün (9 neu: bed, orbit), Build ok, im Browser geprüft (Drehen, Zoomen). Nicht auf iPad getestet.
27.10.2026: Geführter Modus (Laser-Werkstatt, 20 Projekte) mit Coach-Leiste, automatischer Prüfung, Vorlagen und Fortschritt; Taste Mitte. 109 Tests grün, im Browser durchgespielt (Türschild komplett, Zahnräder/Schatzkiste/Laterne/Labyrinth-Vorlagen, Zeichenfläche-Schritt, Fortschritt). Nicht auf iPad getestet.
27.10.2026: Deutsche Tastatur (QWERTZ), Dateiname ohne Vorschlag, freies Ziehen an Ecken ohne Seitenverhältnis-Sperre, Info-Symbol aus der Kartenliste, ultra-kompaktes Layout (< 540 px). 98 Tests grün.
26.10.2026 (Layout/Dateiname/Schrift ändern): Layout-Prüfung auf 7 Fenstergrößen (ohne Befund nach Anpassung: höhenabhängige Größen, Formen-Auswahl im Fenster, Zahlentastatur/Dialoge scrollbar, Galerie-Tasten unter dem Bild), Dateiname vor jedem Export, Text/Schrift nachträglich änderbar. 94 Tests grün.
26.10.2026 (Icons/Beschriftung/Formen): Symbole vereinheitlicht (Formen-Symbole mit gleicher optischer Größe, neue Symbole für Fläche/Formen/Freihand), Schrift unter allen Werkzeugtasten, 29 vorgefertigte Formen in 3 Gruppen. 92 Tests grün.
26.10.2026 (Leiste/Schriften/Lizenzen): Leiste gruppiert, Formen-Auswahl (9 Formen), Freihand direkt darunter; 8 Schriftarten für Text; Lizenzprüfung:
Schriften OFL (Texte beigelegt), Noto Emoji aus der Suche entfernt, Fluent Emoji MIT mit Hinweis in der App; Test für Lizenzdateien. 87 Tests grün.
26.10.2026: Tier-Symbole vergebener Benutzer gesperrt, Benutzer löschbar (Galerie, Mülleimer); Zoom (+, −, ganze Fläche, Verschieben
per Ziehen auf leerer Stelle); vorgefertigte Bilder, Bilder-Knopf, Grafiken-Ordner und Server-Bibliothek entfernt; Bild-Upload
(Umwandlung in Vektor mit Schieberegler/Umkehren) und SVG-Upload. 82 Tests grün, im Browser geprüft.
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
