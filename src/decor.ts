// Zierelemente im MINT2Go-Stil: Zahnräder und die "Schaltkreis"-Linie aus dem Logo.

/** Zahnrad als Pfad (Zähne + Loch, Even-Odd). */
export function gearPath(cx: number, cy: number, r: number, teeth = 10, hole = 0.34): string {
  const pitch = (Math.PI * 2) / teeth;
  const root = r * 0.78;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch;
    const pts: [number, number, number][] = [
      [a - pitch * 0.34, root, 0],
      [a - pitch * 0.2, r, 0],
      [a + pitch * 0.2, r, 0],
      [a + pitch * 0.34, root, 0],
    ];
    for (const [ang, rad] of pts) d += `${d ? 'L' : 'M'}${(cx + Math.cos(ang) * rad).toFixed(2)} ${(cy + Math.sin(ang) * rad).toFixed(2)}`;
  }
  const h = r * hole;
  return `${d}ZM${(cx + h).toFixed(2)} ${cy}A${h.toFixed(2)} ${h.toFixed(2)} 0 1 0 ${(cx - h).toFixed(2)} ${cy}A${h.toFixed(2)} ${h.toFixed(2)} 0 1 0 ${(cx + h).toFixed(2)} ${cy}Z`;
}

/** Drei Zahnräder in Blau, Orange und Pink – dezent als Hintergrund. */
export function gearsMarkup(): string {
  return (
    `<svg class="decor-svg" viewBox="0 0 200 160" aria-hidden="true">` +
    `<path d="${gearPath(62, 100, 52, 12, 0.3)}" fill="var(--m-blue)" fill-rule="evenodd"/>` +
    `<path d="${gearPath(132, 58, 40, 10, 0.34)}" fill="var(--m-orange)" fill-rule="evenodd"/>` +
    `<circle cx="150" cy="118" r="30" fill="var(--m-pink)"/><circle cx="150" cy="118" r="11" fill="#fff"/>` +
    `</svg>`
  );
}

/** Die Linie aus dem Logo: grüner Punkt, orange und pinke Strecke, Ring. */
export function cdLineMarkup(): string {
  return '<div class="cd-line" aria-hidden="true"><span class="dot"></span><span class="seg o"></span><span class="seg p"></span><span class="ring"></span></div>';
}
