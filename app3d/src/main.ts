import '@fontsource-variable/jost';
import './shared.css';
import '../../src/guided/guided.css';
import './style3d.css';
import { createDesign } from './designIO';
import { Editor3d } from './editor3d';
import { galleryScreen, profileScreen } from './screens3d';
import { DEFAULT_SETTINGS, storage, type Design, type Profile, type Settings } from './storage3d';
import type { Project } from './werkstatt/engine3d';
import { werkstattScreen } from './werkstatt/werkstatt3d';

const app = document.getElementById('app')!;
let settings: Settings = DEFAULT_SETTINGS;
let editor: Editor3d | null = null;

// Kein Zoomen der Seite, kein Herunterziehen, kein Textmarkieren.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick']) {
  document.addEventListener(ev, (e) => e.preventDefault());
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (!(e.target as HTMLElement).closest('.left-rail, .right-rail, .card-grid, .pick-grid, .tform, .lic-body, .shape-groups, .panel, .werk-list')) e.preventDefault();
  },
  { passive: false },
);

function leaveEditor(): void {
  editor?.destroy();
  editor = null;
}

async function showProfiles(): Promise<void> {
  if (updatePending) return location.reload();
  leaveEditor();
  settings = await storage.getSettings();
  profileScreen(app, settings, (p) => void showGallery(p), (s) => {
    settings = s;
  });
}

async function showGallery(profile: Profile): Promise<void> {
  if (updatePending) return location.reload();
  leaveEditor();
  settings = await storage.getSettings();
  galleryScreen(app, profile, settings, () => void showProfiles(), (d) => openEditor(profile, d), () => void showWerkstatt(profile));
}

/** 3D-Werkstatt: geführte Projekte */
async function showWerkstatt(profile: Profile): Promise<void> {
  if (updatePending) return location.reload();
  leaveEditor();
  settings = await storage.getSettings();
  const designs = await storage.listDesigns(profile.id).catch(() => [] as Design[]);
  werkstattScreen(app, designs, {
    onBack: () => void showGallery(profile),
    onStart: (p: Project, existing: Design | null) => openEditor(profile, existing ?? { ...createDesign(), guide: { project: p.n, step: 0 } }),
  });
}

function openEditor(profile: Profile, design: Design | null): void {
  app.innerHTML = '';
  editor = new Editor3d({
    profile,
    design,
    settings,
    onExit: () => void (design?.guide ? showWerkstatt(profile) : showGallery(profile)),
    onWerkstatt: () => void showWerkstatt(profile),
    onGallery: () => void showGallery(profile),
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
