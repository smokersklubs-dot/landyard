// Composition du marquage : motif (logo + texte), répétition, méthode d'impression,
// textures de matière (cartes de normales procédurales) et visuel du pass.
import * as THREE from 'three';

export const ORANGE = '#FF6A00';
const FONT = '"Inter Tight", "Arial Black", Arial, sans-serif';

export async function ensureFonts() {
  // Ne bloque jamais plus de 2,5 s : sinon police de secours.
  const load = Promise.all([document.fonts.load(`800 64px "Inter Tight"`), document.fonts.load(`600 64px "Inter Tight"`)]).catch(() => {});
  await Promise.race([load, new Promise((r) => setTimeout(r, 2500))]);
}

// Pictogramme SKLUBS (goutte / flamme évidée) dessiné en vectoriel.
export function dropPath(x, y, h) {
  const w = h * 0.78, p = new Path2D();
  p.moveTo(x + w * 0.5, y);
  p.bezierCurveTo(x + w * 0.62, y + h * 0.2, x + w, y + h * 0.4, x + w, y + h * 0.64);
  p.bezierCurveTo(x + w, y + h * 0.86, x + w * 0.78, y + h, x + w * 0.5, y + h);
  p.bezierCurveTo(x + w * 0.22, y + h, x, y + h * 0.86, x, y + h * 0.64);
  p.bezierCurveTo(x, y + h * 0.4, x + w * 0.38, y + h * 0.2, x + w * 0.5, y);
  const q = new Path2D(), ih = h * 0.42, iw = ih * 0.7, ix = x + w * 0.5 - iw / 2, iy = y + h * 0.46;
  q.moveTo(ix + iw * 0.5, iy);
  q.bezierCurveTo(ix + iw, iy + ih * 0.4, ix + iw, iy + ih, ix + iw * 0.5, iy + ih);
  q.bezierCurveTo(ix, iy + ih, ix, iy + ih * 0.4, ix + iw * 0.5, iy);
  return { outer: p, inner: q, w };
}

function drawDrop(ctx, x, y, h, color) {
  const d = dropPath(x, y, h);
  ctx.save();
  ctx.fillStyle = color;
  ctx.fill(d.outer);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(d.inner);
  ctx.restore();
  return d.w;
}

// Motif horizontal (lecture le long du ruban), fond transparent, hauteur hPx.
export function buildMotif(side, hPx) {
  const pad = Math.round(hPx * 0.12);
  const iconH = hPx * 0.86;
  const fontPx = hPx * 0.62;
  const m = document.createElement('canvas').getContext('2d');
  m.font = `800 ${fontPx}px ${FONT}`;
  const hasIcon = side.logoOn;
  const img = side.logoImage;
  let iconW = 0;
  if (hasIcon) iconW = img ? iconH * (img.width / img.height) : iconH * 0.78;
  const text = side.textOn ? (side.text || '').trim() : '';
  const textW = text ? m.measureText(text).width : 0;
  const gap = hasIcon && text ? hPx * 0.28 : 0;
  const W = Math.max(8, Math.ceil(iconW + gap + textW + pad * 2));
  const c = document.createElement('canvas');
  c.width = W; c.height = Math.ceil(hPx);
  const ctx = c.getContext('2d');
  let x = pad;
  if (hasIcon) {
    const y = (hPx - iconH) / 2;
    if (img) ctx.drawImage(img, x, y, iconW, iconH);
    else drawDrop(ctx, x, y, iconH, side.iconColor || ORANGE);
    x += iconW + gap;
  }
  if (text) {
    ctx.font = `800 ${fontPx}px ${FONT}`;
    ctx.fillStyle = side.textColor || '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, hPx / 2 + fontPx * 0.04);
  }
  return c;
}

// Sérigraphie : réduction aux N couleurs dominantes, bords nets.
function posterize(c, n) {
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height), a = d.data;
  const hist = new Map();
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 128) continue;
    const k = ((a[i] >> 4) << 8) | ((a[i + 1] >> 4) << 4) | (a[i + 2] >> 4);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const sorted = [...hist.entries()].sort((x, y) => y[1] - x[1]);
  const pal = [];
  for (const [k] of sorted) {
    const col = [((k >> 8) & 15) * 17, ((k >> 4) & 15) * 17, (k & 15) * 17];
    if (pal.every((p) => Math.hypot(p[0] - col[0], p[1] - col[1], p[2] - col[2]) > 70)) pal.push(col);
    if (pal.length >= n) break;
  }
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 128) { a[i + 3] = 0; continue; }
    let best = pal[0], bd = 1e9;
    for (const p of pal) { const dd = (p[0] - a[i]) ** 2 + (p[1] - a[i + 1]) ** 2 + (p[2] - a[i + 2]) ** 2; if (dd < bd) { bd = dd; best = p; } }
    a[i] = best[0]; a[i + 1] = best[1]; a[i + 2] = best[2]; a[i + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  return pal.length;
}

