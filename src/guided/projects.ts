// Die 20 Projekte der MINT2Go Laser-Werkstatt als geführte Aufgaben in der eigenen Zeichen-App.
// Inhalte (Material, Zeiten, Ideen, Laser-Werte) stammen aus der Laser-Werkstatt; die Schritte sind für
// diese App geschrieben (statt xTool Studio) und werden automatisch geprüft.
import type { El } from '../model';
import {
  allInside, and, centeredOn, dimsHint, exportedCheck, has, hasAll, insideOf, isFound, isFree,
  isOpenLine, isPhoto, isShape, isTemplate, isText, mixedSizes, noThin, not, opIs, or, surfaceIs, surfaceWidthBetween, twins,
  type Check, type Pred, type Project, type Step,
} from './engine';

export const LEVELS: Record<number, { name: string; color: string }> = {
  1: { name: 'Starter', color: '#95C11F' },
  2: { name: 'Gravur-Profi', color: '#3FB4DA' },
  3: { name: 'Schneide-Meister', color: '#F2A23A' },
  4: { name: 'Erfinder', color: '#E0157A' },
};

/** Material: Symbol und Name */
export const MATERIAL: Record<string, [string, string]> = {
  holz: ['🪵', 'Holz 3 mm'], karton: ['📦', 'Karton'], kork: ['🍾', 'Kork'], glas: ['🥛', 'Glas'], schiefer: ['⬛', 'Schiefer'],
  leder: ['🟤', 'Leder'], alu: ['🏷️', 'Alu-Marke'], filz: ['🧶', 'Filz'], papier: ['📄', 'Fotokarton'], becher: ['☕', 'Metall-Becher'],
  stoff: ['👜', 'Stofftasche'],
};

// ---------- gemeinsame Bausteine ----------
const ANY: Pred = () => true;
const anyShape: Pred = (e) => e.kind === 'shape';
const RECTS = isShape('rectangle', 'square', 'roundrect');
const spans = (w: number, h: number): Pred => (e) => e.w >= w || e.h >= h;
const widthAtMost = (mm: number): Pred => (e) => e.w <= mm + 0.6;
const heightAtMost = (mm: number): Pred => (e) => e.h <= mm + 0.6;
const dim = (w: number | undefined, h: number | undefined, tol = 1.2): Pred => (e) =>
  (w === undefined || Math.abs(e.w - w) <= tol) && (h === undefined || Math.abs(e.h - h) <= tol);
const thinSide = (mm: number, tol = 0.8): Pred => (e) => Math.abs(Math.min(e.w, e.h) - mm) <= tol;
const allOps = (op: 'cut' | 'engrave' | 'fill'): Check => opIs(ANY, op);

/** Zu jedem Teil von a gibt es ein Gegenstück an der Spiegelachse (senkrechte Mitte von b). */
const mirrorSymmetric = (a: Pred, axis: Pred, tol = 6): Check => (s) => {
  const A = s.elements.filter(a);
  const ax = s.elements.find(axis);
  if (!ax || A.length < 2) return false;
  return A.every((e) => {
    const mx = 2 * ax.x - e.x;
    return Math.abs(mx - e.x) <= tol || A.some((o) => o !== e && Math.abs(o.x - mx) <= tol && Math.abs(o.y - e.y) <= tol && Math.abs(o.w - e.w) <= 2 && Math.abs(o.h - e.h) <= 2);
  });
};
/** Teil sitzt in der Mitte der Zeichenfläche */
const onSurfaceCenter = (p: Pred, tol = 3): Check => (s) => {
  const m = s.elements.filter(p);
  return s.surface.kind !== 'free' && m.length > 0 && m.every((e) => Math.hypot(e.x - s.surface.w / 2, e.y - s.surface.h / 2) <= tol);
};
const sizeAtMost = (p: Pred, mm: number): Check => (s) => {
  const m = s.elements.filter(p);
  return m.length > 0 && m.every((e) => Math.max(e.w, e.h) <= mm + 0.6);
};

const EXPORT = (nr: number): Step => ({
  icon: '📤',
  title: 'Abschicken',
  text: `Tippe oben rechts auf die grüne Export-Taste. Dann tippst du einen Namen für die Datei: dein Name und die Nummer, z. B. Anna-${String(nr).padStart(2, '0')}.`,
  show: ['export'],
  check: exportedCheck,
});
const LASER: Step = {
  icon: '🔥',
  title: 'Lasern mit Aufsicht',
  text: 'Die Lehrperson öffnet deine Datei am Computer und stellt das Material ein. Rahmen ansehen, Deckel zu, Start drücken – und zuschauen.',
  warn: 'Nie allein lasern und nie weggehen, solange der Laser arbeitet!',
};
const hand = (title: string, text: string): Step => ({ icon: '🤲', title, text });

const surfaceStep = (title: string, text: string, check: Check): Step => ({ icon: '⭕', title, text, show: ['surface'], action: 'surface', check });

const hintMsg = (p: Pred, w?: number, h?: number) => dimsHint(p, w, h);

