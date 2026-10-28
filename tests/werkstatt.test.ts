import { describe, expect, it } from 'vitest';
import { buildFinal, printCheck, type FinalModel } from '../app3d/src/printExport';
import { firstOpenStep, type Snapshot } from '../app3d/src/werkstatt/engine3d';
import { runHelp, type HelpState } from '../app3d/src/werkstatt/help';
import { LEVELS, PROJECTS, projectByNumber } from '../app3d/src/werkstatt/projects3d';

const bed = { width: 220, depth: 220, height: 250 };
const snap = (st: HelpState, exported = false): Snapshot => ({ parts: st.parts, selected: st.parts.find((p) => p.id === st.selected) ?? null, exported, bed });

describe('3D-Werkstatt: Projektdaten', () => {
  it('hat 20 Projekte, 5 je Stufe, lückenlos nummeriert', () => {
    expect(PROJECTS.map((p) => p.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const lv of [1, 2, 3, 4]) expect(PROJECTS.filter((p) => p.lv === lv).length).toBe(5);
    expect(Object.keys(LEVELS)).toHaveLength(4);
    expect(projectByNumber(7)?.title).toBe('Mein Ring');
  });

  it('jedes Projekt ist vollständig (Titel, Symbol, 3 Ideen, Tipp, Schritte mit Symbol und kurzem Text)', () => {
    for (const p of PROJECTS) {
      expect(p.title, `Titel ${p.n}`).toBeTruthy();
      expect(p.emoji, `Symbol ${p.n}`).toBeTruthy();
      expect(p.ich, `Ideen ${p.n}`).toHaveLength(3);
      expect(p.tip, `Tipp ${p.n}`).toBeTruthy();
      expect(p.steps.length, `Schritte ${p.n}`).toBeGreaterThanOrEqual(5);
      for (const [i, s] of p.steps.entries()) {
        expect(s.icon, `Symbol ${p.n}.${i + 1}`).toBeTruthy();
        expect(s.title.length, `Titel ${p.n}.${i + 1}`).toBeLessThanOrEqual(24);
        // kurze Sätze für 6-Jährige: Anweisung höchstens ~190 Zeichen
        expect(s.text.length, `Text ${p.n}.${i + 1}: ${s.text}`).toBeLessThanOrEqual(190);
      }
    }
  });

  it('Projekte zum Abschicken enden mit Abschicken und Drucken; die Übung (4) wird nicht abgeschickt', () => {
    for (const p of PROJECTS) {
      const titles = p.steps.map((s) => s.title);
      if (p.noSend) expect(titles).not.toContain('Abschicken');
      else {
        expect(titles.slice(-2), `Ende ${p.n}`).toEqual(['Abschicken', 'Drucken']);
      }
    }
    expect(projectByNumber(4)?.noSend).toBe(true);
  });

  it('jeder Schritt mit Prüfung hat eine Zeig-mir-Hilfe (außer Abschicken)', () => {
    for (const p of PROJECTS)
      for (const [i, s] of p.steps.entries()) if (s.check && s.title !== 'Abschicken') expect(s.help?.length, `Hilfe ${p.n}.${i + 1} ${s.title}`).toBeGreaterThan(0);
  });
});

describe('3D-Werkstatt: jedes Projekt lässt sich mit der Hilfe komplett lösen', () => {
  for (const p of PROJECTS) {
    it(`${p.n}. ${p.title}`, async () => {
      let st: HelpState = { parts: [], selected: null };
      for (const [i, step] of p.steps.entries()) {
        const where = `${p.n}.${i + 1} ${step.title}`;
        if (step.check && step.title !== 'Abschicken') {
          // vor der Hilfe soll der Schritt noch offen sein (sonst prüft er nichts) – außer er wurde vorher schon miterledigt
          st = await runHelp(st, step.help ?? [], bed);
          expect(step.check(snap(st)), `${where}: Prüfung stimmt nach der Hilfe nicht (Körper: ${JSON.stringify(st.parts.map((q) => [q.kind, q.tag, q.hole ? 'Loch' : '', q.w, q.d, q.h, q.z]))})`).toBe(true);
        } else if (step.title === 'Abschicken') {
          expect(step.check!(snap(st, false)), `${where}: ohne Export darf es nicht stimmen`).toBe(false);
          expect(step.check!(snap(st, true)), `${where}: Druck-Regeln verletzt (Körper: ${JSON.stringify(st.parts.map((q) => [q.kind, q.w, q.d, q.h, q.z]))})`).toBe(true);
        }
      }
      // Ergebnis ist druckbar: Netze in Ordnung, nichts schwebt, im Bauraum (außer Hand-Schritte)
      if (!p.noSend) {
        const model = (await buildFinal(st.parts)) as FinalModel;
        expect(model, `${p.n}: Export liefert ein Modell`).toBeTruthy();
        const check = printCheck(st.parts, model, bed, 0.4);
        expect(check, `${p.n}: Druckprüfung`).toEqual({ empty: false, outside: false, floating: false, thin: false });
      }
    }, 60000);
  }

  it('Prüfungen sind nicht von Anfang an erfüllt: auf leerer Fläche ist kein Schritt (mit Prüfung) schon fertig', () => {
    const empty: Snapshot = { parts: [], selected: null, exported: false, bed };
    for (const p of PROJECTS) for (const [i, s] of p.steps.entries()) if (s.check) expect(s.check(empty), `${p.n}.${i + 1} ${s.title}`).toBe(false);
  });

  it('firstOpenStep findet den ersten offenen Schritt', () => {
    const p = projectByNumber(3)!;
    expect(firstOpenStep(p, { parts: [], selected: null, exported: false, bed })).toBe(0);
  });
});
