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
- Laufzeit-Bibliotheken der 3D-App (vom Nutzer freigegeben): three.js (MIT, nur Ansicht) und manifold-3d (Apache-2.0, WebAssembly, nur Vereinen/Ausschneiden, wird erst beim ersten Vereinen geladen); Geometrie, Mesh, Extrusion, STL/3MF selbst schreiben
- Aufbau: app3d/index.html + app3d/src/ (Quellen), app3d/public/ (Manifest, Icons, config.json mit Bett/Düse); Build `vite.3d.config.ts` -> dist/3d/ mit eigenem Service Worker (`node scripts/make-sw.mjs 3d`, eigener Cache-Name)
- Befehle: `npm run dev:3d` (Port 5174), `npm run build` baut beide Apps; Tests liegen in tests/ (importieren aus ../app3d/src)
- Koordinaten: Ursprung Mitte Druckbett, x rechts, y hinten, z oben (z = 0 ist das Bett), Maße in mm
- Reine Logik ohne three.js (testbar): bed.ts (Bauraum), orbit.ts (Kamera), mesh.ts (8 Grundkörper als geschlossene Dreiecksnetze im Einheitsquader), model3d.ts (Part, Maße/Grenzen/freier Platz), gizmo.ts (Rechnung der Griffe), history.ts (Rückgängig); Darstellung/Gesten: view3d.ts, Oberfläche: editor3d.ts, Symbole: icons3d.ts
- Bedienung 3D: linke Leiste = Körper setzen (Würfel, Kugel, Zylinder, Kegel, Pyramide, Dach, Kuppel, Ring); Antippen wählt, Ziehen verschiebt (rastet auf 1 mm); Griffe am gewählten Körper: orange Ecke = Größe, blau oben = Höhe, rosa Ring = Drehen (5°-Raster); Maße-Leiste: Breite/Tiefe/Höhe/Drehung/Abstand zum Bett (Zahlentastatur aus src/numpad.ts), Schloss = gleichmäßig skalieren (Standard an), Mitte; Körper außerhalb des Bauraums rot + Warnzeichen (kein Zwang)
- Zeichnen (Phase 3): Taste Körper (Auswahl der 8 Grundkörper), Formen (29 aus der Laser-App), Freihand (Skizzenfläche 120x80 mm: Fläche oder dicke Linie in 3 Breiten, Striche werden gerastert und per trace.ts zu Umrissen vereint), Text (Block + 7 Webschriften, QWERTZ), SVG-Datei. Danach fragt die App mit der Zahlentastatur nach der Höhe (Abbrechen = Starthöhe: Formen 10, Skizze/SVG 8, Text 5 mm). Umriss -> Körper: extrude.ts (eigenes Ear-Clipping mit Lochbrücken, geschlossene Netze), Part.kind 'extrude' mit Part.outline (normierter Umriss, y nach hinten)
- Kombinieren (Phase 4): Taste Loch (Voll <-> Loch, Loch durchscheinend orange, wird nicht gedruckt) und Vereinen (csg.ts): der gewählte Körper wird mit allen vereint, die ihn berühren/überlappen (auch über Ketten, Berührung per manifold geprüft), volle Körper = Summe, Löcher werden abgezogen; Ergebnis = ein Körper Part.kind 'mesh' (Netz im Einheitsquader in meshStore.ts, Part.meshId; Netze liegen nur im Speicher -> in Phase 6 mit speichern). Rückgängig stellt die Einzelteile wieder her
- Export (Phase 5, printExport.ts): Taste Export (grün, Kopfleiste) -> endgültiges Netz (alle vollen Körper vereint, alle Löcher abgezogen, auch ohne vorheriges Vereinen; manifold) -> Prüffenster ohne Text (Bauraum, Schwebt = Stück berührt das Bett nicht, Dünne Stellen = Strich < 2 Düsen; grüner Haken oder oranges Warnzeichen, sperrt nichts) + Wahl STL (binär) / 3MF (mm, ZIP) -> Dateiname vom Kind getippt (src/saveDialog.ts, kein Vorschlag, Speichern direkt im Tipp auf ✓) -> Teilen-Menü/Download (Dateityp beim Teilen `application/octet-stream`, siehe shareMime: mit `model/stl` zeigte das iPad LocalSend nicht an, weil dessen Share-Erweiterung nur Bild/Video/Text/Link/Datei annimmt; Versuch, noch nicht auf dem iPad bestätigt; Ersatz: "In Dateien sichern" und dort teilen, oder eigene Download-Taste). Koordinaten im Export: Ursprung vordere linke Bettecke (x+Breite/2, y+Tiefe/2)
- Profile/Galerie/Speichern (Phase 6): eigene Datenbank `mint2go-3d` (storage3d.ts, getrennt von der Laser-App, auch unter gleicher Adresse; Profile also getrennt); Speicher je Arbeit: Körper + Netze der vereinten Körper (designIO.ts packDesign/unpackDesign) + Vorschaubild (View3d.snapshot, JPEG); Autospeichern 600 ms nach jeder Änderung und beim Verlassen/Ausblenden der App; Löschen = Papierkorb-Speicher; Bildschirme wie Laser-App (screens3d.ts, CSS aus der Laser-CSS per `node scripts/extract-css.mjs` nach app3d/src/shared.css erzeugt, nicht von Hand ändern)
- Lehrkraft-Bereich (teacher3d.ts, langer Druck 1,5 s auf das Logo): Druckbett (Breite/Tiefe/Bauhöhe, Voreinstellungen Ender 3/Prusa MK4/Bambu), Düse, Standard-Dateiart (STL/3MF, gilt für Galerie und ZIP), alle Arbeiten aller Kinder als ZIP (<Kind>/<Kind>_<Datum>_<Uhrzeit>.stl|3mf); Standardwerte in app3d/public/config.json (bed, nozzle, format); Info-Symbol = Lizenzen (licenses3d.ts)
- Körper auf Körper (support.ts): beim Verschieben fällt ein Körper, der auflag, auf die höchste Fläche unter seiner Bodenfläche (Auflagepunkte = Bodeneckpunkte + Raster, Löcher tragen nicht, Körper auf ihm zählen nicht; z. B. Text auf einen Quader für ein Namensschild); Mitte rastet an der Mitte anderer Körper ein (2,5 mm); Taste Mitte lässt aufliegende Körper weiter aufliegen. Z per Ziehen: grüner Griff an der linken Seitenwand (mit Linie zum Bett), ganze mm, rastet auf der Auflage ein (2 mm); schwebende Körper behalten beim Verschieben ihre Höhe
- Neue Werkzeuge (für die Werkstatt): Kippen (rechte Leiste, Fenster mit Pfeilen und 5/15/45/90°; backt den Körper in ein Netz, `Part.tilt` zählt die Grad, Herkunft in `tag`), Spiegeln (Umriss/Netz wirklich gespiegelt), Ausrichten (Mitte auf Mitte mit dem Körper, den er am meisten überlappt), Röhre (Umriss-Ring, Wand = 1/6 Radius) und Zahnrad (Zähne 8–24 über Zahlentastatur, Modul 2,5 mm, Achsloch 5,5 mm; Räder greifen im Abstand (Zähne A + Zähne B) x 1,25 mm) in der Körper-Auswahl, Kopie merkt den Abstand (Kopie einer Kopie springt gleich weit). Reine Logik: transform.ts, shapes3d.ts. Löcher fallen beim Verschieben nicht auf andere Körper
- 3D-Werkstatt (app3d/src/werkstatt/): 20 Projekte der MINT2Go Tinkercad-Werkstatt (Quelle: https://pages.schule-tirol.com/ef0b734d20/, 8–10 Jahre) für 6-Jährige umgeschrieben (kurze Sätze, Symbole; kein Vorlesen), 4 Stufen (Starter, Loch-Profi, Baumeister, Erfinder), alle frei wählbar. engine3d.ts (Schritte, Prüfungen, Hilfe-Aktionen), projects3d.ts (Daten), help.ts (Lösungsweg, nur für den Durchspiel-Test, nicht in der Oberfläche), coach3d.ts (Erklärung als auf-/zuklappbares Pop-up über der Ansicht: Karte <-> Pille "n/N", animiert: Aufpoppen, Schritt-Wechsel, Zeigehand, Sterne bei Erfolg; automatisches Abhaken), werkstatt3d.ts (Auswahl, Sterne), dialogs3dw.ts (Infos, Druck-Regeln, Fertig mit Konfetti). Vorschaubilder der Karten = die Original-Bilder der Werkstatt-Seite (app3d/public/werkstatt/pics/01..20.jpg). Fortschritt in Design.guide {project, step, done}; Galerie-Eintrag 3D-Werkstatt; Projekt 4 ist nur eine Übung (nicht abschicken); Projekt 19 ohne Gelenk (Flügel-Tier). tests/werkstatt.test.ts spielt jedes Projekt mit der Hilfe komplett durch und prüft Export/Druckprüfung
- Phasen 3D: 1 Gerüst + Ansicht · 2 Körper platzieren/skalieren/drehen · 3 Zeichnen + Höhe · 4 Kombinieren (CSG) · 5 Export STL/3MF + Druckprüfung · 6 Profile/Galerie/Speichern/Lehrkraft · 7 Feinschliff/Klassentest
- Offen: Druckermodell (Standard 220 x 220 x 250 mm, Düse 0,4 mm in app3d/public/config.json), eigenes App-Symbol für 3D (aktuell Kopie der Laser-App)

## Sperre und Hand-Werkzeug (Laser-App)
- El.locked: gesperrte Teile sind nicht verschiebbar/skalierbar/drehbar, Art, Schrift, Löschen und Mitte gesperrt (Guards in editor.ts: pointerDown, setOp, editDim, centerSelected, remove, replaceText); Taste Sperre/Frei in der Kopfleiste, Schloss-Plakette im Bild
- Hand-Modus (handMode): Gesten hzoom (zwei Finger, anchoredCenter in surface.ts) und pan; Mausrad zoomt im Hand-Modus

- Fangen (snap.ts): beim Verschieben rasten Kanten/Mitten an Kanten/Mitten anderer Teile und der Fläche ein (Fangabstand 9 px * mm/px), rosa Führungslinien nur während des Ziehens; Taste Fangen links (Standard an, localStorage laser.snap)

- Box-Generator (boxgen.ts, boxDialog.ts, box.css): Steckbox mit Fingerzinken; Teile als graphic-Elemente (ref box:<teil>), op cut, locked; Kantenmodell: je Kante Abschnitte mit Rücksprung 0/t (pattern/cubeEdge), Eck-Würfel gehören Vorne/Hinten, Umriss aus panelOutline; Kerf-Ausgleich = Versatz des Umrisses um (Kerf − Passung)/2 nach außen; Passprobe fitTestSheet (Kerf 0,05–0,25); Werte in localStorage laser.box; Numpad hat decimals (2 für Kerf)

## Stand
30.10.2026 (Box-Generator): Steckbox-Generator (Innen/Außen, Deckel offen/lose/fest, Zinken, Schnittbreite- und Passungs-Ausgleich) mit Passprobe, Eintrag in der Galerie. Tests: auch die 3D-Prüfung (Hülle lückenlos, keine Überschneidung) für alle Deckelarten; 327 Tests grün; im Browser geprüft (Dialog auf 5 Größen, Box und Passprobe erzeugt, SVG-Export 1 roter Pfad). Schnittbreite 0,15 mm ist ein NICHT nachgemessener Startwert; nicht auf dem Laser getestet. Offen: Scharnier/Schiebedeckel, Beschriftung auf Seiten.
30.10.2026 (Fangen): Objektfang beim Verschieben in der Laser-App mit Führungslinien und Taste Fangen. 311 Tests grün (7 neu), im Browser geprüft (Einrasten am Flächenrand, Linie, aus = frei); linke Leiste bei ca. 768 px Höhe kompakter, 5 Größen ohne Überdeckung. Nicht auf iPad getestet.
30.10.2026: Laser-App: Objekt sperren (Taste Sperre/Frei, gespeichert) und Hand-Werkzeug (Zoom mit zwei Fingern/Mausrad, Verschieben mit einem Finger). 263 Tests grün, im Browser geprüft (Sperre hält gegen Ziehen, bleibt nach Neuladen, Pinch x3, Verschieben, Mausrad); Layout auf 6 Größen ohne Überdeckung, bei ca. 768 px Höhe kleinere Tasten rechts. Nicht auf iPad getestet (echte Zwei-Finger-Gesten).
28.10.2026 (3D-Werkstatt Nachbesserung): Vorlesen und Zeig-mir entfernt; Erklärung als animiertes Pop-up (auf-/zuklappbar, Pille mit Schrittzähler) statt fester Leiste; Karten mit den Original-Bildern; Griffe am Körper größer (Sicht 18 px, Treffer 44 px) und mit Pixel-Abstand (Höhe 56, Größe 40, Anheben 64, Drehring mind. 92), auch bei kleinen Körpern gut zu greifen. Im Browser auf 960x540 und 1024x768 geprüft. Offen: nicht auf dem iPad mit Fingern getestet; Quelle/Lizenz der Original-Bilder (Tinkercad-Screenshots der Werkstatt-Seite) ist noch zu klären.
28.10.2026 (3D-Werkstatt): 20 Projekte als geführter Modus für 6-Jährige (Coach-Leiste, automatische Prüfung, Zeig-mir-Hilfe, Vorlesen, Sterne, Fertig-Fenster) und neue Werkzeuge Kippen, Spiegeln, Ausrichten, Röhre, Zahnrad, Kopie merkt Abstand. 300 Tests grün (41 neu: Werkzeuge, Projektdaten, alle 20 Projekte werden mit der Hilfe komplett durchgespielt und sind druckbar). Im Browser durchgespielt: Türschild bis Fertig-Fenster mit Export (STL-Name), Handyständer (Kippen, Festkleben), Röhre/Kippen/Zahnrad frei; Layout auf 960x540, 1024x768, 1133x744 geprüft. Offen: nicht auf dem iPad getestet (Vorlesen/Sprachausgabe, Finger); Projekt-Schritte sind für 6-Jährige noch nicht mit echten Kindern erprobt; Zahnräder greifen nur als Spielzeug (Trapez-Zähne); Griffe verdecken kleine Körper.
28.10.2026 (3D Teilen-Menü): STL/3MF werden mit Dateityp `application/octet-stream` geteilt (Versuch, damit LocalSend im iPad-Teilen-Menü erscheint, was mit `model/stl` fehlte; SVG der Laser-App funktioniert, weil iOS es als Bild kennt). 259 Tests grün. Offen: Wirkung auf dem iPad bestätigen; falls LocalSend weiter fehlt: Download-Taste im Speichern-Fenster (Datei landet in Dateien, dort teilen).
27.10.2026 (3D Nachbesserung): Körper direkt auf Körper legen (Text auf Quader fällt beim Verschieben auf die Oberseite, Mitte-auf-Mitte-Einrasten) und Z-Achse per Ziehen (grüner Anheben-Griff). 258 Tests grün (14 neu: Stützhöhe, Einrasten, Anheben), im Browser durchgespielt (Text auf Quader: Abstand 6 mm, Anheben auf 19 mm, zurück einrasten auf 6, vom Quader auf das Bett: fällt auf 0). Offen: auf kleinen Fenstern verdecken die Griffe kleine Körper; nicht auf iPad getestet.
27.10.2026 (3D Phase 6): Profile, Galerie, Speichern, Lehrkraft-Bereich der 3D-App. Arbeiten (auch vereinte Körper) überstehen Neuladen, Galerie mit Vorschaubild, Export je Arbeit und alle als ZIP, Benutzer/Arbeiten löschen mit Bestätigung, Lehrkraft: Bett/Düse/Dateiart. 244 Tests grün (8 neu: Speicher, Laden/Speichern, ZIP), im Browser durchgespielt (Benutzer anlegen, Arbeit bauen, Neuladen, ZIP-Download, Einstellungen, Löschen), alle Bildschirme auf 960x540, 1024x768, 1133x744 geprüft. Offen: Profile gelten nur in der 3D-App (nicht die der Laser-App); Text-Körper merken Schrift/Wortlaut nicht; Phase 7 (Feinschliff/Klassentest); nicht auf iPad getestet (IndexedDB, Teilen-Menü).
27.10.2026 (3D Phase 5): Export STL und 3MF mit Dateiname vom Kind, Druckprüfung (Bauraum, Schwebt, Dünne Stellen). Löcher/Vereinigung werden beim Export automatisch angewendet. 236 Tests grün (13 neu: Netz, STL-Bytes, 3MF-Inhalt, Prüfung), im Browser durchgespielt (Prüffenster, 3MF-Download mit getipptem Namen, Netz nachgerechnet: Würfel mit Kugel-Delle), Kopfleiste auf 960x540/1024x768 geprüft. Offen: weder STL noch 3MF mit echtem Slicer geöffnet; Teilen-Menü auf dem iPad nicht getestet; Profile/Speichern (Phase 6).
27.10.2026 (3D Phase 4): Kombinieren: Loch-Taste und Vereinen (manifold-3d): bündige Flächen, Ketten, Löcher, Text auf Platte; Ergebnis garantiert geschlossen. 223 Tests grün (11 neu: csg), im Browser durchgespielt (Würfel mit Kugel-Loch vereint, Rückgängig/Wiederholen), Kopfleiste auf 960x540/1024x768 geprüft. Offen: Löcher und volle Körper werden erst in Phase 5 beim Export automatisch angewendet (Löcher nicht gedruckt); Netz-Körper werden noch nicht gespeichert (Phase 6); nicht auf iPad getestet.
27.10.2026 (3D Phase 3): Zeichnen und Höhe geben: Formen, Freihand-Skizze, Text (8 Schriften), SVG -> Körper mit Höhe (eigene Extrusion, alle 29 Formen und Text als geschlossene Netze getestet). Linke Leiste auf 5 Tasten (Körper-Auswahl statt 8 Tasten). 212 Tests grün, Formen/Text/Skizze/SVG im Browser durchgespielt, Dialoge auf 960x540, 1024x768, 1133x744 geprüft. Offen: Text-Teile merken Schrift/Wortlaut noch nicht (nachträgliches Ändern fehlt); Foto -> Umrisse nicht übernommen; nicht auf iPad getestet (Skizze mit Finger/Pencil).
27.10.2026 (3D Phase 2): Körper setzen/auswählen/verschieben/skalieren/drehen (Griffe + Maße in mm mit Zahlentastatur), Kopie, Löschen mit Bestätigung, Rückgängig/Wiederholen, rote Warnung außerhalb des Bauraums. Layout auf 1024x768, 1133x744, 1366x1024, 960x540 geprüft (nichts überdeckt/abgeschnitten). 155 Tests grün (37 neu: mesh, model3d, gizmo), Griffe/Maße/Löschen/Rückgängig im Browser durchgespielt. Feinschliff: Höhen-Griff mit Schloss richtet sich nach dem größten Maß (flache Körper wie der Ring werden nicht riesig). Offen: Körper nur um die senkrechte Achse drehbar (Kippen fehlt); nicht auf iPad getestet.
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
