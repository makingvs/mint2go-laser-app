# Laser-Zeichen-App

Eigenständige Web-App für Kinder (6–10 Jahre): Formen, Bilder, Text und Freihandzeichnungen am iPad gestalten und als **SVG** für den Laser (xTool S1, xTool Creative Space) exportieren.

- Kein Server, kein Konto, keine Cloud nötig: Arbeiten werden **auf dem Gerät** gespeichert (IndexedDB).
- Nach dem ersten Öffnen läuft die App **offline** (Service Worker) und lässt sich als Symbol auf den **Home-Bildschirm** legen (Vollbild, Querformat).
- Das „Senden“ an einen PC ist vorerst ausgeklammert (siehe unten „Später: Senden“).

## App öffnen (iPad)

**https://makingvs.github.io/mint2go-laser-app/** – auf dem iPad in Safari öffnen oder den QR-Code scannen (Kamera-App):

![QR-Code zur App](docs/ipad-qr.png)

Dann Teilen-Symbol → **Zum Home-Bildschirm**, einmal von dort starten – danach läuft die App auch offline. Die Seite wird bei jedem Push auf `main` automatisch neu gebaut und veröffentlicht (`.github/workflows/pages.yml`, GitHub Pages).

## Design (MINT2Go)

Die Oberfläche folgt dem Corporate Design von **MINT2Go – MINT erleben**: weiß, freundlich, rund, modern.

| Rolle | Farbe | Wert |
| --- | --- | --- |
| Primär / Aktionen (Exportieren, Bestätigen) | Grün (Wortmarke) | `#98C227` |
| Akzent | Orange | `#F0A030` |
| Akzent / Löschen | Pink | `#E01070` |
| Auswahl, Hilfslinien | Hellblau | `#38B8E8` |
| Griffe, Rahmen | Dunkelblau | `#3757A9` |
| Text | Schiefer (Tagline) | `#4D597C` bzw. `#2F3A5F` |

- **Farben/Tokens:** `:root` in `src/style.css` (`--m-green`, `--m-orange` …). Farben für Schneiden/Gravieren/Fläche (Rot/Blau/Schwarz) bleiben bewusst unverändert – sie sind die Laserfarben der SVG.
- **Schrift:** Jost (Variable, SIL Open Font License 1.1), über das Paket `@fontsource-variable/jost` mitgeliefert – funktioniert offline. Weitere Schriften für Text: siehe „Text und Schriftarten“.
- **Logo:** `public/mint2go-logo.png` (Startseite; langer Druck darauf öffnet den Lehrkraft-Bereich). Wird die Datei ersetzt, ändert sich das Logo überall.
- **Zierelemente:** Zahnräder im Hintergrund und die Schaltkreis-Linie (grüner Punkt, orange/pinke Strecke, Ring) – `src/decor.ts`. Profilkarten wechseln die Akzentfarbe (Grün, Orange, Pink, Blau).
- **App-Symbol:** drei Zahnräder in den CD-Farben, erzeugt mit `node scripts/make-icons.mjs`.

## Verteilen

`npm run build` erzeugt den Ordner **`dist/`**: das ist die fertige App. Er ist reine statische Webseite und kann überall liegen:

| Weg | So geht's | Offline-Betrieb |
| --- | --- | --- |
| **Eigene Webadresse (empfohlen)** | Inhalt von `dist/` auf einen beliebigen Webspace legen (Schulserver, GitHub Pages, Netlify, Cloudflare Pages …). Muss **https** sein. | ja |
| **Lokaler Rechner im Schulnetz** | `server\start.bat` (Node.js nötig) liefert `dist/` im WLAN aus; Hinweise zur Firewall unter „Lokaler Server“. | nur über https/localhost – über http läuft die App, aber ohne Offline-Cache |

