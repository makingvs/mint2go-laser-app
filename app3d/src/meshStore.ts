// Speicher für Netze, die nicht aus einer einfachen Beschreibung entstehen (Ergebnis von "Vereinen").
// Ein Körper (Part.kind 'mesh') verweist nur mit seiner Nummer darauf; so bleiben Rückgängig-Schnappschüsse klein.
// Die Netze liegen im Einheitsquader (x, y in [-0.5, 0.5], z in [0, 1]) wie bei mesh.ts.
import type { TriMesh } from './mesh';

const store = new Map<string, TriMesh>();

export const putMesh = (id: string, mesh: TriMesh): void => void store.set(id, mesh);
export const getMesh = (id: string): TriMesh | undefined => store.get(id);
