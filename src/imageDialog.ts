// Dialog "Bild in Vektor umwandeln": Foto/Bild wählen -> Schwarz-Weiß-Umrisse mit Schieberegler
// für die Helligkeitsgrenze und Umkehren (hell/dunkel). Ergebnis sind Pfade, die als SVG exportiert werden.
import { button, h, overlay } from './dom';
import { shapeToPath, type Shape } from './geometry';
import { ICONS } from './icons';
import { darkFraction, fitSize, grayFromRGBA, otsu, traceGray, type GrayImage } from './trace';

async function loadBitmap(file: File): Promise<{ source: CanvasImageSource; w: number; h: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {
      /* Fallback unten */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Bild nicht lesbar'));
    img.src = url;
  });
  return { source: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

/** Liefert die Umrisse (Pixelkoordinaten), [] wenn nichts zu erkennen war, null bei Abbruch. */
export async function openTraceDialog(file: File): Promise<Shape | null> {
  const dlg = overlay('overlay-dim');
  const panel = h('div', 'panel trace-panel');
  panel.append(h('div', 'search-msg', `<div class="spinner">${ICONS.imageUp}</div>`));
  dlg.root.append(panel);

  let img: GrayImage;
  let previewUrl = '';
  try {
    const bmp = await loadBitmap(file);
    const size = fitSize(bmp.w, bmp.h);
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.drawImage(bmp.source, 0, 0, size.w, size.h);
    bmp.close();
    img = grayFromRGBA(ctx.getImageData(0, 0, size.w, size.h).data, size.w, size.h);
    previewUrl = canvas.toDataURL('image/png');
  } catch {
    dlg.close();
    return [];
  }

  return new Promise<Shape | null>((resolve) => {
    let threshold = otsu(img);
    let invert = darkFraction(img, threshold) > 0.5; // Vordergrund ist meist die kleinere Fläche
    let shape: Shape = [];

    panel.innerHTML = '';
    const head = h('div', 'panel-head');
    const ok = button('btn send', ICONS.check, () => {
      dlg.close();
      resolve(shape);
    }, 'Fertig');
    head.append(button('btn', ICONS.cross, () => {
      dlg.close();
      resolve(null);
    }, 'Abbrechen'), h('div', 'surface-title', ICONS.imageUp), ok);

    const views = h('div', 'trace-views');
    const orig = h('div', 'trace-view', `<img src="${previewUrl}" alt="" draggable="false">`);
    const result = h('div', 'trace-view result');
    views.append(orig, result);

    const controls = h('div', 'trace-controls');
    const slider = h('input', 'trace-slider');
    slider.type = 'range';
    slider.min = '5';
    slider.max = '250';
    slider.step = '1';
    slider.value = String(threshold);
    slider.setAttribute('aria-label', 'Helligkeitsgrenze');
    const flip = button('btn', ICONS.contrast, () => {
      invert = !invert;
      flip.classList.toggle('active', invert);
      update();
    }, 'Umkehren');
    flip.classList.toggle('active', invert);
    controls.append(h('span', 'trace-end', '◐'), slider, flip);

    let timer = 0;
    const update = () => {
      cancelAnimationFrame(timer);
      timer = requestAnimationFrame(() => {
        shape = traceGray(img, { threshold, invert });
        const d = shapeToPath(shape, 1);
        result.innerHTML = shape.length
          ? `<svg viewBox="0 0 ${img.w} ${img.h}" preserveAspectRatio="xMidYMid meet"><path d="${d}" fill="#2f3a5f" fill-rule="evenodd"/></svg>`
          : `<div class="big-emoji">🤷</div>`;
        ok.disabled = !shape.length;
      });
    };
    slider.addEventListener('input', () => {
      threshold = Number(slider.value);
      update();
    });

    panel.append(head, views, controls);
    update();
  });
}