// Tissage : fils visibles et contours crénelés.
function weaveEffect(c, pitch) {
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height), a = d.data;
  const p = Math.max(2, Math.round(pitch));
  for (let y = 0; y < c.height; y++) {
    const f = (Math.floor(y / p) % 2) ? 0.84 : 1.04;
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      a[i + 3] = a[i + 3] > 110 ? 255 : 0;
      const g = f * ((x % (p * 2)) < p ? 1 : 0.95);
      a[i] = Math.min(255, a[i] * g); a[i + 1] = Math.min(255, a[i + 1] * g); a[i + 2] = Math.min(255, a[i + 2] * g);
    }
  }
  ctx.putImageData(d, 0, 0);
}

// Motif final (rotation + méthode) dans un canevas, dimensions en mm.
export function motifForSide(side, widthMM, ppm, method) {
  const rot = ((side.rotation || 0) % 360 + 360) % 360;
  const across = rot === 90 || rot === 270;
  let h = widthMM * Math.min(0.95, Math.max(0.2, side.scale / 100)) * ppm;
  let base = buildMotif(side, h);
  if (across) {
    // En travers : la longueur du motif doit tenir dans la largeur du ruban.
    const maxLen = widthMM * 0.92 * ppm;
    if (base.width > maxLen) base = buildMotif(side, h * (maxLen / base.width));
  }
  if (method?.id === 'screen') posterize(base, method.maxColors || 3);
  if (method?.id === 'woven') weaveEffect(base, ppm * 0.35);
  const out = document.createElement('canvas');
  out.width = across ? base.height : base.width;
  out.height = across ? base.width : base.height;
  const ctx = out.getContext('2d');
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(base, -base.width / 2, -base.height / 2);
  return { canvas: out, lengthMM: out.width / ppm, heightMM: out.height / ppm };
}

// Liseré : deux filets parallèles aux bords du ruban.
function drawEdges(ctx, w, h, ppm, color) {
  if (!color) return;
  const t = Math.max(1, 0.9 * ppm), inset = Math.max(1, 0.7 * ppm);
  ctx.fillStyle = color;
  ctx.fillRect(0, inset, w, t);
  ctx.fillRect(0, h - inset - t, w, t);
}

// Texture d'une face du ruban. Mode répétition : une tuile (entraxe) répétée le long de u.
export function stripTexture({ side, widthMM, lengthMM, drop, method, maxTex = 4096 }) {
  const bg = side.bg;
  const hasArt = side.enabled && (side.logoOn || (side.textOn && side.text));
  if (side.mode !== 'single') {
    let ppm = 16;
    const probe = hasArt ? motifForSide(side, widthMM, 1, method) : { lengthMM: 0 };
    const pitch = Math.max(side.spacing, probe.lengthMM + 3);
    ppm = Math.min(ppm, (maxTex - 2) / pitch);
    const c = document.createElement('canvas');
    c.width = Math.max(4, Math.round(pitch * ppm)); c.height = Math.max(4, Math.round(widthMM * ppm));
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    if (side.enabled) drawEdges(ctx, c.width, c.height, ppm, side.edge);
    if (hasArt) {
      const m = motifForSide(side, widthMM, ppm, method);
      ctx.drawImage(m.canvas, Math.round((c.width - m.canvas.width) / 2), Math.round((c.height - m.canvas.height) / 2));
    }
    return { canvas: c, repeat: lengthMM / pitch, offset: -(side.offset || 0) / pitch, pitch };
  }
  const ppm = Math.min(10, (maxTex - 2) / lengthMM);
  const c = document.createElement('canvas');
  c.width = Math.round(lengthMM * ppm); c.height = Math.max(4, Math.round(widthMM * ppm));
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  if (side.enabled) drawEdges(ctx, c.width, c.height, ppm, side.edge);
  if (hasArt) {
    const m = motifForSide(side, widthMM, ppm, method);
    const at = Math.min(drop * 0.45, lengthMM * 0.25) + (side.offset || 0);
    for (const s of [at, lengthMM - at]) {
      ctx.save();
      ctx.translate(s * ppm, c.height / 2);
      ctx.drawImage(m.canvas, -m.canvas.width / 2, -m.canvas.height / 2);
      ctx.restore();
    }
  }
  return { canvas: c, repeat: 1, offset: 0, pitch: null };
}

// Aperçu à plat sur 1 mètre (panneau « Impression & répétition »).
export function flatPreview(target, tex, widthMM, lengthMM) {
  const ctx = target.getContext('2d');
  const W = target.width, H = target.height;
  ctx.clearRect(0, 0, W, H);
  const span = Math.min(1000, lengthMM);
  const k = W / span;
  const h = Math.max(10, widthMM * k * 1.6);
  const y = (H - h) / 2;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, y, W, h, 3); ctx.clip();
  if (tex.pitch) {
    const tileW = tex.pitch * k;
    const start = (tex.offset * tex.pitch) * k;
    for (let x = start - tileW * 2; x < W; x += tileW) ctx.drawImage(tex.canvas, x, y, tileW, h);
  } else {
    ctx.drawImage(tex.canvas, 0, 0, tex.canvas.width * (span / lengthMM), tex.canvas.height, 0, y, W, h);
  }
  ctx.restore();
}

export function toTexture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  return t;
}

