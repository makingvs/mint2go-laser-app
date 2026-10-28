// Erklärung der 3D-Werkstatt als Pop-up im Editor: Es klappt auf (großes Symbol, kurzer Text, animiert) und lässt sich zu
// einem kleinen Knopf zuklappen, damit auf dem kleinen iPad-Bildschirm viel Platz für die Arbeit bleibt.
// Der Coach hebt die passenden Tasten hervor, prüft das Ergebnis automatisch und springt beim Treffer zum nächsten Schritt.
import { button, h } from '../../../src/dom';
import { ICONS } from '../../../src/icons';
import { openProjectInfo } from './dialogs3dw';
import type { GuideState, Highlight, Project, Snapshot, Step } from './engine3d';

export interface CoachHost {
  snapshot(): Snapshot;
  targets(k: Highlight): HTMLElement[];
  /** Fortschritt geändert (zum Speichern) */
  changed(): void;
  /** letzter Schritt abgehakt */
  finished(): void;
}

const AUTO_MS = 1300;

export class Coach {
  /** Rahmen über der 3D-Ansicht; enthält das aufgeklappte Pop-up und den kleinen Knopf */
  readonly el = h('div', 'coach');
  private card = h('div', 'coach-card');
  private pill: HTMLButtonElement;
  private pillIco = h('span', 'pill-ico');
  private pillN = h('span', 'pill-n');
  private ico = h('div', 'coach-ico');
  private title = h('div', 'coach-title');
  private text = h('div', 'coach-text');
  private note = h('div', 'coach-note');
  private dots = h('div', 'coach-dots');
  private back: HTMLButtonElement;
  private next: HTMLButtonElement;
  private marked: HTMLElement[] = [];
  private ok = false;
  private open = true;
  private evalTimer = 0;
  private advTimer = 0;
  private i: number;

  constructor(private p: Project, private state: GuideState, private host: CoachHost) {
    this.i = Math.min(Math.max(state.step, 0), p.steps.length - 1);
    const body = h('div', 'coach-body');
    const head = h('div', 'coach-head');
    this.back = button('coach-btn back', ICONS.back, () => this.go(-1), 'Zurück');
    this.next = button('coach-btn next', ICONS.check, () => this.go(1), 'Weiter');
    const nav = h('div', 'coach-nav');
    nav.append(this.back, this.next);
    head.append(this.title, button('coach-btn info', ICONS.info, () => openProjectInfo(this.p), 'Infos'), button('coach-btn mini', '<span class="chev"></span>', () => this.setOpen(false), 'Zuklappen'));
    body.append(head, this.text, this.note);
    this.card.append(this.ico, body, nav, this.dots);
    // kleiner Knopf: Symbol und Schrittnummer, antippen klappt das Pop-up auf
    this.pill = button('coach-pill', '', () => this.setOpen(true), 'Aufgabe zeigen');
    this.pill.append(this.pillIco, this.pillN, h('span', 'pill-chev'));
    this.el.append(this.card, this.pill);
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

  /** Pop-up auf- oder zuklappen (mit Animation). */
  private setOpen(open: boolean): void {
    this.open = open;
    this.card.hidden = !open;
    this.pill.hidden = open;
    this.el.classList.toggle('closed', !open);
    // Animation neu starten
    const el = open ? this.card : this.pill;
    el.classList.remove('pop-in');
    void el.offsetWidth;
    el.classList.add('pop-in');
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

  /** Zeigt den aktuellen Schritt; das Pop-up klappt bei jedem neuen Schritt auf und das Bild hüpft. */
  private show(auto: boolean): void {
    clearTimeout(this.advTimer);
    const st = this.step;
    this.ico.textContent = st.icon;
    this.pillIco.textContent = st.icon;
    this.pillN.textContent = `${this.i + 1}/${this.p.steps.length}`;
    this.title.innerHTML = '';
    this.title.append(h('span', 'coach-n', `${this.i + 1}/${this.p.steps.length}`), document.createTextNode(` ${st.title}`));
    this.text.textContent = st.text;
    this.back.disabled = this.i === 0;
    this.dots.innerHTML = '';
    this.p.steps.forEach((_, k) => this.dots.append(h('i', k < this.i ? 'done' : k === this.i ? 'now' : '')));
    this.state.step = this.i;
    this.host.changed();
    this.mark();
    this.ok = !!st.check && st.check(this.host.snapshot());
    this.paint();
    this.setOpen(true);
    this.animateStep();
    // vorwärts durchgelaufen und Ergebnis passt schon: kurz zeigen, dann weiter
    if (auto && this.ok) this.schedule();
  }

  /** Bild hüpft, Text und Überschrift gleiten herein. */
  private animateStep(): void {
    for (const el of [this.ico, this.title, this.text]) {
      el.classList.remove('step-in');
      void el.offsetWidth;
      el.classList.add('step-in');
    }
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
    if (ok && !was) {
      this.burst();
      this.schedule();
    } else if (!ok) clearTimeout(this.advTimer);
  }

  /** Kleine Sterne sprühen aus dem Pop-up (oder dem Knopf), wenn ein Schritt geschafft ist. */
  private burst(): void {
    const host = this.open ? this.card : this.pill;
    const b = h('div', 'burst');
    for (let k = 0; k < 7; k++) {
      const s = h('i', '', k % 2 ? '⭐' : '✨');
      s.style.setProperty('--a', `${(k / 7) * 360}deg`);
      b.append(s);
    }
    host.append(b);
    setTimeout(() => b.remove(), 1100);
  }

  private schedule(): void {
    clearTimeout(this.advTimer);
    this.advTimer = window.setTimeout(() => {
      if (this.ok) this.go(1);
    }, AUTO_MS);
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
