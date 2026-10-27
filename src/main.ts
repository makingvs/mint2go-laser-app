import './style.css';
import { Editor } from './editor';
import { DEFAULT_SETTINGS, createDesign, type Design, type Settings, type Surface } from './model';
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
    if (!(e.target as HTMLElement).closest('.pick-grid, .tform, .card-grid, .keys, .kb, .left-rail, .font-row')) e.preventDefault();
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
  });
}

function openEditor(profile: Profile, existing: Design | null, surface?: Surface): void {
  app.innerHTML = '';
  const design = existing ?? { ...createDesign(), surface };
  editor = new Editor({
    profile,
    design,
    settings,
    saved: !!existing,
    onExit: () => void showGallery(profile),
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
