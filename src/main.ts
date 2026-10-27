import './style.css';
import './guided/guided.css';
import { Editor } from './editor';
import { DEFAULT_SETTINGS, createDesign, type Design, type Settings, type Surface } from './model';
import type { GuideState, Project } from './guided/engine';
import { werkstattScreen } from './guided/werkstatt';
import { defaultSurface, ellipseSurface, rectSurface } from './surface';
import { openSurfaceDialog } from './surfaceDialog';
import { galleryScreen, profileScreen } from './screens';
import { storage, type Profile } from './storage';

const app = document.getElementById('app')!;
let settings: Settings = DEFAULT_SETTINGS;
let editor: Editor | null = null;

// Kein Zoomen, kein Herunterziehen, kein Textmarkieren.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick']) {
  document.addEventListener(ev, (e) => e.preventDefault());
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (!(e.target as HTMLElement).closest('.pick-grid, .tform, .card-grid, .keys, .kb, .left-rail, .font-row, .werk-list, .guide-panel')) e.preventDefault();
  },
  { passive: false },
);

async function showProfiles(): Promise<void> {
  if (updatePending) return location.reload();
  editor?.destroy();
  editor = null;
  settings = await storage.getSettings();
  profileScreen(app, settings, (p) => void showGallery(p), (s) => {
    settings = s;
  });
}

async function showGallery(profile: Profile): Promise<void> {
  if (updatePending) return location.reload();
  editor?.destroy();
  editor = null;
  settings = await storage.getSettings();
  galleryScreen(app, profile, settings, () => void showProfiles(), (d) => {
    if (d) openEditor(profile, d);
    // Neue Arbeit: zuerst die Zeichenfläche wählen (unendlich oder Werkstück mit Maßen)
    else openSurfaceDialog({ settings, onDone: (surface) => openEditor(profile, null, surface) });
  }, () => void showWerkstatt(profile));
}

/** Laser-Werkstatt: geführte Projekte */
async function showWerkstatt(profile: Profile): Promise<void> {
  if (updatePending) return location.reload();
  editor?.destroy();
  editor = null;
  settings = await storage.getSettings();
  const designs = await storage.listDesigns(profile.id).catch(() => [] as Design[]);
  werkstattScreen(app, designs, {
    onBack: () => void showGallery(profile),
    onStart: (p, d) => startGuided(profile, p, d),
  });
}

function startGuided(profile: Profile, p: Project, existing: Design | null): void {
  if (existing) return openEditor(profile, existing);
  const s = p.surface;
  const surface = !s ? defaultSurface(settings) : s.kind === 'ellipse' ? ellipseSurface(s.w, s.h) : rectSurface(s.w, s.h);
  openEditor(profile, null, surface, { project: p.n, step: 0 });
}

function openEditor(profile: Profile, existing: Design | null, surface?: Surface, guide?: GuideState): void {
  app.innerHTML = '';
  const design = existing ?? { ...createDesign(), surface, guide };
  editor = new Editor({
    profile,
    design,
    settings,
    saved: !!existing,
    onExit: () => void (design.guide ? showWerkstatt(profile) : showGallery(profile)),
  });
  app.append(editor.root);
}

// Offline-Betrieb: Service Worker (nur über https oder localhost verfügbar).
// Kommt eine neue App-Version, lädt die App sich selbst neu – aber nie mitten in einer Arbeit,
// sondern erst beim nächsten Wechsel zur Profil-/Galerie-Ansicht.
let updatePending = false;
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // erster Besuch: nichts zu aktualisieren
    if (editor) updatePending = true;
    else location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

void storage.init().then(showProfiles);
