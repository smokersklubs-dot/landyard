// SKLUBS EVENT 3D — parcours Lanyard (écrans 01 → 12), état, panneaux, export projet.
import { LanyardViewer } from './viewer.js';
import { ensureFonts, stripTexture, flatPreview, ORANGE } from './artwork.js';
import { sanitize, computePrice, allowedMethods, allowedAttachments, canHoldBadge, modelOf } from './pricing.js';

const PRODUCT_URL = 'products/lanyard/product.json';
// Point d'envoi des projets (API, WooCommerce, CRM). null = téléchargement local.
const SUBMIT_ENDPOINT = null;
const STORE_KEY = 'sklubs-lanyard-v1';
const PROJECT_KEY = 'sklubs-event-project';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

const STEPS = [
  { id: 'model', n: '03', title: 'Choix du modèle', sub: 'Différents styles pour différents besoins.' },
  { id: 'view', n: '04', title: 'Vue 3D interactive', sub: 'Rotation, faces, détails et vue éclatée des pièces.' },
  { id: 'dims', n: '05', title: 'Dimensions', sub: 'Choisissez la largeur et la longueur.' },
  { id: 'material', n: '06', title: 'Matière & couleur', sub: 'Textile, teinte et finition.' },
  { id: 'perso', n: '07', title: 'Personnalisation', sub: 'Logo, texte, taille et rotation.' },
  { id: 'print', n: '08', title: 'Impression & répétition', sub: 'Technique, recto / verso, répétition du motif.' },
  { id: 'attach', n: '09', title: 'Attaches & accessoires', sub: 'Attache, sécurité, boucle et couleur du métal.' },
  { id: 'badge', n: '10', title: 'Badge & pass', sub: 'Complete your event kit.' },
  { id: 'qty', n: '11', title: 'Quantité & prix', sub: 'Paliers et estimation.' },
  { id: 'final', n: '12', title: 'Finalisation', sub: 'Votre configuration complète.' },
];

let product, state, viewer, hero, studio;
let step = 0;
const modelThumbs = {};

function defaultState(modelId = 'classic') {
  const m = modelOf(product, modelId);
  const s = {
    model: modelId, width: m.defaultWidth, length: m.defaultLength, customLength: false,
    material: m.defaultMaterial, color: '#141414', finish: 'matte', method: m.defaultMethod,
    front: { mode: 'repeat', logoOn: true, logoImage: null, logoName: null, textOn: true, text: 'SKLUBS', textColor: '#F4F4F2', iconColor: ORANGE, scale: 62, rotation: 0, spacing: 85, offset: 0 },
    backMode: 'same',
    back: { mode: 'repeat', logoOn: false, logoImage: null, logoName: null, textOn: true, text: 'EVENT 2026', textColor: ORANGE, iconColor: ORANGE, scale: 50, rotation: 0, spacing: 70, offset: 0 },
    mirror: false,
    breakaway: m.pose === 'neck' ? 'safety' : 'none', buckle: 'none',
    attachment: m.defaultAttachment || 'snaphook', hardwareColor: 'chrome', hardwareHex: '#FF6A00',
    kit: 'pass', holder: 'pvcsoft', holderOrientation: 'vertical',
    pass: { event: 'SKLUBS', name: 'Prénom Nom', role: 'VIP', date: '12 — 14 JUIN 2026', accent: ORANGE, bg: '#121212' },
    quantity: product.quantity.default, logoVersion: 0,
    ui: { dims: false, explode: false, editSide: 'front' },
  };
  return sanitize(product, s);
}

// ---------- Démarrage ----------
async function init() {
  product = window.SKLUBS_PRODUCT || await (await fetch(PRODUCT_URL)).json();
  await ensureFonts();
  state = defaultState();
  bindGlobal();
  renderCategories();
  renderSteps();

  hero = new LanyardViewer($('#heroStage'), { mode: 'hero' });
  hero.apply(state, product);
  hero.setView('hero', true);

  viewer = new LanyardViewer($('#viewer'), { mode: 'config' });
  viewer.apply(state, product);
  viewer.setView('front', true);
  $('#loading').classList.add('hidden');

  studio = new LanyardViewer($('#studio'), { mode: 'studio', width: 360, height: 460 });
  if (store.get(STORE_KEY)) $('#resumeBtn').hidden = false;
  updateBag();
  const hash = location.hash.replace('#', '');
  if (hash === 'config') go('config');
  requestIdle(renderModelThumbs);
}
const requestIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 800 }) : setTimeout(fn, 200));

function renderModelThumbs() {
  for (const m of product.models) {
    const s = sanitize(product, { ...defaultState(m.id), kit: 'lanyard' });
    studio.apply(s, product);
    modelThumbs[m.id] = studio.snapshot('front');
  }
  renderCategories();
  if (currentPage === 'config') { renderRail(); if (STEPS[step].id === 'model') renderPanel(); }
}

// ---------- Navigation ----------
let currentPage = 'home';
function go(page) {
  if (page === 'quote') { page = 'config'; step = STEPS.length - 1; }
  currentPage = page;
  $$('.page').forEach((p) => p.classList.toggle('is-active', p.id === 'page-' + page));
  $$('.nav-links button').forEach((b) => b.classList.toggle('is-active', b.dataset.go === page || (page === 'category' && b.dataset.go === 'category')));
  hero.motion = page === 'home';
  if (page === 'config') { viewer.resize(); setStep(step, true); }
  window.scrollTo(0, 0);
}

