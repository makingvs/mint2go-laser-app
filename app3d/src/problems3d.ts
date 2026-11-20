// Sätze für das Fenster "Was ist das Problem?": immer wenn die App ein Warnzeichen zeigt, steht dort auch, was los ist
// und was das Kind tun kann. Reine Texte und Rechnung (ohne Oberfläche) -> testbar.
import type { PrintCheck } from './printExport';

export const MSG = {
  /** Vereinen */
  mergeNoSelection: 'Tippe zuerst auf einen Körper. Dann tippe auf Vereinen.',
  mergeNothingTouches: 'Dieser Körper berührt keinen anderen. Schiebe die Teile zusammen, bis sie sich berühren oder überlappen.',
  mergeBroken: 'Ein Teil ist beschädigt und lässt sich nicht vereinen. Lösche das Teil und mache es noch einmal.',
  /** Export */
  exportEmpty: 'Es gibt nichts zum Drucken. Setze zuerst einen Körper. Ein Loch wird nicht gedruckt.',
  exportBroken: 'Ein Teil ist beschädigt und lässt sich nicht exportieren. Lösche das Teil und mache es noch einmal.',
  exportBase: 'Auf dem Sockel ist noch nichts. Setze zuerst einen Körper, eine Form oder einen Buchstaben darauf.',
  /** Zeichnen und Ausrichten */
  svgBad: 'In dieser Datei habe ich keine Umrisse gefunden. Nimm eine SVG-Datei mit Formen oder dicken Linien.',
  drawEmpty: 'Das Bild ist leer. Daraus kann kein Körper entstehen. Zeichne etwas, das größer ist.',
  alignNone: 'Es ist nichts in der Nähe. Schiebe den Körper näher an einen anderen und tippe noch einmal auf Ausrichten.',
  /** Prüfung konnte nicht laufen */
  checkFailed: 'Die Prüfung hat nicht geklappt, weil ein Teil beschädigt ist. Lösche das letzte Teil und mache es noch einmal.',
  /** freie Arbeit */
  outside: 'Etwas ragt aus dem Druckbett heraus. Schiebe es zurück oder mache es kleiner.',
  floating: 'Ein Stück schwebt über dem Bett. Es berührt weder das Bett noch ein anderes Stück. Schiebe es nach unten.',
  allGood: 'Alles in Ordnung.',
} as const;

const mm = (v: number): string => String(Math.round(v * 100) / 100).replace('.', ',');

/** Kleinste druckbare Wand oder Kante: zwei Düsenbreiten. */
export const minWall = (nozzle: number): number => 2 * nozzle;

/** Satz zu "zu dünn oder zu klein" mit der Zahl für diese Düse. */
export const thinText = (nozzle: number): string =>
  `Ein Teil oder eine Stelle ist zu dünn oder zu klein zum Drucken. Dünner als ${mm(minWall(nozzle))} mm druckt der Drucker nicht. Mache es dicker oder größer.`;

export type FreeProblemKind = 'outside' | 'floating' | 'thin';

/** Probleme einer freien Arbeit (ohne Spielfigur) aus der Druckprüfung; leer = nichts zu beanstanden. */
export function freeProblems(check: PrintCheck, nozzle: number): { kind: FreeProblemKind; text: string }[] {
  const out: { kind: FreeProblemKind; text: string }[] = [];
  if (check.outside) out.push({ kind: 'outside', text: MSG.outside });
  if (check.floating) out.push({ kind: 'floating', text: MSG.floating });
  if (check.thin) out.push({ kind: 'thin', text: thinText(nozzle) });
  return out;
}
