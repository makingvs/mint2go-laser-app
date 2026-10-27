# Lizenzen und Quellen (Drittanbieter)

Diese App enthält bzw. nutzt die folgenden Komponenten. Die vollständigen Lizenztexte liegen in
[`public/licenses/`](public/licenses/) und werden mit der App ausgeliefert; in der App stehen sie auf der
Seite **„Lizenzen & Quellen“** (Info-Symbol unten links auf der Startseite).

## Schriften (SIL Open Font License 1.1)

Die Schriften werden unverändert über die npm-Pakete von [Fontsource](https://fontsource.org) mitgeliefert (nur der
lateinische Zeichenbereich, als WOFF2). Die OFL erlaubt Einbetten und Weitergabe zusammen mit Software, verlangt aber,
dass Urheberhinweis und Lizenztext jeder Schrift beiliegen – das sind die Dateien `public/licenses/font-*.txt`
(erzeugt mit `node scripts/copy-licenses.mjs`). Die Schriften werden nicht einzeln verkauft und nicht umbenannt oder verändert.

| Schrift | Urheberrechtshinweis | Quelle | Lizenzdatei |
| --- | --- | --- | --- |
| Jost | © 2020 The Jost Project Authors | <https://github.com/indestructible-type/Jost> | `public/licenses/font-jost.txt` |
| Fredoka | © 2016 The Fredoka Project Authors | <https://github.com/hafontia/Fredoka-One> | `public/licenses/font-fredoka.txt` |
| Baloo 2 | © 2019 The Baloo 2 Project Authors | <https://github.com/EkType/Baloo2> | `public/licenses/font-baloo.txt` |
| Rubik Mono One | © 2015 The Rubik Project Authors | <https://github.com/googlefonts/rubik> | `public/licenses/font-rubik.txt` |
| Bangers | © 2010 The Bangers Project Authors | <https://github.com/googlefonts/bangers> | `public/licenses/font-bangers.txt` |
| Caveat | © 2014 The Caveat Project Authors | <https://github.com/googlefonts/caveat> | `public/licenses/font-caveat.txt` |
| Pacifico | © 2018 The Pacifico Project Authors | <https://github.com/googlefonts/Pacifico> | `public/licenses/font-pacifico.txt` |

Die Strichschrift „Block“ ist Teil dieser App (`src/text.ts`) und keine fremde Schrift. Die mit den Schriften
gezeichneten Texte (Umrisse in der exportierten SVG) sind Ergebnisse der Nutzung, nicht die Schrift selbst.

## Bilder der Online-Suche (MIT)

Die Suche fragt die offene Schnittstelle von [Iconify](https://iconify.design) (`api.iconify.design`) ab und ist auf
Sammlungen mit eindeutiger Lizenz beschränkt (`public/config.json` → `onlineSearch.sets`):

- **Fluent Emoji High Contrast** und **Fluent Emoji Flat** – © Microsoft Corporation, MIT-Lizenz,
  <https://github.com/microsoft/fluentui-emoji> – Lizenztext: `public/licenses/fluent-emoji.txt`.

Die MIT-Lizenz verlangt, dass Urheberhinweis und Lizenztext bei Kopien oder wesentlichen Teilen beiliegen. Die Bilder
werden in der App nicht mitgeliefert, sondern zur Laufzeit abgerufen und zu einfarbigen Umrissen verändert; Hinweis und
Lizenztext stehen in der App (Seite „Lizenzen & Quellen“) und in diesem Repository.

**Nicht verwendet:** Noto Emoji (Google). Die Lizenzangaben des Projekts sind widersprüchlich (Lizenzdatei im Repository:
OFL 1.1; README und Iconify: Apache 2.0 mit einem Link auf eine nicht vorhandene Datei). Solange das nicht eindeutig ist,
bleibt die Sammlung aus der Suche ausgeschlossen. Weitere Sammlungen nur aufnehmen, wenn Lizenz und Rechteinhaber
eindeutig sind, und dann `SET_CREDITS` in `src/online.ts` sowie eine Lizenzdatei in `public/licenses/` ergänzen.

## Eigene Bilder, Logo

- Selbst hochgeladene Bilder und SVG-Dateien: Verantwortung der hochladenden Person (Rechte vorhanden?).
- MINT2Go-Logo und -Name (`public/mint2go-logo.png`): Eigentum von MINT2Go.
- App-Symbol (`public/*.png`) und Zierelemente (Zahnräder): selbst erzeugt (`scripts/make-icons.mjs`, `src/decor.ts`).

## Laser-Werkstatt (Projekte, Bilder, Vorlagen)

Projektbeschreibungen, Fotos (`public/werkstatt/pics/`) und Vorlagen (`public/werkstatt/vorlagen/`) stammen aus der MINT2Go Laser-Werkstatt (Material von MINT2Go, vom Projektauftraggeber für diese App bereitgestellt). Die Schritte im geführten Modus wurden für diese App neu formuliert.

## Entwicklungswerkzeuge (nicht Teil der ausgelieferten App)

Vite, TypeScript, Vitest, @types/node (MIT bzw. Apache 2.0). Der QR-Code `docs/ipad-qr.png` wurde mit dem npm-Paket
`qrcode` (MIT) erzeugt.