function setStep(i, force = false) {
  const prev = step;
  step = Math.max(0, Math.min(STEPS.length - 1, i));
  const s = STEPS[step];
  state.ui.dims = s.id === 'dims';
  if (s.id !== 'view' && state.ui.explode) { state.ui.explode = false; viewer.setExploded(false); }
  $('#stepIndex').textContent = s.n + ' / 12';
  $('#stepTitle').textContent = s.title;
  $('#stepSub').textContent = s.sub || '';
  $('#page-config').dataset.step = s.id;
  renderSteps();
  renderPanel();
  renderRail();
  refresh();
  if (prev !== step || force) {
    const view = { dims: 'front', attach: 'detail', badge: 'front', material: 'macro', print: 'front', final: 'front' }[s.id];
    if (view) viewer.setView(view); else if (force) viewer.setView('front');
  }
  $('#backBtn').title = step === 0 ? 'Catégories' : 'Étape précédente';
  $('#nextBtn').innerHTML = step === STEPS.length - 1 ? 'Devis <span class="arrow">→</span>' : s.id === 'model' ? 'Choisir ce modèle <span class="arrow">→</span>' : 'Continuer <span class="arrow">→</span>';
}

function renderSteps() {
  $('#steps').innerHTML = STEPS.map((s, i) => `<li class="${i === step ? 'active' : i < step ? 'done' : ''}"><button data-step="${i}"><span class="n">${s.n}</span><span class="t">${s.title}</span></button></li>`).join('');
  const a = $('#steps .active');
  if (a) { const bar = $('#steps'); bar.scrollLeft = a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2; }
}

// ---------- État ----------
function setPath(key, val) {
  const parts = key.split('.');
  let o = state;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = val;
}
const sideKey = () => (state.backMode === 'different' && state.ui.editSide === 'back' ? 'back' : 'front');

function refresh() {
  sanitize(product, state);
  viewer.apply(state, product);
  viewer.setExploded(state.ui.explode);
  $$('#tools [data-tool="explode"]').forEach((b) => b.classList.toggle('is-on', state.ui.explode));
  $('#specLine').innerHTML = specLine();
  $('#footPrice').innerHTML = priceBlock(computePrice(product, state));
  if (STEPS[step].id === 'print') drawFlat();
  if (STEPS[step].id === 'view') $('#tree').innerHTML = treeHTML();
  store.set(STORE_KEY, serializable());
}

function specLine() {
  const m = modelOf(product, state.model);
  const mat = product.materials.find((x) => x.id === state.material);
  const meth = product.printingMethods.find((x) => x.id === state.method);
  return `<b>${m.name}</b> · ${state.width} mm × ${state.length / 10} cm · ${mat.name} · ${meth.name}`;
}

