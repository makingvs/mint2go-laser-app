import './style.css';
import { browserStorage, Store } from './storage';
import { fitStage, type App, type Screen } from './ui/app';
import { levelScreen } from './ui/level';
import { mapScreen } from './ui/map';
import { profilesScreen } from './ui/profiles';
import { applySettings } from './ui/teacher';

const stage = document.getElementById('stage')!;
fitStage(stage);

let current: Screen | null = null;

const app: App = {
  store: new Store(browserStorage()),
  stage,
  mount(screen) {
    current?.dispose?.();
    current = screen;
    stage.replaceChildren(screen.el);
  },
  showProfiles() {
    app.mount(profilesScreen(app));
  },
  showMap(id) {
    app.mount(mapScreen(app, id));
  },
  showLevel(id, level) {
    app.mount(levelScreen(app, id, level));
  },
};

applySettings(app);

// Kinder sollen sich nicht aus Versehen verirren: kein Rechtsklick-Menü, kein Autoscroll mit dem Mausrad,
// keine Zurück-/Vor-Tasten der Maus (Seitentasten), kein Ziehen von Bildern oder Markieren von Text.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousedown', (e) => {
  if (e.button === 1 || e.button === 3 || e.button === 4) e.preventDefault();
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 3 || e.button === 4) e.preventDefault();
});
document.addEventListener('dragstart', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => {
  if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
});
// Strg + Mausrad würde die Seite zoomen
window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

app.showProfiles();
