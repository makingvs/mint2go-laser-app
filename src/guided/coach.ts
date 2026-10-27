// Coach-Leiste im Editor: zeigt den aktuellen Schritt, hebt die passenden Tasten hervor, prüft das Ergebnis
// automatisch und springt beim Treffer zum nächsten Schritt.
import { button, h } from '../dom';
import { ICONS } from '../icons';
import type { GuideState, Highlight, Project, Snapshot, Step } from './engine';
import { openProjectInfo } from './dialogs';

export interface CoachHost {
  snapshot(): Snapshot;
  targets(k: Highlight): HTMLElement[];
  action(kind: 'template' | 'surface'): void;
  /** Fortschritt geändert (zum Speichern) */
  changed(): void;
  /** letzter Schritt abgehakt */
  finished(): void;
}

const ACTION_LABEL = { template: 'Vorlage laden', surface: 'Fläche einstellen' } as const;
const ACTION_ICON = { template: ICONS.folder, surface: ICONS.canvas } as const;
const AUTO_MS = 1100;

export class Coach {
  readonly el = h('div', 'coach');
  private ico = h('div', 'coach-ico');
  private title = h('div', 'coach-title');
  private text = h('div', 'coach-text');
  private note = h('div', 'coach-note');
  private dots = h('div', 'coach-dots');
  private back: HTMLButtonElement;
  private act: HTMLButtonElement;
  private next: HTMLButtonElement;
  private mini: HTMLButtonElement;
  private marked: HTMLElement[] = [];
  private ok = false;
  private evalTimer = 0;
  private advTimer = 0;
  private i: number;

  constructor(private p: Project, private state: GuideState, private host: CoachHost) {
    this.i = Math.min(Math.max(state.step, 0), p.steps.length - 1);
    const body = h('div', 'coach-body');
    const head = h('div', 'coach-head');
    this.back = button('coach-btn back', ICONS.back, () => this.go(-1), 'Zurück');
    this.act = button('coach-btn act', '', () => this.doAction(), '');
    this.next = button('coach-btn next', ICONS.check, () => this.go(1), 'Weiter');
    this.mini = button('coach-btn mini', '<span class="chev"></span>', () => this.el.classList.toggle('min'), 'Klein/Groß');
    const nav = h('div', 'coach-nav');
    nav.append(this.back, this.next);
    head.append(this.title, button('coach-btn info', ICONS.info, () => openProjectInfo(this.p), 'Infos'), this.mini);
    body.append(head, this.text, this.note, this.act);
    this.el.append(this.ico, body, nav, this.dots);
    this.show(false);
  }

  private get step(): Step {
    return this.p.steps[this.i];
  }

  destroy(): void {
    clearTimeout(this.evalTimer);
    clearTimeout(this.advTimer);
    this.unmark();
  }

  /** Editor hat sich geändert (entprellt prüfen). */
  update(now = false): void {
    clearTimeout(this.evalTimer);
    this.evalTimer = window.setTimeout(() => this.evaluate(), now ? 0 : 140);
  }

  private unmark(): void {
    for (const m of this.marked) m.classList.remove('guide-pulse');
    this.marked = [];
  }

  private mark(): void {
    this.unmark();
    for (const k of this.step.show ?? []) {
      for (const t of this.host.targets(k)) {
        if (t.hidden) continue;
        t.classList.add('guide-pulse');
        this.marked.push(t);
      }
    }
  }

  private show(auto: boolean): void {
    clearTimeout(this.advTimer);
    const st = this.step;
    this.ico.textContent = st.icon;
    this.title.innerHTML = '';
    this.title.append(h('span', 'coach-n', `${this.i + 1}/${this.p.steps.length}`), document.createTextNode(` ${st.title}`));
    this.text.textContent = st.text;
    this.back.disabled = this.i === 0;
    this.dots.innerHTML = '';
    this.p.steps.forEach((_, k) => this.dots.append(h('i', k < this.i ? 'done' : k === this.i ? 'now' : '')));
    if (st.action) {
      this.act.hidden = false;
      this.act.innerHTML = `<span class="ico">${ACTION_ICON[st.action]}</span><span class="lbl">${ACTION_LABEL[st.action]}</span>`;
      this.act.setAttribute('aria-label', ACTION_LABEL[st.action]);
    } else this.act.hidden = true;
    this.state.step = this.i;
    this.host.changed();
    this.mark();
    this.ok = !!st.check && st.check(this.host.snapshot());
    this.paint();
    // vorwärts durchgelaufen und Ergebnis passt schon: kurz zeigen, dann weiter
    if (auto && this.ok) this.schedule();
  }

  private paint(): void {
    const st = this.step;
    const last = this.i === this.p.steps.length - 1;
    this.el.classList.toggle('ok', this.ok);
    this.el.classList.toggle('manual', !st.check);
    this.next.classList.toggle('ready', this.ok || !st.check);
    this.next.innerHTML = last ? ICONS.check : ICONS.back;
    this.next.classList.toggle('finish', last);
    this.next.setAttribute('aria-label', last ? 'Fertig' : 'Weiter');
    const snap = st.hint && !this.ok ? st.hint(this.host.snapshot()) : null;
    const warn = st.warn ?? '';
    this.note.className = 'coach-note' + (warn ? ' warn' : snap ? ' hint' : this.ok ? ' good' : '');
    this.note.textContent = warn ? `⚠️ ${warn}` : snap ? `💡 ${snap}` : this.ok ? '✅ Das passt!' : '';
  }

  private evaluate(): void {
    const st = this.step;
    if (!st.check) return;
    const ok = !!st.check(this.host.snapshot());
    const was = this.ok;
    this.ok = ok;
    this.paint();
    if (ok && !was) this.schedule();
    else if (!ok) clearTimeout(this.advTimer);
  }

  private schedule(): void {
    clearTimeout(this.advTimer);
    this.advTimer = window.setTimeout(() => {
      if (this.ok) this.go(1);
    }, AUTO_MS);
  }

  private doAction(): void {
    const a = this.step.action;
    if (a) this.host.action(a);
  }

  private go(dir: 1 | -1): void {
    clearTimeout(this.advTimer);
    const n = this.i + dir;
    if (n < 0) return;
    if (n >= this.p.steps.length) {
      this.state.done = true;
      this.host.changed();
      this.host.finished();
      return;
    }
    this.i = n;
    this.show(dir > 0);
  }
}