const fmt = (v, cur = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format(v);
function priceBlock(p) {
  if (p.status === 'factory') return `<span class="price-label">${p.quantity} pcs</span><b class="price-factory">Validation usine requise</b>`;
  return `<span class="price-label">${p.status === 'estimated' ? 'Estimation' : 'Prix'} · ${p.quantity} pcs</span><b>${fmt(p.unit, p.currency)} <small>HT / u</small></b>`;
}

// ---------- Panneaux ----------
const chip = (k, v, label, cur, extra = '') => `<button class="chip ${String(cur) === String(v) ? 'is-on' : ''}" data-k="${k}" data-v="${esc(v)}" ${extra}>${label}</button>`;
const swatches = (k, list, cur) => `<div class="swatches">${list.map((c) => `<button class="sw ${cur?.toLowerCase() === c.hex.toLowerCase() ? 'is-on' : ''}" style="--c:${c.hex}" data-k="${k}" data-v="${c.hex}" title="${esc(c.name)}" aria-label="${esc(c.name)}"></button>`).join('')}</div>`;
const group = (title, body, note = '') => `<div class="group"><div class="group-head"><h3>${title}</h3>${note ? `<span>${note}</span>` : ''}</div>${body}</div>`;
const toggle = (k, on, label, sub = '') => `<label class="toggle"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><i></i></label>`;
const range = (k, v, min, max, stepv, unit) => `<div class="range"><input type="range" data-k="${k}" data-t="num" value="${v}" min="${min}" max="${max}" step="${stepv}"><output data-out="${k}">${v} ${unit}</output></div>`;

const ICONS = {
  snaphook: '<path d="M12 2.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM12 6.5v2.5M10 9h4v2h-4zM11 11l-2 7a3 3 0 0 0 6 0l.4-3"/>',
  swivel: '<circle cx="12" cy="4" r="1.8"/><path d="M12 6v3M10.5 9h3v2h-3zM12 11v6a2.5 2.5 0 0 0 5 0v-3"/>',
  plasticclip: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M12 7v5a3 3 0 0 0 6 0v-2"/>',
  keyring: '<circle cx="12" cy="13" r="6.5"/><path d="M12 4v2.5"/>',
  double: '<circle cx="9" cy="5" r="1.6"/><path d="M9 7v9a2.2 2.2 0 0 0 4.4 0v-2"/><circle cx="16.5" cy="14" r="4"/>',
  phone: '<rect x="7" y="9" width="10" height="11" rx="2"/><path d="M12 3v6"/>',
  none: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const icon = (id) => `<svg viewBox="0 0 24 24">${ICONS[id] || ''}</svg>`;

function renderPanel() {
  const id = STEPS[step].id;
  const m = modelOf(product, state.model);
  let html = '';
  if (id === 'model') {
    html = `<div class="model-list">${product.models.map((x) => `<button class="model-card ${x.id === state.model ? 'is-on' : ''}" data-model="${x.id}">
        <span class="thumb">${modelThumbs[x.id] ? `<img src="${modelThumbs[x.id]}" alt="">` : ''}</span>
        <span><b>${x.name}</b><small>${x.tagline}</small></span></button>`).join('')}</div>` +
      `<div class="spec-card"><h3>${m.name}</h3><p>${m.tagline}</p><dl>
        <div><dt>Matière</dt><dd>${m.materials.map((id) => product.materials.find((x) => x.id === id).name).join(' / ')}</dd></div>
        <div><dt>Largeur</dt><dd>${m.widths.join(' / ')} mm</dd></div>
        <div><dt>Longueur</dt><dd>${m.lengths.map((l) => l / 10).join(' / ')} cm ou sur mesure</dd></div>
        <div><dt>Impression</dt><dd>${[...new Set(m.materials.flatMap((id) => product.rules.methodsByMaterial[id]))].map((id) => product.printingMethods.find((x) => x.id === id).name).join(', ')}</dd></div>
        <div><dt>Utilisation</dt><dd>${m.usage}</dd></div></dl></div>`;
  }
  if (id === 'view') {
    html = group('Explorer', `<div class="tool-grid">
        <button class="tool" data-tool="rotate">Rotation 360°</button><button class="tool" data-view="front">Vue avant</button>
        <button class="tool" data-view="back">Vue arrière</button><button class="tool" data-view="top">Vue de dessus</button>
        <button class="tool" data-view="side">Profil</button><button class="tool" data-view="neck">Nuque</button>
        <button class="tool" data-view="detail">Détail attache</button><button class="tool" data-view="macro">Macro matière</button></div>`) +
      group('Vue technique', `${toggle('ui.explode', state.ui.explode, 'Vue éclatée', 'Sépare et nomme chaque pièce')}<pre class="tree" id="tree"></pre>`);
  }
  if (id === 'dims') {
    const [minL, maxL] = m.customLength;
    html = group('Largeur', `<div class="chips">${m.widths.map((w) => chip('width', w, `${w} mm`, state.width, 'data-t="num"')).join('')}</div>`) +
      group('Longueur', `<div class="chips">${m.lengths.map((l) => chip('length', l, `${l / 10} cm`, state.customLength ? '' : state.length, 'data-t="num" data-custom="0"')).join('')}
        <button class="chip ${state.customLength ? 'is-on' : ''}" data-custom="1">Sur mesure</button></div>
        ${state.customLength ? `<div class="field inline"><label>Longueur totale (cm)</label><input type="number" id="customLen" min="${minL / 10}" max="${maxL / 10}" step="1" value="${state.length / 10}"></div>` : ''}`,
        'Longueur à plat du ruban') +
      `<p class="note">Chute portée ≈ <b id="dropOut">${Math.round(viewer.strap.drop / 10)} cm</b> sous la nuque. Tolérances et longueurs usine à confirmer.</p>`;
  }
  if (id === 'material') {
    html = group('Matière du lanyard', `<div class="list">${m.materials.map((mid) => { const x = product.materials.find((y) => y.id === mid); return `<button class="row ${x.id === state.material ? 'is-on' : ''}" data-k="material" data-v="${x.id}"><i class="weave ${x.weave}" style="--c:${state.color}"></i><span><b>${x.name}</b><small>${x.sub}</small></span></button>`; }).join('')}</div>`) +
      group('Couleur du lanyard', swatches('color', product.colors, state.color) +
        `<div class="field inline"><label>Couleur personnalisée</label><span class="hex"><input type="color" data-k="color" value="${state.color}"><input type="text" data-k="color" data-t="hex" value="${state.color.toUpperCase()}" maxlength="7"></span></div>`, state.method === 'sublimation' ? 'Fond imprimé' : 'Teinte du ruban') +
      group('Finition', `<div class="list compact">${product.finishes.map((f) => `<button class="row radio ${f.id === state.finish ? 'is-on' : ''}" data-k="finish" data-v="${f.id}"><i></i><span><b>${f.name}</b></span></button>`).join('')}</div>`);
  }
  if (id === 'perso') {
    const k = sideKey(), s = state[k];
    html = (state.backMode === 'different' ? group('Face éditée', `<div class="chips">${chip('ui.editSide', 'front', 'Recto', state.ui.editSide)}${chip('ui.editSide', 'back', 'Verso', state.ui.editSide)}</div>`) : '') +
      group('Logo', `<div class="upload"><button class="btn ghost" id="importLogo">Importer un logo</button>
          <span class="file">${s.logoName ? esc(s.logoName) + ` <button class="link-btn" id="removeLogo">Retirer</button>` : 'Pictogramme SKLUBS par défaut'}</span></div>
          ${toggle(k + '.logoOn', s.logoOn, 'Afficher le logo')}
          ${!s.logoName ? `<div class="field"><label>Couleur du pictogramme</label>${swatches(k + '.iconColor', product.colors, s.iconColor)}</div>` : ''}`, 'PNG, JPG ou SVG') +
      group('Texte', `${toggle(k + '.textOn', s.textOn, 'Ajouter un texte')}
          <div class="field"><input type="text" data-k="${k}.text" value="${esc(s.text)}" maxlength="28" placeholder="Votre texte"></div>
          <div class="field"><label>Couleur du texte</label>${swatches(k + '.textColor', product.colors, s.textColor)}</div>`) +
      group('Taille', range(k + '.scale', s.scale, 20, 95, 1, '%'), 'Hauteur / largeur du ruban') +
      group('Rotation', `<div class="chips">${[0, 90, 180, 270].map((r) => chip(k + '.rotation', r, r + '°', s.rotation, 'data-t="num"')).join('')}</div>`);
  }
  if (id === 'print') {
    const methods = allowedMethods(product, state.material);
    const k = sideKey(), s = state[k];
    const meth = product.printingMethods.find((x) => x.id === state.method);
    html = group("Type d'impression", `<div class="cards3">${methods.map((x) => `<button class="card ${x.id === state.method ? 'is-on' : ''}" data-k="method" data-v="${x.id}"><b>${x.name}</b><small>${x.sub}</small></button>`).join('')}</div>`,
        meth.maxColors ? `${meth.maxColors} couleurs max.` : '') +
      group("Options d'impression", `<div class="chips">${chip('backMode', 'none', 'Recto', state.backMode)}${chip('backMode', 'same', 'Recto-verso · même design', state.backMode)}${chip('backMode', 'different', 'Recto-verso · design différent', state.backMode)}</div>
        ${state.backMode === 'different' ? `<div class="chips sub">${chip('ui.editSide', 'front', 'Régler le recto', state.ui.editSide)}${chip('ui.editSide', 'back', 'Régler le verso', state.ui.editSide)}</div>` : ''}`) +
      group('Répétition du logo', `<div class="chips">${chip(k + '.mode', 'single', 'Simple', s.mode)}${chip(k + '.mode', 'repeat', 'Répété', s.mode)}</div>
        ${s.mode === 'repeat' ? `<div class="field"><label>Espacement (entraxe)</label>${range(k + '.spacing', s.spacing, 30, 250, 1, 'mm')}</div>` : ''}
        <div class="field"><label>${s.mode === 'repeat' ? 'Décalage du motif' : 'Position depuis le bas'}</label>${range(k + '.offset', s.offset, s.mode === 'repeat' ? 0 : -80, s.mode === 'repeat' ? 200 : 200, 1, 'mm')}</div>
        <div class="field"><label>Sens de lecture</label><div class="chips">${chip('mirror', 'false', 'Continu', String(state.mirror), 'data-t="bool"')}${chip('mirror', 'true', 'Lisible des deux côtés', String(state.mirror), 'data-t="bool"')}</div></div>`) +
      group('Aperçu sur 1 mètre', `<canvas class="flat" id="flatFront" width="720" height="64"></canvas>${state.backMode === 'different' ? '<canvas class="flat" id="flatBack" width="720" height="64"></canvas>' : ''}<div class="ruler"><span>0</span><span>25</span><span>50</span><span>75</span><span>100 cm</span></div>`, '<span id="pitchOut"></span>');
  }
  if (id === 'attach') {
    const atts = allowedAttachments(product, state.model);
    html = group("Type d'attache", `<div class="icon-grid">${atts.map((a) => `<button class="icard ${a.id === state.attachment ? 'is-on' : ''}" data-k="attachment" data-v="${a.id}">${icon(a.id)}<b>${a.name}</b><small>${a.sub}</small></button>`).join('')}</div>`) +
      group('Sécurité & boucle', (m.pose === 'neck' ? toggle('breakaway', state.breakaway === 'safety', 'Safety breakaway', "S'ouvre à la nuque en cas de traction") : '') +
        toggle('buckle', state.buckle === 'detachable', 'Boucle détachable', "Détache l'attache du tour de cou")) +
      group('Couleur des accessoires', `${swatches('hardwareColor', product.hardwareColors.map((h) => ({ ...h, hex: h.id })), state.hardwareColor).replace(/--c:([a-z]+)/g, (_, id) => `--c:${product.hardwareColors.find((h) => h.id === id).hex}`)}
        <div class="field inline"><label>Personnalisée</label><span class="hex"><input type="color" id="hwCustom" value="${state.hardwareHex}"></span></div>`,
        product.hardwareColors.find((h) => h.id === state.hardwareColor)?.name || 'Personnalisée');
  }
  if (id === 'badge') {
    if (!canHoldBadge(product, state)) {
      html = `<div class="notice"><b>Porte-badge indisponible avec cette configuration.</b><p>${m.pose !== 'neck' ? 'Le modèle choisi ne se porte pas autour du cou.' : "L'attache choisie ne permet pas d'accrocher un porte-badge."}</p>
        ${m.pose === 'neck' ? '<button class="btn ghost" data-k="attachment" data-v="snaphook">Passer au mousqueton standard</button>' : ''}</div>`;
    } else {
      html = group('Complete your event kit', `<div class="list">${[['lanyard', 'Lanyard seul', 'Le cordon et son attache'], ['holder', 'Lanyard + porte-badge', 'Pochette ou étui'], ['pass', 'Lanyard + porte-badge + pass imprimé', 'Le kit complet, prêt à distribuer']].map(([v, t, sub]) => `<button class="row radio ${state.kit === v ? 'is-on' : ''}" data-k="kit" data-v="${v}"><i></i><span><b>${t}</b><small>${sub}</small></span></button>`).join('')}</div>`);
      if (state.kit !== 'lanyard') {
        html += group('Type de porte-badge', `<div class="cards3">${product.holders.filter((h) => h.id !== 'none').map((h) => `<button class="card ${h.id === state.holder ? 'is-on' : ''}" data-k="holder" data-v="${h.id}"><b>${h.name}</b><small>${h.sub}</small></button>`).join('')}</div>`) +
          group('Format', `<div class="chips">${chip('holderOrientation', 'vertical', 'Vertical', state.holderOrientation)}${chip('holderOrientation', 'horizontal', 'Horizontal', state.holderOrientation)}</div>`, 'Carte CR80 · 54 × 86 mm');
      }
      if (state.kit === 'pass') {
        html += group('Pass personnalisé', `<div class="field"><label>Événement</label><input type="text" data-k="pass.event" value="${esc(state.pass.event)}" maxlength="18"></div>
          <div class="field"><label>Nom du porteur</label><input type="text" data-k="pass.name" value="${esc(state.pass.name)}" maxlength="26"></div>
          <div class="field two"><div><label>Accès</label><input type="text" data-k="pass.role" value="${esc(state.pass.role)}" maxlength="16"></div><div><label>Dates</label><input type="text" data-k="pass.date" value="${esc(state.pass.date)}" maxlength="24"></div></div>
          <div class="field"><label>Couleur d'accent</label>${swatches('pass.accent', product.colors, state.pass.accent)}</div>`, 'Le logo du lanyard est repris');
      }
    }
  }
  if (id === 'qty') {
    html = `<table class="tiers"><thead><tr><th>Quantité</th><th>Prix unitaire HT</th></tr></thead><tbody>${product.quantity.tiers.map((q) => {
        const p = computePrice(product, state, q);
        return `<tr class="${q === state.quantity ? 'is-on' : ''}" data-qty="${q}"><td>${q.toLocaleString('fr-FR')} pcs</td><td>${p.status === 'factory' ? '<span class="muted">Sur devis</span>' : fmt(p.unit, p.currency)}${q === 500 ? '<em>Le plus populaire</em>' : ''}</td></tr>`;
      }).join('')}</tbody></table>
      <div class="field inline"><label>Quantité libre</label><input type="number" id="qtyInput" min="1" step="1" value="${state.quantity}"></div>
      <div class="price-big" id="priceBig"></div>
      <p class="note">Prix estimatifs, validation usine incluse. ${computePrice(product, state).status === 'factory' ? 'Tarifs fournisseur non renseignés : chaque projet est validé et chiffré par l\'usine.' : ''}</p>`;
  }
  if (id === 'final') {
    html = `<h2 class="ready">Votre lanyard est prêt !</h2><dl class="recap">${recap().map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      <div class="final-actions">
        <button class="btn primary" id="addProject">Ajouter au projet <span class="arrow">→</span></button>
        <button class="btn outline" id="quoteBtn">Demander un devis</button>
        <button class="btn outline" id="saveBtn">Sauvegarder mon projet</button>
      </div>`;
  }
  $('#panelBody').innerHTML = html;
  if (id === 'qty') $('#priceBig').innerHTML = bigPrice();
  if (id === 'view') $('#tree').innerHTML = treeHTML();
}

function bigPrice() {
  const p = computePrice(product, state);
  if (p.status === 'factory') return `<div><b class="price-factory">Validation usine requise</b><small>pour ${p.quantity.toLocaleString('fr-FR')} pièces</small></div><div class="missing">À renseigner : ${p.reasons.slice(0, 4).join(', ')}${p.reasons.length > 4 ? '…' : ''}</div>`;
  return `<div><b>${fmt(p.unit, p.currency)}</b> HT / unité<small>pour ${p.quantity.toLocaleString('fr-FR')} pièces</small></div><div class="total"><small>Total HT</small><b>${fmt(p.total, p.currency)}</b></div>`;
}

function recap() {
  const m = modelOf(product, state.model);
  const name = (list, id) => product[list].find((x) => x.id === id)?.name || id;
  const colorName = product.colors.find((c) => c.hex.toLowerCase() === state.color.toLowerCase())?.name || state.color.toUpperCase();
  const rows = [
    ['Modèle', m.name], ['Largeur', state.width + ' mm'], ['Longueur', state.length / 10 + ' cm'], ['Matière', name('materials', state.material)],
    ['Couleur', colorName], ['Finition', name('finishes', state.finish)],
    ['Impression', name('printingMethods', state.method) + ({ none: ' (recto)', same: ' (recto + verso)', different: ' (recto + verso différents)' }[state.backMode])],
    ['Répétition', state.front.mode === 'repeat' ? `Répété · ${state.front.spacing} mm` : 'Simple'],
    ['Attache', name('attachments', state.attachment)],
  ];
  if (m.pose === 'neck') rows.push(['Breakaway', state.breakaway === 'safety' ? 'Oui' : 'Non']);
  rows.push(['Boucle', state.buckle === 'detachable' ? 'Détachable' : 'Non']);
  rows.push(['Accessoires', product.hardwareColors.find((h) => h.id === state.hardwareColor)?.name || state.hardwareHex]);
  if (state.kit !== 'lanyard') rows.push(['Porte-badge', `${name('holders', state.holder)} (${state.holderOrientation})`]);
  if (state.kit === 'pass') rows.push(['Pass', `${state.pass.event} · ${state.pass.role}`]);
  rows.push(['Quantité', state.quantity.toLocaleString('fr-FR') + ' pcs']);
  return rows;
}

function treeHTML() {
  const m = modelOf(product, state.model);
  const lines = ['LANYARD_MASTER', `├── STRAP · ${state.width} mm × ${state.length / 10} cm${m.pose === 'neck' ? '' : ' (boucle courte)'}`,
    `│   ├── ARTWORK_FRONT`, `│   └── ARTWORK_BACK${state.backMode === 'none' ? ' · —' : ''}`];
  if (state.breakaway === 'safety') lines.push('├── SAFETY_BREAKAWAY');
  lines.push(state.buckle === 'detachable' ? '├── DETACHABLE_BUCKLE' : '├── CRIMP (embout)');
  if (state.attachment !== 'none') lines.push(`├── ${state.attachment.toUpperCase()}`);
  if (state.kit !== 'lanyard' && canHoldBadge(product, state)) {
    lines.push(`└── BADGE_HOLDER · ${state.holder}`);
    if (state.kit === 'pass') lines.push('    └── EVENT_PASS');
  }
  const last = lines.length - 1;
  lines[last] = lines[last].replace('├──', '└──');
  return lines.join('\n');
}

function drawFlat() {
  const draw = (id, tex) => { const c = $('#' + id); if (c && tex) flatPreview(c, tex, state.width, state.length); };
  draw('flatFront', viewer.frontTex);
  draw('flatBack', viewer.backTex);
  const out = $('#pitchOut');
  if (out) out.textContent = viewer.frontTex?.pitch ? `Entraxe réel ${Math.round(viewer.frontTex.pitch)} mm · ${Math.floor(state.length / viewer.frontTex.pitch)} motifs` : '2 motifs';
}

function renderRail() {
  const id = STEPS[step].id;
  const rail = $('#rail');
  if (id === 'model') {
    rail.innerHTML = product.models.map((m) => `<button class="${m.id === state.model ? 'is-on' : ''}" data-model="${m.id}" title="${m.name}">${modelThumbs[m.id] ? `<img src="${modelThumbs[m.id]}" alt="${m.name}">` : `<span>${m.name}</span>`}</button>`).join('');
  } else if (id === 'view') {
    const views = [['front', 'Face'], ['back', 'Dos'], ['threeq', '3/4'], ['top', 'Dessus'], ['detail', 'Attache'], ['macro', 'Matière']];
    const saved = studio.twist;
    studio.apply({ ...state, ui: { ...state.ui, dims: false } }, product);
    rail.innerHTML = views.map(([v, t]) => `<button data-view="${v}" title="${t}"><img src="${studio.snapshot(v)}" alt="${t}"><small>${t}</small></button>`).join('');
    studio.twist = saved;
  } else rail.innerHTML = '';
}

function renderCategories() {
  const svg = {
    wristbands: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="16" ry="9"/><ellipse cx="24" cy="27" rx="16" ry="9"/></svg>',
    holders: '<svg viewBox="0 0 48 48"><rect x="13" y="10" width="22" height="30" rx="3"/><path d="M20 15h8"/></svg>',
    badges: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14"/><path d="M24 15c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11Z"/></svg>',
    passes: '<svg viewBox="0 0 48 48"><rect x="14" y="8" width="20" height="32" rx="3"/><path d="M19 30h10M21 13h6"/></svg>',
  };
  const card = (c, big) => `<button class="cat ${c.active ? '' : 'soon'} ${big ? 'big' : ''}" data-cat="${c.id}" ${c.active ? '' : 'aria-disabled="true"'}>
      <span class="thumb">${c.active && modelThumbs[c.model || 'classic'] ? `<img src="${modelThumbs[c.model || 'classic']}" alt="">` : svg[c.id] || ''}</span>
      <b>${c.name}</b><small>${c.active ? c.sub : 'Bientôt'}</small>${c.active ? '<i class="go">→</i>' : ''}</button>`;
  $('#catGrid').innerHTML = product.categories.map((c) => card(c, true)).join('');
  $('#homeCats').innerHTML = product.categories.map((c) => card(c, false)).join('');
}

// ---------- Projet ----------
function serializable() {
  const strip = (s) => { const { logoImage, ...r } = s; return r; };
  return { ...state, front: strip(state.front), back: strip(state.back), ui: undefined };
}

function buildProject(withImage = true) {
  const p = computePrice(product, state);
  const m = modelOf(product, state.model);
  const side = (s) => ({ mode: s.mode, logo: s.logoOn ? (s.logoName || 'SKLUBS_DEFAULT_MARK') : null, text: s.textOn ? s.text : null, text_color: s.textColor, scale_pct_of_width: s.scale, rotation_deg: s.rotation, spacing_mm: s.mode === 'repeat' ? s.spacing : null, offset_mm: s.offset });
  return {
    product_id: product.id, engine: product.engine, timestamp: new Date().toISOString(),
    LANYARD: {
      TYPE: m.id, POSE: m.pose, WIDTH_MM: state.width, LENGTH_MM: state.length, MATERIAL: state.material, BASE_COLOR: state.color, FINISH: state.finish,
      ARTWORK: { FRONT: side(state.front), BACK: state.backMode === 'none' ? null : state.backMode === 'same' ? 'SAME_AS_FRONT' : side(state.back), READING: state.mirror ? 'mirrored_at_center' : 'continuous' },
      PRINT_METHOD: state.method, BREAKAWAY: state.breakaway, BUCKLE: state.buckle, ATTACHMENT: state.attachment,
      HARDWARE_COLOR: state.hardwareColor === 'custom' ? state.hardwareHex : state.hardwareColor,
      KIT: state.kit, HOLDER: state.kit === 'lanyard' ? null : { type: state.holder, orientation: state.holderOrientation },
      PASS: state.kit === 'pass' ? { ...state.pass, format: 'CR80' } : null,
      QUANTITY: state.quantity,
      PRICE: { status: p.status, unit: p.unit, total: p.total, currency: p.currency, missing: p.reasons },
      FACTORY_RULES: product.rules._status,
    },
    logo_files: [state.front, state.back].filter((s) => s.logoImage).map((s) => ({ name: s.logoName, data_url: s.logoData })),
    preview_image: withImage ? viewer.snapshot() : undefined,
  };
}

function download(name, data, type) {
  const a = document.createElement('a');
  a.href = typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(new Blob([data], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

function exportProject() {
  const proj = buildProject();
  if (window.SKLUBS_PREVIEW) {
    const { preview_image, logo_files, ...light } = proj;
    modal('Fichier projet', `<p class="note">Les téléchargements sont bloqués dans cet aperçu. Voici le fichier projet (JSON) :</p><pre class="json">${esc(JSON.stringify(light, null, 2))}</pre>`,
      '<button class="btn primary" value="copy" id="copyJson">Copier le JSON</button>');
    $('#copyJson').onclick = (e) => { e.preventDefault(); navigator.clipboard?.writeText(JSON.stringify(light, null, 2)).then(() => toast('JSON copié.')); };
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  download(`sklubs-lanyard-${stamp}.json`, JSON.stringify(proj, null, 2), 'application/json');
  download(`sklubs-lanyard-${stamp}.png`, proj.preview_image);
}

async function submitQuote() {
  if (!SUBMIT_ENDPOINT) {
    exportProject();
    if (!window.SKLUBS_PREVIEW) toast("Envoi en ligne à brancher (point d'envoi SKLUBS à définir). Projet et aperçu téléchargés.");
    return;
  }
  try {
    const res = await fetch(SUBMIT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildProject()) });
    toast(res.ok ? 'Demande de devis envoyée.' : "L'envoi a échoué, réessayez.");
  } catch { toast("L'envoi a échoué, réessayez."); }
}

function updateBag() {
  const items = store.get(PROJECT_KEY) || [];
  $('#bagCount').hidden = !items.length;
  $('#bagCount').textContent = items.length;
}

function showProject() {
  const items = store.get(PROJECT_KEY) || [];
  modal('Mon projet', items.length ? `<ul class="proj">${items.map((it, i) => `<li><img src="${it.thumb}" alt=""><span><b>${esc(it.title)}</b><small>${esc(it.spec)}</small></span><button class="link-btn" data-remove="${i}" value="rm${i}">Retirer</button></li>`).join('')}</ul>` : '<p class="note">Votre projet est vide. Configurez un lanyard puis « Ajouter au projet ».</p>');
}

// ---------- UI ----------
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3400);
}
function modal(title, body, actions = '') {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  $('#modalActions').innerHTML = actions + '<button class="btn ghost" value="close">Fermer</button>';
  $('#modal').showModal();
}

function selectModel(id) {
  const keep = { color: state.color, front: state.front, back: state.back, backMode: state.backMode, pass: state.pass, quantity: state.quantity, hardwareColor: state.hardwareColor, hardwareHex: state.hardwareHex, logoVersion: state.logoVersion, ui: state.ui };
  state = sanitize(product, { ...defaultState(id), ...keep });
  refresh();
  renderPanel();
  renderRail();
  viewer.setView('front');
}

function parseVal(el, raw) {
  const t = el.dataset.t;
  if (t === 'num') return Number(raw);
  if (t === 'bool') return raw === 'true';
  return raw;
}

function bindGlobal() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, tr[data-qty]');
    if (!t) return;
    if (t.dataset.go) { go(t.dataset.go); return; }
    if (t.dataset.cat) {
      const c = product.categories.find((x) => x.id === t.dataset.cat);
      if (!c.active) { toast(`${c.name} : bientôt disponible dans SKLUBS EVENT 3D.`); return; }
      step = 0; go('config'); selectModel(c.model || state.model); return;
    }
    if (t.dataset.step) { setStep(Number(t.dataset.step)); return; }
    if (t.dataset.model) { selectModel(t.dataset.model); return; }
    if (t.dataset.view) { viewer.setAutoRotate(false); viewer.setView(t.dataset.view); return; }
    if (t.dataset.tool) {
      const tool = t.dataset.tool;
      if (tool === 'rotate') { const on = !viewer.controls.autoRotate; viewer.setAutoRotate(on); t.classList.toggle('is-on', on); }
      if (tool === 'zoomin') viewer.zoom(0.7);
      if (tool === 'zoomout') viewer.zoom(1.4);
      if (tool === 'explode') { state.ui.explode = !state.ui.explode; refresh(); if (state.ui.explode) viewer.setView('threeq'); if (STEPS[step].id === 'view') renderPanel(); }
      return;
    }
    if (t.dataset.qty) { state.quantity = Number(t.dataset.qty); refresh(); renderPanel(); return; }
    if (t.dataset.custom) {
      const m = modelOf(product, state.model);
      state.customLength = t.dataset.custom === '1';
      if (!state.customLength && !m.lengths.includes(state.length)) state.length = m.defaultLength;
      if (t.dataset.custom === '0') state.length = Number(t.dataset.v);
      refresh(); renderPanel(); $('#dropOut') && ($('#dropOut').textContent = Math.round(viewer.strap.drop / 10) + ' cm'); return;
    }
    if (t.dataset.k && t.dataset.v !== undefined) {
      if (t.dataset.k === 'hardwareColor') state.hardwareColor = t.dataset.v;
      else setPath(t.dataset.k, parseVal(t, t.dataset.v));
      if (t.dataset.k === 'attachment' && STEPS[step].id === 'attach') viewer.setView('detail');
      refresh(); renderPanel(); return;
    }
    if (t.dataset.remove !== undefined) {
      e.preventDefault();
      const items = store.get(PROJECT_KEY) || []; items.splice(Number(t.dataset.remove), 1); store.set(PROJECT_KEY, items); updateBag(); showProject(); return;
    }
    switch (t.id) {
      case 'nextBtn': if (step === STEPS.length - 1) submitQuote(); else setStep(step + 1); break;
      case 'backBtn': if (step === 0) go('category'); else setStep(step - 1); break;
      case 'prevModel': case 'nextModel': {
        const ids = product.models.map((m) => m.id), i = ids.indexOf(state.model);
        selectModel(ids[(i + (t.id === 'nextModel' ? 1 : -1) + ids.length) % ids.length]); break;
      }
      case 'heroNext': {
        const ids = product.models.map((m) => m.id);
        const i = (ids.indexOf(hero.state.model) + 1) % ids.length;
        const s = sanitize(product, { ...defaultState(ids[i]), front: state.front, color: state.color });
        hero.apply(s, product); hero.setView('hero', true);
        $('#heroIndex').textContent = String(i + 1).padStart(2, '0');
        $('#heroModel').textContent = modelOf(product, ids[i]).name;
        break;
      }
      case 'importLogo': $('#logoFile').click(); break;
      case 'removeLogo': { const s = state[sideKey()]; s.logoImage = null; s.logoName = null; s.logoData = null; state.logoVersion++; refresh(); renderPanel(); break; }
      case 'addProject': {
        const items = store.get(PROJECT_KEY) || [];
        items.push({ title: modelOf(product, state.model).name, spec: `${state.width} mm × ${state.length / 10} cm · ${state.quantity} pcs`, thumb: viewer.snapshot(), config: serializable() });
        if (!store.set(PROJECT_KEY, items)) { items.at(-1).thumb = ''; store.set(PROJECT_KEY, items); }
        updateBag(); toast('Ajouté à votre projet.'); break;
      }
      case 'quoteBtn': submitQuote(); break;
      case 'saveBtn': store.set(STORE_KEY, serializable()); exportProject(); if (!window.SKLUBS_PREVIEW) toast('Projet enregistré sur cet appareil et téléchargé.'); break;
      case 'bagBtn': showProject(); break;
      case 'resumeBtn': {
        const saved = store.get(STORE_KEY);
        if (saved) { state = sanitize(product, { ...defaultState(saved.model), ...saved, front: { ...defaultState().front, ...saved.front }, back: { ...defaultState().back, ...saved.back }, ui: { dims: false, explode: false, editSide: 'front' } }); }
        step = 0; go('config'); break;
      }
      default: break;
    }
  });

  const onInput = (e) => {
    const el = e.target;
    if (el.id === 'customLen') {
      const m = modelOf(product, state.model);
      const v = Number(el.value) * 10;
      if (v >= m.customLength[0] && v <= m.customLength[1]) { state.length = v; refresh(); $('#dropOut').textContent = Math.round(viewer.strap.drop / 10) + ' cm'; }
      return;
    }
    if (el.id === 'qtyInput') { const q = Math.max(1, Math.round(Number(el.value) || 1)); state.quantity = q; refresh(); $('#priceBig').innerHTML = bigPrice(); $$('.tiers tr').forEach((r) => r.classList.toggle('is-on', Number(r.dataset.qty) === q)); return; }
    if (el.id === 'hwCustom') { state.hardwareColor = 'custom'; state.hardwareHex = el.value; refresh(); if (e.type === 'change') renderPanel(); return; }
    const k = el.dataset.k;
    if (!k) return;
    let v = el.type === 'checkbox' ? el.checked : parseVal(el, el.value);
    if (k === 'breakaway') v = el.checked ? 'safety' : 'none';
    if (k === 'buckle') v = el.checked ? 'detachable' : 'none';
    if (el.dataset.t === 'hex') { if (!/^#[0-9a-f]{6}$/i.test(v)) return; }
    setPath(k, v);
    const out = $(`[data-out="${k}"]`);
    if (out) out.textContent = `${v} ${out.textContent.split(' ').slice(1).join(' ')}`;
    refresh();
    if (el.type === 'checkbox' || (e.type === 'change' && el.type !== 'range' && el.type !== 'text')) renderPanel();
  };
  document.addEventListener('input', onInput);
  document.addEventListener('change', (e) => { if (e.target.type === 'checkbox' || e.target.type === 'color' || e.target.id === 'hwCustom') onInput(e); });

  $('#logoFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = state[sideKey()];
        s.logoImage = img; s.logoName = f.name; s.logoData = reader.result; s.logoOn = true;
        state.logoVersion++;
        refresh(); renderPanel();
        toast('Logo importé : il se répète sur le ruban.');
      };
      img.onerror = () => toast('Image illisible. Utilisez un PNG, JPG ou SVG.');
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  });
}

init().catch((err) => {
  console.error(err);
  const l = document.getElementById('loading');
  if (l) l.textContent = 'Impossible de charger le configurateur. Lancez-le via un serveur HTTP.';
});
