// Seite "Lizenzen & Quellen": Urheber- und Lizenzhinweise der mitgelieferten Schriften und der
// Bilder aus der Online-Suche, mit vollständigem Lizenztext (aus public/licenses/).
import { button, h, overlay } from './dom';
import { FONTS, fontStyle } from './fonts';
import { ICONS } from './icons';
import { SET_CREDITS } from './online';
import { storage } from './storage';

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

  body.append(h('h3', '', 'Schriften'));
  body.append(h('p', 'hint', 'Alle Schriften stehen unter der SIL Open Font License 1.1 (OFL) und werden unverändert mitgeliefert. Der Lizenztext liegt jeder Schrift bei.'));
  for (const f of FONTS) {
    if (!f.family) {
      body.append(card('Block', '', 'Eigene Strichschrift dieser App (Großbuchstaben, Ziffern) – keine fremde Schrift.', null));
      continue;
    }
    body.append(card(f.label, fontStyle(f), `© ${f.copyright ?? ''} · SIL Open Font License 1.1`, f.license, f.url));
  }

  body.append(h('h3', '', 'Bilder aus der Suche'));
  const sets = h('div');
  body.append(sets);
  void storage.getSearchConfig().then((cfg) => {
    sets.append(
      h(
        'p',
        'hint',
        'Die Bildersuche nutzt die offene Schnittstelle von Iconify (api.iconify.design). Die Bilder werden in der App zu einfarbigen Umrissen verändert (Farben und innere Details entfallen). Gewählte Bilder werden in der Arbeit gespeichert.',
      ),
    );
    const seen = new Set<string>();
    for (const prefix of cfg.sets) {
      const c = SET_CREDITS[prefix];
      if (!c) {
        sets.append(card(prefix, '', 'Lizenz dieser Sammlung ist nicht hinterlegt – bitte prüfen.', null));
        continue;
      }
      if (seen.has(c.licenseFile)) continue;
      seen.add(c.licenseFile);
      sets.append(card('Fluent Emoji (Microsoft)', '', `© ${c.author} · MIT-Lizenz`, c.licenseFile, c.url));
    }
  });

  body.append(h('h3', '', 'Eigene Bilder und Logo'));
  body.append(
    h(
      'p',
      'hint',
      'Selbst hochgeladene Bilder und SVG-Dateien dürfen nur verwendet werden, wenn die Rechte dafür vorliegen. Das MINT2Go-Logo und der Name gehören MINT2Go.',
    ),
  );

  panel.append(head, body);
  o.root.append(panel);
}
