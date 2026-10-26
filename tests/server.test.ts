import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
// @ts-expect-error – reines JS-Modul ohne Typen
import { createApp, safeName, timestampName } from '../server/server.mjs';

let base = '';
let root = '';
let server: ReturnType<typeof createApp>;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'laser-test-'));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(dist, 'index.html'), '<html>app</html>');
  fs.writeFileSync(path.join(root, 'geheim.txt'), 'geheim');
  server = createApp({ root, distDir: dist });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const json = (url: string, init?: RequestInit) => fetch(base + url, init).then(async (r) => ({ status: r.status, body: await r.json() }));

describe('Server', () => {
  it('liefert die App aus und schützt andere Dateien', async () => {
    const r = await fetch(base + '/');
    expect(await r.text()).toContain('app');
    const t = await fetch(base + '/..%2Fgeheim.txt');
    expect(await t.text()).not.toContain('geheim');
  });

  it('nennt die Adressen für die iPads (keine VPN-/Link-Local-Adressen)', async () => {
    const info = (await json('/api/info')).body;
    expect(info.addresses.at(-1).url).toMatch(/^http:\/\/.+\.local:\d+$/);
    for (const a of info.addresses) {
      expect(a.url).not.toMatch(/\/\/169\.254\./);
      expect(a.url).not.toMatch(/\/\/100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./);
    }
  });

  it('antwortet auf ping', async () => {
    expect((await json('/api/ping')).body.ok).toBe(true);
  });

  it('speichert gesendete SVG im Laser-Eingang mit Kindername', async () => {
    const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm"></svg>';
    const r = await json('/api/send?kind=Lena', { method: 'POST', body: svg });
    expect(r.body.ok).toBe(true);
    expect(r.body.file).toMatch(/^Lena_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.svg$/);
    expect(fs.readFileSync(path.join(root, 'Laser-Eingang', r.body.file), 'utf8')).toBe(svg);
  });

  it('weist Nicht-SVG ab', async () => {
    const r = await json('/api/send?kind=X', { method: 'POST', body: 'hallo' });
    expect(r.status).toBe(400);
  });

  it('macht Dateinamen sicher', () => {
    expect(safeName('../../Windows')).toBe('Windows');
    expect(safeName('Ana Lena!')).toBe('Ana_Lena');
    expect(safeName('')).toBe('Kind');
    expect(timestampName('Tom', new Date(2026, 9, 24, 8, 5, 9))).toBe('Tom_2026-10-24_08-05-09.svg');
  });

  it('verwaltet Profile und Arbeiten, Löschen geht in den Papierkorb', async () => {
    const p = await json('/api/profiles', { method: 'POST', body: JSON.stringify({ name: 'Fuchs', icon: '🦊' }) });
    expect(p.body.id).toBe('Fuchs');
    expect((await json('/api/profiles')).body).toEqual([{ id: 'Fuchs', name: 'Fuchs', icon: '🦊' }]);

    const design = { id: 'x', created: 1, updated: 5, elements: [] };
    await json('/api/profiles/Fuchs/designs/d-1', { method: 'PUT', body: JSON.stringify(design) });
    const list = (await json('/api/profiles/Fuchs/designs')).body;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('d-1');

    await json('/api/profiles/Fuchs/designs/d-1', { method: 'DELETE' });
    expect((await json('/api/profiles/Fuchs/designs')).body).toHaveLength(0);
    expect(fs.readdirSync(path.join(root, 'Projekte', 'Fuchs', '_Papierkorb'))).toHaveLength(1);
  });

  it('speichert Einstellungen mit Grenzen', async () => {
    const d = (await json('/api/settings')).body;
    expect(d.plate.width).toBe(300);
    const r = await json('/api/settings', { method: 'PUT', body: JSON.stringify({ plate: { width: 400, height: 5000 }, colors: { cut: '#00ff00' }, minSize: 2 }) });
    expect(r.body.plate).toEqual({ width: 400, height: 1000 });
    expect(r.body.colors.cut).toBe('#00FF00');
    expect(r.body.colors.engrave).toBe('#0000FF');
    expect((await json('/api/settings')).body.minSize).toBe(2);
  });
});
