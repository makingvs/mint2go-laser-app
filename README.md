# Laser-Zeichen-App

Eigenständige Web-App für Kinder (6–10 Jahre): Formen, Bilder, Text und Freihandzeichnungen am iPad gestalten und als **SVG** für den Laser (xTool S1, xTool Creative Space) exportieren.

- Kein Server, kein Konto, keine Cloud nötig: Arbeiten werden **auf dem Gerät** gespeichert (IndexedDB).
- Nach dem ersten Öffnen läuft die App **offline** (Service Worker) und lässt sich als Symbol auf den **Home-Bildschirm** legen (Vollbild, Querformat).
- Das „Senden“ an einen PC ist vorerst ausgeklammert (siehe unten „Später: Senden“).

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
- **Schrift:** Jost (Variable, SIL Open Font License 1.1), über das Paket `@fontsource-variable/jost` mitgeliefert – funktioniert offline.
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
- **`Grafiken/<Thema>/*.svg`**: Bilder für das Bilder-Menü (siehe `Grafiken/LIES-MICH.txt`). Beim Bauen werden sie in die App gepackt und funktionieren offline.
- Danach `npm run build` und `dist/` verteilen. Neue Version = gleiche Adresse neu bespielen. Die iPads laden sie beim nächsten Start mit Netz im Hintergrund; die App lädt sich dann beim nächsten Wechsel zur Galerie von selbst neu (nie mitten in einer Arbeit).

## Export der SVGs

- **Exportieren-Taste** (grün, oben rechts): Auf dem iPad öffnet sich das **Teilen-Menü** → „In Dateien sichern“, AirDrop, Mail … Auf dem Computer wird die Datei heruntergeladen. Dateiname: `<Kind>_<Datum>_<Uhrzeit>.svg`.
- **Galerie**: Pfeil-Taste an jeder Arbeit = diese Arbeit exportieren; Pfeil oben rechts = **alle Arbeiten dieses Kindes als ZIP**.
- **Lehrkraft-Bereich → „Alle SVGs als ZIP exportieren“**: alle Kinder, je ein Ordner pro Kind.
- Die SVG hat die Größe der Platte in mm; Schneiden = rot, Gravieren = blau, Fläche = schwarz (Farben änderbar). Gleiche Bearbeitungsarten werden vereint, Text liegt als Pfad vor.

Wichtig: Arbeiten liegen **nur auf dem jeweiligen iPad**. Wer Arbeiten dauerhaft braucht, exportiert sie. Löscht Safari die Website-Daten (z. B. „Verlauf und Websitedaten löschen“, oder bei längerer Nichtbenutzung im Browser), sind sie weg; als Home-Bildschirm-App ist der Speicher geschützter, trotzdem regelmäßig sichern.

## Lehrkraft-Bereich

**1,5 Sekunden lang** auf den freien Bereich in der Mitte der oberen Leiste (im Editor) bzw. auf das ✨ (Startseite) drücken. Dort: Plattengröße, die drei Farben, Mindestgröße (zu dünne Stellen bekommen ein Warndreieck), eigene SVG-Bilder hinzufügen, alle Arbeiten als ZIP exportieren. Die Einstellungen gelten **je Gerät**; „Standardwerte“ setzt auf `config.json` zurück.

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
- **Eigene Form** – ein Umriss aus der SVG-Bibliothek (z. B. die Form des Rohlings: Tasse, Untersetzer, Brett …). Die Lehrkraft legt solche Umrisse als gefüllte SVG in `Grafiken\<Thema>` (oder im Lehrkraft-Bereich) ab.

Die Zeichenfläche erscheint als Werkstück (Holzfarbe, Umriss, Gitter alle 10 mm) auf grauem Grund. Teile, die über das Werkstück hinausstehen, bekommen ein **rotes Warnzeichen** (nicht gesperrt, damit nichts verloren geht). Mit der Taste **Zeichenfläche** (gestrichelter Rahmen, oben links neben Wiederholen) lässt sich die Fläche später ändern; das ist nicht Teil von „Rückgängig“.

Die exportierte SVG hat die Größe der Zeichenfläche in mm (Rechteck: Breite × Höhe; Kreis/Form: Umgebungsrechteck). Der Umriss des Werkstücks selbst wird **nicht** mitexportiert. Ältere Arbeiten ohne Zeichenfläche bekommen das Standardrechteck.

## Maße in mm

Ist ein Teil ausgewählt, zeigt die Leiste unter der Fläche **Breite**, **Höhe** (mm) und **Drehung** (°). Antippen öffnet eine große Zahlentastatur (Komma für Dezimalstellen, die erste Ziffer ersetzt den alten Wert). Das **Schloss** in der Mitte hält das Seitenverhältnis (Standard: gesperrt); entsperrt lassen sich Breite und Höhe unabhängig ändern (Teil wird gestreckt). Kleinstes Maß 1 mm. Die Werte aktualisieren sich live, wenn ein Teil mit den Fingern verschoben, gedreht oder skaliert wird; jede Änderung lässt sich rückgängig machen.

## Bilder aus dem Internet (Suche)

