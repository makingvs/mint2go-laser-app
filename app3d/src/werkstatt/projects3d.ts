// Die 20 Projekte der MINT2Go Tinkercad-Werkstatt als geführte Aufgaben in der eigenen 3D-App, für Kinder ab 6 Jahren.
// Themen, Reihenfolge, Zeiten und Ideen stammen von der Werkstatt-Seite (für 8-10 Jahre); die Schritte sind hier in
// einfachen, kurzen Sätzen für diese App geschrieben (statt Tinkercad), werden automatisch geprüft und haben eine
// Zeig-mir-Hilfe, mit der sich jedes Projekt auch automatisch durchspielen lässt (tests/werkstatt.test.ts).
import {
  BOX, CONE, CYL, SPHERE, allOf, and, between, bottomOf, centerOf, centered, exportedCheck, extent, footprint, has, insideXY, isGear,
  isHole, isMesh, isShape, isSketch, isText, isTube, kindIs, lifted, mergedInto, none, not, onBed, or, overlapXY, pair, everyHas, printRulesOk, restsOn, sized,
  solid, tall, thin, topOf, touching, wide, dimsHint,
  type Check, type Pred, type Project, type Step,
} from './engine3d';
import { pitchDiameter } from '../shapes3d';
import type { Part } from '../model3d';

export const LEVELS: Record<number, { name: string; color: string }> = {
  1: { name: 'Starter', color: '#95C11F' },
  2: { name: 'Loch-Profi', color: '#3FB4DA' },
  3: { name: 'Baumeister', color: '#F2A23A' },
  4: { name: 'Erfinder', color: '#E0157A' },
};

// ---------- gemeinsame Bausteine ----------
const hand = (icon: string, title: string, text: string): Step => ({ icon, title, text });
const nn = (n: number): string => String(n).padStart(2, '0');

const SEND = (n: number): Step => ({
  icon: '📤',
  title: 'Abschicken',
  text: `Tippe oben rechts auf Export. Wähle STL. Tippe deinen Namen und die Nummer, zum Beispiel Anna-${nn(n)}. Dann LocalSend.`,
  show: ['export'],
  check: (s) => exportedCheck(s) && printRulesOk(s),
  hint: (s) => (s.exported && !printRulesOk(s) ? 'Prüfe die Druck-Regeln: Nichts darf in der Luft schweben. Höchstens 10 cm groß.' : null),
});
const PRINT = hand('🖨️', 'Drucken', 'Die Lehrperson druckt dein Teil. Das dauert ein bisschen. Warte auf deinen Namen.');

/** Alles Volle zu einem Teil verbinden */
const GLUE = (n = 1, text = 'Tippe oben auf Vereinen. Dann ist alles ein Teil.', help = true): Step => ({
  icon: '🧲',
  title: 'Zusammenkleben',
  text,
  show: ['merge'],
  check: mergedInto(n),
  hint: (s) => (s.parts.some(isHole) || s.parts.filter(solid).length > n ? 'Tippe einen Körper an, dann auf Vereinen.' : null),
  help: help ? [{ op: 'merge' }] : undefined,
});

const dim = (field: 'w' | 'd' | 'h' | 'z', value: number, lock = false): { op: 'set'; field: 'w' | 'd' | 'h' | 'z'; value: number; lock: boolean } => ({ op: 'set', field, value, lock });

// Kippen: nach hinten = negativer Winkel um die x-Achse
const tiltOf = (p: Part, axis: 'x' | 'y'): number => ((p.tilt?.[axis] ?? 0) + 360) % 360;
const tiltNear = (p: Part, deg: number, tol = 6): boolean => {
  for (const axis of ['x', 'y'] as const) {
    const t = tiltOf(p, axis);
    if (Math.abs(t - deg) <= tol || Math.abs(t - deg - 360) <= tol || Math.abs(t - (deg % 360)) <= tol) return true;
  }
  return false;
};
const tiltedBack = (p: Part, lo: number, hi: number): boolean => between(tiltOf(p, 'x'), 360 - hi, 360 - lo);

/** Mehrere Körper gleich weit auseinander in einer Reihe (x oder y) */
const evenRow = (p: Pred, n: number, tol = 1.5): Check => (s) => {
  const m = s.parts.filter(p);
  if (m.length < n) return false;
  for (const axis of [0, 1] as const) {
    const v = m.map((q) => centerOf(q)[axis]).sort((a, b) => a - b);
    const d = v.slice(1).map((x, i) => x - v[i]);
    if (d.every((x) => x > 2) && Math.max(...d) - Math.min(...d) <= tol) return true;
  }
  return false;
};
/** Zu jedem Teil von a gibt es ein Gegenstück auf der anderen Seite der Mitte von b (links/rechts) */
const symmetric = (a: Pred, axis: Pred, tol = 4): Check => (s) => {
  const A = s.parts.filter(a);
  const B = s.parts.find(axis);
  if (!B || A.length < 2) return false;
  const bx = centerOf(B)[0];
  return A.some((x) => A.some((y) => x !== y && Math.abs((centerOf(x)[0] + centerOf(y)[0]) / 2 - bx) <= tol && Math.abs(centerOf(x)[1] - centerOf(y)[1]) <= tol && Math.abs(extent(x)[0] - extent(y)[0]) <= 2));
};