Die Pfade sind relativ (`base: './'`), die App funktioniert daher auch in einem Unterordner (z. B. `https://schule.example/laser/`). Ein Doppelklick auf `dist/index.html` funktioniert **nicht** (Browser blockieren Module bei `file://`).

### Auf dem iPad einrichten

1. Adresse in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. Einmal vom Home-Bildschirm aus öffnen (lädt alles für den Offline-Betrieb).

### Vor dem Verteilen anpassen (einmalig am PC)

- **`public/config.json`**: Standard-Plattengröße (mm), die drei Farben und die Mindestgröße für alle Geräte. Die Datei wird beim Bauen mitgeliefert (nach dem Bauen auch in `dist/config.json` änderbar).
- Danach `npm run build` und `dist/` verteilen. Neue Version = gleiche Adresse neu bespielen. Die iPads laden sie beim nächsten Start mit Netz im Hintergrund; die App lädt sich dann beim nächsten Wechsel zur Galerie von selbst neu (nie mitten in einer Arbeit).

## Export der SVGs

**Vor jedem Export/Download muss der Benutzer selbst einen Dateinamen eintippen** – es gibt keinen Vorschlag, und ohne Namen ist Speichern nicht möglich (die Endung `.svg` bzw. `.zip` steht fest daneben). Ungültige Zeichen (` / : * ? " < > |`) werden entfernt, ein leerer Name ist nicht möglich. Das gilt für die grüne Export-Taste, für „Arbeit exportieren“ in der Galerie und für beide ZIP-Exporte.

- **Exportieren-Taste** (grün, oben rechts): Auf dem iPad öffnet sich das **Teilen-Menü** → „In Dateien sichern“, AirDrop, Mail … Auf dem Computer wird die Datei heruntergeladen. Dateiname: `<Kind>_<Datum>_<Uhrzeit>.svg`.
- **Galerie**: Pfeil-Taste an jeder Arbeit = diese Arbeit exportieren; Pfeil oben rechts = **alle Arbeiten dieses Kindes als ZIP**.
- **Lehrkraft-Bereich → „Alle SVGs als ZIP exportieren“**: alle Kinder, je ein Ordner pro Kind.
- Die SVG hat die Größe der Platte in mm; Schneiden = rot, Gravieren = blau, Fläche = schwarz (Farben änderbar). Gleiche Bearbeitungsarten werden vereint, Text liegt als Pfad vor.

Wichtig: Arbeiten liegen **nur auf dem jeweiligen iPad**. Wer Arbeiten dauerhaft braucht, exportiert sie. Löscht Safari die Website-Daten (z. B. „Verlauf und Websitedaten löschen“, oder bei längerer Nichtbenutzung im Browser), sind sie weg; als Home-Bildschirm-App ist der Speicher geschützter, trotzdem regelmäßig sichern.

## Lehrkraft-Bereich

**1,5 Sekunden lang** auf den freien Bereich in der Mitte der oberen Leiste (im Editor) bzw. auf das ✨ (Startseite) drücken. Dort: Plattengröße, die drei Farben, Mindestgröße (zu dünne Stellen bekommen ein Warndreieck), alle Arbeiten als ZIP exportieren. Die Einstellungen gelten **je Gerät**; „Standardwerte“ setzt auf `config.json` zurück.

## Phase 0 – Vorab-Tests in xTool Creative Space (einmalig)

- [ ] `phase0\Test-3-Farben.svg` (rot/blau/schwarz, 100 × 40 mm) in XCS importieren: Es müssen **drei Ebenen** entstehen, Größe 100 × 40 mm.
- [ ] Jeder Ebene Laser-Parameter für **Pappel 3 mm** zuweisen und als Vorlage speichern. Die App-Farben bleiben immer gleich, damit die Vorlage jedes Mal passt.
- [ ] Eine in der App exportierte SVG importieren: Größe stimmt auf den Millimeter?

## Zeichenfläche (pro Arbeit)

