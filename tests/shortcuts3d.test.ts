import { describe, expect, it } from 'vitest';
import { defaultOrbit } from '../app3d/src/orbit';
import { SHORTCUT_HELP, arrowDelta, shortcut3dFor, type Action3d } from '../app3d/src/shortcuts3d';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {}) =>
  shortcut3dFor({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

describe('Tastenkürzel der 3D-App', () => {
  it('Bearbeiten mit Strg oder Befehlstaste', () => {
    expect(key('z', { ctrlKey: true })).toBe('undo');
    expect(key('z', { metaKey: true })).toBe('undo');
    expect(key('Z', { ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(key('y', { ctrlKey: true })).toBe('redo');
    expect(key('c', { ctrlKey: true })).toBe('copy');
    expect(key('v', { ctrlKey: true })).toBe('paste');
    expect(key('d', { ctrlKey: true })).toBe('duplicate');
    expect(key('e', { ctrlKey: true })).toBe('export');
  });

  it('Browser-Kürzel bleiben unberührt', () => {
    expect(key('r', { ctrlKey: true })).toBeNull(); // Neu laden
    expect(key('a', { ctrlKey: true })).toBeNull();
    expect(key('l', { ctrlKey: true })).toBeNull();
    expect(key('Tab', { altKey: true })).toBeNull();
    expect(key('f')).toBeNull();
  });

  it('einzelne Tasten: Löschen, Auswahl, Pfeile, Anheben, Drehen, Tab', () => {
    expect(key('Delete')).toBe('delete');
    expect(key('Backspace')).toBe('delete');
    expect(key('Escape')).toBe('deselect');
    expect(key('ArrowLeft')).toBe('left');
    expect(key('ArrowUp', { shiftKey: true })).toBe('up');
    expect(key('PageUp')).toBe('raise');
    expect(key('PageDown')).toBe('lower');
    expect(key('r')).toBe('rotate');
    expect(key('R', { shiftKey: true })).toBe('rotateBack');
    expect(key('Tab')).toBe('next');
    expect(key('Tab', { shiftKey: true })).toBe('prev');
  });

  it('Werkzeuge über Ziffern und Buchstaben', () => {
    expect(['1', '2', '3', '4', '5'].map((k) => key(k))).toEqual(['body', 'shapes', 'draw', 'text', 'svg']);
    expect(['l', 'v', 'k', 's', 'a', 'm', 'h', '?'].map((k) => key(k))).toEqual(['hole', 'merge', 'tilt', 'mirror', 'align', 'center', 'home', 'help']);
    expect(key('M')).toBe('center'); // Feststelltaste
    expect(key('Home')).toBe('home');
  });

  it('jede Aktion steht in der Hilfe-Liste', () => {
    const all: Action3d[] = [
      'undo', 'redo', 'copy', 'paste', 'duplicate', 'delete', 'deselect', 'left', 'right', 'up', 'down', 'raise', 'lower', 'rotate', 'rotateBack',
      'next', 'prev', 'body', 'shapes', 'draw', 'text', 'svg', 'hole', 'merge', 'tilt', 'mirror', 'align', 'center', 'home', 'export', 'help',
    ];
    const listed = new Set(SHORTCUT_HELP.flatMap((h) => h.actions));
    for (const a of all) expect(listed.has(a)).toBe(true);
  });
});

describe('Pfeiltasten folgen der Ansicht', () => {
  it('Startansicht: rechts = +x, oben = von der Kamera weg = +y', () => {
    const yaw = defaultOrbit({ width: 60, depth: 60, height: 30 }).yaw;
    expect(arrowDelta('right', yaw)).toEqual([1, 0]);
    expect(arrowDelta('left', yaw)).toEqual([-1, 0]);
    expect(arrowDelta('up', yaw)).toEqual([0, 1]);
    expect(arrowDelta('down', yaw)).toEqual([0, -1]);
  });

  it('Ansicht von der Seite gedreht: die Pfeile drehen mit', () => {
    const yaw = defaultOrbit({ width: 60, depth: 60, height: 30 }).yaw + Math.PI / 2; // Kamera steht rechts vom Bett und blickt nach links (-x)
    expect(arrowDelta('right', yaw)).toEqual([0, 1]);
    expect(arrowDelta('up', yaw)).toEqual([-1, 0]);
    const back = defaultOrbit({ width: 60, depth: 60, height: 30 }).yaw + Math.PI; // Blick von hinten
    expect(arrowDelta('right', back)).toEqual([-1, 0]);
    expect(arrowDelta('up', back)).toEqual([0, -1]);
  });
});
