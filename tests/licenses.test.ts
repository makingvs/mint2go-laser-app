import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FONTS } from '../src/fonts';
import { DEFAULT_SEARCH, SET_CREDITS } from '../src/online';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Lizenzen: Schriften (SIL OFL 1.1)', () => {
  const webFonts = FONTS.filter((f) => f.family);

  it('jede mitgelieferte Schrift hat Urheberhinweis und vollständigen Lizenztext in public/licenses', () => {
    expect(webFonts.length).toBeGreaterThanOrEqual(5);
    for (const f of webFonts) {
      expect(f.license, f.id).toBeTruthy();
      const text = read(`public/licenses/${f.license}.txt`);
      expect(text, f.id).toMatch(/Copyright \d{4}/);
      expect(text, f.id).toContain('SIL OPEN FONT LICENSE Version 1.1');
      expect(text, f.id).toContain('PERMISSION & CONDITIONS');
      expect(text, f.id).toContain('DISCLAIMER');
      expect(text, f.id).not.toMatch(/Reserved Font Name "/); // keine Schrift mit Reserved Font Name
    }
  });

  it('jede Schrift ist per @font-face eingebunden und im Hinweisdokument genannt', () => {
    const css = read('src/style.css');
    const notices = read('THIRD-PARTY-NOTICES.md');
    for (const f of webFonts) {
      expect(css, f.id).toContain(`font-family: '${f.family}'`);
      expect(notices, f.id).toContain(f.label);
      expect(f.copyright, f.id).toBeTruthy();
      expect(f.url, f.id).toMatch(/^https:\/\//);
    }
  });
});

describe('Lizenzen: Bildersuche', () => {
  it('nur Sammlungen mit hinterlegter, eindeutiger Lizenz sind freigeschaltet', () => {
    for (const set of DEFAULT_SEARCH.sets) {
      const c = SET_CREDITS[set];
      expect(c, set).toBeTruthy();
      expect(c.license).toBe('MIT');
      const text = read(`public/licenses/${c.licenseFile}.txt`);
      expect(text).toContain('Permission is hereby granted');
      expect(text).toContain(c.author.split(' ')[0]); // Microsoft
    }
    expect(DEFAULT_SEARCH.sets).not.toContain('noto');
  });

  it('config.json und Standardwerte stimmen überein', () => {
    const cfg = JSON.parse(read('public/config.json'));
    expect(cfg.onlineSearch.sets).toEqual(DEFAULT_SEARCH.sets);
  });

  it('das Hinweisdokument nennt Microsoft/MIT und den Ausschluss von Noto Emoji', () => {
    const notices = read('THIRD-PARTY-NOTICES.md');
    expect(notices).toContain('Microsoft Corporation');
    expect(notices).toContain('MIT');
    expect(notices).toContain('Noto Emoji');
  });
});
