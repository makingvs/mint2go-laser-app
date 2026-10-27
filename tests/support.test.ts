import { describe, expect, it } from 'vitest';
import { textShape } from '../src/text';
import { liftHandleXY, liftZ } from '../app3d/src/gizmo';
import { createPart, makeOutlinePart, type Part } from '../app3d/src/model3d';
import { restOn, snapToCenters, supportHeight } from '../app3d/src/support';

const bed = { width: 220, depth: 220, height: 250 };
const box = (x: number, y: number, z: number, w = 30, d = 30, h = 30): Part => ({ ...createPart('box', x, y), z, w, d, h });

describe('Körper auf Körper legen', () => {
  it('ohne andere Körper ruht er auf dem Bett', () => {
    expect(supportHeight(box(0, 0, 0), [])).toBe(0);
    expect(supportHeight(box(0, 0, 50), [])).toBe(0);
  });

  it('über einem Quader ruht er auf dessen Oberseite', () => {
    const plate = box(0, 0, 0, 80, 40, 6);
    const top = box(10, 5, 0, 20, 10, 4);
    expect(supportHeight(top, [plate])).toBe(6);
    expect(restOn(top, [plate]).z).toBe(6);
  });

  it('nur ein Teil der Fläche liegt über dem Quader: er ruht trotzdem darauf (Kante)', () => {
    const plate = box(0, 0, 0, 40, 40, 10);
    expect(supportHeight(box(30, 0, 0, 30, 30, 5), [plate])).toBe(10); // ragt 5 mm über den Rand
  });

  it('daneben ruht er auf dem Bett', () => {
    expect(supportHeight(box(100, 0, 0), [box(0, 0, 0)])).toBe(0);
  });

  it('eine Kugel ruht mit ihrem tiefsten Punkt auf der Oberseite', () => {
    const plate = box(0, 0, 0, 60, 60, 12);
    const ball = { ...createPart('sphere', 5, 5), w: 20, d: 20, h: 20 };
    expect(supportHeight(ball, [plate])).toBe(12);
  });

  it('eine große Platte über einem kleinen Würfel in ihrer Mitte ruht auf dem Würfel', () => {
    const cube = box(0, 0, 0, 10, 10, 15);
    expect(supportHeight(box(0, 0, 0, 80, 80, 4), [cube])).toBe(15);
  });

  it('gezeichneter Text (Umriss) landet auf der Platte', () => {
    const plate = box(0, 0, 0, 100, 40, 6);
    const text = makeOutlinePart(textShape('ANNA'), { scale: 2 }, 3, bed, 0, 0)!;
    expect(supportHeight(text, [plate])).toBe(6);
  });

  it('auch auf einem Körper, der selbst auf einem anderen steht (Stapel)', () => {
    const a = box(0, 0, 0, 40, 40, 10);
    const b = box(0, 0, 10, 20, 20, 10); // auf a
    expect(supportHeight(box(0, 0, 40, 10, 10, 5), [a, b])).toBe(20); // von oben fallen gelassen: auf den Stapel
    expect(supportHeight(box(0, 0, 0, 10, 10, 5), [a, b])).toBe(10); // vom Bett aus: b liegt "über" ihm, es landet auf a
    // beim Ziehen springt es nicht: mit dem Körper vor dem Ziehen als Bezug bleibt das Ergebnis gleich
    const start = box(0, 0, 0, 10, 10, 5);
    expect(supportHeight({ ...start, z: 10 }, [a, b], start)).toBe(10);
  });

  it('Körper, die selbst auf dem verschobenen liegen, zählen nicht', () => {
    const base = box(0, 0, 0, 40, 40, 10);
    const onTop = box(0, 0, 10, 20, 20, 10); // liegt auf base
    // base wird über eine freie Stelle geschoben: onTop darf ihn nicht "hochheben"
    expect(supportHeight({ ...base, x: 100 }, [onTop])).toBe(0);
    expect(supportHeight(base, [onTop])).toBe(0);
  });

  it('Löcher tragen nichts', () => {
    expect(supportHeight(box(0, 0, 0), [{ ...box(0, 0, 0, 80, 80, 20), hole: true }])).toBe(0);
  });

  it('gedrehter Körper: die Auflagepunkte drehen mit', () => {
    const plate = box(0, 0, 0, 20, 20, 8);
    const bar = { ...box(0, 0, 0, 60, 4, 4), rot: 90 }; // steht nach Drehen längs y, ragt 30 mm über die Platte hinaus
    expect(supportHeight(bar, [plate])).toBe(8);
    const off = { ...bar, x: 25 }; // 25 mm daneben: 25 > 10, die Platte reicht nur bis x = 10
    expect(supportHeight(off, [plate])).toBe(0);
  });
});

describe('Einrasten und Anheben', () => {
  it('Mitte auf Mitte, wenn nahe genug', () => {
    const plate = box(10, 20, 0);
    const text = { ...box(11.5, 18, 6) };
    const s = snapToCenters(text, [plate]);
    expect([s.x, s.y]).toEqual([10, 20]);
    const far = snapToCenters({ ...text, x: 16, y: 25 }, [plate]);
    expect([far.x, far.y]).toEqual([16, 25]);
    // x und y getrennt
    const half = snapToCenters({ ...text, x: 11, y: 30 }, [plate]);
    expect([half.x, half.y]).toEqual([10, 30]);
    expect(snapToCenters(text, [{ ...plate, hole: true }])).toBe(text);
    expect(snapToCenters(text, [text])).toBe(text);
  });

  it('Anheben: ganze mm, nie unter das Bett, nie über die Bauhöhe, rastet auf der Auflage ein', () => {
    expect(liftZ(0, 7.4, 10, 0, 250)).toBe(7);
    expect(liftZ(10, -50, 10, 0, 250)).toBe(0);
    expect(liftZ(0, 1000, 10, 0, 250)).toBe(240);
    expect(liftZ(0, 19, 5, 20, 250)).toBe(20); // 1 mm unter der Oberseite eines Quaders: einrasten
    expect(liftZ(0, 14, 5, 20, 250)).toBe(14); // weiter weg: frei
    expect(liftZ(3, 0.4, 5, 0, 250)).toBe(3);
  });

  it('Griff sitzt auf der linken Wand und dreht mit', () => {
    expect(liftHandleXY({ x: 10, y: 20, rot: 0, w: 40 })).toEqual([-10, 20]);
    const [x, y] = liftHandleXY({ x: 10, y: 20, rot: 90, w: 40 });
    expect(x).toBeCloseTo(10, 9);
    expect(y).toBeCloseTo(0, 9);
  });
});
