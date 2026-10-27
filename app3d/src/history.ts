// Rückgängig/Wiederholen über Schnappschüsse (JSON) eines beliebigen Zustands.
export class History<T> {
  private past: string[] = [];
  private future: string[] = [];
  private current: string;
  constructor(initial: T, private readonly limit = 100) {
    this.current = JSON.stringify(initial);
  }
  /** Neuen Stand festhalten. Gibt false zurück, wenn sich nichts geändert hat. */
  commit(state: T): boolean {
    const s = JSON.stringify(state);
    if (s === this.current) return false;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = s;
    this.future = [];
    return true;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  undo(): T | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(this.current);
    this.current = prev;
    return JSON.parse(prev) as T;
  }
  redo(): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.current);
    this.current = next;
    return JSON.parse(next) as T;
  }
}
