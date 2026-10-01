// BAT (bon à tirer) usine : le ruban à plat à l'échelle 1, recto et verso, cotes,
// spécifications et couleurs. Sortie SVG (unités mm) et PDF (via jsPDF, chargé à la demande).
import { stripTexture, passCanvas, ORANGE } from './artwork.js';

const MM_PER_ROW = 280;        // longueur de ruban par ligne de la planche
const PAGE_W = 420;            // A3 paysage
const MARGIN = 12;
const SPEC_X = 300;            // colonne des spécifications
const HIDDEN_END = 15;         // longueur prise dans l'embout à chaque extrémité (indicatif)

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

function textures(state, product, drop) {
  const method = product.printingMethods.find((m) => m.id === state.method);
  const side = (s, enabled) => ({ ...s, enabled, bg: state.color, guides: false });
  const front = side(state.front, true);
  const back = state.backMode === 'same' ? side(state.front, true) : side(state.back, state.backMode === 'different');
  const common = { widthMM: state.width, lengthMM: state.length, drop, method, maxTex: 8192 };
  return { front: stripTexture({ side: front, ...common }), back: state.backMode === 'none' ? null : stripTexture({ side: back, ...common }) };
}

// Une face du ruban, découpée en lignes. Les UV « lisible des deux côtés » sont reproduits :
// au-delà du milieu, le motif est tourné de 180°.
function stripRows(id, tex, state, y0, label) {
  const L = state.length, W = state.width;
  const rows = Math.ceil(L / MM_PER_ROW), seg = L / rows;
  let out = '', y = y0;
  const href = tex.canvas.toDataURL('image/png');
  const defs = tex.pitch
    ? `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${tex.pitch}" height="${W}" x="${-tex.offset * tex.pitch}" y="0"><image href="${href}" width="${tex.pitch}" height="${W}" preserveAspectRatio="none"/></pattern>`
    : `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${L}" height="${W}"><image href="${href}" width="${L}" height="${W}" preserveAspectRatio="none"/></pattern>`;
  out += `<text x="${MARGIN}" y="${y + 4}" class="h2">${label}</text>`;
  y += 9;
  for (let r = 0; r < rows; r++) {
    const s0 = r * seg, s1 = s0 + seg;
    const x = MARGIN + 10;
    out += `<g transform="translate(${x} ${y})">`;
    if (state.mirror) {
      // première moitié normale, seconde moitié tournée de 180°
      const mid = L / 2;
      const a0 = s0, a1 = Math.min(s1, mid), b0 = Math.max(s0, mid), b1 = s1;
      if (a1 > a0) out += `<g transform="translate(${-s0} 0)"><rect x="${a0}" y="0" width="${a1 - a0}" height="${W}" fill="url(#${id})"/></g>`;
      // rotation de 180° autour du centre du ruban : (s, y) → (L - s, W - y), comme les UV du 3D
      if (b1 > b0) out += `<g transform="translate(${-s0} 0)"><g transform="rotate(180 ${L / 2} ${W / 2})"><rect x="${L - b1}" y="0" width="${b1 - b0}" height="${W}" fill="url(#${id})"/></g></g>`;
    } else {
      out += `<g transform="translate(${-s0} 0)"><rect x="${s0}" y="0" width="${seg}" height="${W}" fill="url(#${id})"/></g>`;
    }
    out += `<rect x="0" y="0" width="${seg}" height="${W}" class="outline"/>`;
    // zones prises dans l'embout
    if (r === 0) out += `<rect x="0" y="0" width="${HIDDEN_END}" height="${W}" class="hidden-zone"/>`;
    if (r === rows - 1) out += `<rect x="${seg - HIDDEN_END}" y="0" width="${HIDDEN_END}" height="${W}" class="hidden-zone"/>`;
    // milieu (nuque)
    const mid = L / 2 - s0;
    if (mid > 0 && mid < seg) out += `<line x1="${mid}" y1="-3" x2="${mid}" y2="${W + 3}" class="mid"/><text x="${mid + 1}" y="-1.2" class="tiny accent">milieu · nuque</text>`;
    // règle : graduation tous les 10 mm, cote tous les 50 mm
    for (let s = Math.ceil(s0 / 10) * 10; s <= s1 + 0.01; s += 10) {
      const t = s - s0, major = s % 50 === 0;
      out += `<line x1="${t}" y1="${W + 0.6}" x2="${t}" y2="${W + (major ? 3 : 1.6)}" class="tick"/>`;
      if (major) out += `<text x="${t}" y="${W + 6}" class="tiny" text-anchor="middle">${s / 10}</text>`;
    }
    // largeur au début de ligne
    out += `<line x1="-4" y1="0" x2="-4" y2="${W}" class="dim"/><line x1="-6" y1="0" x2="-2" y2="0" class="dim"/><line x1="-6" y1="${W}" x2="-2" y2="${W}" class="dim"/>`;
    out += `<text x="-6" y="${W / 2 + 1.2}" class="tiny" text-anchor="end">${W}</text>`;
    out += `</g>`;
    y += W + 13;
  }
  return { svg: out, defs, y };
}