Die **Lupe** links öffnet die Bildersuche. Die Kinder tippen ein Wort (eigene Buchstabentasten, auch Umlaute) oder wählen ein Vorschlagsbild; die Treffer erscheinen als Vorschau, Antippen fügt das Bild als Form ein (Schere/Stift/Farbrolle wie bei allen Formen). Das gewählte Bild wird in der Arbeit gespeichert und funktioniert danach offline; nur die Suche selbst braucht Internet.

- **Quelle:** [Iconify](https://iconify.design) (offene Schnittstelle `api.iconify.design`, Suche + SVG-Abruf, Lizenz je Sammlung). SVG Repo wurde geprüft und scheidet aus: keine dokumentierte API, automatische Abrufe werden mit einer Bot-Prüfung (HTTP 429) abgewiesen.
- **Erlaubte Sammlungen** (kinderfreundlich, freie Lizenzen): Fluent Emoji High Contrast (MIT, Microsoft, einfarbig, am besten zum Gravieren), Noto Emoji (Apache 2.0, Google), Fluent Emoji Flat (MIT, Microsoft). Änderbar in `public/config.json` unter `onlineSearch.sets`; `"enabled": false` schaltet die Suche ab (z. B. ohne Internet).
- **Deutsch → Englisch:** Die Sammlungen sind englisch benannt, deshalb übersetzt die App rund 300 Kinderwörter (Katze → cat, auch Mehrzahl). Unbekannte Wörter werden unverändert gesucht (Englisch geht also auch).
- **Kindersicherung:** Ungeeignete Begriffe werden in Suche und Ergebnissen gesperrt (Liste in `src/online.ts`). Das ist ein Filter, keine Garantie – die Lehrkraft bleibt in der Verantwortung.
- **Aussehen:** Farbige Bilder werden zur einfarbigen Silhouette (weiße Flächen gelten als Hintergrund, Überlappungen werden vereint); die Vorschau zeigt deshalb schon die Silhouette.
- **Lizenzen:** Die Lizenzen stehen im Lehrkraft-Bereich. Für MIT/Apache gilt: Lizenzhinweis der Sammlungen beilegen, wenn Bilder weitergegeben werden; die Sammlungen selbst nennen die Rechteinhaber (Microsoft, Google).

## Bedienung für Kinder

- Links: Formen, Bilder, Bildersuche (Lupe), Text, Zeichnen. Rechts: Schere (schneiden), Stift (gravieren), Farbrolle (Fläche gravieren).
- Antippen wählt ein Teil aus: mit dem Finger verschieben, Eckpunkte ziehen = Größe, blauer Kreis = drehen (rastet bei 15°), zwei Finger = Größe + Drehen.
- Oben: Galerie, Rückgängig, Wiederholen, Kopieren, Löschen (mit Bestätigung), **Exportieren** (grün).
- Arbeiten werden automatisch gespeichert. Ein rotes Wolken-Symbol oben heißt: Speichern klappt nicht (z. B. privater Modus).

## Entwicklung

```bash
npm install
npm test          # Vitest: Geometrie, Export, Import, Speicher, ZIP, Suche, Server
npm run build     # Typprüfung + Bilder-Bibliothek + Build nach dist/ + Service Worker
npm run dev       # Vite-Entwicklungsserver (Port 5173)
npm run preview   # gebaute App lokal ansehen
node scripts/make-icons.mjs   # App-Symbol neu erzeugen
```

Technik: TypeScript + Vite, keine Laufzeit-Bibliotheken. Vereinigung überlappender Formen, Glättung, Blockschrift (Großbuchstaben, Ä Ö Ü, Ziffern, `. ! ? -`), SVG-Import und ZIP-Schreiber sind selbst geschrieben; die 13 eingebauten Grafiken sind selbst gezeichnet (keine Lizenzfragen). Speicher: IndexedDB (`src/storage.ts`); Löschen verschiebt in einen Papierkorb-Speicher.

## Offene SVG-Bibliothek

Bilder-Menü = 13 eingebaute Motive + Reiter aus `Grafiken\<Thema>\*.svg` (beim Bauen eingepackt) + eigene Bilder, die im Lehrkraft-Bereich auf dem Gerät hinzugefügt wurden. Geeignet sind Silhouetten/Umrisse aus gefüllten Formen; Überlappungen werden vereint, Löcher bleiben Löcher, weiße Füllungen gelten als Hintergrund. Text, Bilder, Verläufe, `<use>` und Masken werden übersprungen; Dateien mit Skripten oder über 2 MB werden abgelehnt. Nur Bilder verwenden, deren Lizenz das erlaubt (z. B. CC0).

## Lokaler Server (optional)

Im Ordner `server/` liegt ein kleiner Node.js-Server (ohne Abhängigkeiten): `start.bat` liefert `dist/` im Schulnetz aus, `wlan-einrichten.bat` öffnet einmalig (als Administrator) den Port 3000 in der Windows-Firewall für das lokale Netz, `autostart-installieren.bat` startet ihn mit Windows. Für die App selbst ist er **nicht nötig**; er bietet außerdem die Schnittstellen für das spätere „Senden“ (`POST /api/send` → Ordner `Laser-Eingang`).

## Später: Senden

Ausgeklammert. Vorbereitet ist der Server (`server/server.mjs`: `/api/send`, Profile, Projekte). Die App müsste dazu wieder eine „Senden“-Taste bekommen, die die exportierte SVG per `fetch` dorthin schickt.
