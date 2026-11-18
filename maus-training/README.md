# Maus-Training für Kinder

Spielerisches Training für die Computermaus (Kinder 6–10 Jahre). Eigenständiges Projekt, ohne Server und ohne Laufzeit-Bibliotheken.

## Starten

```powershell
npm install        # einmalig
npm run dev        # Entwicklung, http://localhost:5180
npm test           # Tests (Vitest)
npm run build      # erzeugt dist/
```

`dist/index.html` läuft auch per **Doppelklick** (ohne Webserver) oder von einem USB-Stick/Netzlaufwerk. Den ganzen Ordner `dist/` weitergeben.

## Aufbau des Spiels

5 Welten mit je 3 Levels (frei nach dem Vorgänger freigeschaltet), 1–3 Sterne je Level:

| Welt | Fertigkeit | Levels |
|---|---|---|
| Zeigen & Bewegen | Zeiger führen | Sterne sammeln · breiter Weg · schmaler Weg |
| Klicken | linke Taste | Ballons · Zielscheiben (Zeitdruck) · nur rote Äpfel |
| Doppelklick | schneller Doppelklick | Eier · Schatzkisten · Eins oder zwei? |
| Ziehen & Ablegen | Taste halten und ziehen | Formen sortieren · Puzzle · Größen |
| Mausrad | Mausrad drücken / drehen | Drücken = 90° · Drehen = 15° · Drehen und ziehen |

- Sterne: wenige Fehler = 3, mehr = 2, geschafft = immer mindestens 1. Level ohne mögliche Fehler (1, 13, 14) werten die Zeit.
- Niemand scheitert: Fehler kosten nur Sterne, es gibt kein „Verloren“.
- Jede Welt ergibt eine druckbare **Urkunde** (A4 quer), nach allen 5 Welten die Maus-Profi-Urkunde.

## Lehrkraft-Bereich

Maskottchen (Maus oben rechts auf der Karte) oder Logo (Startseite) **1,5 Sekunden gedrückt halten**:
Zielgröße (leicht/normal/schwer), großer Mauszeiger, alle Levels freischalten, Sterne eines Kindes zurücksetzen, Kind löschen.
Alles wird je Gerät/Browser im `localStorage` gespeichert (Schlüssel `maus-training.v1`).

## Technik

- TypeScript + Vite (nur Entwicklung), Ausgabe als IIFE-Bündel (`scripts/post-build.mjs` macht daraus ein `defer`-Script).
- Feste Bühne 1280×720, wird auf das Fenster skaliert. Alle Bilder selbst gezeichnete SVG (`src/art.ts`), keine Fremd-Grafiken, keine Schriftdateien (Systemschrift).
- Doppelklick = `dblclick` des Browsers, es gilt also die Doppelklick-Geschwindigkeit der Windows-Mauseinstellung.
- Mausrad drücken = Maustaste 1 (Autoscroll des Browsers wird unterdrückt), Rad drehen = `wheel`.
- Reine Logik (Geometrie, Fortschritt, Speicher, Drop-Entscheidung) ist getestet (`tests/`), Spiele in `src/games/`.

## Bekannte Grenzen

- Nur mit **Maus** sinnvoll: Mausrad-Welt braucht ein Rad mit Klick (Touchpad/Tablet geht nicht).
- Keine Töne, kein Vorlesen (bewusst weggelassen).
- Nicht auf echter Schulhardware, mit Kindern und mit einem Drucker erprobt.
