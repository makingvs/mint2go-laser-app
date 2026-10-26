// Lokaler Speicher auf dem Gerät (IndexedDB). Ohne IndexedDB (z. B. privater Modus)
// läuft die App mit einem Speicher im Arbeitsspeicher weiter, dann gehen Arbeiten beim
// Schließen verloren – die Oberfläche zeigt das über `storage.persistent` an.
import { DEFAULT_SETTINGS, type Design, type Settings } from './model';
import { safeName } from './names';
import { normalizeSearchConfig, type SearchConfig } from './online';

export interface Profile {
  id: string;
  name: string;
  icon: string;
}

export type StoredDesign = Design & { profile: string };

type StoreName = 'profiles' | 'designs' | 'trash' | 'settings';
const KEY: Record<StoreName, string> = { profiles: 'id', designs: 'id', trash: 'key', settings: 'key' };
const STORES = Object.keys(KEY) as StoreName[];

const memory: Record<StoreName, Map<string, unknown>> = {
  profiles: new Map(),
  designs: new Map(),
  trash: new Map(),
  settings: new Map(),
};

let dbPromise: Promise<IDBDatabase | null> | null = null;
let persistent = false;

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const open = indexedDB.open('laser-zeichen-app', 1);
        open.onupgradeneeded = () => {
          const db = open.result;
          for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: KEY[s] });
        };
        open.onsuccess = () => {
          persistent = true;
          resolve(open.result);
        };
        open.onerror = () => resolve(null);
        open.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

const wrap = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  if (!db) return [...memory[store].values()] as T[];
  return wrap(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

async function getOne<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return memory[store].get(key) as T | undefined;
  return (await wrap(db.transaction(store).objectStore(store).get(key))) as T | undefined;
}

async function put(store: StoreName, value: object): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory[store].set(String((value as Record<string, unknown>)[KEY[store]]), JSON.parse(JSON.stringify(value)));
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function remove(store: StoreName, key: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory[store].delete(key);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Prüft und begrenzt Einstellungen (Plattengröße, Farben, Mindestgröße). */
export function normalizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const s = (input && typeof input === 'object' ? input : {}) as Partial<Settings> & { plate?: Partial<Settings['plate']>; colors?: Partial<Settings['colors']> };
  const num = (v: unknown, d: number, lo: number, hi: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const col = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : d);
  return {
    plate: { width: num(s.plate?.width, base.plate.width, 20, 1000), height: num(s.plate?.height, base.plate.height, 20, 1000) },
    colors: { cut: col(s.colors?.cut, base.colors.cut), engrave: col(s.colors?.engrave, base.colors.engrave), fill: col(s.colors?.fill, base.colors.fill) },
    minSize: num(s.minSize, base.minSize, 0, 50),
  };
}

let configRaw: Promise<unknown> | null = null;
/** config.json (vom Verteiler vor dem Veröffentlichen anpassbar). */
function loadConfig(): Promise<unknown> {
  if (!configRaw) {
    configRaw = fetch('config.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return configRaw;
}
const loadDefaults = (): Promise<Settings> => loadConfig().then((j) => normalizeSettings(j));

export const storage = {
  /** false = nur Arbeitsspeicher, Arbeiten gehen beim Schließen verloren */
  get persistent(): boolean {
    return persistent;
  },

  /** Beim Start aufrufen: öffnet die Datenbank und bittet Safari, den Speicher nicht zu räumen. */
  async init(): Promise<void> {
    await openDb();
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* egal */
    }
  },

  /** Einstellungen der Online-Suche aus config.json (onlineSearch). */
  async getSearchConfig(): Promise<SearchConfig> {
    const cfg = (await loadConfig()) as { onlineSearch?: unknown };
    return normalizeSearchConfig(cfg?.onlineSearch);
  },

  async getSettings(): Promise<Settings> {
    const defaults = await loadDefaults();
    const stored = await getOne<{ key: string; value: unknown }>('settings', 'settings');
    return stored ? normalizeSettings(stored.value, defaults) : defaults;
  },
  async putSettings(s: Settings): Promise<Settings> {
    const clean = normalizeSettings(s, await loadDefaults());
    await put('settings', { key: 'settings', value: clean });
    return clean;
  },
  async resetSettings(): Promise<Settings> {
    await remove('settings', 'settings');
    return loadDefaults();
  },

  /** Benutzer samt Arbeiten entfernen (Arbeiten wandern in den Papierkorb-Speicher). Das Tier-Symbol wird dadurch wieder frei. */
  async deleteProfile(id: string): Promise<void> {
    for (const d of await getAll<StoredDesign>('designs')) {
      if (d.profile === id) await this.deleteDesign(id, d.id);
    }
    await remove('profiles', id);
  },

  async listProfiles(): Promise<Profile[]> {
    const list = await getAll<Profile>('profiles');
    return list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  },
  async createProfile(name: string, icon: string): Promise<Profile> {
    const id = safeName(name || 'Kind');
    const existing = await getOne<Profile>('profiles', id);
    if (existing) return existing;
    const p: Profile = { id, name: id, icon: icon || '🙂' };
    await put('profiles', p);
    return p;
  },

  async listDesigns(pid: string): Promise<Design[]> {
    const all = await getAll<StoredDesign>('designs');
    return all.filter((d) => d.profile === pid).sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  },
  async listAllDesigns(): Promise<StoredDesign[]> {
    return getAll<StoredDesign>('designs');
  },
  async saveDesign(pid: string, d: Design): Promise<void> {
    await put('designs', { ...d, profile: pid });
  },
  /** Löschen verschiebt in den Papierkorb (Store "trash"), damit nichts unwiederbringlich verloren geht. */
  async deleteDesign(pid: string, id: string): Promise<void> {
    const d = await getOne<StoredDesign>('designs', id);
    if (d && d.profile === pid) {
      await put('trash', { ...d, key: `${id}@${Date.now()}`, deleted: Date.now() });
      await remove('designs', id);
    }
  },

};
