// Such-Fenster für Bilder aus dem Internet (Iconify). Eingabe über eigene Buchstabentasten
// (die iPad-Tastatur würde die Fläche verschieben); Vorschläge zum Antippen für Kinder, die noch nicht tippen.
import { button, h, overlay } from './dom';
import { ICONS } from './icons';
import { buildKeyboard } from './keyboard';
import { TOPICS, fetchIconSvg, hitRef, searchIcons, type Hit, type SearchConfig } from './online';

const MAX_QUERY = 20;

/**
 * onPick bekommt SVG-Text und Referenz; true = übernommen (Fenster schließt), false = Fehler (Kachel wackelt).
 */
export function openOnlineSearch(cfg: SearchConfig, onPick: (svg: string, ref: string) => Promise<boolean>): void {
  const dlg = overlay('overlay-dim');
  const panel = h('div', 'panel search-panel');
  const head = h('div', 'panel-head');
  const display = h('div', 'search-display');
  const go = button('btn send', ICONS.search, () => void run(true), 'Suchen');
  head.append(button('btn', ICONS.cross, () => dlg.close(), 'Schließen'), display, go);

  const body = h('div', 'search-body');
  const results = h('div', 'pick-grid search-results');
  const keyboard = buildKeyboard({
    shift: false,
    onChar: (ch) => press(ch),
    onSpace: () => press(' '),
    onBackspace: () => {
      text = text.slice(0, -1);
      showText();
      void run(false);
    },
  });
  keyboard.el.classList.add('search-kb');
  body.append(results, keyboard.el);
  panel.append(head, body);
  dlg.root.append(panel);

  let text = '';
  let timer = 0;
  let ctrl: AbortController | null = null;

  const showText = () => {
    display.innerHTML = `<span class="s-ico">${ICONS.search}</span><span class="s-text">${text.toUpperCase()}</span><span class="cursor"></span>`;
    go.disabled = !text.trim();
  };

  const topics = () => {
    results.innerHTML = '';
    for (const t of TOPICS) {
      results.append(
        button('pick-item topic', `<span class="emoji">${t.emoji}</span>`, () => {
          text = t.query;
          showText();
          void run(true);
        }, t.query),
      );
    }
  };

  const message = (html: string) => {
    results.innerHTML = `<div class="search-msg">${html}</div>`;
  };

  const render = (hits: Hit[]) => {
    results.innerHTML = '';
    for (const hit of hits) {
      const item = button('pick-item remote', `<img src="${hit.thumb}" alt="" draggable="false" loading="lazy">`, async () => {
        item.classList.add('busy');
        let ok = false;
        try {
          ok = await onPick(await fetchIconSvg(hit), hitRef(hit));
        } catch {
          ok = false;
        }
        if (ok) dlg.close();
        else {
          item.classList.remove('busy', 'shake');
          void item.offsetWidth;
          item.classList.add('shake');
        }
      }, hit.name);
      results.append(item);
    }
  };

  async function run(now = false): Promise<void> {
    clearTimeout(timer);
    ctrl?.abort();
    const q = text.trim();
    if (!q) {
      topics();
      return;
    }
    if (!now) {
      timer = window.setTimeout(() => void run(true), 700);
      return;
    }
    ctrl = new AbortController();
    message(`<div class="spinner">${ICONS.search}</div>`);
    try {
      const out = await searchIcons(q, cfg.sets, ctrl.signal);
      if (out.kind === 'blocked') message('<div class="big-emoji">🙈</div>');
      else if (out.kind === 'offline') message(`<div class="fail-icon">🌐<span>${ICONS.cross}</span></div>`);
      else if (!out.hits.length) message('<div class="big-emoji">🤷</div>');
      else render(out.hits);
    } catch {
      /* abgebrochen: neuere Suche läuft */
    }
  }

  const press = (ch: string) => {
    if (text.length < MAX_QUERY) text += ch;
    showText();
    void run(false);
  };
  showText();
  topics();
}