// ---------- die Projekte ----------
export const PROJECTS: Project[] = [
  {
    n: 1, lv: 1, title: 'Mein Türschild', k: 'Dein Name auf Holz – für deine Zimmertür', mat: 'holz', d: 1, bau: '20 min', laser: '10 min',
    surface: { kind: 'rect', w: 200, h: 120 },
    steps: (() => {
      const base = or(and(isShape('roundrect'), dim(120, 60)), and(isShape('heart'), (e: El) => Math.min(e.w, e.h) >= 90));
      const deco = and(not(base), not(isText));
      return [
        { icon: '⬜', title: 'Deine Form', text: 'Tippe links auf „Formen“ und wähle das abgerundete Quadrat – oder ein Herz.', show: ['shapes'], check: has(or(isShape('roundrect'), isShape('heart'))) },
        { icon: '📏', title: 'Groß machen', text: 'Tippe unter der Fläche aufs Schloss, damit es offen ist. Dann stellst du Breite ↔ 120 und Höhe ↕ 60 ein (beim Herz: Breite mindestens 100).', show: ['lock', 'width', 'height'], check: has(base), hint: hintMsg(isShape('roundrect'), 120, 60) },
        { icon: '🔤', title: 'Dein Name', text: 'Tippe links auf „Text“, wähle eine Schrift und tippe deinen Namen. Dann auf den grünen Haken.', show: ['text'], check: has(isText) },
        { icon: '👆', title: 'In die Mitte', text: 'Tippe deinen Namen an und dann auf „Mitte“. Rundherum soll Platz bleiben.', show: ['center'], check: hasAll(centeredOn(isText, base, 12), insideOf(isText, base)) },
        { icon: '⭐', title: 'Deine Deko', text: 'Hol dir mit „Formen“ einen Stern oder ein Herz dazu – kleiner als dein Name. Oder suche mit der Lupe ein Tier.', show: ['shapes', 'search'], check: has(or(and(isShape('star', 'star6', 'burst', 'flower', 'moon', 'cloud', 'heart'), (e: El) => Math.max(e.w, e.h) < 50), isFound)) },
        { icon: '✂️', title: 'Schneiden + Gravieren', text: 'Tippe die Form an → „Schneiden“. Name und Deko → „Füllen“. (Teil antippen, dann rechts die Taste.)', show: ['cut', 'fill'], check: hasAll(opIs(base, 'cut'), opIs(isText, 'fill'), opIs(deco, 'fill')) },
        EXPORT(1), LASER,
      ];
    })(),
    ich: ['Name + Lieblingstier', '„Zimmer von …“', 'Wolke mit Sternen', 'Türschild „Bitte klopfen!“'],
    pro: 'Schneiden = Laser geht ganz durch. Gravieren = Laser malt nur oben drauf.',
    tip: 'Zum Aufhängen: 2 kleine Kreise (5 mm) oben, Typ „Schneiden“.',
    lp: { m: 'Pappelsperrholz 3 mm', e: [['Schneiden', '100 %', '15 mm/s', '1'], ['Flächengravur', '25 %', '300 mm/s', '1']] },
  },
  {
    n: 2, lv: 1, title: 'Mein Taschen-Anhänger', k: 'Tier-Anhänger für deine Schultasche', mat: 'holz', d: 1, bau: '20 min', laser: '5 min',
    warn: 'Das Loch braucht Holz rundherum: mindestens 3 mm vom Rand!',
    surface: { kind: 'rect', w: 120, h: 100 },
    steps: [
      { icon: '🔎', title: 'Dein Tier', text: 'Tippe links auf die Lupe und such dir ein Tier aus, z. B. Katze, Hund oder Fisch. Tippe es an.', show: ['search'], check: has(isFound) },
      { icon: '🔒', title: 'Schloss zu, Größe 60', text: 'Das Schloss muss zu sein (blau). Stelle Breite ↔ auf 60 ein. Nicht größer!', show: ['lock', 'width'], check: has(and(isFound, dim(60, undefined))), hint: hintMsg(isFound, 60) },
      { icon: '⚪', title: 'Loch', text: 'Hol mit „Formen“ einen Kreis. Stelle Breite 5 ein und schiebe ihn oben ins Tier – mindestens 3 mm vom Rand.', show: ['shapes', 'width'], check: hasAll(has(and(isShape('circle'), dim(5, 5, 0.8))), insideOf(and(isShape('circle'), dim(5, 5, 0.8)), isFound)), hint: hintMsg(isShape('circle'), 5, 5) },
      { icon: '🔤', title: 'Dein Buchstabe', text: 'Text: dein Anfangsbuchstabe kommt auf den Bauch. Er muss kleiner sein als das Tier.', show: ['text'], check: hasAll(has(isText), insideOf(isText, isFound)) },
      { icon: '✂️', title: 'Schneiden + Gravieren', text: 'Tier und Loch → „Schneiden“. Buchstabe → „Füllen“.', show: ['cut', 'fill'], check: hasAll(opIs(isFound, 'cut'), opIs(isShape('circle'), 'cut'), opIs(isText, 'fill')) },
      EXPORT(2), LASER,
    ],
    ich: ['Katze mit deinem Buchstaben', 'Dino mit Muster', 'Hase mit Herz', 'Fisch mit Schuppen (Freihand)'],
    pro: 'Kreis im Tier + Schneiden = ein Loch. So einfach!',
    tip: 'Nach dem Lasern: Schlüsselring durch das Loch.',
    lp: { m: 'Pappelsperrholz 3 mm', e: [['Schneiden', '100 %', '15 mm/s', '1'], ['Flächengravur', '25 %', '300 mm/s', '1']] },
  },
  {
    n: 3, lv: 1, title: 'Mein Lesezeichen', k: 'Lesezeichen mit deiner eigenen Zeichnung', mat: 'karton', d: 1, bau: '15 min', laser: '3 min',
    surface: { kind: 'rect', w: 100, h: 220 },
    steps: [
      { icon: '⬜', title: 'Streifen', text: 'Tippe links auf „Formen“ → Rechteck. Schloss offen, Breite ↔ 50, Höhe ↕ 180.', show: ['shapes', 'lock', 'width', 'height'], check: has(and(RECTS, dim(50, 180))), hint: hintMsg(RECTS, 50, 180) },
      { icon: '✏️', title: 'Zeichnen', text: 'Tippe links auf „Freihand“ und zeichne mit dem Finger dein Bild auf den Streifen. Tippe danach nochmal auf „Freihand“.', show: ['draw'], check: has(isFree) },
      { icon: '👆', title: 'Auf den Streifen', text: 'Die Zeichnung muss ganz auf den Streifen und höchstens 40 mm breit sein. Antippen, schieben, Breite ändern.', show: ['width'], check: hasAll(insideOf(isFree, RECTS), has(and(isFree, widthAtMost(40)))) },
      { icon: '🔤', title: 'Dein Name', text: 'Text: deinen Namen klein unten auf den Streifen.', show: ['text'], check: hasAll(has(isText), insideOf(isText, RECTS)) },
      { icon: '✂️', title: 'Schneiden + Gravieren', text: 'Streifen → „Schneiden“. Zeichnung → „Gravieren“ (Linie). Name → „Füllen“.', show: ['cut', 'engrave', 'fill'], check: hasAll(opIs(RECTS, 'cut'), opIs(isFree, 'engrave'), opIs(isText, 'fill')) },
      EXPORT(3), LASER,
    ],
    ich: ['Rakete, die nach oben fliegt', 'Ranke mit Blättern', 'Katze schaut oben raus', 'Dein Lieblingsbuch-Held'],
    pro: 'Gravieren (Linie) = der Laser malt genau deine Linie nach.',
    tip: 'Oben ein Loch (Kreis Breite 6, „Schneiden“) – für ein Band.',
    lp: { m: 'Graukarton 1–1,5 mm', e: [['Schneiden', '60 %', '40 mm/s', '1'], ['Liniengravur', '15 %', '150 mm/s', '1'], ['Flächengravur', '15 %', '300 mm/s', '1']] },
  },
  {
    n: 4, lv: 1, title: 'Mein Kork-Untersetzer', k: 'Muster auf einen runden Untersetzer', mat: 'kork', d: 2, bau: '20 min', laser: '8 min',
    surface: { kind: 'rect', w: 160, h: 140 },
    steps: [
      surfaceStep('Dein Untersetzer', 'Tippe oben auf „Fläche“, wähle „Kreis/Oval“ und stelle Breite 100 und Höhe 100 ein. So groß ist dein Untersetzer.', surfaceIs('ellipse', 100, 100)),
      { icon: '⭐', title: 'Muster legen', text: 'Hol mit „Formen“ Sterne, Herzen und Blumen in den Kreis. Mindestens 4 Formen!', show: ['shapes'], check: has(ANY, 4) },
      { icon: '📏', title: 'Groß und klein', text: 'Mische große und kleine Formen. Die Größe änderst du unter der Fläche bei Breite ↔.', show: ['width'], check: mixedSizes(ANY, 4) },
      { icon: '🎯', title: 'Alles im Kreis', text: 'Nichts darf über den Rand ragen. Ein rotes Dreieck zeigt dir, was zu weit draußen ist.', check: allInside },
      { icon: '🖌️', title: 'Gravieren', text: 'Alle Muster → „Füllen“. Tippe jedes Teil an und dann rechts auf „Füllen“.', show: ['fill'], check: allOps('fill') },
      EXPORT(4), LASER,
    ],
    ich: ['Blumenwiese', 'Sternenhimmel mit Mond', 'Herz mit Namen', 'Fußball'],
    pro: 'Die Zeichenfläche ist deine Hilfs-Form: Du siehst sie – der Laser schneidet sie nicht.',
    tip: 'Fertige Kork-Untersetzer: Wir gravieren nur, wir schneiden nicht.',
    lp: { m: 'Kork-Untersetzer Ø 100 mm, 3–5 mm', hw: 'Untersetzer mittig einlegen, Position mit „Rahmen fahren“ prüfen.', e: [['Flächengravur', '15 %', '300 mm/s', '1']] },
  },
  {
    n: 5, lv: 1, title: 'Mein Kühlschrank-Magnet', k: 'Kleiner Magnet in deiner Form', mat: 'holz', d: 2, bau: '15 min', laser: '4 min',
    surface: { kind: 'rect', w: 100, h: 100 },
    steps: [
      { icon: '⭐', title: 'Deine Form', text: 'Tippe links auf „Formen“ und wähle Stern, Herz, Wolke … – such dir eine aus.', show: ['shapes'], check: has(anyShape) },
      { icon: '🔒', title: 'Schloss zu, klein', text: 'Schloss zu (blau). Stelle Breite ↔ auf 50 ein. Die Höhe passt sich an.', show: ['lock', 'width'], check: has(and(anyShape, dim(50, undefined))), hint: hintMsg(anyShape, 50) },
      { icon: '😀', title: 'Gesicht', text: 'Tippe links auf „Freihand“ und zeichne ein Gesicht oder Muster auf die Form.', show: ['draw'], check: hasAll(has(isFree), insideOf(isFree, anyShape)) },
      { icon: '✂️', title: 'Schneiden + Gravieren', text: 'Form → „Schneiden“. Gesicht → „Gravieren“ (Linie).', show: ['cut', 'engrave'], check: hasAll(opIs(anyShape, 'cut'), opIs(isFree, 'engrave')) },
      EXPORT(5), LASER,
      hand('Magnet kleben', 'Nach dem Lasern: Magnet hinten drauf kleben – mit einem Erwachsenen! Heißkleber nur mit Erwachsenen.'),
    ],
    ich: ['Lachender Stern', 'Erdbeere', 'Monster mit 3 Augen', 'Weihnachtsbaum'],
    pro: 'Schloss zu = die Form wird nicht dick oder dünn verzogen.',
    tip: 'Heißkleber nur mit einem Erwachsenen!',
    lp: { m: 'Pappelsperrholz 3 mm + Magnete Ø 10 mm', hw: 'Magnete mit Heißkleber oder Holzleim + Klebepunkt.', e: [['Schneiden', '100 %', '15 mm/s', '1'], ['Liniengravur', '25 %', '100 mm/s', '1']] },
  },
  {
    n: 6, lv: 2, title: 'Mein Trinkglas', k: 'Glas anmalen – der Laser zaubert dein Bild hinein', mat: 'glas', d: 2, bau: '20 min', laser: '10 min',
    warn: 'Glas immer nur mit einem Erwachsenen anfassen. Nie ein kaputtes Glas verwenden!',
    surface: { kind: 'rect', w: 160, h: 100 },
    steps: [
      { icon: '🎨', title: 'Glas anmalen', text: 'Außen dick mit dunkler Plakatfarbe anmalen. Schwarz oder dunkelblau klappt am besten. Einen Tag trocknen lassen.' },
      surfaceStep('Dein Bild-Feld', 'Tippe oben auf „Fläche“ → Rechteck, Breite 60, Höhe 40. Hier wird dein Bild graviert.', surfaceIs('rect', 60, 40)),
      { icon: '🔤', title: 'Dein Bild', text: 'Lege Name, Herzen und Sterne in das Feld. Alles muss ganz im Feld liegen.', show: ['text', 'shapes'], check: hasAll(has(ANY, 2), allInside) },
      { icon: '🖌️', title: 'Gravieren', text: 'Alles → „Füllen“.', show: ['fill'], check: allOps('fill') },
      EXPORT(6), LASER,
      { icon: '🚿', title: 'Abwaschen', text: 'Farbe mit Wasser und Schwamm abwaschen – dein Bild ist im Glas!' },
    ],
    ich: ['Dein Name in großen Buchstaben', 'Sterne rundherum', 'Herz + Datum', 'Dein Lieblingstier'],
    pro: 'Dunkle Farbe schluckt das Laser-Licht. Darum klappt es auf Glas!',
    tip: 'Schwarze oder dunkelblaue Plakatfarbe funktioniert am besten.',
    lp: { m: 'Trinkglas (gerade Wand) + schwarze Plakatfarbe', hw: 'RA2 Pro im Rollenmodus, Durchmesser eingeben. Farbe deckend, ganz trocken. Danach abwaschen.', e: [['Flächengravur', '50 %', '200 mm/s', '1']] },
  },
  {
    n: 7, lv: 2, title: 'Mein Kunstwerk', k: 'Deine Zeichnung vom Papier aufs Holz', mat: 'holz', d: 2, bau: '20 min', laser: '15 min',
    surface: { kind: 'rect', w: 160, h: 140 },
    steps: [
      { icon: '✏️', title: 'Zeichnen', text: 'Zeichne auf weißes Papier – mit einem dicken, schwarzen Stift. Keine Schatten, keine Bleistift-Striche.' },
      { icon: '📷', title: 'Fotografieren', text: 'Tippe links auf „Bild“ und wähle „Foto aufnehmen“. iPad gerade halten, viel Licht, kein Schatten. Stell mit dem Schieberegler ein, dass dein Bild gut aussieht, dann auf den Haken.', show: ['image'], check: has(isPhoto) },
      { icon: '🔒', title: 'Schloss zu, Größe 100', text: 'Schloss zu (blau). Breite ↔ 100 eintippen.', show: ['lock', 'width'], check: has(and(isPhoto, dim(100, undefined))), hint: hintMsg(isPhoto, 100) },
      { icon: '🖌️', title: 'Gravieren', text: 'Bild → „Füllen“.', show: ['fill'], check: opIs(isPhoto, 'fill') },
      EXPORT(7), LASER,
    ],
    ich: ['Dein Haustier', 'Dein Haus', 'Comic-Figur, die du erfunden hast', 'Selbstporträt'],
    pro: 'Dicke schwarze Linien = schönes Laser-Bild. Bleistift sieht man kaum.',
    tip: 'Schon fotografiert? Dann wähle das Foto aus deinen Fotos.',
    lp: { m: 'Pappelsperrholz 3 mm', hw: 'Das Bild wurde in der App schon in Schwarz-Weiß-Umrisse umgewandelt.', e: [['Flächengravur (Bild)', '25 %', '300 mm/s', '1']] },
  },
  {
    n: 8, lv: 2, title: 'Meine Schiefer-Tafel', k: 'Dein Lieblingsfoto auf Stein', mat: 'schiefer', d: 2, bau: '20 min', laser: '12 min',
    surface: { kind: 'rect', w: 100, h: 100 },
    steps: [
      { icon: '🖼️', title: 'Foto holen', text: 'Tippe links auf „Bild“ und such dein Foto aus. Auf Schiefer wird der Laser hell: Tippe auf den Knopf „Umkehren“, bis dein Motiv hell ist, dann auf den Haken.', show: ['image'], check: has(isPhoto) },
      { icon: '🔒', title: 'Schloss zu, Größe 80', text: 'Schloss zu (blau). Breite ↔ 80 eintippen.', show: ['lock', 'width'], check: has(and(isPhoto, dim(80, undefined))), hint: hintMsg(isPhoto, 80) },
      { icon: '🔤', title: 'Text dazu', text: 'Text: ein Wort unter das Foto, z. B. „Mein Hund“. Es muss auf die Tafel passen.', show: ['text'], check: hasAll(has(isText), allInside) },
      { icon: '🖌️', title: 'Gravieren', text: 'Foto und Text → „Füllen“.', show: ['fill'], check: hasAll(opIs(isPhoto, 'fill'), opIs(isText, 'fill')) },
      EXPORT(8), LASER,
    ],
    ich: ['Dein Haustier', 'Deine Familie', 'Dein Lieblingsplatz', 'Fußball-Team'],
    pro: 'Auf Schiefer wird der Laser hell – umgekehrt wie bei Holz!',
    tip: 'Fotos mit viel Licht und klarem Hintergrund werden am schönsten.',
    lp: { m: 'Schiefer-Untersetzer 10 × 10 cm', hw: 'Foto in der App ggf. umkehren (Schiefer wird hell). Danach mit Öl abwischen.', e: [['Flächengravur (Bild)', '40 %', '200 mm/s', '1']] },
  },
  {
    n: 9, lv: 2, title: 'Mein Lederarmband', k: 'Armband in deiner Größe mit deinem Namen', mat: 'leder', d: 3, bau: '25 min', laser: '5 min',
    warn: 'Nur pflanzlich gegerbtes Leder – kein Kunstleder!',
    surface: { kind: 'rect', w: 300, h: 40 },
    steps: (() => {
      const strip = and(RECTS, (e: El) => e.w >= 100 && Math.abs(e.h - 18) <= 0.8);
      const hole = and(isShape('circle'), dim(4, 4, 0.7));
      return [
        { icon: '📐', title: 'Handgelenk messen', text: 'Lege einen Papierstreifen ums Handgelenk, lies das Maß ab und rechne 3 cm dazu. Messen in mm: 15 cm = 150 mm.' },
        { icon: '⬜', title: 'Streifen', text: 'Formen → Rechteck. Schloss offen. Breite ↔ = dein Maß in mm, Höhe ↕ 18.', show: ['shapes', 'lock', 'width', 'height'], check: has(strip), hint: hintMsg(RECTS, undefined, 18) },
        { icon: '⚪', title: '4 Löcher', text: 'Hol 4 Kreise mit Breite 4: je 2 an jedem Ende des Streifens (Tipp: Kopieren-Taste oben).', show: ['shapes', 'width'], check: hasAll(has(hole, 4), insideOf(hole, strip)) },
        { icon: '🔤', title: 'Dein Name', text: 'Text: Name in die Mitte, höchstens Höhe 10.', show: ['text', 'center'], check: hasAll(has(and(isText, heightAtMost(10))), insideOf(isText, strip)) },
        { icon: '⭐', title: 'Deko', text: 'Kleine Sterne oder Herzen neben den Namen.', show: ['shapes'], check: has(isShape('star', 'heart', 'star6', 'burst')) },
        { icon: '✂️', title: 'Schneiden + Gravieren', text: 'Streifen und Löcher → „Schneiden“. Name und Deko → „Füllen“.', show: ['cut', 'fill'], check: hasAll(opIs(or(strip, hole), 'cut'), opIs(isText, 'fill'), opIs(isShape('star', 'heart', 'star6', 'burst'), 'fill')) },
        EXPORT(9), LASER,
      ];
    })(),
    ich: ['Freundschafts-Armband für 2', 'Name + Lieblingszahl', 'Sternbild', 'Muster aus Dreiecken'],
    pro: 'Messen in mm: 15 cm = 150 mm.',
    tip: 'Durch die Löcher kommt ein Band zum Zubinden.',
    lp: { m: 'Pflanzlich gegerbtes Leder 1,5–2 mm', hw: 'Kein Kunstleder und kein chromgegerbtes Leder (giftige Dämpfe)!', e: [['Schneiden', '80 %', '15 mm/s', '1'], ['Flächengravur', '15 %', '250 mm/s', '1']] },
  },
  {
    n: 10, lv: 2, title: 'Mein Metall-Anhänger', k: 'Glänzende Marke für Rucksack oder Hund', mat: 'alu', d: 3, bau: '15 min', laser: '5 min',
    warn: 'Die Marke ist fertig ausgeschnitten. Wir gravieren nur – nichts schneiden!',
    surface: { kind: 'rect', w: 100, h: 80 },
    steps: [
      surfaceStep('Deine Marke', 'Tippe oben auf „Fläche“ → Rechteck, Breite 50, Höhe 28. So groß ist die Marke.', surfaceIs('rect', 50, 28)),
      { icon: '🔤', title: 'Dein Text', text: 'Text: Name oder Spruch, höchstens 2 Zeilen. Dicke Schrift ist auf kleinen Marken besser zu lesen.', show: ['text'], check: has(isText) },
      { icon: '📏', title: 'Klein genug', text: 'Alles höchstens 40 mm breit – 5 mm Platz zum Loch! Nichts darf über den Rand ragen.', show: ['width'], check: hasAll(allInside, has(and(isText, widthAtMost(40)))) },
      { icon: '⭐', title: 'Symbol', text: 'Herz, Stern oder ein Tier (Lupe) dazu.', show: ['shapes', 'search'], check: has(or(isShape('star', 'heart', 'star6', 'burst', 'flower'), isFound)) },
      { icon: '🖌️', title: 'Gravieren', text: 'Text und Symbol → „Füllen“.', show: ['fill'], check: allOps('fill') },
      EXPORT(10), LASER,
    ],
    ich: ['„Ich gehöre …“ für den Rucksack', 'Hundemarke mit Telefon der Eltern', 'Glücksbringer mit Kleeblatt', 'Fan-Marke'],
    pro: 'Der Laser nimmt die bunte Schicht weg – darunter glänzt das Metall.',
    tip: 'Dicke Schrift ist auf kleinen Marken besser zu lesen.',
    lp: { m: 'Eloxierte Alu-Marken (Dog Tags)', hw: 'Marke mit Magnet/Klebeband fixieren. Nicht schneiden.', e: [['Flächengravur', '60 %', '250 mm/s', '1']] },
  },
  {
    n: 11, lv: 3, title: 'Mein Puzzle', k: 'Dein Bild – in Teile geschnitten', mat: 'holz', d: 3, bau: '30 min', laser: '15 min',
    warn: 'Jede Puzzle-Linie geht von Rand zu Rand. Höchstens 8 Teile!',
    surface: { kind: 'rect', w: 140, h: 110 },
    steps: (() => {
      const plate = and(RECTS, dim(120, 90));
      const puzzle = and(isOpenLine, spans(100, 75));
      const picture = and(isFree, not(puzzle));
      return [
        { icon: '⬜', title: 'Platte', text: 'Formen → Rechteck. Schloss offen, Breite ↔ 120, Höhe ↕ 90.', show: ['shapes', 'lock', 'width', 'height'], check: has(plate), hint: hintMsg(RECTS, 120, 90) },
        { icon: '✏️', title: 'Dein Bild', text: 'Tippe auf „Freihand“ und zeichne ein großes Bild auf die Platte. Oder lege Formen darauf.', show: ['draw'], check: hasAll(has(picture), insideOf(picture, plate)) },
        { icon: '〰️', title: 'Puzzle-Linien', text: 'Nochmal „Freihand“: 3–4 wellige Linien mit Nasen, von Rand zu Rand. Eine Linie darf nicht in sich geschlossen sein.', show: ['draw'], check: has(puzzle, 3) },
        { icon: '✂️', title: 'Schneiden + Gravieren', text: 'Platte und Puzzle-Linien → „Schneiden“. Dein Bild → „Gravieren“.', show: ['cut', 'engrave'], check: hasAll(opIs(plate, 'cut'), opIs(puzzle, 'cut'), opIs(picture, 'engrave')) },
        EXPORT(11), LASER,
      ];
    })(),
    ich: ['Dein Lieblingstier', 'Weltkarte', 'Dein Name groß', 'Unterwasserwelt'],
    pro: 'Die Nasen an den Linien halten die Teile zusammen.',
    tip: 'Puzzle für jüngere Geschwister? Dann nur 4 große Teile.',
    lp: { m: 'Pappelsperrholz 3 mm', hw: 'Die Puzzle-Linien sind offene Linien – sie dürfen geschnitten werden.', e: [['Schneiden', '100 %', '15 mm/s', '1'], ['Liniengravur', '25 %', '100 mm/s', '1']] },
  },
  {
    n: 12, lv: 3, title: 'Mein Fensterbild', k: 'Scherenschnitt aus Karton – nur mit dem Laser', mat: 'papier', d: 3, bau: '25 min', laser: '5 min',
    warn: 'Formen innen dürfen sich nicht berühren – und nicht den Rand. Sonst fällt alles auseinander.',
    surface: { kind: 'rect', w: 160, h: 160 },
    steps: (() => {
      const big = and(isShape('circle'), dim(120, 120));
      const small = and(anyShape, (e: El) => Math.max(e.w, e.h) >= 9 && Math.max(e.w, e.h) <= 21);
      return [
        { icon: '⭕', title: 'Großer Kreis', text: 'Formen → Kreis. Schloss zu, Breite ↔ 120. Das ist dein Fensterbild.', show: ['shapes', 'lock', 'width'], check: has(big), hint: hintMsg(isShape('circle'), 120, 120) },
        { icon: '⭐', title: 'Löcher-Formen', text: 'Lege mindestens 6 kleine Formen (Breite 10–20) in den Kreis: Sterne, Herzen, Tropfen. Sie dürfen sich nicht berühren.', show: ['shapes'], check: hasAll(has(small, 6), insideOf(small, big)) },
        { icon: '🪞', title: 'Links = Rechts', text: 'Links und rechts vom Kreis-Mittelpunkt liegt jeweils das Gleiche – symmetrisch! Kopieren-Taste hilft.', check: mirrorSymmetric(small, big, 6) },
        { icon: '🎯', title: 'Mitte', text: 'Tippe den großen Kreis an und dann auf „Mitte“.', show: ['center'], check: onSurfaceCenter(big, 3) },
        { icon: '✂️', title: 'Schneiden', text: 'Alles → „Schneiden“. Die kleinen Formen fallen heraus = Löcher.', show: ['cut'], check: allOps('cut') },
        EXPORT(12), LASER,
      ];
    })(),
    ich: ['Schneeflocke', 'Mandala', 'Sonne mit Strahlen', 'Schmetterling'],
    pro: 'Symmetrie: Wenn du in der Mitte faltest, passt links genau auf rechts.',
    tip: 'Ans Fenster kleben – die Sonne scheint durch die Löcher.',
    lp: { m: 'Fotokarton 300 g/m²', hw: 'Air Assist niedrig. Karton mit Magneten/Pins auf der Wabenplatte fixieren.', e: [['Schneiden', '30 %', '60 mm/s', '1']] },
  },
  {
    n: 13, lv: 3, title: 'Mein Stecktier', k: 'Tier zum Zusammenstecken – ohne Kleber', mat: 'karton', d: 4, bau: '30 min', laser: '8 min',
    surface: { kind: 'rect', w: 280, h: 200 },
    steps: (() => {
      const slot = and(RECTS, dim(2, 20, 0.6));
      const leg = and(RECTS, dim(60, 40));
      return [
        { icon: '🔎', title: 'Körper', text: 'Such mit der Lupe ein Tier. Schloss zu, Breite ↔ 120.', show: ['search', 'lock', 'width'], check: has(and(isFound, dim(120, undefined))), hint: hintMsg(isFound, 120) },
        { icon: '📏', title: 'Zwei Schlitze im Körper', text: 'Formen → Rechteck, Breite 2, Höhe 20 (Schloss offen). Zwei Stück: vorne und hinten, von unten in den Bauch.', show: ['shapes', 'lock', 'width', 'height'], check: has(slot, 2), hint: hintMsg(RECTS, 2, 20) },
        { icon: '🦵', title: 'Beine', text: 'Zwei Rechtecke, Breite 60, Höhe 40, neben das Tier legen.', show: ['shapes'], check: has(leg, 2), hint: hintMsg(RECTS, 60, 40) },
        { icon: '📏', title: 'Schlitze in den Beinen', text: 'In jedes Bein kommt von oben ein Schlitz (Breite 2, Höhe 20). Insgesamt brauchst du 4 Schlitze.', show: ['shapes'], check: has(slot, 4) },
        { icon: '✂️', title: 'Schneiden', text: 'Alles → „Schneiden“.', show: ['cut'], check: allOps('cut') },
        EXPORT(13), LASER,
        hand('Zusammenstecken', 'Teile vorsichtig aus dem Karton drücken. Schlitz in Schlitz stecken – nicht mit Gewalt. Steht dein Tier?'),
      ];
    })(),
    ich: ['Pferd', 'Dino', 'Elefant', 'Erfundenes Fantasie-Tier'],
    pro: 'Schlitz-Breite = Karton-Dicke. Dann hält es ohne Kleber!',
    tip: 'Die Schlitze im Körper müssen in die Schlitze der Beine passen.',
    lp: { m: 'Graukarton 2 mm (Schlitze 2 mm)', hw: 'Schlitzbreite an die echte Kartonstärke anpassen.', e: [['Schneiden', '70 %', '35 mm/s', '1']] },
  },
  {
    n: 14, lv: 3, title: 'Meine Zahnräder', k: 'Zahnräder, die sich wirklich drehen', mat: 'holz', d: 4, bau: '30 min', laser: '12 min',
    template: 'werkstatt/vorlagen/14_Zahnraeder.svg', surface: { kind: 'rect', w: 300, h: 92 },
    steps: [
      { icon: '📂', title: 'Vorlage öffnen', text: 'Tippe auf „Vorlage laden“. Du bekommst Platte und zwei Zahnräder.', action: 'template', check: has(isTemplate, 3) },
      { icon: '👀', title: 'Ansehen', text: 'Großes Rad 24 Zähne, kleines Rad 12 Zähne, Platte mit 2 Löchern. Zeig es deiner Lehrperson.' },
      { icon: '😀', title: 'Gesicht', text: 'Tippe auf „Freihand“ und zeichne ein Gesicht oder Muster auf das große Rad.', show: ['draw'], check: has(isFree) },
      { icon: '🔤', title: 'Dein Name', text: 'Text: Name klein auf die Platte.', show: ['text'], check: has(isText) },
      { icon: '✂️', title: 'Typ prüfen', text: 'Räder und Platte bleiben „Schneiden“. Gesicht und Name → „Gravieren“.', show: ['engrave'], check: hasAll(opIs(isTemplate, 'cut'), opIs(isFree, 'engrave'), opIs(isText, 'engrave')) },
      EXPORT(14), LASER,
      hand('Zusammenbauen', 'Holzstäbchen in die Platte, Räder drauf – drehen!'),
    ],
    ich: ['Rad mit Gesicht', 'Windrad-Flügel', 'Uhr mit Zeiger', '3 Räder in einer Reihe'],
    pro: 'Großes Rad 1 Runde = kleines Rad 2 Runden.',
    tip: 'Nichts an den Zähnen verändern – sonst greifen sie nicht.',
    lp: { m: 'Pappelsperrholz 3 mm + Rundstab Ø 5 mm', hw: 'Löcher Ø 5,4 mm.', e: [['Schneiden', '100 %', '15 mm/s', '1'], ['Liniengravur', '25 %', '100 mm/s', '1']] },
  },
  {
    n: 15, lv: 3, title: 'Meine Filz-Fingerpuppe', k: 'Puppe für deinen Finger', mat: 'filz', d: 3, bau: '25 min', laser: '6 min',
    surface: { kind: 'rect', w: 120, h: 90 },
    steps: (() => {
      const body = and(isShape('drop'), dim(45, 65));
      return [
        { icon: '💧', title: 'Körper', text: 'Formen → Tropfen. Schloss offen, Breite ↔ 45, Höhe ↕ 65.', show: ['shapes', 'lock', 'width', 'height'], check: has(body), hint: hintMsg(isShape('drop'), 45, 65) },
        { icon: '👯', title: 'Zweites Teil', text: 'Die gleiche Form noch einmal – Kopieren-Taste oben! Gleiche Zahlen bei Breite und Höhe.', check: twins(isShape('drop'), 2) },
        { icon: '🐱', title: 'Ohren', text: 'Kleine Kreise (Breite höchstens 20) oben überlappen lassen – bei beiden Teilen. Insgesamt 4 Kreise.', show: ['shapes', 'width'], check: has(and(isShape('circle'), (e: El) => Math.max(e.w, e.h) <= 20.6), 4) },
        { icon: '✂️', title: 'Schneiden', text: 'Alles → „Schneiden“.', show: ['cut'], check: allOps('cut') },
        EXPORT(15), LASER,
        hand('Zusammenkleben', 'Rand mit Textilkleber kleben – unten offen lassen! Mit einem Erwachsenen.'),
        { icon: '🎨', title: 'Gesicht', text: 'Augen aus Filz oder Wackelaugen aufkleben.' },
      ];
    })(),
    ich: ['Katze', 'Eule', 'Monster', 'Prinzessin'],
    pro: 'Gleiche Zahlen bei Breite und Höhe = genau gleich große Teile.',
    tip: 'Ohren: Die Lehrperson verbindet sie am Computer mit dem Körper.',
    lp: { m: 'Bastelfilz 2–3 mm (Wolle/Polyester)', hw: 'Ohren am Computer mit dem Körper vereinigen (Kombinieren).', e: [['Schneiden', '40 %', '40 mm/s', '1']] },
  },
  {
    n: 16, lv: 4, title: 'Mein Becher rundum', k: 'Dein Muster einmal rund um den Becher', mat: 'becher', d: 4, bau: '25 min', laser: '15 min',
    surface: { kind: 'rect', w: 250, h: 60 },
    steps: [
      { icon: '📐', title: 'Becher messen', text: 'Maßband rund um den Becher. Wie viele mm sind es? Schreib die Zahl auf.' },
      surfaceStep('Dein Becher-Feld', 'Tippe oben auf „Fläche“ → Rechteck. Breite = dein Maß in mm, Höhe 60.', hasAll(surfaceIs('rect', undefined, 60), surfaceWidthBetween(100, 400))),
      { icon: '🔤', title: 'Name', text: 'Text: dein Name in die Mitte.', show: ['text', 'center'], check: has(isText) },
      { icon: '⭐', title: 'Muster rundherum', text: 'Sterne, Tiere, Pflanzen von links bis rechts verteilen. Oben und unten 10 mm frei lassen. Mindestens 3 Teile.', show: ['shapes', 'search'], check: hasAll(has(not(isText), 3), allInside) },
      { icon: '🖌️', title: 'Gravieren', text: 'Alles → „Füllen“.', show: ['fill'], check: allOps('fill') },
      EXPORT(16),
      { icon: '🔄', title: 'Lasern', text: 'Die Lehrperson setzt den Becher in die Drehvorrichtung, trägt den Durchmesser ein und fährt den Rahmen. Der Becher dreht sich – zuschauen!', warn: 'Nie allein lasern!' },
    ],
    ich: ['Dschungel rundherum', 'Fußballfeld', 'Sternenhimmel', 'Dein Name 3-mal'],
    pro: 'Der Becher dreht sich – so kommt das Bild ganz rundherum.',
    tip: 'Oben und unten 10 mm frei lassen.',
    lp: { m: 'Pulverbeschichteter Metallbecher', hw: 'RA2 Pro (Rollen), Durchmesser messen und eingeben. Erst „Rahmen fahren“.', e: [['Flächengravur', '60 %', '250 mm/s', '1–2']] },
  },
  {
    n: 17, lv: 4, title: 'Meine Schatzkiste', k: 'Box mit Zinken, die genau ineinander passen', mat: 'holz', d: 5, bau: '40 min', laser: '20 min',
    template: 'werkstatt/vorlagen/17_Schatzkiste.svg', surface: { kind: 'rect', w: 305, h: 125 },
    steps: [
      { icon: '📂', title: 'Vorlage öffnen', text: 'Tippe auf „Vorlage laden“. Du bekommst die Teile der Kiste mit Zinken.', action: 'template', check: has(isTemplate, 4) },
      { icon: '👀', title: '6 Teile', text: 'Boden, Deckel und 4 Wände mit Zinken. Zinken sind kleine Zähne, die ineinander greifen.' },
      { icon: '🔤', title: 'Deckel', text: 'Text: dein Name oder „Geheim!“ – auf den Deckel (das größte Teil).', show: ['text'], check: has(isText) },
      { icon: '⭐', title: 'Wände', text: 'Muster, Tiere (Lupe) oder Juwelen auf die Wände.', show: ['shapes', 'search'], check: has(and(not(isTemplate), not(isText), not(isFree)), 1) },
      { icon: '✂️', title: 'Typ prüfen', text: 'Die Teile bleiben „Schneiden“. Name und Muster → „Füllen“.', show: ['fill'], check: hasAll(opIs(isText, 'fill'), opIs(and(not(isTemplate), not(isText)), 'fill')) },
      EXPORT(17), LASER,
      hand('Zusammenstecken', 'Zinken ineinander stecken. Mit Holzleim fest machen – der Deckel liegt lose auf.'),
    ],
    ich: ['Piraten-Kiste mit X', 'Schmuck-Kästchen', 'Geheim-Box', 'Box für Bastel-Sachen'],
    pro: 'Zinken sind kleine Zähne. Sie greifen ineinander wie Finger.',
    tip: 'Nichts an den Zinken verändern – sonst passt es nicht.',
    lp: { m: 'Pappelsperrholz 3 mm (Zinken für 3,0 mm)', hw: 'Holzstärke messen! Bei 3,2 mm Vorlage anpassen. Deckel liegt lose auf.', e: [['Schneiden', '100 %', '15 mm/s', '1'], ['Flächengravur', '25 %', '300 mm/s', '1']] },
  },
  {
    n: 18, lv: 4, title: 'Meine Siebdruck-Tasche', k: 'Dein Motiv – gedruckt auf Stoff', mat: 'stoff', d: 5, bau: '30 min', laser: '10 min',
    warn: 'Keine dünnen Linien! Alles mindestens 2 mm dick, sonst kommt keine Farbe durch.',
    surface: { kind: 'rect', w: 120, h: 120 },
    steps: [
      { icon: '⭐', title: 'Motiv', text: 'Hol dicke Formen (Formen-Taste) oder ein Tier (Lupe). Höchstens 100 × 100 mm.', show: ['shapes', 'search'], check: hasAll(has(not(isText)), sizeAtMost(ANY, 100)) },
      { icon: '🔤', title: 'Dicke Schrift', text: 'Text: such eine dicke Schrift aus (Block, Rubik Mono, Bangers).', show: ['text'], check: has(isText) },
      { icon: '🔍', title: 'Nicht zu dünn', text: 'Wenn ein gelbes Warndreieck erscheint, ist die Stelle zu dünn: größer machen oder dickere Schrift nehmen.', check: noThin },
      { icon: '🖌️', title: 'Gravieren', text: 'Alles → „Füllen“.', show: ['fill'], check: allOps('fill') },
      EXPORT(18),
      { icon: '🔥', title: 'Sieb lasern', text: 'Die Lehrperson lasert dein Motiv ins Sieb.', warn: 'Nie allein lasern!' },
      { icon: '🖼️', title: 'Drucken', text: 'Sieb auf die Tasche, Farbe oben drauf, ein Erwachsener hält das Sieb. Du ziehst die Farbe mit dem Rakel einmal fest drüber. Sieb hochheben – fertig!' },
      { icon: '⏳', title: 'Trocknen', text: 'Tasche flach hinlegen und trocknen lassen. Ein Erwachsener bügelt die Farbe fest.' },
    ],
    ich: ['Dein Lieblingstier als Umriss', 'Name in Blockschrift', 'Blitz und Stern', 'Klassen-Logo'],
    pro: 'Wo der Laser war, ist das Sieb offen – da kommt die Farbe durch.',
    tip: 'Ein Sieb – viele Taschen! Gut für die ganze Klasse.',
    lp: { m: 'xTool Siebdruck-Rahmen + Stofftasche + Textil-Siebdruckfarbe', hw: 'In XCS Projekttyp/Preset „Siebdruck“ verwenden (Werte aus der Software).', e: [['Siebdruck-Preset', 'laut XCS', 'laut XCS', '1']] },
  },
  {
    n: 19, lv: 4, title: 'Meine Sternbild-Laterne', k: 'Echte Sternbilder leuchten im Dunkeln', mat: 'papier', d: 4, bau: '35 min', laser: '8 min',
    warn: 'Nur LED-Teelicht – nie eine echte Kerze!',
    template: 'werkstatt/vorlagen/19_Laterne.svg', surface: { kind: 'rect', w: 302, h: 170 },
    steps: (() => {
      const star = and(isShape('circle'), (e: El) => e.w >= 2.6 && e.w <= 6.4);
      return [
        { icon: '📂', title: 'Vorlage öffnen', text: 'Tippe auf „Vorlage laden“. Du bekommst die Laterne mit 4 Seiten und Falt-Linien.', action: 'template', check: has(isTemplate, 2) },
        { icon: '✨', title: 'Sternbild', text: 'Pro Seite ein Sternbild: kleine Kreise (Breite 3–6) an die Stern-Punkte. Insgesamt mindestens 8 Sterne. Große Sterne = große Löcher.', show: ['shapes', 'width'], check: has(star, 8) },
        { icon: '✏️', title: 'Linien', text: 'Tippe auf „Freihand“ und verbinde die Sterne mit Linien.', show: ['draw'], check: has(isOpenLine, 1) },
        { icon: '✂️', title: 'Typ', text: 'Sterne → „Schneiden“. Linien → „Gravieren“ (Linie).', show: ['cut', 'engrave'], check: hasAll(opIs(star, 'cut'), opIs(isOpenLine, 'engrave')) },
        EXPORT(19), LASER,
        hand('Falten + Kleben', 'An den Linien falten, Lasche kleben, LED-Teelicht rein.'),
      ];
    })(),
    ich: ['Großer Wagen', 'Kassiopeia', 'Orion', 'Dein eigenes Sternbild'],
    pro: 'Große Sterne = große Löcher. So sieht man, welcher Stern hell ist.',
    tip: 'Sternbilder findest du in Sternkarten oder Büchern.',
    lp: { m: 'Fotokarton 300 g/m², dunkelblau + LED-Teelicht', hw: 'Faltlinien der Vorlage als Liniengravur (nur anritzen).', e: [['Schneiden', '30 %', '60 mm/s', '1'], ['Liniengravur', '10 %', '150 mm/s', '1']] },
  },
  {
    n: 20, lv: 4, title: 'Mein Murmel-Labyrinth', k: 'Labyrinth zum Kippen – mit Start und Ziel', mat: 'holz', d: 5, bau: '60 min', laser: '25 min',
    warn: 'Wege mindestens 14 mm breit – sonst bleibt die Murmel stecken.',
    template: 'werkstatt/vorlagen/20_Labyrinth.svg', surface: { kind: 'rect', w: 320, h: 160 },
    steps: (() => {
      const path = and(RECTS, thinSide(14));
      const spot = and(isShape('circle'), dim(20, 20, 0.8));
      return [
        { icon: '✏️', title: 'Plan', text: 'Zeichne auf Karopapier: Start, Ziel und die Wege.' },
        { icon: '📂', title: 'Vorlage öffnen', text: 'Tippe auf „Vorlage laden“. Links die Wege-Platte (2×), rechts der Boden (1×). Die Wege liegen innerhalb der blauen Linie.', action: 'template', check: has(isTemplate, 2) },
        { icon: '⬜', title: 'Wege', text: 'Formen → Rechteck. Die schmale Seite ist 14 mm (Schloss offen). Die Wege dürfen sich überlappen. Mindestens 3.', show: ['shapes', 'lock', 'height'], check: has(path, 3), hint: hintMsg(RECTS, undefined, 14) },
        { icon: '⚪', title: 'Start + Ziel', text: 'Formen → Kreis, Breite 20. Zwei Stück: Start und Ziel.', show: ['shapes', 'width'], check: has(spot, 2), hint: hintMsg(isShape('circle'), 20, 20) },
        { icon: '🔤', title: 'Thema', text: 'Text: Name oder Deko auf den Rand – Weltraum, Dschungel …', show: ['text'], check: has(isText) },
        { icon: '✂️', title: 'Typ', text: 'Wege und Kreise → „Schneiden“. Deko und Text → „Füllen“.', show: ['cut', 'fill'], check: hasAll(opIs(or(path, spot), 'cut'), opIs(isText, 'fill')) },
        EXPORT(20), LASER,
        { icon: '🗂️', title: 'Zusammenkleben', text: 'Die Wege-Platte wird 2-mal gelasert. Beide Wege-Platten genau aufeinander kleben, dann auf den Boden. Gut trocknen lassen.' },
      ];
    })(),
    ich: ['Weltraum-Labyrinth', 'Dschungel-Pfad', 'Burg mit Schatz', 'Dein Name als Labyrinth'],
    pro: '2 Schichten aufeinander = tiefe Wege. Die Murmel bleibt drin.',
    tip: 'Murmel mit 10–12 mm – nicht größer.',
    lp: { m: 'Pappelsperrholz 3 mm, 3 Platten 150 × 150 mm + Murmel 10–12 mm', hw: 'Überlappende Wege am Computer vereinigen (Kombinieren). Weg-Platte 2×, Boden 1×.', e: [['Schneiden', '100 %', '15 mm/s', '1'], ['Flächengravur', '25 %', '300 mm/s', '1']] },
  },
];

export const projectByNumber = (n: number): Project | undefined => PROJECTS.find((p) => p.n === n);