export function buildBAT({ state, product, drop, preview, ref }) {
  const tex = textures(state, product, drop);
  const model = product.models.find((m) => m.id === state.model);
  const name = (list, id) => product[list].find((x) => x.id === id)?.name || id;
  let y = 34;
  const front = stripRows('patFront', tex.front, state, y, 'RECTO — échelle 1:1 (cm)');
  y = front.y + 4;
  let back = null;
  if (tex.back) { back = stripRows('patBack', tex.back, state, y, state.backMode === 'same' ? 'VERSO — même design (cm)' : 'VERSO — design différent (cm)'); y = back.y + 4; }

  // Spécifications
  const side = state.front;
  const specs = [
    ['Modèle', model.name], ['Largeur', `${state.width} mm`], ['Longueur à plat', `${state.length} mm`],
    ['Matière', name('materials', state.material)], ['Finition', name('finishes', state.finish)],
    ['Couleur du ruban', state.color.toUpperCase()],
    ['Impression', name('printingMethods', state.method)],
    ['Faces', { none: 'Recto seul', same: 'Recto + verso identiques', different: 'Recto + verso différents' }[state.backMode]],
    ['Motif', side.mode === 'repeat' ? `Répété · entraxe ${fmt(tex.front.pitch)} mm` : 'Une fois par côté'],
    ['Hauteur du motif', `${fmt(state.width * side.scale / 100)} mm (${side.scale} %)`],
    ['Rotation', `${side.rotation}°`], ['Sens de lecture', state.mirror ? 'Retourné au milieu' : 'Continu'],
    ['Logo', side.logoOn ? (side.logoName || 'Pictogramme SKLUBS') : '—'],
    ['Fichier logo', side.logoName ? (side.logoVector ? 'Vectoriel (SVG / PDF)' : `Image ${side.logoImage?.width || '?'} × ${side.logoImage?.height || '?'} px`) : '—'],
    ['Couleur du logo', side.logoTint ? side.logoTint.toUpperCase() : "Couleurs d'origine"],
    ['Texte', side.textOn && side.text ? `« ${side.text} » ${side.textColor.toUpperCase()}` : '—'],
    ['Liseré', side.edge ? side.edge.toUpperCase() : '—'],
    ['Attache', name('attachments', state.attachment)],
    ['Breakaway', state.breakaway === 'safety' ? 'Oui (nuque)' : 'Non'],
    ['Boucle détachable', state.buckle === 'detachable' ? 'Oui' : 'Non'],
    ['Accessoires', state.hardwareColor === 'custom' ? state.hardwareHex.toUpperCase() : name('hardwareColors', state.hardwareColor)],
    ['Porte-badge', state.kit === 'lanyard' ? '—' : `${name('holders', state.holder)} · ${state.holderOrientation}`],
    ['Pass imprimé', state.kit === 'pass' ? `CR80 · ${state.pass.event} · ${state.pass.role}` : '—'],
    ['Badges nominatifs', (state.pass.names || '').trim() ? `${state.pass.names.split('\n').filter((x) => x.trim()).length} noms (liste jointe)` : '—'],
    ['Quantité', `${state.quantity.toLocaleString('fr-FR')} pcs`],
  ];
  let sy = 34, specSvg = `<text x="${SPEC_X}" y="${sy}" class="h2">SPÉCIFICATIONS</text>`;
  sy += 6;
  for (const [k, v] of specs) {
    specSvg += `<text x="${SPEC_X}" y="${sy}" class="small muted">${esc(k)}</text><text x="${SPEC_X + 34}" y="${sy}" class="small">${esc(v)}</text>`;
    sy += 4.6;
  }
  // nuancier
  const swatches = [...new Set([state.color, side.textColor, side.edge, side.logoTint, side.iconColor].filter(Boolean).map((c) => c.toUpperCase()))];
  sy += 3;
  specSvg += `<text x="${SPEC_X}" y="${sy}" class="h2">COULEURS</text>`;
  sy += 3;
  swatches.forEach((c, i) => {
    const x = SPEC_X + i * 22;
    specSvg += `<rect x="${x}" y="${sy}" width="18" height="9" rx="1" style="fill:${c};stroke:#999;stroke-width:.15"/><text x="${x}" y="${sy + 13}" class="tiny">${c}</text>`;
  });
  sy += 20;
  if (preview) { specSvg += `<image href="${preview}" x="${SPEC_X}" y="${sy}" width="52" height="66" preserveAspectRatio="xMidYMid meet"/>`; }
  if (state.kit === 'pass') {
    const pc = passCanvas(state.pass, state.passArt || (state.front.logoOn ? state.front : null), state.holderOrientation === 'horizontal');
    const pw = state.holderOrientation === 'horizontal' ? 86 : 54, ph = state.holderOrientation === 'horizontal' ? 54 : 86;
    const px = SPEC_X + 58;
    specSvg += `<image href="${pc.toDataURL('image/png')}" x="${px}" y="${sy}" width="${pw}" height="${ph}"/><rect x="${px}" y="${sy}" width="${pw}" height="${ph}" rx="3" class="outline"/>`;
    specSvg += `<text x="${px}" y="${sy + ph + 4}" class="tiny">Pass CR80 à l'échelle 1:1 (${pw} × ${ph} mm)</text>`;
    sy += ph + 8;
  } else sy += 70;

  const H = Math.max(297, y + 18, sy + 18);
  const date = new Date().toLocaleDateString('fr-FR');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}mm" height="${H}mm" viewBox="0 0 ${PAGE_W} ${H}">
