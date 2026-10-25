import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SEARCH, isBlocked, iconUrl, normalizeSearchConfig, searchIcons, translateQuery } from '../src/online';
import { formatNumber, parseEntry } from '../src/numpad';

describe('Übersetzung Deutsch -> Englisch', () => {
  it('übersetzt Grundwörter, Mehrzahl und Mehrwortsuchen', () => {
    expect(translateQuery('Katze')).toBe('cat');
    expect(translateQuery('Katzen')).toBe('cat');
    expect(translateQuery('Meerschweinchen')).toBe('guinea pig');
    expect(translateQuery('Fußball')).toBe('soccer ball');
    expect(translateQuery('Schildkröten')).toBe('turtle');
    expect(translateQuery('rotes Auto')).toBe('rotes automobile');
    expect(translateQuery('cat')).toBe('cat'); // Englisch bleibt
    expect(translateQuery('   ')).toBe('');
  });
});

describe('Kindersicherung', () => {
  it('sperrt ungeeignete Begriffe, lässt harmlose Wörter mit ähnlichen Buchstaben durch', () => {
    for (const bad of ['pistol', 'Bier', 'wine glass', 'skull', 'cigarette', 'gun', 'nackt', 'Messer', 'beer-mug', 'sex']) expect(isBlocked(bad), bad).toBe(true);
    for (const ok of ['butterfly', 'meerschweinchen', 'waffel', 'trombone', 'cat', 'guinea pig', 'engraving', 'seaweed', 'grapes', 'Schwein', 'pillow', 'Biene']) expect(isBlocked(ok), ok).toBe(false);
  });
});

describe('Suche (Iconify)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('übersetzt, begrenzt auf erlaubte Sammlungen, filtert und entdoppelt', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ icons: ['noto:cat', 'fluent-emoji-high-contrast:cat', 'noto:cat-face', 'noto:pistol', 'noto:cat'] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await searchIcons('Katze', ['fluent-emoji-high-contrast', 'noto']);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('query=cat');
    expect(url).toContain('prefixes=fluent-emoji-high-contrast,noto');
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') return;
    // einfarbige Sammlung zuerst, doppelter Name nur einmal, Pistole gefiltert
    expect(out.hits.map((h) => `${h.prefix}:${h.name}`)).toEqual(['fluent-emoji-high-contrast:cat', 'noto:cat-face']);
    expect(out.hits[0].url).toBe(iconUrl('fluent-emoji-high-contrast', 'cat'));
  });

  it('fragt bei gesperrten Begriffen gar nicht erst an', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await searchIcons('Pistole', ['noto'])).kind).toBe('blocked');
    expect((await searchIcons('Bier', ['noto'])).kind).toBe('blocked');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('meldet fehlendes Internet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect((await searchIcons('Hund', ['noto'])).kind).toBe('offline');
  });

  it('prüft die Konfiguration', () => {
    expect(normalizeSearchConfig(undefined)).toEqual(DEFAULT_SEARCH);
    expect(normalizeSearchConfig({ enabled: false, sets: ['noto', 'böse/../x'] })).toEqual({ enabled: false, sets: ['noto'] });
    expect(normalizeSearchConfig({ sets: [] }).sets).toEqual(DEFAULT_SEARCH.sets);
  });
});

describe('Zahleneingabe', () => {
  it('zeigt Zahlen mit Komma und höchstens einer Nachkommastelle', () => {
    expect(formatNumber(56)).toBe('56');
    expect(formatNumber(56.04)).toBe('56');
    expect(formatNumber(12.55)).toBe('12,6');
  });

  it('liest Eingaben mit Komma und begrenzt sie', () => {
    expect(parseEntry('12,5', 1, 100)).toBe(12.5);
    expect(parseEntry('0,2', 1, 100)).toBe(1);
    expect(parseEntry('999', 1, 100)).toBe(100);
    expect(parseEntry('', 1, 100)).toBeNull();
    expect(parseEntry(',', 1, 100)).toBeNull();
  });
});
