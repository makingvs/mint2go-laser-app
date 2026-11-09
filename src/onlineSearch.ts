// Such-Fenster für Bilder aus dem Internet (Iconify). Eingabe über die Tastatur des Geräts;
// Vorschläge zum Antippen für Kinder, die noch nicht tippen.
import { button, h, overlay } from './dom';
import { ICONS } from './icons';
import { TOPICS, fetchIconSvg, hitRef, searchIcons, type Hit, type SearchConfig } from './online';

const MAX_QUERY = 20;

/**
 * onPick bekommt SVG-Text und Referenz; true = übernommen (Fenster schließt), false = Fehler (Kachel wackelt).
 */
export function openOnlineSearch(cfg: SearchConfig, onPick: (svg: string, ref: string) => Promise<boolean>): void {
  const dlg = overlay('overlay-dim overlay-top');
  const panel = h('div', 'panel search-panel');
  const head = h('div', 'panel-head');
  const input = h('input', 'name-input search-input');
  input.type = 'search';
  input.maxLength = MAX_QUERY;
  input.placeholder = 'Suchen';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.enterKeyHint = 'search';
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('aria-label', 'Suchbegriff');
  const go = button('btn send', ICONS.search, () => void run(true), 'Suchen');
  head.append(button('btn', ICONS.cross, () => dlg.close(), 'Schließen'), input, go);

  const body = h('div', 'search-body');
  const results = h('div', 'pick-grid search-results');
  body.append(results);
  panel.append(head, body);
  dlg.root.append(panel);

  let timer = 0;
  let ctrl: AbortController | null = null;

  const showText = () => {
    go.disabled = !input.value.trim();
  };

  const topics = () => {
    results.innerHTML = '';
    for (const t of TOPICS) {
      results.append(
        button('pick-item topic', `<span class="emoji">${t.emoji}</span>`, () => {
          input.value = t.query;
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
    const q = input.value.trim().toLowerCase();
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

  input.addEventListener('input', () => {
    showText();
    void run(false);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    input.blur();
    void run(true);
  });
  showText();
  topics();
  input.focus();
}