Beim Anlegen einer **neuen Arbeit** (Plus in der Galerie) wählen die Kinder zuerst die Zeichenfläche:

- **∞ Unendlich** – frei zeichnen. Die Ansicht wächst mit dem Inhalt (sie schrumpft nie, damit nichts springt). Beim Export wird die SVG auf den Inhalt zugeschnitten (Größe = Rahmen um alle Teile, ab Punkt 0/0).
- **Rechteck** – Breite und Höhe in mm (Vorgabe: Standardgröße aus dem Lehrkraft-Bereich bzw. `config.json`).
- **Kreis / Oval** – beginnt als Kreis (Schloss), entsperrt ergibt Breite ≠ Höhe ein Oval.
- **Dreieck, Stern, Herz** – feste Form, Größe per Zahlentastatur (Seitenverhältnis gesperrt).
- **Eigene Form** – SVG-Datei oder Foto hochladen (z. B. der Umriss des Rohlings: Tasse, Untersetzer, Brett …); Fotos werden wie beim Bild-Upload in Umrisse umgewandelt.

Die Zeichenfläche erscheint als Werkstück (Holzfarbe, Umriss, Gitter alle 10 mm) auf grauem Grund. Teile, die über das Werkstück hinausstehen, bekommen ein **rotes Warnzeichen** (nicht gesperrt, damit nichts verloren geht). Mit der Taste **Zeichenfläche** (gestrichelter Rahmen, oben links neben Wiederholen) lässt sich die Fläche später ändern; das ist nicht Teil von „Rückgängig“.

Die exportierte SVG hat die Größe der Zeichenfläche in mm (Rechteck: Breite × Höhe; Kreis/Form: Umgebungsrechteck). Der Umriss des Werkstücks selbst wird **nicht** mitexportiert. Ältere Arbeiten ohne Zeichenfläche bekommen das Standardrechteck.

## Maße in mm

Ist ein Teil ausgewählt, zeigt die Leiste unter der Fläche **Breite**, **Höhe** (mm) und **Drehung** (°). Antippen öffnet eine große Zahlentastatur (Komma für Dezimalstellen, die erste Ziffer ersetzt den alten Wert). Das **Schloss** in der Mitte hält das Seitenverhältnis (Standard: gesperrt); entsperrt lassen sich Breite und Höhe unabhängig ändern (Teil wird gestreckt). Kleinstes Maß 1 mm. Die Werte aktualisieren sich live, wenn ein Teil mit den Fingern verschoben, gedreht oder skaliert wird; jede Änderung lässt sich rückgängig machen.

## Bilder aus dem Internet (Suche)

Die **Lupe** links öffnet die Bildersuche. Die Kinder tippen ein Wort (eigene Buchstabentasten, auch Umlaute) oder wählen ein Vorschlagsbild; die Treffer erscheinen als Vorschau, Antippen fügt das Bild als Form ein (Schere/Stift/Farbrolle wie bei allen Formen). Das gewählte Bild wird in der Arbeit gespeichert und funktioniert danach offline; nur die Suche selbst braucht Internet.