<style>
  text { font-family: "Inter Tight", Arial, sans-serif; fill: #111; }
  .h1 { font-size: 7px; font-weight: 800; } .h2 { font-size: 3.4px; font-weight: 700; letter-spacing: .3px; }
  .small { font-size: 2.7px; } .tiny { font-size: 2.1px; } .muted { fill: #777; } .accent { fill: ${ORANGE}; }
  .outline { fill: none; stroke: #999; stroke-width: .15; } .tick { stroke: #555; stroke-width: .12; }
  .dim { stroke: ${ORANGE}; stroke-width: .2; } .mid { stroke: ${ORANGE}; stroke-width: .25; stroke-dasharray: 1 .8; }
  .hidden-zone { fill: rgba(255,106,0,.18); stroke: ${ORANGE}; stroke-width: .15; stroke-dasharray: .8 .6; }
</style>
<defs>${front.defs}${back ? back.defs : ''}</defs>
<rect width="${PAGE_W}" height="${H}" fill="#fff"/>
<text x="${MARGIN}" y="16" class="h1">SKLUBS — BAT LANYARD</text>
<text x="${MARGIN}" y="22" class="small muted">Bon à tirer à valider avant production · Réf. ${esc(ref)} · ${date} · Cotes en mm, ruban à l'échelle 1:1</text>
<rect x="${PAGE_W - MARGIN - 60}" y="9" width="60" height="12" rx="2" fill="${ORANGE}"/>
<text x="${PAGE_W - MARGIN - 30}" y="16.6" class="small" text-anchor="middle" style="fill:#fff;font-weight:700">VALIDATION USINE REQUISE</text>
${front.svg}${back ? back.svg : ''}${specSvg}
<rect x="${MARGIN + 10}" y="${H - 12}" width="6" height="3" class="hidden-zone"/>
<text x="${MARGIN + 18}" y="${H - 9.6}" class="tiny">Zone prise dans l'embout (${HIDDEN_END} mm, indicatif) · Couleurs écran indicatives, références Pantone à confirmer par l'usine · Généré par SKLUBS EVENT 3D</text>
</svg>`;
  return { svg, width: PAGE_W, height: H };
}

// SVG → image (pour le PDF et l'aperçu).
export function svgToCanvas(svg, width, height, pxPerMM = 6) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(width * pxPerMM); c.height = Math.round(height * pxPerMM);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSPDF_URL; s.onload = () => resolve(window.jspdf); s.onerror = () => reject(new Error('jsPDF indisponible'));
    document.head.appendChild(s);
  });
}

export async function batPDF(bat) {
  const [{ jsPDF }, canvas] = await Promise.all([loadJsPDF(), svgToCanvas(bat.svg, bat.width, bat.height, 7)]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [bat.width, bat.height] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, bat.width, bat.height);
  pdf.setProperties({ title: 'SKLUBS — BAT Lanyard', creator: 'SKLUBS EVENT 3D' });
  return pdf.output('blob');
}
