import { describe, expect, it } from 'vitest';
import { GERMAN_ROWS } from '../src/keyboard';

describe('Deutsche Tastatur (QWERTZ)', () => {
  const row = (i: number) => GERMAN_ROWS[i].keys.map((k) => k.ch).join('');

  it('hat die Reihen einer deutschen Tastatur', () => {
    expect(row(0)).toBe('1234567890ß');
    expect(row(1)).toBe('QWERTZUIOPÜ');
    expect(row(2)).toBe('ASDFGHJKLÖÄ');
    expect(row(3)).toBe('YXCVBNM,.-');
    expect(row(4)).toBe('!?:');
  });

  it('Z steht neben T und Y unten links (nicht wie bei QWERTY)', () => {
    expect(row(1).indexOf('Z')).toBe(row(1).indexOf('T') + 1);
    expect(row(3)[0]).toBe('Y');
    expect(row(1)).not.toContain('Y');
  });

  it('Reihen sind wie bei einer echten Tastatur versetzt und passen in das 48-Spalten-Raster', () => {
    const starts = GERMAN_ROWS.map((r) => r.start);
    expect(starts[0]).toBeLessThan(starts[1]);
    expect(starts[1]).toBeLessThan(starts[2]);
    for (const r of GERMAN_ROWS.slice(0, 3)) expect(r.start + r.keys.length * 4).toBeLessThanOrEqual(48);
    expect(GERMAN_ROWS[3].start + 6 + GERMAN_ROWS[3].keys.length * 4).toBeLessThanOrEqual(48);
  });

  it('Umlaute und ß sind vorhanden, ß wird nicht zu SS', () => {
    const all = GERMAN_ROWS.flatMap((r) => r.keys);
    for (const ch of 'ÄÖÜß') expect(all.some((k) => k.ch === ch)).toBe(true);
    expect(all.find((k) => k.ch === 'ß')?.letter).toBeFalsy();
    expect(all.find((k) => k.ch === 'Q')?.letter).toBe(true);
  });
});
