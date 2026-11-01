// Tastenkürzel (PC-Tastatur oder Tastatur am Tablet): Strg bzw. Befehlstaste.
export type Shortcut = 'copy' | 'paste' | 'cut' | 'undo' | 'redo' | 'delete' | 'deselect' | 'left' | 'right' | 'up' | 'down';

const ARROWS: Record<string, Shortcut> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

export function shortcutFor(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): Shortcut | null {
  if (e.altKey) return null;
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'c': return 'copy';
      case 'v': return 'paste';
      case 'x': return 'cut';
      case 'z': return e.shiftKey ? 'redo' : 'undo';
      case 'y': return 'redo';
      default: return null;
    }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') return 'delete';
  if (e.key === 'Escape') return 'deselect';
  return ARROWS[e.key] ?? null;
}