// ---------- Cartes de normales procédurales (textile, cuir) ----------
const HEIGHTS = {
  ribs: (x, y) => 0.5 + 0.5 * Math.sin(x * Math.PI * 2 * 5) + 0.08 * Math.sin(y * Math.PI * 2 * 16),
  satin: (x, y) => 0.5 + 0.15 * Math.sin(y * Math.PI * 2 * 24) + 0.05 * Math.sin(x * Math.PI * 2 * 3),
  weave: (x, y) => {
    const cx = Math.floor(x * 8), cy = Math.floor(y * 8);
    const fx = (x * 8) % 1, fy = (y * 8) % 1;
    return (cx + cy) % 2 ? Math.sin(fx * Math.PI) * 0.9 : Math.sin(fy * Math.PI) * 0.9;
  },
  twill: (x, y) => 0.5 + 0.5 * Math.sin((x * 6 + y * 6) * Math.PI * 2),
  knit: (x, y) => { const fx = (x * 6) % 1, fy = (y * 4) % 1; return Math.abs(Math.sin((fy + Math.abs(fx - 0.5)) * Math.PI * 2)); },
  leather: (x, y) => { let v = 0; for (let k = 1; k < 5; k++) v += Math.sin(x * 37 * k + Math.sin(y * 23 * k) * 2) * Math.sin(y * 41 * k + Math.cos(x * 19 * k)) / k; return 0.5 + v * 0.25; },
};

const normalCache = new Map();
export function fabricNormal(kind, renderer) {
  if (normalCache.has(kind)) return normalCache.get(kind);
  const N = 128, f = HEIGHTS[kind] || HEIGHTS.ribs;
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = f(x / N, y / N);
  const c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d'), img = ctx.createImageData(N, N);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  normalCache.set(kind, t);
  return t;
}

// ---------- Pass événementiel (CR80, 10 px/mm) ----------
export function passCanvas(pass, art, horizontal = false) {
  const W = horizontal ? 860 : 540, H = horizontal ? 540 : 860;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const accent = pass.accent || ORANGE;
  ctx.fillStyle = pass.bg || '#121212'; ctx.fillRect(0, 0, W, H);
  // bandes diagonales
  ctx.save();
  ctx.globalAlpha = 0.9;
  const g = ctx.createLinearGradient(0, H * 0.35, W, H * 0.75);
  g.addColorStop(0, accent); g.addColorStop(1, '#ff9a3c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, H * 0.62); ctx.lineTo(W, H * 0.38); ctx.lineTo(W, H * 0.47); ctx.lineTo(0, H * 0.71); ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.moveTo(0, H * 0.75); ctx.lineTo(W, H * 0.51); ctx.lineTo(W, H * 0.54); ctx.lineTo(0, H * 0.78); ctx.fill();
  ctx.restore();
  // perforation
  ctx.fillStyle = '#d9d9d6';
  ctx.beginPath(); ctx.roundRect(W / 2 - 60, 26, 120, 22, 11); ctx.fill();
  // logo
  const lh = horizontal ? 120 : 150;
  if (art?.logoImage) {
    const iw = lh * art.logoImage.width / art.logoImage.height;
    ctx.drawImage(art.logoImage, W / 2 - iw / 2, 90, iw, lh);
  } else {
    const d = dropPath(0, 0, lh);
    ctx.save(); ctx.translate(W / 2 - d.w / 2, 90);
    ctx.fillStyle = accent; ctx.fill(d.outer);
    ctx.fillStyle = pass.bg || '#121212'; ctx.fill(d.inner);
    ctx.restore();
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `800 ${horizontal ? 64 : 70}px ${FONT}`;
  ctx.fillText((pass.event || 'SKLUBS').toUpperCase(), W / 2, 90 + lh + 80, W - 60);
  ctx.font = `600 26px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillText(pass.date || '', W / 2, 90 + lh + 122, W - 60);
  // rôle
  const ry = H * (horizontal ? 0.72 : 0.8);
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.roundRect(40, ry - 50, W - 80, 76, 14); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText((pass.role || 'VIP').toUpperCase(), W / 2, ry + 4, W - 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText(pass.name || '', W / 2, ry + 80, W - 60);
  // code-barres
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  let x = W / 2 - 110, seed = 7;
  while (x < W / 2 + 110) { seed = (seed * 9301 + 49297) % 233280; const bw = 2 + (seed % 5); ctx.fillRect(x, H - 58, bw, 30); x += bw + 2 + (seed % 3); }
  return c;
}

export function passBackCanvas(pass, horizontal = false) {
  const W = horizontal ? 860 : 540, H = horizontal ? 540 : 860;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f2ef'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#111'; ctx.textAlign = 'center';
  ctx.font = `800 54px ${FONT}`; ctx.fillText('SKLUBS', W / 2, H / 2 - 10);
  ctx.font = `500 24px ${FONT}`; ctx.fillStyle = '#777';
  ctx.fillText('Pass nominatif · non cessible', W / 2, H / 2 + 34);
  ctx.fillStyle = pass.accent || ORANGE; ctx.fillRect(W / 2 - 40, H / 2 + 60, 80, 6);
  return c;
}