export const PROJECTS: Project[] = [
  // ===================== Stufe 1: Starter =====================
  {
    n: 1, lv: 1, title: 'Mein Türschild', k: 'Ein Schild mit deinem Namen', emoji: '🚪', d: 1, bau: '25 min', druck: '45 min',
    ich: ['Name und dein Lieblingstier', 'Schild mit Wolken aus Kugeln', 'Schild mit Stern und Herz'],
    tip: 'Zwei Farben? Die Lehrperson wechselt bei 3 mm das Filament.', pro: 'Eine Form auf eine andere ziehen: Sie setzt sich gleich oben drauf.',
    steps: [
      { icon: '🟦', title: 'Platte', text: 'Tippe links auf Körper. Nimm den Würfel.', show: ['body'], check: has(and(solid, BOX)), help: [{ op: 'add', kind: 'box' }] },
      {
        icon: '📏', title: 'Flach machen', text: 'Tippe auf das Schloss. Dann: Breite 70, Tiefe 36, Höhe 3.', show: ['lock', 'width', 'depth', 'height'],
        check: has(and(solid, BOX, footprint(60, 80, 30, 42), tall(2, 4.5))), hint: dimsHint(BOX, { x: 70, y: 36, z: 3 }, 6), help: [dim('w', 70), dim('d', 36), dim('h', 3)],
      },
      { icon: '✍️', title: 'Dein Name', text: 'Tippe links auf Text. Tippe deinen Namen. Dann ✓.', show: ['text'], check: has(isText), help: [{ op: 'text', value: 'ANNA', h: 3 }] },
      {
        icon: '🧲', title: 'Auf die Platte', text: 'Zieh den Text mit dem Finger auf die Platte. Er setzt sich oben drauf.',
        check: pair(isText, and(solid, BOX), (t, b) => restsOn(t, b) && insideXY(t, b)), help: [{ op: 'drop' }],
      },
      {
        icon: '❤️', title: 'Herz dazu', text: 'Tippe links auf Formen. Nimm ein Herz. Zieh es auch auf die Platte.', show: ['shapes'],
        check: pair(isShape, and(solid, BOX), (t, b) => restsOn(t, b) && insideXY(t, b)),
        help: [{ op: 'select', pick: 'biggest' }, { op: 'shape', id: 'heart', longest: 6, h: 3, place: 'on', dy: -14 }],
      },
      GLUE(1),
      SEND(1),
      PRINT,
    ],
  },
  {
    n: 2, lv: 1, title: 'Mein Anhänger', k: 'Zeichne deinen eigenen Anhänger', emoji: '🔑', d: 2, bau: '30 min', druck: '40 min',
    warn: 'Alle Teile müssen sich berühren. Was schwebt, fällt nach dem Druck ab. Die Öse muss in deine Form hineinragen.',
    ich: ['Blume mit Blatt', 'Dein Anfangsbuchstabe', 'Umriss von deinem Lieblingstier'], tip: 'Flach und 4 mm dick: ungefähr 40 Minuten Druck.',
    pro: 'Willst du etwas ändern? Tippe es an und mach es neu.',
    steps: [
      hand('💭', 'Idee', 'Was soll es werden? Ein Tier, eine Blume, ein Stern? Denk kurz nach.'),
      {
        icon: '🖍️', title: 'Zeichnen', text: 'Tippe links auf Freihand. Male mit dem Finger eine dicke Form. Dann ✓.', show: ['draw'],
        check: has(and(solid, or(isSketch, isShape))), help: [{ op: 'shape', id: 'circle', longest: 50, h: 4 }],
      },
      {
        icon: '📏', title: 'Dicke 4', text: 'Tippe auf das Schloss. Dann Höhe 4.', show: ['lock', 'height'],
        check: has(and(solid, or(isSketch, isShape), tall(3, 5.5))), hint: dimsHint(or(isSketch, isShape), { z: 4 }, 1.5), help: [dim('h', 4)],
      },
      {
        icon: '↔️', title: 'Größe', text: 'Mach es nicht kleiner als 3 cm und nicht größer als 6 cm.', show: ['width'],
        check: has(and(solid, or(isSketch, isShape), wide(25, 65))), help: [dim('w', 50, true)],
      },
      {
        icon: '⭕', title: 'Öse', text: 'Hol einen kleinen Zylinder: 1 cm breit, 4 mm hoch. Schiebe ihn halb in deine Form.', show: ['body'],
        check: pair(and(solid, or(isSketch, isShape)), and(solid, CYL, footprint(8, 12.5, 8, 12.5), tall(3, 5.5)), (f, o) => touching(f, o)),
        help: [{ op: 'add', kind: 'cylinder', w: 10, d: 10, h: 4, place: 'in', dx: 0, dy: 22 }],
      },
      {
        icon: '🕳️', title: 'Loch', text: 'Hol einen Zylinder: 5 mm breit, 10 mm hoch. Tippe auf Loch. Schiebe ihn in die Öse.', show: ['body', 'hole'],
        check: pair(and(isHole, CYL, footprint(3.5, 7, 3.5, 7)), and(solid, CYL, footprint(8, 12.5, 8, 12.5)), (h, o) => insideXY(h, o, 1.2) && bottomOf(h) <= bottomOf(o) + 0.6 && topOf(h) >= topOf(o) - 0.6),
        help: [{ op: 'add', kind: 'cylinder', w: 5, d: 5, h: 10, hole: true, place: 'in' }],
      },
      GLUE(1), SEND(2), PRINT,
    ],
  },
  {
    n: 3, lv: 1, title: 'Mein Würfel', k: 'Dein Würfel mit einem Extra-Teil', emoji: '🧊', d: 1, bau: '20 min', druck: '20 min',
    ich: ['Partyhut: gelber Kegel oben drauf', 'Monster mit 2 Kugel-Augen', 'Haus: Dach oben drauf'], tip: 'Klein ist schnell gedruckt. Perfekt zum Testen!',
    pro: '10 mm sind 1 cm. Die App misst in Millimetern.',
    steps: [
      { icon: '🟦', title: 'Würfel', text: 'Tippe links auf Körper. Nimm den Würfel.', show: ['body'], check: has(and(solid, BOX)), help: [{ op: 'add', kind: 'box' }] },
      {
        icon: '📏', title: 'Größe 2 cm', text: 'Tippe unten bei Breite und schreibe 20. Das Schloss ist zu: Dann wird alles 20.', show: ['width', 'lock'],
        check: has(and(solid, BOX, sized(20, 20, 20, 5))), hint: dimsHint(BOX, { x: 20, y: 20, z: 20 }, 5), help: [dim('w', 20, true)],
      },
      {
        icon: '🔺', title: 'Extra-Teil', text: 'Hol einen Kegel, eine Kugel oder ein Dach. Zieh es oben auf den Würfel.', show: ['body'],
        check: pair(and(solid, kindIs('cone', 'sphere', 'roof', 'cylinder', 'pyramid', 'dome')), and(solid, BOX), (a, b) => restsOn(a, b) && insideXY(a, b)),
        help: [{ op: 'add', kind: 'cone', w: 12, d: 12, h: 12, place: 'on' }],
      },
      GLUE(1),
      hand('👀', 'Anschauen', 'Wische mit einem Finger über die leere Fläche. Schau deinen Würfel von allen Seiten an.'),
      SEND(3), PRINT,
    ],
  },
  {
    n: 4, lv: 1, title: 'Meine Schnee-Figur', k: 'Übung: deine Figur aus Kugeln', emoji: '⛄', d: 1, bau: '20 min', druck: '–', noSend: true,
    ich: ['Schneekatze mit Kegel-Ohren', 'Schneemann mit Zylinder-Hut', 'Schneebär mit runden Ohren'], tip: 'Nur eine Übung: nicht abschicken! Du lernst das Hochheben.',
    pro: 'Kugeln etwas ineinander schieben: Dann halten sie zusammen.',
    steps: [
      {
        icon: '🍽️', title: 'Teller', text: 'Hol einen Zylinder: 35 breit, 3 hoch. Tippe auf das Schloss.', show: ['body', 'lock'],
        check: has(and(solid, CYL, footprint(30, 40, 30, 40), tall(2, 4.5))), hint: dimsHint(CYL, { x: 35, y: 35, z: 3 }, 5), help: [{ op: 'add', kind: 'cylinder', w: 35, d: 35, h: 3 }],
      },
      {
        icon: '⚪', title: 'Bauch', text: 'Hol eine Kugel (3 cm). Zieh sie auf den Teller.', show: ['body'],
        check: pair(and(solid, SPHERE, wide(22, 38)), and(solid, CYL), (s, c) => restsOn(s, c) && insideXY(s, c, 1)), help: [{ op: 'add', kind: 'sphere', w: 30, place: 'on' }],
      },
      {
        icon: '⬆️', title: 'Hochheben', text: 'Tippe die Kugel an. Zieh den grünen Punkt nach oben.', show: ['z'],
        check: has(and(solid, SPHERE, lifted(4))), hint: () => 'Der grüne Punkt sitzt an der Seite.', help: [dim('z', 6)],
      },
      {
        icon: '🙂', title: 'Kopf', text: 'Hol eine kleinere Kugel (2 cm). Zieh sie oben auf den Bauch.', show: ['body'],
        check: pair(and(solid, SPHERE, wide(12, 24)), and(solid, SPHERE, wide(22, 38)), (k, b) => k !== b && restsOn(k, b, 2.5)), help: [{ op: 'add', kind: 'sphere', w: 20, place: 'on' }],
      },
      {
        icon: '🥕', title: 'Gesicht', text: 'Hol einen Kegel als Nase und zwei kleine Kugeln als Augen.', show: ['body'],
        check: allOf(has(and(solid, CONE, wide(2, 15))), has(and(solid, SPHERE, wide(2, 10)), 2)),
        help: [{ op: 'add', kind: 'cone', w: 6, d: 6, h: 10 }, { op: 'add', kind: 'sphere', w: 5 }, { op: 'add', kind: 'sphere', w: 5 }],
      },
      hand('🎉', 'Fertig', 'Das war eine Übung. Du schickst sie nicht ab.'),
    ],
  },
  {
    n: 5, lv: 1, title: 'Meine Medaille', k: 'Eine Medaille für etwas, das du geschafft hast', emoji: '🏅', d: 2, bau: '25 min', druck: '40 min',
    ich: ['Medaille „Beste Freundin“', 'Sport-Medaille mit Ball', 'Medaille mit deinem Lieblingstier'], tip: 'Fädle ein Band durch – fertig ist dein Orden.',
    pro: 'Das Loch muss mindestens 3 mm vom Rand weg sein.',
    steps: [
      {
        icon: '⭐', title: 'Form', text: 'Tippe auf Formen. Nimm einen Stern oder Kreis, 5 cm breit. Die Höhe: 4.', show: ['shapes'],
        check: has(and(solid, isShape, wide(38, 62), tall(3, 5.5))), hint: dimsHint(isShape, { z: 4 }, 1.5), help: [{ op: 'shape', id: 'circle', longest: 50, h: 4 }],
      },
      {
        icon: '1️⃣', title: 'Zeichen', text: 'Tippe auf Text. Schreibe eine Zahl oder ein Wort. Die Höhe: 2.', show: ['text'],
        check: has(and(isText, tall(1.2, 3))), hint: dimsHint(isText, { z: 2 }, 1), help: [{ op: 'text', value: '1', h: 2 }],
      },
      {
        icon: '🧲', title: 'Auf die Medaille', text: 'Zieh den Text auf die Medaille.',
        check: pair(isText, and(solid, isShape), (t, m) => restsOn(t, m) && insideXY(t, m)), help: [{ op: 'drop' }],
      },
      {
        icon: '🎯', title: 'In die Mitte', text: 'Tippe den Text an. Tippe rechts auf Ausrichten.', show: ['align'],
        check: pair(isText, and(solid, isShape), (t, m) => centered(t, m, 2.5)), help: [{ op: 'align' }],
      },
      {
        icon: '🕳️', title: 'Loch fürs Band', text: 'Hol einen Zylinder, 4 mm breit. Tippe auf Loch. Schiebe ihn oben an den Rand.', show: ['body', 'hole'],
        check: pair(and(isHole, CYL, footprint(3, 5.5, 3, 5.5)), and(solid, isShape), (h, m) => insideXY(h, m, 0.3) && !centered(h, m, 6) && bottomOf(h) <= bottomOf(m) + 0.6 && topOf(h) >= topOf(m) - 0.6),
        help: [{ op: 'select', pick: 'biggest' }, { op: 'add', kind: 'cylinder', w: 4, d: 4, h: 6, hole: true, place: 'in', dy: 20 }],
      },
      GLUE(1), SEND(5), PRINT,
    ],
  },

  // ===================== Stufe 2: Loch-Profi =====================
  {
    n: 6, lv: 2, title: 'Mein Stifte-Monster', k: 'Ein Stiftehalter mit deinem Look', emoji: '🐲', d: 2, bau: '30 min', druck: '2 h',
    warn: 'Große Teile brauchen lange beim Drucken. Schick es früh ab!',
    ich: ['Monster mit Kugel-Augen', 'Burg mit Zinnen', 'Katze mit Kegel-Ohren'], tip: 'Die Wand ist 3 mm dick. Dünner bricht schnell.', pro: 'Ein Loch im Inneren macht den Becher hohl.',
    steps: [
      {
        icon: '🥤', title: 'Becher', text: 'Hol einen Zylinder: 5 cm breit, 6 cm hoch.', show: ['body', 'lock'],
        check: has(and(solid, CYL, footprint(45, 55, 45, 55), tall(55, 70))), hint: dimsHint(CYL, { x: 50, y: 50, z: 60 }, 5), help: [{ op: 'add', kind: 'cylinder', w: 50, d: 50, h: 60 }],
      },
      {
        icon: '🕳️', title: 'Innen-Loch', text: 'Hol noch einen Zylinder, etwas kleiner: 4 cm breit. Tippe auf Loch.', show: ['body', 'hole'],
        check: has(and(isHole, CYL, footprint(38, 47, 38, 47))), help: [{ op: 'add', kind: 'cylinder', w: 44, d: 44, h: 60, hole: true, place: 'in' }],
      },
      {
        icon: '⬆️', title: 'Boden lassen', text: 'Hebe das Loch 3 mm hoch. Oben muss es herausschauen. Sonst hat der Becher keinen Boden.', show: ['z'],
        check: pair(and(isHole, CYL), and(solid, CYL), (h, c) => between(bottomOf(h), 2, 4.5) && topOf(h) >= topOf(c) - 0.6), hint: () => 'Das Loch: Abstand zum Bett 3. Höhe 60.', help: [dim('z', 3)],
      },
      {
        icon: '🎯', title: 'In die Mitte', text: 'Tippe das Loch an. Tippe auf Ausrichten.', show: ['align'],
        check: pair(and(isHole, CYL), and(solid, CYL), (h, c) => centered(h, c, 1.5)), help: [{ op: 'align' }],
      },
      GLUE(1, 'Tippe oben auf Vereinen. Jetzt ist der Becher hohl!'),
      {
        icon: '👀', title: 'Dein Look', text: 'Hol 2 Kugeln als Augen. Schiebe sie vorne an den Becher.', show: ['body'],
        check: allOf(has(and(solid, SPHERE, wide(5, 20)), 2), everyHas(and(solid, SPHERE, wide(5, 20)), isMesh, (s, m) => touching(s, m))),
        help: [
          { op: 'select', pick: 'biggest' }, { op: 'add', kind: 'sphere', w: 10, place: 'in', dx: -8, dy: -25, dz: 40 },
          { op: 'select', pick: 'biggest' }, { op: 'add', kind: 'sphere', w: 10, place: 'in', dx: 8, dy: -25, dz: 40 },
        ],
      },
      GLUE(1, 'Nochmal Vereinen. Die Augen kleben am Becher fest.'),
      SEND(6), PRINT,
    ],
  },
  {
    n: 7, lv: 2, title: 'Mein Ring', k: 'Ein Ring in deiner Größe', emoji: '💍', d: 2, bau: '20 min', druck: '20 min',
    ich: ['Ring mit deinem Anfangsbuchstaben', 'Kronen-Ring', 'Ring mit Kugel-Edelstein'], tip: 'Schick zwei Größen ab und probiere.', pro: 'Lieber ein halbes Millimeter größer, dann passt er.',
    steps: [
      hand('📏', 'Finger messen', 'Frag deine Lehrerin: Wie weit ist dein Finger? Meistens sind es 17 mm.'),
      {
        icon: '⚪', title: 'Ring-Form', text: 'Hol einen Zylinder: 21 breit, 6 hoch. Das Schloss ist aus.', show: ['body', 'lock'],
        check: has(and(solid, CYL, footprint(19, 24, 19, 24), tall(4, 8))), hint: dimsHint(CYL, { x: 21, y: 21, z: 6 }, 3), help: [{ op: 'add', kind: 'cylinder', w: 21, d: 21, h: 6 }],
      },
      {
        icon: '🕳️', title: 'Finger-Loch', text: 'Hol einen Zylinder: 17 breit. Tippe auf Loch. Er muss höher sein als der Ring.', show: ['body', 'hole'],
        check: pair(and(isHole, CYL, footprint(15, 19.5, 15, 19.5)), and(solid, CYL), (h, r) => bottomOf(h) <= bottomOf(r) + 0.6 && topOf(h) >= topOf(r) - 0.6),
        help: [{ op: 'add', kind: 'cylinder', w: 17, d: 17, h: 10, hole: true, place: 'in' }],
      },
      {
        icon: '🎯', title: 'In die Mitte', text: 'Tippe das Loch an. Tippe auf Ausrichten.', show: ['align'],
        check: pair(and(isHole, CYL), and(solid, CYL), (h, r) => centered(h, r, 1.5)), help: [{ op: 'align' }],
      },
      GLUE(1, 'Tippe auf Vereinen. Jetzt hat dein Ring ein Loch für den Finger.'),
      {
        icon: '💎', title: 'Schmuckstück', text: 'Zieh ein Herz, einen Stern oder eine Kugel außen an den Ring.', show: ['shapes', 'body'],
        check: pair(and(solid, not(isMesh)), isMesh, (j, r) => touching(j, r) && !centered(j, r, 8)),
        help: [{ op: 'shape', id: 'star', longest: 8, h: 4, place: 'in', dx: 10.5 }],
      },
      GLUE(1), SEND(7), PRINT,
    ],
  },
  {
    n: 8, lv: 2, title: 'Mein Lesezeichen', k: 'Ein Lesezeichen mit deinem Muster', emoji: '🔖', d: 2, bau: '25 min', druck: '30 min',
    ich: ['Katze schaut oben raus', 'Sternen-Himmel', 'Dein Name als Loch-Schrift'], tip: 'Nur 2 mm dünn. Es biegt sich schön.', pro: 'Kopie merkt sich deinen letzten Schritt: Die nächste Kopie springt gleich weit.',
    steps: [
      {
        icon: '📏', title: 'Streifen', text: 'Hol einen Würfel. Breite 100, Tiefe 30, Höhe 2. Das Schloss ist aus.', show: ['body', 'lock'],
        check: has(and(solid, BOX, footprint(85, 101, 25, 35), tall(1.5, 3))), hint: dimsHint(BOX, { x: 100, y: 30, z: 2 }, 5), help: [{ op: 'add', kind: 'box', w: 100, d: 30, h: 2 }],
      },
      {
        icon: '🕳️', title: 'Muster-Loch', text: 'Hol ein Herz, so groß wie ein Daumennagel (8 mm). Tippe auf Loch. Zieh es auf den Streifen.', show: ['shapes', 'hole'],
        check: pair(and(isHole, isShape, wide(5, 12)), and(solid, BOX), (h, s) => insideXY(h, s, 0.3) && bottomOf(h) <= topOf(s) - 0.6),
        help: [{ op: 'shape', id: 'heart', longest: 8, h: 10, hole: true, place: 'in', dx: -35 }],
      },
      {
        icon: '📑', title: 'Kopie', text: 'Tippe oben auf Kopie. Schiebe die Kopie ein Stück nach rechts.', show: ['copy'],
        check: has(and(isHole, isShape), 2), help: [{ op: 'copy', dx: 15, dy: 0 }],
      },
      {
        icon: '🔁', title: 'Nochmal', text: 'Tippe nochmal auf Kopie. Die Kopie springt gleich weit! Mach 3 Herzen.', show: ['copy'],
        check: evenRow(and(isHole, isShape), 3), help: [{ op: 'copy', dx: 15, dy: 0 }],
      },
      GLUE(1, 'Tippe auf Vereinen. Die Herzen sind jetzt Löcher im Streifen.'),
      {
        icon: '🐱', title: 'Dein Kopf', text: 'Hol eine Kugel oder einen Kegel. Schiebe sie oben ans Lesezeichen: ein Kopf schaut heraus.', show: ['body'],
        check: pair(and(solid, not(isMesh), kindIs('sphere', 'cone', 'dome', 'cylinder')), isMesh, (k, m) => touching(k, m)),
        help: [{ op: 'add', kind: 'sphere', w: 12, d: 12, h: 12, place: 'in', dx: 44, dy: 15 }],
      },
      GLUE(1), SEND(8), PRINT,
    ],
  },
  {
    n: 9, lv: 2, title: 'Meine Ausstechform', k: 'Ein Keks-Ausstecher in deiner Form', emoji: '🍪', d: 3, bau: '30 min', druck: '1 h',
    warn: 'Nur mit Erwachsenen und nur für Teig!',
    ich: ['Maus aus 3 Kreisen', 'Dein Anfangsbuchstabe', 'Stern mit runden Spitzen'], tip: 'Nur mit Erwachsenen und nur für Teig.', pro: '60 − 56 = 4 mm: Pro Seite sind es 2 mm Wand.',
    steps: [
      {
        icon: '❤️', title: 'Deine Form', text: 'Tippe auf Formen. Nimm ein Herz oder einen Stern: 6 cm breit, 15 mm hoch.', show: ['shapes', 'lock'],
        check: has(and(solid, isShape, wide(52, 68), tall(12, 18))), hint: dimsHint(isShape, { z: 15 }, 3), help: [{ op: 'shape', id: 'heart', longest: 60, h: 15 }],
      },
      {
        icon: '📑', title: 'Rand unten', text: 'Tippe auf Kopie. Die Kopie: 66 breit und nur 2 hoch. Daran drückst du später.', show: ['copy', 'lock'],
        check: allOf(has(and(solid, isShape), 2), has(and(solid, isShape, wide(62, 72), tall(1.2, 3.5)))),
        help: [{ op: 'copy', dx: 0, dy: 0 }, dim('w', 66, true), dim('h', 2)],
      },
      {
        icon: '🕳️', title: 'Innen-Form', text: 'Noch eine Kopie von der großen Form: 56 breit, 20 hoch. Tippe auf Loch.', show: ['copy', 'hole'],
        check: has(and(isHole, isShape, wide(52, 59), tall(17, 24))),
        help: [{ op: 'select', pick: 'first' }, { op: 'copy', dx: 0, dy: 0 }, dim('w', 56, true), dim('h', 20), { op: 'hole' }],
      },
      {
        icon: '🎯', title: 'Alle in die Mitte', text: 'Tippe jede Form an. Tippe auf Ausrichten.', show: ['align'],
        check: (s) => {
          const f = s.parts.filter(isShape);
          return f.length >= 3 && f.every((q) => centered(q, f[0], 2));
        },
        help: [{ op: 'select', pick: 'last' }, { op: 'align' }],
      },
      GLUE(1, 'Tippe auf Vereinen. Jetzt ist die Form innen leer!'),
      SEND(9), PRINT,
    ],
  },
  {
    n: 10, lv: 2, title: 'Mein Spielwürfel', k: 'Ein Würfel mit deinen Zeichen', emoji: '🎲', d: 3, bau: '35 min', druck: '30 min',
    ich: ['Gefühle-Würfel mit Gesichtern', 'Rechen-Würfel', 'Tier-Würfel'], tip: 'Danach kannst du die Punkte mit einem Stift ausmalen.', pro: 'Bei einem normalen Würfel ist gegenüber immer die 7.',
    steps: [
      {
        icon: '🟦', title: 'Würfel', text: 'Hol einen Würfel: 24 mm. Das Schloss ist zu.', show: ['body', 'lock'],
        check: has(and(solid, BOX, sized(24, 24, 24, 3))), hint: dimsHint(BOX, { x: 24, y: 24, z: 24 }, 3), help: [{ op: 'add', kind: 'box', w: 24, d: 24, h: 24 }],
      },
      hand('💭', 'Deine Idee', 'Was soll oben auf dem Würfel sein? Punkte, Sterne oder Herzen? Denk kurz nach.'),
      {
        icon: '⚫', title: 'Punkt eindrücken', text: 'Hol eine Kugel (5 mm). Tippe auf Loch. Hebe sie mit dem grünen Punkt, bis sie oben aus dem Würfel schaut.', show: ['body', 'hole', 'z'],
        check: (s) => dents(s) >= 1, hint: () => 'Die Kugel muss oben ein bisschen herausschauen.',
        help: [{ op: 'add', kind: 'sphere', w: 5, hole: true, place: 'in', dx: -7, dz: 21.5 }],
      },
      {
        icon: '⚫', title: 'Drei Punkte', text: 'Tippe auf Kopie. Schiebe die Kopie. Mach drei Punkte.', show: ['copy'],
        check: (s) => dents(s) >= 3, help: [{ op: 'copy', dx: 7, dy: 0 }, { op: 'copy', dx: 7, dy: 0 }],
      },
      GLUE(1, 'Tippe auf Vereinen. Die Punkte sind jetzt eingedrückt.'),
      SEND(10), PRINT,
    ],
  },

  // ===================== Stufe 3: Baumeister =====================
  {
    n: 11, lv: 3, title: 'Mein Traumhaus', k: 'Ein Haus, eine Burg oder ein Turm', emoji: '🏠', d: 3, bau: '40 min', druck: '1,5 h',
    ich: ['Baumhaus auf einem Stamm', 'Leuchtturm aus Zylindern', 'Burg mit vier Türmen'], tip: 'Fenster nur 2 mm tief: Dann bleibt das Haus stabil.', pro: 'Schräge Dächer drucken ohne Stützen.',
    steps: [
      hand('✏️', 'Skizze', 'Male dein Traumhaus auf Papier. Wie viele Fenster? Ein Turm?'),
      {
        icon: '🟦', title: 'Wände', text: 'Hol einen Würfel: etwa 4 cm breit und tief, 3 cm hoch.', show: ['body', 'lock'],
        check: has(and(solid, BOX, footprint(30, 52, 30, 52), tall(20, 36))), hint: dimsHint(BOX, { x: 40, y: 40, z: 30 }, 10), help: [{ op: 'add', kind: 'box', w: 40, d: 40, h: 30 }],
      },
      {
        icon: '🔺', title: 'Dach', text: 'Hol ein Dach oder eine Pyramide. Zieh es oben auf das Haus.', show: ['body'],
        check: pair(and(solid, kindIs('roof', 'pyramid', 'cone', 'dome')), and(solid, BOX), (r, b) => restsOn(r, b) && overlapXY(r, b)), help: [{ op: 'add', kind: 'roof', w: 44, d: 44, h: 15, place: 'on' }],
      },
      {
        icon: '🪟', title: 'Tür und Fenster', text: 'Hol 2 kleine Würfel. Tippe auf Loch. Schiebe sie an die Wand.', show: ['body', 'hole'],
        check: allOf(has(and(isHole, wide(3, 14)), 2), everyHas(and(isHole, wide(3, 14)), and(solid, BOX), (h, b) => touching(h, b))),
        help: [
          { op: 'select', pick: 'kind:box' }, { op: 'add', kind: 'box', w: 8, d: 8, h: 10, hole: true, place: 'in', dx: -9, dy: -20, dz: 12 },
          { op: 'select', pick: 'kind:box' }, { op: 'add', kind: 'box', w: 8, d: 8, h: 10, hole: true, place: 'in', dx: 9, dy: -20, dz: 12 },
        ],
      },
      GLUE(1, 'Tippe auf Vereinen. Die Löcher sind jetzt Fenster in der Wand.'),
      hand('🏗️', 'Extras', 'Willst du einen Kamin oder einen Turm? Hol einen Zylinder und kleb ihn mit Vereinen an. Sonst: weiter.'),
      SEND(11), PRINT,
    ],
  },
  {
    n: 12, lv: 3, title: 'Mein Handyständer', k: 'Ein Ständer, der zu deinem Handy passt', emoji: '📱', d: 3, bau: '40 min', druck: '2 h',
    ich: ['Ständer mit Katzen-Ohren', 'Dein Name auf der Lehne', 'Lehne mit Loch-Muster'], tip: 'Die Lehne muss die Platte berühren.', pro: 'Die Zahl beim Kippen sind Grad: 15 bis 30 sind schön.',
    steps: [
      {
        icon: '🟦', title: 'Platte', text: 'Hol einen Würfel: 80 breit, 70 tief, 5 hoch. Das Schloss ist aus.', show: ['body', 'lock'],
        check: has(and(solid, BOX, footprint(70, 90, 60, 80), tall(4, 6.5))), hint: dimsHint(BOX, { x: 80, y: 70, z: 5 }, 8), help: [{ op: 'add', kind: 'box', w: 80, d: 70, h: 5 }],
      },
      {
        icon: '🧱', title: 'Lehne', text: 'Hol einen Würfel: 80 breit, 6 dick, 60 hoch. Zieh ihn hinten auf die Platte.', show: ['body'],
        check: pair(and(solid, BOX, footprint(70, 90, 4, 9), tall(50, 70)), and(solid, BOX, footprint(70, 90, 60, 80), tall(4, 6.5)), (l, p) => restsOn(l, p) && centerOf(l)[1] - centerOf(p)[1] >= 10),
        help: [{ op: 'add', kind: 'box', w: 80, d: 6, h: 60, place: 'on', dy: 25 }],
      },
      {
        icon: '↗️', title: 'Kippen', text: 'Tippe die Lehne an. Tippe rechts auf Kippen. Kippe sie ein bisschen nach hinten.', show: ['tilt'],
        check: has(and(solid, (p) => tiltedBack(p, 10, 35))), hint: () => 'Nicht zu steil: 15 bis 30 Grad.', help: [{ op: 'tilt', axis: 'x', deg: -20 }],
      },
      {
        icon: '⬇️', title: 'Festkleben', text: 'Drücke die Lehne mit dem grünen Punkt 2 mm nach unten. Dann steckt sie in der Platte und klebt fest.', show: ['z'],
        check: pair(and(solid, (p) => tiltedBack(p, 10, 35)), and(solid, BOX, footprint(70, 90, 60, 80)), (l, p) => between(bottomOf(l), topOf(p) - 3.5, topOf(p) - 0.8)), help: [dim('z', 3)],
      },
      {
        icon: '🪜', title: 'Halte-Kante', text: 'Hol einen flachen Würfel: 80 breit, 5 dick, 8 hoch. Leg ihn vorne auf die Platte.', show: ['body'],
        check: (s) => {
          const plate = s.parts.find(and(solid, BOX, footprint(70, 90, 60, 80), tall(4, 6.5)));
          const lehne = s.parts.find(and(solid, (p) => tiltedBack(p, 10, 35)));
          return !!plate && !!lehne && s.parts.some((k) => solid(k) && BOX(k) && footprint(70, 90, 3, 8)(k) && tall(6, 10)(k) && restsOn(k, plate) && centerOf(k)[1] <= centerOf(lehne)[1] - 20);
        },
        help: [{ op: 'select', pick: 'first' }, { op: 'add', kind: 'box', w: 80, d: 5, h: 8, place: 'on', dy: -25 }],
      },
      hand('🎨', 'Dein Design', 'Willst du Ohren, ein Herz oder deinen Namen dazu? Mach es jetzt. Sonst: weiter.'),
      GLUE(1), SEND(12), PRINT,
    ],
  },
  {
    n: 13, lv: 3, title: 'Meine Rakete', k: 'Eine Rakete in deinem Design', emoji: '🚀', d: 4, bau: '40 min', druck: '1,5 h',
    ich: ['Rakete mit 3 Stufen', 'Rakete mit Fenstern', 'Rakete mit 3 Flossen'], tip: 'Flossen bis zum Boden: Dann braucht es keine Stützen.', pro: 'Teile mitten durch die Rakete drehen sich perfekt im Kreis.',
    steps: [
      {
        icon: '🛢️', title: 'Rumpf', text: 'Hol einen Zylinder: 2 cm breit, 6 cm hoch. Das Schloss ist aus.', show: ['body', 'lock'],
        check: has(and(solid, CYL, footprint(15, 26, 15, 26), tall(50, 80))), hint: dimsHint(CYL, { x: 20, y: 20, z: 60 }, 5), help: [{ op: 'add', kind: 'cylinder', w: 20, d: 20, h: 60 }],
      },
      {
        icon: '🔺', title: 'Spitze', text: 'Hol einen Kegel. Zieh ihn oben auf die Rakete.', show: ['body'],
        check: pair(and(solid, kindIs('cone', 'dome', 'pyramid')), and(solid, CYL), (k, r) => restsOn(k, r) && centered(k, r, 4)), help: [{ op: 'add', kind: 'cone', w: 20, d: 20, h: 15, place: 'on' }],
      },
      {
        icon: '➖', title: 'Flosse', text: 'Hol einen flachen Würfel: 40 breit, 2 dick, 20 hoch. Leg ihn unten durch die Rakete.', show: ['body'],
        check: pair(and(solid, BOX, footprint(30, 50, 1, 3.5), tall(12, 30), onBed), and(solid, CYL), (f, r) => touching(f, r) && centered(f, r, 3)),
        help: [{ op: 'select', pick: 'first' }, { op: 'add', kind: 'box', w: 40, d: 2, h: 20, place: 'in' }],
      },
      {
        icon: '➕', title: 'Kreuz', text: 'Tippe auf Kopie. Dreh die Kopie auf 90 Grad. Schon hast du 4 Flossen!', show: ['copy', 'rot'],
        check: pair(and(solid, BOX, footprint(30, 50, 1, 3.5)), and(solid, BOX, footprint(30, 50, 1, 3.5)), (a, b) => Math.abs(extent(a)[0] - extent(b)[1]) < 3 && Math.abs(extent(a)[1] - extent(b)[0]) < 3 && extent(a)[0] !== extent(b)[0] && centered(a, b, 2)),
        help: [{ op: 'copy', dx: 0, dy: 0 }, { op: 'set', field: 'rot', value: 90 }],
      },
      {
        icon: '🪟', title: 'Fenster', text: 'Hol eine kleine Kugel. Tippe auf Loch. Schiebe sie vorne in die Rakete.', show: ['body', 'hole'],
        check: pair(and(isHole, SPHERE, wide(3, 12)), and(solid, CYL), (h, r) => touching(h, r)),
        help: [{ op: 'select', pick: 'first' }, { op: 'add', kind: 'sphere', w: 6, hole: true, place: 'in', dy: -10, dz: 40 }],
      },
      {
        icon: '🎯', title: 'In die Mitte', text: 'Tippe die Spitze an. Tippe auf Ausrichten.', show: ['align'],
        check: pair(and(solid, kindIs('cone', 'dome', 'pyramid')), and(solid, CYL), (k, r) => centered(k, r, 1.5)), help: [{ op: 'select', pick: 'kind:cone' }, { op: 'align' }],
      },
      GLUE(1), SEND(13), PRINT,
    ],
  },
  {
    n: 14, lv: 3, title: 'Meine Schatzkiste', k: 'Eine Kiste mit passendem Deckel', emoji: '🧰', d: 4, bau: '45 min', druck: '2,5 h',
    ich: ['Piraten-Kiste', 'Schmuckkästchen mit Herz', 'Geheim-Box mit deinem Namen'], tip: 'Der Deckel liegt neben der Kiste, der Rand nach oben.', pro: 'Der Rand ist innen 1 mm kleiner: Dann passt der Deckel.',
    steps: [
      {
        icon: '🟦', title: 'Kiste', text: 'Hol einen Würfel: 5 cm breit, 4 cm tief, 3 cm hoch.', show: ['body', 'lock'],
        check: has(and(solid, BOX, footprint(45, 55, 35, 45), tall(25, 35))), hint: dimsHint(BOX, { x: 50, y: 40, z: 30 }, 5), help: [{ op: 'add', kind: 'box', w: 50, d: 40, h: 30 }],
      },
      {
        icon: '🕳️', title: 'Innen-Loch', text: 'Hol noch einen Würfel: 4 mm kleiner (46 breit, 36 tief). Tippe auf Loch.', show: ['body', 'hole'],
        check: has(and(isHole, BOX, footprint(41, 51, 31, 41))), help: [{ op: 'add', kind: 'box', w: 46, d: 36, h: 30, hole: true, place: 'in' }],
      },
      {
        icon: '⬆️', title: 'Boden lassen', text: 'Hebe das Loch 2 mm hoch. Oben muss es herausschauen.', show: ['z'],
        check: pair(and(isHole, BOX), and(solid, BOX), (h, k) => between(bottomOf(h), 1.2, 3) && topOf(h) >= topOf(k) - 0.6), help: [dim('z', 2)],
      },
      {
        icon: '🎯', title: 'In die Mitte', text: 'Tippe das Loch an. Tippe auf Ausrichten.', show: ['align'],
        check: pair(and(isHole, BOX), and(solid, BOX), (h, k) => centered(h, k, 1.5)), help: [{ op: 'align' }],
      },
      GLUE(1, 'Tippe auf Vereinen. Jetzt ist die Kiste hohl!'),
      {
        icon: '🟫', title: 'Deckel', text: 'Hol einen Würfel, so groß wie die Kiste, aber nur 3 mm hoch. Leg ihn neben die Kiste.', show: ['body'],
        check: pair(and(solid, BOX, footprint(45, 55, 35, 45), tall(2, 4.5)), isMesh, (d, k) => !overlapXY(d, k)),
        help: [{ op: 'select', pick: 'biggest' }, { op: 'add', kind: 'box', w: 50, d: 40, h: 3, place: 'beside' }],
      },
      {
        icon: '🔲', title: 'Rand', text: 'Hol einen Würfel: 45 breit, 35 tief, 4 hoch. Zieh ihn in die Mitte auf den Deckel.', show: ['body'],
        check: pair(and(solid, BOX, footprint(43, 47, 33, 37), tall(3, 5.5)), and(solid, BOX, footprint(45, 55, 35, 45), tall(2, 4.5)), (r, d) => restsOn(r, d) && centered(r, d, 2.5)),
        help: [{ op: 'add', kind: 'box', w: 45, d: 35, h: 4, place: 'on' }],
      },
      GLUE(2, 'Tippe auf Vereinen. Der Rand klebt am Deckel. Kiste und Deckel bleiben zwei Teile.'),
      SEND(14), PRINT,
    ],
  },
  {
    n: 15, lv: 3, title: 'Mein Roboter', k: 'Erfinde deinen eigenen Roboter', emoji: '🤖', d: 4, bau: '45 min', druck: '2 h',
    ich: ['Roboter-Hund', 'Roboter auf Rädern', 'Roboter mit Riesen-Kopf'], tip: 'Arme müssen unten auf dem Boden stehen, sonst brauchen sie Stützen.', pro: 'Gleiche Seiten? Spiegeln statt neu bauen.',
    steps: [
      hand('✏️', 'Skizze', 'Wie sieht dein Roboter aus? Male ihn kurz auf Papier.'),
      {
        icon: '🟦', title: 'Körper', text: 'Hol einen Würfel: 30 breit, 20 tief, 35 hoch.', show: ['body', 'lock'],
        check: has(and(solid, BOX, footprint(25, 35, 15, 25), tall(30, 40))), hint: dimsHint(BOX, { x: 30, y: 20, z: 35 }, 5), help: [{ op: 'add', kind: 'box', w: 30, d: 20, h: 35 }],
      },
      {
        icon: '🙂', title: 'Kopf', text: 'Hol einen Würfel, eine Kugel oder einen Zylinder. Zieh ihn oben auf den Körper.', show: ['body'],
        check: pair(and(solid, kindIs('box', 'sphere', 'cylinder', 'dome')), and(solid, BOX, footprint(25, 35, 15, 25), tall(30, 40)), (k, b) => restsOn(k, b) && insideXY(k, b, 3)),
        help: [{ op: 'add', kind: 'box', w: 20, d: 20, h: 15, place: 'on' }],
      },
      {
        icon: '👀', title: 'Augen', text: 'Hol 2 kleine Kugeln. Schiebe sie vorne an den Kopf.', show: ['body'],
        check: allOf(has(and(solid, SPHERE, wide(2, 10)), 2), everyHas(and(solid, SPHERE, wide(2, 10)), and(solid, not(SPHERE)), (a, b) => touching(a, b))),
        help: [
          { op: 'add', kind: 'sphere', w: 5, place: 'in', dx: -5, dy: -10, dz: 5 },
          { op: 'select', pick: 'kind:box' }, { op: 'add', kind: 'sphere', w: 5, place: 'in', dx: 5, dy: -10, dz: 5 },
        ],
      },
      {
        icon: '🦾', title: 'Arm', text: 'Hol einen Zylinder. Leg ihn an die Seite vom Körper, unten auf den Boden.', show: ['body'],
        check: pair(and(solid, CYL, onBed), and(solid, BOX, footprint(25, 35, 15, 25), tall(30, 40)), (a, b) => touching(a, b)),
        help: [{ op: 'select', pick: 'first' }, { op: 'add', kind: 'cylinder', w: 8, d: 8, h: 25, place: 'in', dx: 18 }],
      },
      {
        icon: '🪞', title: 'Zweiter Arm', text: 'Tippe auf Kopie. Tippe auf Spiegeln. Schiebe den Arm auf die andere Seite.', show: ['copy', 'mirror'],
        check: symmetric(and(solid, CYL, onBed), and(solid, BOX, footprint(25, 35, 15, 25), tall(30, 40))), help: [{ op: 'copy', dx: -36, dy: 0 }, { op: 'mirror' }],
      },
      {
        icon: '🎯', title: 'Kopf in die Mitte', text: 'Tippe den Kopf an. Tippe auf Ausrichten.', show: ['align'],
        check: pair(and(solid, BOX, footprint(15, 25, 15, 25), tall(10, 20)), and(solid, BOX, footprint(25, 35, 15, 25), tall(30, 40)), (k, b) => centered(k, b, 2)), help: [{ op: 'select', pick: 'kind:box' }, { op: 'align' }],
      },
      GLUE(1), SEND(15), PRINT,
    ],
  },

  // ===================== Stufe 4: Erfinder =====================
  {
    n: 16, lv: 4, title: 'Meine Murmelbahn', k: 'Dein Bahn-Stück für alle', emoji: '🔵', d: 4, bau: '50 min', druck: '2 h',
    ich: ['Rampe mit hohen Füßen', 'Tunnel-Stück', 'Ziel-Becher am Ende'], tip: 'Alle Teile der Klasse passen zusammen!', pro: 'Das Loch ist etwas größer als der Zapfen.',
    steps: [
      hand('🗺️', 'Plan', 'Was baust du? Eine Rampe, einen Tunnel oder ein Ziel? Die Röhre ist bei allen gleich breit.'),
      {
        icon: '🧪', title: 'Röhre', text: 'Tippe auf Körper. Nimm die Röhre. 24 mm breit, 7 cm lang (hoch).', show: ['body'],
        check: has(and(solid, isTube, footprint(20, 28, 20, 28), tall(55, 85))), hint: dimsHint(isTube, { x: 24, y: 24, z: 70 }, 4), help: [{ op: 'add', kind: 'tube', w: 24, h: 70 }],
      },
      {
        icon: '↪️', title: 'Hinlegen', text: 'Tippe die Röhre an. Tippe rechts auf Kippen. Leg sie hin (90 Grad).', show: ['tilt'],
        check: has(and(solid, isTube, wide(50, 90), (p) => tiltNear(p, 90) || tiltNear(p, 270))), help: [{ op: 'tilt', axis: 'y', deg: 90 }],
      },
      {
        icon: '✂️', title: 'Halbieren', text: 'Hol einen großen Würfel. Tippe auf Loch. Leg ihn über die obere Hälfte der Röhre.', show: ['body', 'hole'],
        check: pair(and(isHole, BOX), and(solid, isTube), (h, t) => between(bottomOf(h), bottomOf(t) + extent(t)[2] * 0.35, bottomOf(t) + extent(t)[2] * 0.65) && insideXY(t, h, 1.5)),
        help: [{ op: 'add', kind: 'box', w: 90, d: 40, h: 30, hole: true, place: 'in', dz: 12 }],
      },
      GLUE(1, 'Tippe auf Vereinen. Jetzt ist die Röhre eine halbe Röhre.'),
      {
        icon: '🔩', title: 'Zapfen', text: 'Hol einen kleinen Zylinder (6 mm). Kleb ihn an ein Ende der Röhre.', show: ['body'],
        check: pair(and(solid, CYL, wide(3, 9)), isMesh, (z, m) => touching(z, m)), help: [{ op: 'add', kind: 'cylinder', w: 6, d: 6, h: 6, place: 'in', dx: 36 }],
      },
      GLUE(1), SEND(16), PRINT,
    ],
  },
  {
    n: 17, lv: 4, title: 'Meine Zahnrad-Maschine', k: 'Zahnräder, die deine Maschine antreiben', emoji: '⚙️', d: 5, bau: '50 min', druck: '1,5 h',
    ich: ['Kurbel mit Griff', 'Zahnrad-Blume', '3 Räder in einer Reihe'], tip: 'Die Räder liegen flach nebeneinander.', pro: 'Doppelt so viele Zähne: halb so schnell.',
    steps: [
      {
        icon: '⚙️', title: 'Zahnrad A', text: 'Tippe auf Körper. Nimm das Zahnrad. Tippe 10 Zähne.', show: ['body'],
        check: has(and(solid, isGear, (p) => between(p.teeth ?? 0, 8, 12))), help: [{ op: 'add', kind: 'gear', teeth: 10, h: 5 }],
      },
      {
        icon: '⚙️', title: 'Zahnrad B', text: 'Noch ein Zahnrad. Jetzt mit 20 Zähnen. Es wird groß.', show: ['body'],
        check: has(and(solid, isGear, (p) => between(p.teeth ?? 0, 16, 24))), help: [{ op: 'add', kind: 'gear', teeth: 20, h: 5 }],
      },
      {
        icon: '🤝', title: 'Greifen', text: 'Schiebe die Räder zusammen. Die Zähne greifen ineinander, aber sie kleben nicht.', show: ['body'],
        check: pair(and(solid, isGear, (p) => between(p.teeth ?? 0, 8, 12)), and(solid, isGear, (p) => between(p.teeth ?? 0, 16, 24)), (a, b) => gearsMesh(a, b)),
        hint: (s) => {
          const a = s.parts.find(and(solid, isGear, (p) => between(p.teeth ?? 0, 8, 12)));
          const b = s.parts.find(and(solid, isGear, (p) => between(p.teeth ?? 0, 16, 24)));
          if (!a || !b) return null;
          const d = Math.hypot(centerOf(a)[0] - centerOf(b)[0], centerOf(a)[1] - centerOf(b)[1]);
          const want = (pitchDiameter(a.teeth ?? 10) + pitchDiameter(b.teeth ?? 20)) / 2;
          return d > want + 2.2 ? 'Noch zu weit auseinander.' : d < want - 2.2 ? 'Zu nah: Die Räder kleben zusammen.' : null;
        },
        help: [{ op: 'select', pick: 'last' }, { op: 'put', x: 37.5, y: 0 }],
      },
      {
        icon: '🔄', title: 'Kurbel', text: 'Hol einen kleinen Zylinder (6 mm breit, 10 hoch). Zieh ihn oben auf das kleine Zahnrad.', show: ['body'],
        check: pair(and(solid, CYL, not(isGear), wide(4, 12)), and(solid, isGear, (p) => between(p.teeth ?? 0, 8, 12)), (c, g) => restsOn(c, g, 1)),
        help: [{ op: 'select', pick: 'first' }, { op: 'add', kind: 'cylinder', w: 6, d: 6, h: 10, place: 'on', dx: 7 }],
      },
      {
        icon: '🧲', title: 'Zusammenkleben', text: 'Tippe die Kurbel an. Tippe auf Vereinen. Das kleine Rad und die Kurbel sind jetzt eins.', show: ['merge'],
        check: allOf(none(and(solid, CYL, not(isGear))), has(and(solid, isMesh))), help: [{ op: 'merge' }],
      },
      SEND(17), PRINT,
    ],
  },
  {
    n: 18, lv: 4, title: 'Mein Kreisel', k: 'Ein Kreisel, der lange dreht', emoji: '🪀', d: 4, bau: '45 min', druck: '1 h',
    warn: 'Die Spitze steht auf dem Bett. Die Scheibe muss genau in der Mitte sein!',
    ich: ['Stern-Kreisel', 'Kreisel mit Loch-Muster', 'Kreisel mit Doppel-Scheibe'], tip: 'Alles in der Mitte: Dann dreht er lange.', pro: 'Alles symmetrisch und mittig: Der Kreisel dreht lange.',
    steps: [
      {
        icon: '🔺', title: 'Spitze', text: 'Hol einen Kegel: 2 cm breit und hoch. Das Schloss ist zu.', show: ['body', 'lock'],
        check: has(and(solid, CONE, sized(20, 20, 20, 4))), hint: dimsHint(CONE, { x: 20, y: 20, z: 20 }, 4), help: [{ op: 'add', kind: 'cone', w: 20, d: 20, h: 20 }],
      },
      {
        icon: '🙃', title: 'Umdrehen', text: 'Tippe den Kegel an. Tippe rechts auf Kippen. Dreh ihn um (zweimal 90 Grad). Die Spitze zeigt nach unten.', show: ['tilt'],
        check: has(and(solid, CONE, (p) => tiltNear(p, 180))), help: [{ op: 'tilt', axis: 'x', deg: 90 }, { op: 'tilt', axis: 'x', deg: 90 }],
      },
      {
        icon: '⭕', title: 'Scheibe', text: 'Tippe auf Formen. Nimm einen Kreis oder Stern: 4 cm breit, 5 mm hoch. Zieh ihn auf den Kegel.', show: ['shapes'],
        check: pair(and(solid, isShape, wide(33, 52), tall(3.5, 7)), and(solid, CONE), (s, c) => overlapXY(s, c) && Math.abs(bottomOf(s) - topOf(c)) <= 1.5),
        help: [{ op: 'shape', id: 'circle', longest: 40, h: 5, place: 'on' }],
      },
      {
        icon: '🖐️', title: 'Griff', text: 'Hol einen Zylinder: 8 mm breit, 2 cm hoch. Zieh ihn oben auf die Scheibe.', show: ['body'],
        check: pair(and(solid, CYL, footprint(6, 10, 6, 10), tall(15, 25)), and(solid, isShape), (g, s) => restsOn(g, s)),
        help: [{ op: 'add', kind: 'cylinder', w: 8, d: 8, h: 20, place: 'on' }],
      },
      {
        icon: '🕳️', title: 'Muster', text: 'Hol 3 kleine Kugeln. Tippe auf Loch. Schiebe sie in die Scheibe.', show: ['body', 'hole'],
        check: allOf(has(and(isHole, wide(3, 10)), 3), everyHas(and(isHole, wide(3, 10)), and(solid, isShape), (h, s) => insideXY(h, s, 0.5) && touching(h, s))),
        help: [
          { op: 'select', pick: 'tag:shape' }, { op: 'add', kind: 'sphere', w: 5, hole: true, place: 'in', dx: -12, dz: 1 },
          { op: 'select', pick: 'tag:shape' }, { op: 'add', kind: 'sphere', w: 5, hole: true, place: 'in', dx: 12, dz: 1 },
          { op: 'select', pick: 'tag:shape' }, { op: 'add', kind: 'sphere', w: 5, hole: true, place: 'in', dy: 12, dz: 1 },
        ],
      },
      {
        icon: '🎯', title: 'Genau Mitte', text: 'Tippe die Scheibe an, dann den Griff. Tippe jedes Mal auf Ausrichten.', show: ['align'],
        check: (s) => {
          const c = s.parts.find(and(solid, CONE));
          const sc = s.parts.find(and(solid, isShape));
          const g = s.parts.find(and(solid, CYL, tall(15, 25)));
          return !!c && !!sc && !!g && centered(sc, c, 2) && centered(g, c, 2);
        },
        help: [{ op: 'select', pick: 'tag:shape' }, { op: 'align' }, { op: 'select', pick: 'kind:cylinder' }, { op: 'align' }],
      },
      GLUE(1), SEND(18), PRINT,
    ],
  },
  {
    n: 19, lv: 4, title: 'Mein Flügel-Tier', k: 'Ein Tier mit Flügeln – du entscheidest welches', emoji: '🦋', d: 5, bau: '60 min', druck: '1,5 h',
    ich: ['Schmetterling mit Flügel-Muster', 'Biene mit kleinen Flügeln', 'Drache mit Zacken-Flügeln'], tip: 'Die Flügel liegen flach, der Körper steht.', pro: 'Spiegeln macht beide Flügel gleich.',
    steps: [
      hand('💭', 'Idee', 'Welches Tier mit Flügeln? Schmetterling, Biene, Drache? Denk kurz nach.'),
      {
        icon: '🐛', title: 'Körper', text: 'Hol einen Zylinder: 1 cm breit, 4 cm hoch. Das Schloss ist aus.', show: ['body', 'lock'],
        check: has(and(solid, CYL, footprint(8, 13, 8, 13), tall(30, 50))), hint: dimsHint(CYL, { x: 10, y: 10, z: 40 }, 3), help: [{ op: 'add', kind: 'cylinder', w: 10, d: 10, h: 40 }],
      },
      {
        icon: '🦋', title: 'Flügel', text: 'Tippe auf Formen. Nimm ein Herz: 3 cm breit, 3 mm hoch. Leg es links an den Körper.', show: ['shapes'],
        check: pair(and(solid, isShape, wide(22, 40), tall(2, 4.5)), and(solid, CYL, tall(30, 50)), (w, b) => touching(w, b, 1) && centerOf(w)[0] < centerOf(b)[0] - 5),
        help: [{ op: 'shape', id: 'heart', longest: 30, h: 3, place: 'in', dx: -18 }],
      },
      {
        icon: '🪞', title: 'Zweiter Flügel', text: 'Tippe auf Kopie. Tippe auf Spiegeln. Schiebe den Flügel rechts an den Körper.', show: ['copy', 'mirror'],
        check: symmetric(and(solid, isShape), and(solid, CYL, tall(30, 50))), help: [{ op: 'copy', dx: 36, dy: 0 }, { op: 'mirror' }],
      },
      {
        icon: '〰️', title: 'Fühler', text: 'Hol 2 kleine Kegel. Setz sie oben auf den Körper.', show: ['body'],
        check: allOf(has(and(solid, CONE, wide(2, 12)), 2), everyHas(and(solid, CONE, wide(2, 12)), and(solid, CYL, tall(30, 50)), (k, b) => restsOn(k, b))),
        help: [
          { op: 'select', pick: 'kind:cylinder' }, { op: 'add', kind: 'cone', w: 5, d: 5, h: 8, place: 'on', dx: -2.5 },
          { op: 'select', pick: 'kind:cylinder' }, { op: 'add', kind: 'cone', w: 5, d: 5, h: 8, place: 'on', dx: 2.5 },
        ],
      },
      GLUE(1), SEND(19), PRINT,
    ],
  },
  {
    n: 20, lv: 4, title: 'Mein Labyrinth', k: 'Dein Murmel-Labyrinth mit Thema', emoji: '🧩', d: 5, bau: '1,5 h', druck: '4 h',
    warn: 'Das dauert lange zum Drucken. Schick es früh ab!',
    ich: ['Labyrinth mit Fallen-Löchern', 'Weltraum-Labyrinth', 'Dein Name im Labyrinth'], tip: 'Die Wege sind mindestens 14 mm breit, sonst passt die Murmel nicht.', pro: 'Erst auf Karopapier planen: 1 Kästchen sind 10 mm.',
    steps: [
      hand('✏️', 'Plan', 'Male auf Karopapier: 10 mal 10 Kästchen. Start, Ziel und die Wege.'),
      {
        icon: '🟦', title: 'Block', text: 'Hol einen Würfel: 8 cm breit und tief, 11 mm hoch.', show: ['body', 'lock'],
        check: has(and(solid, BOX, footprint(70, 85, 70, 85), tall(9, 13))), hint: dimsHint(BOX, { x: 80, y: 80, z: 11 }, 5), help: [{ op: 'add', kind: 'box', w: 80, d: 80, h: 11 }],
      },
      {
        icon: '🕳️', title: 'Spielfeld', text: 'Hol noch einen Würfel: 76 breit und tief. Tippe auf Loch. Hebe ihn 3 mm hoch.', show: ['body', 'hole', 'z'],
        check: pair(and(isHole, BOX, footprint(72, 79, 72, 79)), and(solid, BOX, footprint(70, 85, 70, 85)), (h, b) => between(bottomOf(h), 2, 4.2) && topOf(h) >= topOf(b) - 0.6),
        help: [{ op: 'add', kind: 'box', w: 76, d: 76, h: 12, hole: true, place: 'in', dz: 3 }],
      },
      {
        icon: '🎯', title: 'In die Mitte', text: 'Tippe das Loch an. Tippe auf Ausrichten.', show: ['align'],
        check: pair(and(isHole, BOX), and(solid, BOX), (h, b) => centered(h, b, 1.5)), help: [{ op: 'align' }],
      },
      GLUE(1, 'Tippe auf Vereinen. Jetzt hast du eine flache Schale mit Rand.'),
      {
        icon: '🧱', title: 'Wände', text: 'Hol einen dünnen Würfel: 2 mm dick, 8 mm hoch. Zieh ihn in das Spielfeld. Mach 3 Wände mit Kopie.', show: ['body', 'copy'],
        check: allOf(
          has(and(solid, BOX, thin(3), tall(5, 10), wide(12, 70), (p) => between(bottomOf(p), 2.4, 3.6)), 3),
          everyHas(and(solid, BOX, thin(3), tall(5, 10), wide(12, 70)), isMesh, (w, m) => insideXY(w, m, 0.5)),
        ),
        help: [
          { op: 'select', pick: 'biggest' }, { op: 'add', kind: 'box', w: 2, d: 40, h: 8, place: 'in', dx: -20, dy: 10, dz: 3 },
          { op: 'select', pick: 'biggest' }, { op: 'add', kind: 'box', w: 2, d: 40, h: 8, place: 'in', dx: 0, dy: -10, dz: 3 },
          { op: 'select', pick: 'biggest' }, { op: 'add', kind: 'box', w: 2, d: 40, h: 8, place: 'in', dx: 20, dy: 10, dz: 3 },
        ],
      },
      {
        icon: '🎯', title: 'Ziel-Loch', text: 'Hol einen Zylinder: 12 mm breit. Tippe auf Loch. Schiebe ihn auf den Boden.', show: ['body', 'hole'],
        check: pair(and(isHole, CYL, footprint(10, 14, 10, 14)), isMesh, (h, m) => insideXY(h, m, 0.5) && bottomOf(h) <= bottomOf(m) + 0.6),
        help: [{ op: 'select', pick: 'biggest' }, { op: 'add', kind: 'cylinder', w: 12, d: 12, h: 30, hole: true, place: 'in', dx: -28, dy: -28 }],
      },
      GLUE(1, 'Tippe auf Vereinen. Alles klebt zusammen, das Ziel-Loch ist offen.'),
      SEND(20), PRINT,
    ],
  },
];

// ---------- Prüfungen, die mehrere Projekte brauchen ----------
/** Zahnräder greifen: Abstand der Mitten = halbe Summe der Teilkreis-Durchmesser (± 2,2 mm) */
function gearsMesh(a: Part, b: Part): boolean {
  const d = Math.hypot(centerOf(a)[0] - centerOf(b)[0], centerOf(a)[1] - centerOf(b)[1]);
  const want = (pitchDiameter(a.teeth ?? 10) + pitchDiameter(b.teeth ?? 20)) / 2;
  return Math.abs(d - want) <= 2.2;
}

/** Wie viele Punkte (Kugel-/Zylinder-Löcher) sind oben in einen Würfel eingedrückt (ragen oben heraus und tauchen ein)? */
function dents(s: { parts: Part[] }): number {
  const cubes = s.parts.filter(and(solid, BOX));
  return s.parts.filter(
    (h) => isHole(h) && wide(2, 8)(h) && cubes.some((c) => insideXY(h, c, 0.2) && bottomOf(h) <= topOf(c) - 0.8 && topOf(h) >= topOf(c) + 0.2),
  ).length;
}

export const projectByNumber = (n: number): Project | undefined => PROJECTS.find((p) => p.n === n);
