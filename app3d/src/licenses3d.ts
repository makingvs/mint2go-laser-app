// Seite "Lizenzen & Quellen" der 3D-App: three.js, manifold, Schriften, mit vollständigem Lizenztext (aus licenses/).
import { button, h, overlay } from '../../src/dom';
import { FONTS, fontStyle } from '../../src/fonts';
import { ICONS } from '../../src/icons';

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Karte mit Titel, Urheber, Lizenzname und aufklappbarem Volltext. */
function card(title: string, titleStyle: string, meta: string, file: string | null, url?: string): HTMLElement {
  const c = h('div', 'lic-card');
  c.append(h('div', 'lic-title', `<span style="${titleStyle}">${esc(title)}</span>`), h('div', 'lic-meta', meta));
  if (url) c.append(h('div', 'lic-url', esc(url)));
  if (file) {
    const pre = h('pre', 'lic-text');
    pre.hidden = true;
    const toggle = button('chip', 'Lizenztext anzeigen', async () => {
      if (pre.hidden) {
        if (!pre.textContent) {
          try {
            const res = await fetch(`licenses/${file}.txt`);
            pre.textContent = res.ok ? await res.text() : 'Lizenztext konnte nicht geladen werden.';
          } catch {
            pre.textContent = 'Lizenztext konnte nicht geladen werden (offline?).';
          }
        }
        pre.hidden = false;
        toggle.textContent = 'Lizenztext verbergen';
      } else {
        pre.hidden = true;
        toggle.textContent = 'Lizenztext anzeigen';
      }
    });
    c.append(toggle, pre);
  }
  return c;
}

export function openLicenses(): void {
  const o = overlay('overlay-dim');
  const panel = h('div', 'panel lic-panel');
  const head = h('div', 'panel-head');
  head.append(button('btn', ICONS.cross, () => o.close(), 'Schließen'), h('h2', '', 'Lizenzen & Quellen'));
  const body = h('div', 'lic-body tform');

  body.append(h('h3', '', 'Programme'));
  body.append(card('three.js', '', '© 2010-2024 three.js authors · MIT-Lizenz (3D-Ansicht)', 'three', 'https://threejs.org'));
  body.append(card('manifold', '', '© The Manifold Authors · Apache License 2.0 (Vereinen und Ausschneiden)', 'manifold', 'https://github.com/elalish/manifold'));

  body.append(h('h3', '', 'Schriften'));
  body.append(h('p', 'hint', 'Alle Schriften stehen unter der SIL Open Font License 1.1 (OFL) und werden unverändert mitgeliefert. Der Lizenztext liegt jeder Schrift bei.'));
  for (const f of FONTS) {
    if (!f.family) {
      body.append(card('Block', '', 'Eigene Strichschrift dieser App (Großbuchstaben, Ziffern) – keine fremde Schrift.', null));
      continue;
    }
    body.append(card(f.label, fontStyle(f), `© ${f.copyright ?? ''} · SIL Open Font License 1.1`, f.license, f.url));
  }

  body.append(h('h3', '', 'Eigene Bilder und Logo'));
  body.append(h('p', 'hint', 'Selbst hochgeladene SVG-Dateien dürfen nur verwendet werden, wenn die Rechte dafür vorliegen. Das MINT2Go-Logo und der Name gehören MINT2Go.'));

  panel.append(head, body);
  o.root.append(panel);
}