- **Quelle:** [Iconify](https://iconify.design) (offene Schnittstelle `api.iconify.design`, Suche + SVG-Abruf, Lizenz je Sammlung). SVG Repo wurde geprüft und scheidet aus: keine dokumentierte API, automatische Abrufe werden mit einer Bot-Prüfung (HTTP 429) abgewiesen.
- **Erlaubte Sammlungen** (nur mit eindeutiger Lizenz): Fluent Emoji High Contrast (einfarbig, am besten zum Gravieren) und Fluent Emoji Flat, beide MIT-Lizenz, © Microsoft Corporation. Noto Emoji ist bewusst ausgeschlossen (widersprüchliche Lizenzangaben, siehe `THIRD-PARTY-NOTICES.md`). Änderbar in `public/config.json` unter `onlineSearch.sets`; `"enabled": false` schaltet die Suche ab (z. B. ohne Internet).
- **Deutsch → Englisch:** Die Sammlungen sind englisch benannt, deshalb übersetzt die App rund 300 Kinderwörter (Katze → cat, auch Mehrzahl). Unbekannte Wörter werden unverändert gesucht (Englisch geht also auch).
- **Kindersicherung:** Ungeeignete Begriffe werden in Suche und Ergebnissen gesperrt (Liste in `src/online.ts`). Das ist ein Filter, keine Garantie – die Lehrkraft bleibt in der Verantwortung.
- **Aussehen:** Farbige Bilder werden zur einfarbigen Silhouette (weiße Flächen gelten als Hintergrund, Überlappungen werden vereint); die Vorschau zeigt deshalb schon die Silhouette.
- **Lizenzen:** Die Lizenzen stehen im Lehrkraft-Bereich. Für MIT/Apache gilt: Lizenzhinweis der Sammlungen beilegen, wenn Bilder weitergegeben werden; die Sammlungen selbst nennen die Rechteinhaber (Microsoft, Google).

## Bedienung für Kinder

- Links, in drei Gruppen: **grün** = Formen (öffnet eine Auswahl mit 29 vorgefertigten Formen in drei Gruppen) und direkt darunter Freihandzeichnen; **blau** = Bild hochladen, SVG hochladen, Bildersuche (Lupe); **pink** = Text. Rechts: Schere (schneiden), Stift (gravieren), Farbrolle (Fläche gravieren).
- Antippen wählt ein Teil aus: mit dem Finger verschieben, Eckpunkte ziehen = Größe, blauer Kreis = drehen (rastet bei 15°), zwei Finger = Größe + Drehen.
- Oben: Galerie, Rückgängig, Wiederholen, Kopieren, Löschen (mit Bestätigung), **Exportieren** (grün).
- Arbeiten werden automatisch gespeichert. Ein rotes Wolken-Symbol oben heißt: Speichern klappt nicht (z. B. privater Modus).

## Entwicklung

```bash
npm install
npm test          # Vitest: Geometrie, Export, Import, Speicher, ZIP, Suche, Server
npm run build     # Typprüfung + Build nach dist/ + Service Worker
npm run dev       # Vite-Entwicklungsserver (Port 5173)
npm run preview   # gebaute App lokal ansehen
node scripts/make-icons.mjs   # App-Symbol neu erzeugen
```

Technik: TypeScript + Vite, keine Laufzeit-Bibliotheken. Vereinigung überlappender Formen, Glättung, Blockschrift (Großbuchstaben, Ä Ö Ü, Ziffern, `. ! ? -`), SVG-Import und ZIP-Schreiber sind selbst geschrieben; es gibt keine vorgefertigten Bilder mehr. Speicher: IndexedDB (`src/storage.ts`); Löschen verschiebt in einen Papierkorb-Speicher.

## Beschriftung der Tasten und vorgefertigte Formen

Alle Werkzeugtasten haben die **Schrift unter dem Symbol** (Galerie, Zurück, Vor, Fläche, Kopie, Löschen, Export; Formen, Freihand, Bild, SVG, Suche, Text; Schneiden, Gravieren, Füllen; Größer, Kleiner, Alles). Die Formen-Auswahl enthält 29 Formen:

- **Grundformen:** Kreis, Oval, Quadrat, Rechteck, abgerundetes Quadrat, Dreieck, Fünfeck, Sechseck, Achteck, Raute, Trapez, Parallelogramm, Halbkreis, Viertelkreis
- **Sterne & Herzen:** Stern, Sechsstern, Zackenstern, Herz, Blume
- **Zeichen:** Pfeil, Kreuz, Blitz, Mond, Wolke, Tropfen, Sprechblase, Haus, Ring, Rahmen (Ring und Rahmen haben ein Loch, das beim Schneiden mit ausgeschnitten wird)

Neue Formen: in `src/shapes.ts` ergänzen (ID, Gruppe, Name, Geometrie); Symbol und Auswahl entstehen automatisch, `tests/shapes.test.ts` prüft sie.

## Tastatur

Text und Bildersuche nutzen eine Bildschirmtastatur im **deutschen Layout (QWERTZ)**: Ziffernreihe mit ß und Löschen, darunter QWERTZUIOPÜ, ASDFGHJKLÖÄ (jeweils wie auf einer echten Tastatur versetzt), YXCVBNM mit Komma, Punkt und Bindestrich, Umschalt (Groß/Klein, nur beim Text) und Leertaste. Definition: `src/keyboard.ts` (`GERMAN_ROWS`).

## Größe ändern an den Ecken

Mit der **Seitenverhältnis-Sperre** (Schloss, Standard) ändert das Ziehen an einer Ecke Breite und Höhe gemeinsam. Ist die Sperre **aufgehoben**, folgen Breite und Höhe dem Finger unabhängig voneinander (auch bei gedrehten Teilen) – das Teil lässt sich frei strecken. Das Schloss wirkt damit auf die Zahleneingabe und auf das Ziehen gleichermaßen. (Zwei Finger skalieren weiterhin gleichmäßig.)

## Text nachträglich ändern

Ein Text-Teil antippen, dann oben die Taste **Schrift**: Es öffnet sich die Texteingabe mit dem vorhandenen Wortlaut und der aktuellen Schrift. Schrift und/oder Text ändern, ✓ – Lage, Drehung, Bearbeitungsart (Schere/Stift/Farbrolle) und die Größe, die das Kind eingestellt hat (relativ zur Standardgröße), bleiben erhalten. Der Schritt lässt sich mit „Zurück“ rückgängig machen. (Die Taste ist nur bei ausgewähltem Text aktiv.)

## Bildschirmgrößen

Die Oberfläche passt sich der Fensterhöhe an (normal ab ca. 760 px, kompakt darunter, sehr kompakt unter 640 px: kleinere Tasten, Dialoge höchstens so hoch wie das Fenster, Formen-Auswahl bleibt im Fenster). Geprüft mit einem Skript, das in allen Ansichten und Dialogen (Startseite, Benutzer, Lehrkraft, Lizenzen, Galerie, Zeichenfläche wählen, Editor, Formen-Auswahl, Text, Schrift ändern, Suche, Zahlentastatur, Dateiname) überdeckte, abgeschnittene und außerhalb liegende Tasten sucht: ohne Befund bei 1366×1024, 1180×820, 1133×744, 1024×768, 1024×650, 900×600 und 800×560. Zusätzlich gibt es eine **ultra-kompakte** Stufe unter 540 px Höhe (z. B. Computer mit 150–200 % Skalierung): ohne Befund bei 960×480, 1280×600 und 1920×960. Bei vielen Benutzern/Arbeiten (13 Benutzer, 9 Arbeiten geprüft) überdeckt nichts mehr die Karten: Das Info-Symbol sitzt oben rechts im Kopfbereich statt unten links über der Kartenliste. Hochformat zeigt den Hinweis „Gerät drehen“.

## Text und Schriftarten

Die Text-Taste (pink) öffnet eine Eingabe mit Buchstabentasten (Umlaute, ß, Ziffern, Satzzeichen; **Pfeil-Taste** = Groß/Klein) und einer Reihe **Schriftmuster „Abc“** zum Antippen. Zur Wahl stehen acht Schriften: **Block** (eigene Strichschrift, Vektor), Jost, Fredoka, Baloo 2, Rubik Mono One, Bangers, Caveat und Pacifico. Der Text wird mit der gewählten Schrift gezeichnet, in Umrisse umgewandelt (`src/fonts.ts`, `src/trace.ts`) und wie jede Form eingefügt (Schere/Stift/Farbrolle, Größe/Drehen, Export als Pfad). Zu dünne Stellen bekommen das Warndreieck.

## Lizenzen

Alle mitgelieferten Schriften stehen unter der **SIL Open Font License 1.1**; Urheberhinweise und Lizenztexte liegen in `public/licenses/` und werden mit der App ausgeliefert. Die Bilder der Suche sind MIT-lizenziert (Microsoft Fluent Emoji). In der App zeigt das **Info-Symbol** unten links auf der Startseite die Seite „Lizenzen & Quellen“ mit allen Hinweisen und den Lizenztexten. Gesamtübersicht und Regeln fürs Erweitern: [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md). Ein Test (`tests/licenses.test.ts`) stellt sicher, dass jede Schrift und jede freigeschaltete Bildersammlung einen Lizenztext und Urheberhinweis hat.

## Bilder hochladen

Links in der Leiste gibt es zwei Tasten (die vorgefertigten Bilder und der Bilder-Knopf wurden entfernt):

- **Bild hochladen** (Bild mit Pfeil): ein Foto oder Bild aus Fotos/Dateien/Kamera wählen. Es öffnet sich die **Umwandlung in Vektor**: links das Original, rechts das Ergebnis als Schwarz-Weiß-Umriss. Mit dem **Schieberegler** wird die Helligkeitsgrenze eingestellt, mit dem **Kontrast-Knopf** hell/dunkel vertauscht (die App rät das automatisch: der kleinere Teil des Bildes ist der Vordergrund). Mit ✓ wird das Ergebnis als Form eingefügt (Schere/Stift/Farbrolle, Größe, Drehen wie bei allen Formen) und beim Exportieren Teil der SVG.
- **SVG hochladen** (Dokument mit Pfeil): eine SVG-Datei wählen. Überlappende Formen werden vereint, Löcher bleiben Löcher, weiße Füllungen gelten als Hintergrund. Text, eingebettete Bilder, Verläufe, `<use>` und Masken werden übersprungen; Dateien über 2 MB werden abgelehnt. Nur Dateien verwenden, deren Lizenz das erlaubt.

Technik der Umwandlung: `src/trace.ts` (Graustufen, Otsu-Schwellwert, Marching Squares, Glätten, Vereinfachen; Flecken unter 0,02 % der Bildfläche werden ignoriert), Oberfläche `src/imageDialog.ts`. Bilder werden auf höchstens 512 Pixel Kantenlänge verkleinert. Es werden nur die Umrisse (Zweifarbigkeit) erkannt – keine Farben, keine Verläufe.

## Benutzer

Beim Anlegen eines neuen Benutzers sind **Tier-Symbole, die schon vergeben sind, gesperrt** (ausgegraut). Auch ein bereits vorhandener Name wird abgelehnt. Ein Symbol wird erst wieder frei, wenn der Benutzer **gelöscht** wurde: In der Galerie des Benutzers die rosa **Mülleimer-Taste** oben rechts antippen und bestätigen. Seine Arbeiten werden dabei nicht endgültig vernichtet, sondern in den Papierkorb-Speicher des Geräts verschoben (nicht mehr in der App sichtbar).

## Zoom

Rechts unter den Werkzeugen: **＋** vergrößert, **－** verkleinert (stufenweise ×1,5, bis 800 %), die Taste mit dem Rahmen zeigt wieder die **ganze Arbeitsfläche**. Die Prozentzahl steht darunter. Die Maße in mm ändern sich dabei nicht – nur der Ausschnitt. Im vergrößerten Zustand lässt sich der Ausschnitt verschieben, indem man auf eine **leere Stelle** der Fläche tippt und zieht. Ein ausgewähltes Teil wird beim Vergrößern in die Mitte genommen. Zwei Finger auf der Fläche zoomen nicht, sondern skalieren/drehen wie bisher das ausgewählte Teil.

## Geführter Modus: Laser-Werkstatt

In der Galerie führt die orange Karte **Laser-Werkstatt** zu den **20 Projekten** der MINT2Go Laser-Werkstatt (4 Stufen: Starter, Gravur-Profi, Schneide-Meister, Erfinder). Die Zeichnungen entstehen **direkt in dieser App** (nicht im xTool Studio). Ein Projekt wählen → „Los geht’s“ → im Editor erscheint oben über der Fläche die **Coach-Leiste**:

- Sie zeigt den aktuellen Schritt (Symbol, kurze Anweisung) und **hebt die passende Taste** hervor (pulsierender Rahmen).
- Das **Ergebnis wird automatisch geprüft** (z. B. „Breite 120, Höhe 60“, Name liegt auf dem Schild, Loch im Tier, Typ Schneiden/Gravieren/Füllen, Teile innerhalb der Fläche, keine zu dünnen Stellen). Passt es, springt der Coach nach einem Moment zum nächsten Schritt. Gelb/grau erscheinen Hinweise wie „Jetzt: Breite 12 mm. Gesucht: 120 mm“.
- Pfeil-Tasten gehen vor/zurück (jeder Schritt lässt sich auch ohne Treffer überspringen), **ⓘ** zeigt Warnung, Tipp und Profi-Wissen, der Pfeil ganz rechts klappt die Leiste klein.
- Schritte ohne Zeichnen (Farbe auftragen, Kleben, Lasern, Waschen) werden von Hand mit dem grünen Pfeil bestätigt; der Schritt „Abschicken“ ist erledigt, sobald die SVG exportiert wurde (Dateiname bestimmt das Kind selbst).
- Zu den Projekten 14, 17, 19 und 20 gibt es **Vorlagen** (Zahnräder, Schatzkiste, Laterne, Labyrinth): Die Taste „Vorlage laden“ setzt die Zeichenfläche auf die Vorlagengröße und fügt die Teile ein (rote Linien = Schneiden, blaue = Gravieren). Dateien: `public/werkstatt/vorlagen/*.svg`, Bilder der Projekte: `public/werkstatt/pics/*.jpg`.
- Zeichenfläche statt „Hilfsform“ (Projekte 4, 6, 10, 16), Suche statt „Tier-Formen“, **Bild-Taste** statt Foto in xTool (Umkehren für Schiefer), neue Taste **Mitte** unter der Fläche (zentriert das Teil im nächstgrößeren Teil bzw. in der Fläche).
- Der Fortschritt wird je Arbeit gespeichert (Plakette 🛠️/✓ in der Galerie, Balken in der Werkstatt). Am Ende: Fertig-Fenster mit Ideen und den **Laser-Werten für die Lehrperson** (Material, Leistung, Tempo); die 5 Laser-Regeln stehen unter 🛡️.

Projektdaten und Schritte: `src/guided/projects.ts`, Prüfungen: `src/guided/engine.ts`, Oberfläche: `coach.ts`, `werkstatt.ts`, `dialogs.ts`, `guided.css`.

## Lokaler Server (optional)

Im Ordner `server/` liegt ein kleiner Node.js-Server (ohne Abhängigkeiten): `start.bat` liefert `dist/` im Schulnetz aus, `wlan-einrichten.bat` öffnet einmalig (als Administrator) den Port 3000 in der Windows-Firewall für das lokale Netz, `autostart-installieren.bat` startet ihn mit Windows. Für die App selbst ist er **nicht nötig**; er bietet außerdem die Schnittstellen für das spätere „Senden“ (`POST /api/send` → Ordner `Laser-Eingang`).

## Später: Senden

Ausgeklammert. Vorbereitet ist der Server (`server/server.mjs`: `/api/send`, Profile, Projekte). Die App müsste dazu wieder eine „Senden“-Taste bekommen, die die exportierte SVG per `fetch` dorthin schickt.
