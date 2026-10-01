// SKLUBS EVENT 3D — parcours Lanyard (écrans 01 → 12), état, panneaux, export projet.
import { LanyardViewer } from './viewer.js';
import { loadHardware } from './hardware.js';
import { buildBAT, batPDF, svgToCanvas } from './bat.js';
import { CONFIG } from './config.js';
import { ensureFonts, stripTexture, flatPreview, ORANGE, rasterizeLogo, hasLightBackground, removeLightBackground } from './artwork.js';
import { sanitize, computePrice, allowedMethods, allowedAttachments, canHoldBadge, modelOf } from './pricing.js';

const PRODUCT_URL = 'products/lanyard/product.json';
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
const catThumbs = {};
const catBig = {};
let heroCat = 0;

function defaultState(modelId = 'classic') {
  const m = modelOf(product, modelId);
  const s = {
    model: modelId, width: m.defaultWidth, length: m.defaultLength, customLength: false,
    material: m.defaultMaterial, color: '#141414', finish: 'matte', method: m.defaultMethod,
    front: { mode: 'repeat', edge: ORANGE, logoOn: true, logoImage: null, logoName: null, textOn: true, text: 'SKLUBS', textColor: '#F4F4F2', iconColor: ORANGE, scale: 62, rotation: 0, spacing: 85, offset: 0 },
    backMode: 'same',
    back: { mode: 'repeat', edge: ORANGE, logoOn: false, logoImage: null, logoName: null, textOn: true, text: 'EVENT 2026', textColor: ORANGE, iconColor: ORANGE, scale: 50, rotation: 0, spacing: 70, offset: 0 },
    mirror: false,
    breakaway: m.pose === 'neck' ? 'safety' : 'none', buckle: 'none',
    attachment: m.defaultAttachment || 'snaphook', hardwareColor: 'chrome', hardwareHex: '#FF6A00',
    kit: 'pass', holder: 'pvcsoft', holderOrientation: 'vertical',
    pass: { event: 'SKLUBS', name: 'Prénom Nom', role: 'VIP', date: '12 — 14 JUIN 2026', accent: ORANGE, bg: '#121212' },
    quantity: product.quantity.default, logoVersion: 0,
    ui: { dims: false, explode: false, editSide: 'front', persoTab: 'logo', badgeTab: 'holder', guides: false },
  };
  return sanitize(product, s);
}

// ---------- Démarrage ----------
async function init() {
  product = window.SKLUBS_PRODUCT || await (await fetch(PRODUCT_URL)).json();
  await ensureFonts();
  state = defaultState();
  track('event_configurator_started');
  bindGlobal();
  bindSheet();
  renderCategories();
  renderSteps();

  hero = new LanyardViewer($('#heroStage'), { mode: 'hero' });
  showHero(0);

  viewer = new LanyardViewer($('#viewer'), { mode: 'config' });
  setSheet($('#panel').dataset.sheet || 'half');
  window.addEventListener('resize', () => setSheet($('#panel').dataset.sheet));
  viewer.apply(state, product);
  viewer.setView('showcase', true);
  $('#loading').classList.add('hidden');

  studio = new LanyardViewer($('#studio'), { mode: 'studio', width: 360, height: 460 });
  if (store.get(STORE_KEY)) $('#resumeBtn').hidden = false;
  // Pièces Blender : chargées en parallèle, la 3D s'affiche déjà avec les pièces procédurales.
  const hardware = loadHardware().then((lib) => { for (const v of [hero, viewer, studio]) v.setHardware(lib); return lib; });
  updateBag();
  const hash = location.hash.replace('#', '');
  if (hash === 'config') go('config');
  hardware.finally(() => requestIdle(renderModelThumbs));
}
const requestIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 800 }) : setTimeout(fn, 200));

// Mise en scène de chaque catégorie (hero de l'accueil et vignettes) par le même moteur.
function showcaseState(catId) {
  const base = sanitize(product, { ...defaultState('classic'), kit: 'lanyard', breakaway: 'none' });
  const front = { ...state.front, scale: 78, spacing: 120 };
  const s = { ...base, front, back: front, width: 25, buckle: 'detachable', attachment: 'snaphook' };
  if (catId === 'wristbands') return { ...s, modelDef: { pose: 'band', profile: 'flat' }, length: 330, width: 15, buckle: 'none', attachment: 'none', front: { ...front, spacing: 70 }, back: { ...front, spacing: 70 } };
  if (catId === 'keystraps') return { ...sanitize(product, { ...defaultState('wrist'), kit: 'lanyard' }), front, back: front, attachment: 'snaphook' };
  if (catId === 'holders') return { ...s, showcase: 'holder', pass: { ...s.pass, role: 'ACCESS' } };
  if (catId === 'badges') return { ...s, showcase: 'badge', pass: { ...s.pass, role: 'STAFF' } };
  if (catId === 'passes') return { ...s, showcase: 'pass', pass: { ...s.pass, role: 'VIP' } };
  return s;
}

function renderModelThumbs() {
  for (const m of product.models) {
    const s = sanitize(product, { ...defaultState(m.id), kit: 'lanyard' });
    studio.apply(s, product);
    modelThumbs[m.id] = studio.snapshot('front');
  }
  studio.setSize(420, 260);
  for (const c of product.categories) {
    studio.apply(showcaseState(c.id), product);
    catThumbs[c.id] = studio.snapshot(['holders', 'badges', 'passes'].includes(c.id) ? 'front' : 'threeq');
  }
  // Page Catégorie : rendus portrait, le produit occupe la carte.
  studio.setSize(300, 380);
  for (const c of product.categories) {
    studio.apply(showcaseState(c.id), product);
    catBig[c.id] = studio.snapshot(['holders', 'badges', 'passes'].includes(c.id) ? 'front' : c.id === 'wristbands' ? 'threeq' : 'showcase');
  }
  studio.setSize(360, 460);
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
  state.ui.guides = s.id === 'perso';
  $('#logoCta').hidden = !!state.front.logoName || s.id === 'perso';
  if (s.id !== 'view' && state.ui.explode) { state.ui.explode = false; viewer.setExploded(false); }
  $('#stepIndex').textContent = s.n + ' / 12';
  $('#stepTitle').textContent = s.title;
  $('#stepSub').textContent = s.sub || '';
  $('#page-config').dataset.step = s.id;
  if (prev !== step || force) track('configurator_step', { step: s.id });
  renderSteps();
  renderPanel();
  if (prev !== step || force) $('#panelBody').scrollTop = 0;
  renderRail();
  refresh();
  if (prev !== step || force) {
    const view = { model: 'showcase', view: 'front', dims: 'front', attach: 'detail', badge: 'front', material: 'macro', perso: 'macro', print: 'showcase', qty: 'showcase', final: 'showcase' }[s.id];
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
    const ic = (d) => `<i class="si"><svg viewBox="0 0 24 24">${d}</svg></i>`;
    const methods = [...new Set(m.materials.flatMap((x) => product.rules.methodsByMaterial[x]))].map((x) => product.printingMethods.find((y) => y.id === x).name).join(', ');
    html = `<div class="spec-card big"><h3>${m.name}</h3><p>${m.tagline}</p><dl>
        <div>${ic('<path d="M4 7h16M4 12h16M4 17h16"/>')}<span><dt>Matière</dt><dd>${m.materials.map((x) => product.materials.find((y) => y.id === x).name).join(' / ')}</dd></span></div>
        <div>${ic('<path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3"/>')}<span><dt>Largeur</dt><dd>${m.widths.join(' / ')} mm</dd></span></div>
        <div>${ic('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>')}<span><dt>Longueur</dt><dd>${m.lengths.map((l) => l / 10).join(' / ')} cm ou sur mesure</dd></span></div>
        <div>${ic('<path d="M5 19 19 5M8 5h11v11"/>')}<span><dt>Personnalisation</dt><dd>${methods}</dd></span></div>
        <div>${ic('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4"/>')}<span><dt>Utilisation</dt><dd>${m.usage}</dd></span></div></dl></div>
      <p class="note">${product.models.length} modèles : utilisez les vignettes à gauche ou les flèches pour comparer.</p>`;
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
    const tab = state.ui.persoTab || 'logo';
    const tabs = [['logo', 'Logo & texte'], ['position', 'Position'], ['size', 'Taille'], ['rotation', 'Rotation'], ['color', 'Couleur'], ['repeat', 'Répétition']];
    html = `<div class="tabs" role="tablist">${tabs.map(([v, t]) => `<button role="tab" aria-selected="${v === tab}" class="${v === tab ? 'is-on' : ''}" data-k="ui.persoTab" data-v="${v}">${t}</button>`).join('')}</div>`;
    if (state.backMode === 'different') html += group('Face éditée', `<div class="chips">${chip('ui.editSide', 'front', 'Recto', state.ui.editSide)}${chip('ui.editSide', 'back', 'Verso', state.ui.editSide)}</div>`);
    if (tab === 'logo') {
      html += `<div class="drop ${s.logoName ? 'has-logo' : ''}" id="dropZone">
          <button class="import" id="importLogo"><span class="ico"><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4h16v-4"/></svg></span>
            <span><b>${s.logoName ? 'Remplacer le logo' : 'Importer un logo'}</b><small>SVG, PDF, PNG ou JPG · ou glissez-déposez ici</small></span></button>
          ${s.logoName ? `<div class="logo-card"><span class="logo-prev" style="--bg:${state.color}"><img id="logoPrev" alt="Votre logo"></span>
            <span class="meta"><b>${esc(s.logoName)}</b>${(() => { const q = logoQuality(s); return q ? `<em class="q q-${q.level}">Qualité d'impression : ${q.label}</em>` : ''; })()}<small>Appliqué sur le ${k === 'back' ? 'verso' : state.backMode === 'same' ? 'recto et le verso' : 'recto'}${state.kit === 'pass' ? ' et sur le pass' : ''}</small></span>
            <button class="link-btn" id="removeLogo">Retirer</button></div>
            ${toggle(k + '.logoBgRemoved', !!s.logoBgRemoved, 'Retirer le fond blanc', 'Garde uniquement le dessin du logo')}` : ''}
        </div>
        ${toggle(k + '.logoOn', s.logoOn, s.logoName ? 'Afficher mon logo' : 'Afficher le pictogramme SKLUBS')}
        <div class="text-row">${toggle(k + '.textOn', s.textOn, 'Ajouter un texte', 'Nom de marque, événement, slogan')}
          <div class="field"><input type="text" id="artText" data-k="${k}.text" value="${esc(s.text)}" maxlength="28" placeholder="Votre texte" aria-label="Texte imprimé"></div></div>` +
        group("Zones d'impression", `<div class="zones">${[['none', 'Recto', 'front'], ['same', 'Recto + Verso', 'threeq'], ['different', 'Verso différent', 'back']].map(([v, t, view]) => `<button class="zone ${state.backMode === v ? 'is-on' : ''}" data-k="backMode" data-v="${v}"><img data-zone="${view}" alt=""><b>${t}</b></button>`).join('')}</div>`);
    }
    if (tab === 'position') {
      html += group('Mise en page', `<div class="chips">${chip(k + '.mode', 'repeat', 'Répété sur tout le ruban', s.mode)}${chip(k + '.mode', 'single', 'Une fois de chaque côté', s.mode)}</div>`) +
        group(s.mode === 'repeat' ? 'Décalage du motif' : 'Position depuis le bas', range(k + '.offset', s.offset, s.mode === 'repeat' ? 0 : -80, 200, 1, 'mm'), 'Le long du ruban') +
        `<p class="note">Le cadre orange sur le ruban montre la zone occupée par chaque logo.</p>`;
    }
    if (tab === 'size') html += group('Taille du logo', range(k + '.scale', s.scale, 20, 95, 1, '%'), `Hauteur ≈ ${Math.round(state.width * s.scale / 100)} mm sur ${state.width} mm`);
    if (tab === 'rotation') {
      html += group('Rotation', `<div class="chips">${[0, 90, 180, 270].map((r) => chip(k + '.rotation', r, r + '°', s.rotation, 'data-t="num"')).join('')}</div>`) +
        group('Sens de lecture', `<div class="chips">${chip('mirror', 'false', 'Continu', String(state.mirror), 'data-t="bool"')}${chip('mirror', 'true', 'Lisible des deux côtés', String(state.mirror), 'data-t="bool"')}</div>`);
    }
    if (tab === 'color') {
      const tints = [{ name: "Couleurs d'origine", hex: '' }, ...product.colors.filter((c) => ['white', 'black', 'orange'].includes(c.id))];
      html += (s.logoName ? group('Couleur du logo', `<div class="chips">${tints.map((t) => chip(k + '.logoTint', t.hex, t.hex ? `<i class="dot" style="--c:${t.hex}"></i>${t.name}` : t.name, s.logoTint || '')).join('')}</div>`) :
        group('Couleur du pictogramme', swatches(k + '.iconColor', product.colors, s.iconColor))) +
        group('Couleur du texte', swatches(k + '.textColor', product.colors, s.textColor)) +
        group('Liseré', `<div class="chips">${[['', 'Aucun'], [ORANGE, 'Orange'], ['#F4F4F2', 'Blanc'], ['#141414', 'Noir']].map(([v, t]) => chip(k + '.edge', v, t, s.edge || '')).join('')}</div>`, 'Filets le long des bords');
    }
    if (tab === 'repeat') {
      html += group('Répétition', `<div class="chips">${chip(k + '.mode', 'single', 'Simple', s.mode)}${chip(k + '.mode', 'repeat', 'Répété', s.mode)}</div>
          ${s.mode === 'repeat' ? `<div class="field"><label>Espacement (entraxe)</label>${range(k + '.spacing', s.spacing, 30, 250, 1, 'mm')}</div>` : ''}`) +
        group('Aperçu sur 1 mètre', `<canvas class="flat" id="flatFront" width="720" height="64"></canvas><div class="ruler"><span>0</span><span>25</span><span>50</span><span>75</span><span>100 cm</span></div>`, '<span id="pitchOut"></span>');
    }
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
      const tabs = state.kit === 'pass' ? [['holder', 'Porte-badge'], ['badge', 'Badge nominatif'], ['pass', 'Pass VIP']] : state.kit === 'holder' ? [['holder', 'Porte-badge']] : [];
      const bt = tabs.some(([v]) => v === state.ui.badgeTab) ? state.ui.badgeTab : 'holder';
      if (tabs.length > 1) html += `<div class="tabs" role="tablist">${tabs.map(([v, t]) => `<button role="tab" aria-selected="${v === bt}" class="${v === bt ? 'is-on' : ''}" data-k="ui.badgeTab" data-v="${v}">${t}</button>`).join('')}</div>`;
      if (state.kit !== 'lanyard' && bt === 'holder') {
        html += group('Type de porte-badge', `<div class="cards3">${product.holders.filter((h) => h.id !== 'none').map((h) => `<button class="card ${h.id === state.holder ? 'is-on' : ''}" data-k="holder" data-v="${h.id}"><b>${h.name}</b><small>${h.sub}</small></button>`).join('')}</div>`) +
          group('Format', `<div class="chips">${chip('holderOrientation', 'vertical', 'Vertical', state.holderOrientation)}${chip('holderOrientation', 'horizontal', 'Horizontal', state.holderOrientation)}</div>`, 'Carte CR80 · 54 × 86 mm');
      }
      if (state.kit === 'pass' && bt === 'badge') {
        const n = (state.pass.names || '').split('\n').map((x) => x.trim()).filter(Boolean).length;
        html += group('Badge nominatif', `<div class="field"><label for="pName">Nom affiché sur l'aperçu</label><input id="pName" type="text" data-k="pass.name" value="${esc(state.pass.name)}" maxlength="26"></div>
          <div class="field"><label for="pRole">Accès / fonction</label><input id="pRole" type="text" data-k="pass.role" value="${esc(state.pass.role)}" maxlength="16"></div>
          <div class="field"><label for="pNames">Liste des noms (un par ligne)</label><textarea id="pNames" class="names" data-k="pass.names" rows="5" placeholder="Prénom Nom — Fonction">${esc(state.pass.names || '')}</textarea></div>
          <p class="note">${n ? `${n} badge${n > 1 ? 's' : ''} nominatif${n > 1 ? 's' : ''} : la liste est jointe au devis.` : 'Sans liste, tous les pass portent le même texte.'}</p>`);
      }
      if (state.kit === 'pass' && bt === 'pass') {
        html += group('Pass VIP', `<div class="field"><label for="pEvent">Événement</label><input id="pEvent" type="text" data-k="pass.event" value="${esc(state.pass.event)}" maxlength="18"></div>
          <div class="field"><label for="pDate">Dates</label><input id="pDate" type="text" data-k="pass.date" value="${esc(state.pass.date)}" maxlength="24"></div>
          <div class="upload"><button class="btn ghost" id="importPassArt">${state.passArt ? 'Remplacer le visuel du pass' : 'Importer un visuel pour le pass'}</button>
            <span class="file">${state.passArt ? esc(state.passArt.logoName) + ' <button class="link-btn" id="removePassArt">Retirer</button>' : 'Par défaut : le logo du lanyard'}</span></div>
          <div class="field"><label>Couleur d'accent</label>${swatches('pass.accent', product.colors, state.pass.accent)}</div>
          <div class="field"><label>Fond du pass</label>${swatches('pass.bg', product.colors, state.pass.bg)}</div>`, 'Carte CR80 imprimée');
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
      <button class="btn primary wide" id="addProject">Ajouter au projet <span class="arrow">→</span></button>
      <p class="note">Prix estimatifs, validation usine incluse. ${computePrice(product, state).status === 'factory' ? 'Tarifs fournisseur non renseignés : chaque projet est validé et chiffré par l\'usine.' : ''}</p>`;
  }
  if (id === 'final') {
    html = `<h2 class="ready">Votre lanyard est prêt !</h2><dl class="recap">${recap().map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      <div class="final-actions">
        <button class="btn primary" id="addProject">Ajouter au projet <span class="arrow">→</span></button>
        <button class="btn outline" id="quoteBtn">Demander un devis</button>
        <button class="btn outline" id="saveBtn">Sauvegarder mon projet</button>
        <div class="bat-row"><button class="link-btn" id="batView">Voir le BAT</button><button class="link-btn" id="batBtn">Télécharger le BAT (PDF + SVG)</button></div>
      </div>`;
  }
  $('#panelBody').innerHTML = html;
  if (id === 'perso') afterPerso();
  if (id === 'qty') $('#priceBig').innerHTML = bigPrice();
  if (id === 'view') $('#tree').innerHTML = treeHTML();
}

const zoneCache = { key: null, imgs: {} };
function afterPerso() {
  const s = state[sideKey()];
  const prev = $('#logoPrev');
  if (prev && s.logoImage) prev.src = s.logoImage.toDataURL ? s.logoImage.toDataURL() : s.logoImage.src;
  if ((state.ui.persoTab || 'logo') === 'repeat') drawFlat();
  const imgs = $$('[data-zone]');
  if (!imgs.length) return;
  const key = viewer.keys.art + state.backMode;
  const fill = () => imgs.forEach((im) => { im.src = zoneCache.imgs[im.dataset.zone] || ''; });
  if (zoneCache.key === key) return fill();
  requestIdle(() => {
    studio.setSize(240, 300);
    studio.apply({ ...state, kit: 'lanyard', ui: { ...state.ui, guides: false, dims: false } }, product);
    for (const v of ['front', 'threeq', 'back']) zoneCache.imgs[v] = studio.snapshot(v === 'front' ? 'macro' : v);
    studio.setSize(360, 460);
    zoneCache.key = key;
    if (STEPS[step].id === 'perso') fill();
  });
}

// Import d'un logo (bouton, glisser-déposer, raccourcis) : rastérisé, fond blanc retiré si détecté.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = PDFJS + 'pdf.min.js';
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; resolve(window.pdfjsLib); };
    sc.onerror = () => reject(new Error('pdf.js indisponible'));
    document.head.appendChild(sc);
  });
}

// PDF (logo vectoriel) : première page rendue en haute définition.
async function pdfToCanvas(file) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await doc.getPage(1);
  const v0 = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 2048 / Math.max(v0.width, v0.height) });
  const c = document.createElement('canvas');
  c.width = Math.round(viewport.width); c.height = Math.round(viewport.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport, background: 'rgba(0,0,0,0)' }).promise;
  return c;
}

function applyLogo(raster, name, dataUrl, vector, goPerso) {
  const s = state[sideKey()];
  const light = hasLightBackground(raster);
  s.logoSrc = raster; s.logoBgRemoved = light;
  s.logoImage = light ? removeLightBackground(raster) : raster;
  // Le texte d'exemple « SKLUBS » laisse la place au logo du client.
  if (!s.logoName && s.text === 'SKLUBS') { s.textOn = false; s.scale = Math.max(s.scale, 72); }
  s.logoName = name; s.logoData = dataUrl; s.logoOn = true; s.logoVector = vector;
  state.logoVersion++;
  if (goPerso || currentPage !== 'config' || STEPS[step].id !== 'perso') { state.ui.persoTab = 'logo'; step = STEPS.findIndex((x) => x.id === 'perso'); go('config'); }
  else { refresh(); renderPanel(); viewer.setView('macro'); }
  $('#logoCta').hidden = true;
  const q = logoQuality(s);
  track('artwork_uploaded', { vector, background_removed: light, quality: q.level });
  toast(q.level === 'low' ? `Logo importé, mais sa résolution est faible (${q.dpi} dpi) : envoyez un SVG ou une image plus grande pour une impression nette.`
    : light ? 'Logo importé, fond blanc retiré. Il se répète sur le ruban.' : 'Logo importé : il se répète sur le ruban.');
}

function loadLogoFile(f, { goPerso = false } = {}) {
  if (!f) return;
  const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  if (!isPdf && !/^image\/(png|jpe?g|svg\+xml)$/.test(f.type)) { toast('Format non pris en charge. Utilisez un SVG, PDF, PNG ou JPG.'); return; }
  if (f.size > 15 * 1024 * 1024) { toast('Fichier trop lourd (15 Mo maximum).'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    if (isPdf) {
      try { applyLogo(await pdfToCanvas(f), f.name, reader.result, true, goPerso); }
      catch { toast('PDF illisible. Essayez un SVG ou un PNG.'); }
      return;
    }
    const img = new Image();
    const vector = f.type === 'image/svg+xml';
    img.onload = () => applyLogo(rasterizeLogo(img, vector ? 2048 : 1600), f.name, reader.result, vector, goPerso);
    img.onerror = () => toast('Image illisible. Utilisez un SVG, PDF, PNG ou JPG.');
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
}

// Qualité d'impression : pixels du logo / hauteur imprimée.
function logoQuality(s = state[sideKey()]) {
  if (!s.logoImage) return null;
  if (s.logoVector) return { level: 'vector', dpi: null, label: 'Vectoriel : impression nette à toutes les tailles' };
  const across = s.rotation === 90 || s.rotation === 270;
  const mm = state.width * (s.scale / 100) * 0.86;
  const px = across ? s.logoImage.width : s.logoImage.height;
  const dpi = Math.round(px / (mm / 25.4));
  if (dpi >= 300) return { level: 'good', dpi, label: `Excellente (${dpi} dpi)` };
  if (dpi >= 150) return { level: 'ok', dpi, label: `Suffisante (${dpi} dpi)` };
  return { level: 'low', dpi, label: `Faible (${dpi} dpi) : risque de flou, fournissez un SVG, un PDF ou une image plus grande` };
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

function showHero(i) {
  const cats = product.categories;
  heroCat = (i + cats.length) % cats.length;
  const c = cats[heroCat];
  const framing = { lanyards: [0.2, 0.74], keystraps: [0.05, 0.95], wristbands: [0, 1.45] }[c.id] || [0, 1.25];
  hero.heroFocus = framing[0]; hero.heroZoom = framing[1];
  hero.heroTilt = ['holders', 'badges', 'passes'].includes(c.id) ? { x: -0.15, y: -0.5, z: 0.12 } : c.id === 'wristbands' ? { x: 0.5, y: -0.4, z: 0.2 } : null;
  hero.apply(showcaseState(c.id), product);
  hero.setView('hero', true);
  $('#heroIndex').textContent = String(heroCat + 1).padStart(2, '0');
  $('#heroTotal').textContent = String(cats.length).padStart(2, '0');
  $('#heroModel').textContent = c.name + (c.active ? '' : ' · bientôt');
  $$('#homeCats .cat').forEach((b) => b.classList.toggle('is-on', b.dataset.cat === c.id));
}

function renderCategories() {
  const svg = {
    wristbands: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="16" ry="9"/><ellipse cx="24" cy="27" rx="16" ry="9"/></svg>',
    holders: '<svg viewBox="0 0 48 48"><rect x="13" y="10" width="22" height="30" rx="3"/><path d="M20 15h8"/></svg>',
    badges: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14"/><path d="M24 15c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11Z"/></svg>',
    passes: '<svg viewBox="0 0 48 48"><rect x="14" y="8" width="20" height="32" rx="3"/><path d="M19 30h10M21 13h6"/></svg>',
  };
  const card = (c, big) => `<button class="cat ${c.active ? '' : 'soon'} ${big ? 'big' : ''} ${!big && product.categories[heroCat]?.id === c.id ? 'is-on' : ''}" data-cat="${c.id}" ${c.active ? '' : 'aria-disabled="true"'}>
      <span class="thumb">${(big ? catBig : catThumbs)[c.id] ? `<img src="${(big ? catBig : catThumbs)[c.id]}" alt="">` : svg[c.id] || ''}</span>
      <b>${c.name}</b>${big ? `<small>${c.active ? c.sub : 'Bientôt'}</small>` : ''}</button>`;
  $('#catGrid').innerHTML = product.categories.map((c) => card(c, true)).join('');
  $('#homeCats').innerHTML = product.categories.map((c) => card(c, false)).join('');
}

// ---------- Projet ----------
function serializable() {
  const strip = (s) => { const { logoImage, logoSrc, ...r } = s; return r; };
  return { ...state, front: strip(state.front), back: strip(state.back), passArt: undefined, ui: undefined };
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

function exportProject(proj = buildProject()) {
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

// ---------- BAT ----------
const projectRef = () => (state.ref ||= 'SK-' + Date.now().toString(36).toUpperCase());
function makeBAT() {
  return buildBAT({ state, product, drop: viewer.strap.drop, preview: viewer.snapshot(), ref: projectRef() });
}

async function downloadBAT() {
  const bat = makeBAT();
  if (window.SKLUBS_PREVIEW) return showBAT(bat);
  toast('Préparation du BAT…');
  download(`BAT-${projectRef()}.svg`, bat.svg, 'image/svg+xml');
  try { download(`BAT-${projectRef()}.pdf`, await batPDF(bat), 'application/pdf'); toast('BAT téléchargé (PDF + SVG).'); }
  catch { toast('BAT SVG téléchargé. Le PDF nécessite une connexion.'); }
  track('bat_downloaded');
}

async function showBAT(bat = makeBAT()) {
  modal('Bon à tirer (BAT)', '<p class="note">Ruban à plat à l\'échelle 1, recto / verso, cotes et spécifications.</p><div class="bat-view" id="batView">Préparation…</div>');
  const c = await svgToCanvas(bat.svg, bat.width, bat.height, 4);
  const img = new Image(); img.src = c.toDataURL('image/png'); img.alt = 'BAT du lanyard';
  $('#batView').replaceChildren(img);
}

// ---------- Devis ----------
function openQuote() {
  const f = store.get('sklubs-contact') || {};
  modal('Demander un devis', `<div class="quote" id="quoteForm">
      <p class="note">Votre configuration, le BAT et votre logo sont joints à la demande. Réponse de l'équipe SKLUBS avec le prix usine.</p>
      <div class="field two"><div><label for="qName">Nom *</label><input id="qName" name="name" type="text" required value="${esc(f.name)}" autocomplete="name"></div>
        <div><label for="qCompany">Société</label><input id="qCompany" name="company" type="text" value="${esc(f.company)}" autocomplete="organization"></div></div>
      <div class="field two"><div><label for="qEmail">E-mail *</label><input id="qEmail" name="email" type="email" required value="${esc(f.email)}" autocomplete="email"></div>
        <div><label for="qPhone">Téléphone</label><input id="qPhone" name="phone" type="tel" value="${esc(f.phone)}" autocomplete="tel"></div></div>
      <div class="field two"><div><label for="qDate">Date de l'événement</label><input id="qDate" name="eventDate" type="date" value="${esc(f.eventDate)}"></div>
        <div><label for="qQty">Quantité</label><input id="qQty" name="quantity" type="number" min="1" value="${state.quantity}"></div></div>
      <div class="field"><label for="qMsg">Message</label><textarea id="qMsg" name="message" rows="3" placeholder="Délais, livraison, questions…">${esc(f.message)}</textarea></div>
      <div class="hp" aria-hidden="true"><label for="qWebsite">Site web</label><input id="qWebsite" name="website" type="text" tabindex="-1" autocomplete="off"></div>
      <p class="form-error" id="qError" hidden></p>
    </div>`, '<button class="btn primary" id="sendQuote" value="send">Envoyer la demande <span class="arrow">→</span></button>');
  $('#sendQuote').onclick = (e) => { e.preventDefault(); sendQuote(); };
  track('quote_form_opened');
}

function quoteSummary(contact, proj) {
  const lines = recap().map(([a, b]) => `${a} : ${b}`);
  return [`Demande de devis ${proj.reference}`, '', `Nom : ${contact.name}`, `Société : ${contact.company || '—'}`, `E-mail : ${contact.email}`,
    `Téléphone : ${contact.phone || '—'}`, `Date de l'événement : ${contact.eventDate || '—'}`, '', ...lines, '', `Message : ${contact.message || '—'}`].join('\n');
}

async function sendQuote() {
  const form = $('#quoteForm');
  const data = Object.fromEntries([...form.querySelectorAll('[name]')].map((i) => [i.name, i.value.trim()]));
  const err = $('#qError');
  if (!data.name?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email || '')) {
    err.textContent = 'Indiquez votre nom et une adresse e-mail valide.'; err.hidden = false; return;
  }
  state.quantity = Math.max(1, Math.round(Number(data.quantity) || state.quantity));
  store.set('sklubs-contact', { ...data, quantity: undefined });
  const proj = { ...buildProject(), reference: projectRef(), contact: data };
  const q = CONFIG.quote;
  const btn = $('#sendQuote');
  const offline = () => {
    $('#modal').close();
    exportProject(proj);
    if (!window.SKLUBS_PREVIEW) downloadBAT();
    track('quote_requested', { mode: 'download' });
  };
  const ready = q.provider === 'wordpress' ? !!q.endpoint : !!q.accessKey;
  if (!ready || window.SKLUBS_PREVIEW) {
    offline();
    if (!window.SKLUBS_PREVIEW) toast("Envoi en ligne pas encore activé : votre dossier est téléchargé, envoyez-le à l'équipe SKLUBS.");
    return;
  }
  btn.disabled = true; btn.textContent = 'Envoi…';
  try {
    const { preview_image, logo_files, ...light } = proj;
    const blob = async (url) => (await fetch(url)).blob();
    const fd = new FormData();
    fd.append('name', data.name); fd.append('email', data.email);
    if (q.provider === 'wordpress') {
      for (const k of ['company', 'phone', 'message', 'quantity']) fd.append(k, data[k] || '');
      fd.append('event_date', data.eventDate || '');
      fd.append('website', data.website || '');
      fd.append('reference', proj.reference);
      fd.append('summary', recap().map(([a, b]) => `${a} : ${b}`).join('\n'));
      fd.append('configuration', JSON.stringify(light));
      const bat = makeBAT();
      fd.append('bat', await batPDF(bat), `BAT-${proj.reference}.pdf`);
      fd.append('bat_svg', new Blob([bat.svg], { type: 'image/svg+xml' }), `BAT-${proj.reference}.svg`);
      fd.append('preview', await blob(preview_image), `apercu-${proj.reference}.png`);
      const [front, back] = [state.front, state.back];
      if (front.logoData) fd.append('logo', await blob(front.logoData), front.logoName);
      if (state.backMode === 'different' && back.logoData) fd.append('logo_back', await blob(back.logoData), back.logoName);
      if (state.kit === 'pass' && state.passArt?.logoData) fd.append('pass_art', await blob(state.passArt.logoData), state.passArt.logoName);
    } else {
      if (q.provider === 'web3forms') { fd.append('access_key', q.accessKey); fd.append('from_name', 'Configurateur SKLUBS'); }
      fd.append('subject', `${q.subject} — ${data.company || data.name} (${proj.reference})`);
      fd.append('message', quoteSummary(data, proj));
      fd.append('configuration_json', JSON.stringify(light, null, 2));
      if (q.attachFiles) {
        fd.append('attachment', await batPDF(makeBAT()), `BAT-${proj.reference}.pdf`);
        fd.append('attachment_preview', await blob(preview_image), `apercu-${proj.reference}.png`);
        for (const l of logo_files) if (l.data_url) fd.append('attachment_logo', await blob(l.data_url), l.name);
      }
    }
    const res = await fetch(q.endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
    const out = await res.json().catch(() => ({}));
    if (res.status === 404) { offline(); toast("Le service de devis n'est pas encore installé : votre dossier est téléchargé, envoyez-le à l'équipe SKLUBS."); return; }
    if (!res.ok) throw Object.assign(new Error(out.message || res.status), { userMessage: out.message });
    $('#modal').close();
    const ref = out.reference || proj.reference;
    toast(`Demande ${ref} envoyée. Un e-mail de confirmation vous a été adressé.`);
    track('quote_requested', { mode: q.provider, reference: ref });
  } catch (e) {
    btn.disabled = false; btn.innerHTML = 'Envoyer la demande <span class="arrow">→</span>';
    err.textContent = e.userMessage || "L'envoi a échoué. Vérifiez votre connexion et réessayez."; err.hidden = false;
  }
}

// ---------- Analytics ----------
function track(event, params = {}) {
  if (!CONFIG.analytics) return;
  (window.dataLayer ||= []).push({ event, product: 'lanyard', model: state?.model, ...params });
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
  track('lanyard_model_selected', { model_id: id });
  const keep = { color: state.color, front: state.front, back: state.back, backMode: state.backMode, pass: state.pass, quantity: state.quantity, hardwareColor: state.hardwareColor, hardwareHex: state.hardwareHex, logoVersion: state.logoVersion, ui: state.ui };
  state = sanitize(product, { ...defaultState(id), ...keep });
  refresh();
  renderPanel();
  renderRail();
  viewer.transition();
  viewer.setView(STEPS[step].id === 'model' ? 'showcase' : 'front');
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
      track('event_category_selected', { category: c.id });
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
      const ev = { width: 'lanyard_width_selected', length: 'lanyard_length_selected', material: 'lanyard_material_selected', color: 'lanyard_color_selected', method: 'print_method_selected', attachment: 'attachment_selected', holder: 'holder_selected', kit: 'kit_selected', backMode: 'print_sides_selected' }[t.dataset.k];
      if (ev) track(ev, { value: t.dataset.v });
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
      case 'nextBtn': if (step === STEPS.length - 1) openQuote(); else setStep(step + 1); break;
      case 'backBtn': if (step === 0) go('category'); else setStep(step - 1); break;
      case 'prevModel': case 'nextModel': {
        const ids = product.models.map((m) => m.id), i = ids.indexOf(state.model);
        selectModel(ids[(i + (t.id === 'nextModel' ? 1 : -1) + ids.length) % ids.length]); break;
      }
      case 'heroNext': showHero(heroCat + 1); break;
      case 'importLogo': $('#logoFile').click(); break;
      case 'importPassArt': $('#passFile').click(); break;
      case 'removePassArt': state.passArt = null; state.logoVersion++; refresh(); renderPanel(); break;
      case 'logoCta': case 'heroLogo': logoIntent = true; $('#logoFile').click(); break;
      case 'removeLogo': { const s = state[sideKey()]; s.logoImage = null; s.logoSrc = null; s.logoName = null; s.logoData = null; s.logoTint = ''; state.logoVersion++; refresh(); renderPanel(); $('#logoCta').hidden = STEPS[step].id === 'perso'; break; }
      case 'addProject': {
        const items = store.get(PROJECT_KEY) || [];
        items.push({ title: modelOf(product, state.model).name, spec: `${state.width} mm × ${state.length / 10} cm · ${state.quantity} pcs`, thumb: viewer.snapshot(), config: serializable() });
        if (!store.set(PROJECT_KEY, items)) { items.at(-1).thumb = ''; store.set(PROJECT_KEY, items); }
        updateBag(); toast('Ajouté à votre projet.'); track('project_added'); break;
      }
      case 'quoteBtn': openQuote(); break;
      case 'batBtn': downloadBAT(); break;
      case 'batView': showBAT(); break;
      case 'saveBtn': store.set(STORE_KEY, serializable()); exportProject(); if (!window.SKLUBS_PREVIEW) toast('Projet enregistré sur cet appareil et téléchargé.'); break;
      case 'bagBtn': showProject(); break;
      case 'resumeBtn': {
        const saved = store.get(STORE_KEY);
        if (saved) { state = sanitize(product, { ...defaultState(saved.model), ...saved, front: { ...defaultState().front, ...saved.front }, back: { ...defaultState().back, ...saved.back }, ui: { dims: false, explode: false, editSide: 'front', persoTab: 'logo', guides: false } }); }
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
    if (k.endsWith('.logoBgRemoved')) { const sd = state[k.split('.')[0]]; if (sd.logoSrc) sd.logoImage = v ? removeLightBackground(sd.logoSrc) : sd.logoSrc; state.logoVersion++; }
    const out = $(`[data-out="${k}"]`);
    if (out) out.textContent = `${v} ${out.textContent.split(' ').slice(1).join(' ')}`;
    refresh();
    if (el.type === 'checkbox' || (e.type === 'change' && el.type !== 'range' && el.type !== 'text')) renderPanel();
  };
  document.addEventListener('input', onInput);
  document.addEventListener('change', (e) => { if (e.target.type === 'checkbox' || e.target.type === 'color' || e.target.id === 'hwCustom') onInput(e); });

  $('#passFile').addEventListener('change', (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f || !/^image\/(png|jpe?g|svg\+xml)$/.test(f.type)) { if (f) toast('Utilisez un SVG, PNG ou JPG pour le pass.'); return; }
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const c = rasterizeLogo(img, 1200); state.passArt = { logoImage: hasLightBackground(c) ? removeLightBackground(c) : c, logoName: f.name, logoData: r.result }; state.logoVersion++; refresh(); renderPanel(); toast('Visuel du pass importé.'); }; img.src = r.result; };
    r.readAsDataURL(f);
  });
  $('#logoFile').addEventListener('change', (e) => { loadLogoFile(e.target.files[0], { goPerso: logoIntent }); logoIntent = false; e.target.value = ''; });

  // Glisser-déposer un logo n'importe où sur la page
  let depth = 0;
  const hasFile = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragenter', (e) => { if (!hasFile(e)) return; e.preventDefault(); depth++; document.body.classList.add('dragging'); });
  document.addEventListener('dragover', (e) => { if (hasFile(e)) e.preventDefault(); });
  document.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('dragging'); });
  document.addEventListener('drop', (e) => {
    if (!hasFile(e)) return;
    e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
    loadLogoFile(e.dataTransfer.files[0], { goPerso: true });
  });
}
let logoIntent = false;

// ---------- Mobile : panneau en bottom sheet (réduit, moitié, plein écran) ----------
const SHEET = ['peek', 'half', 'full'];
const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
function setSheet(v) {
  const p = $('#panel');
  p.dataset.sheet = v;
  if (viewer) viewer.setInset(isMobile() ? (v === 'peek' ? 168 : Math.round(window.innerHeight * 0.52)) - 24 : 0);
  $('#sheetHandle').setAttribute('aria-label', v === 'full' ? 'Réduire le panneau' : 'Agrandir le panneau');
}
function bindSheet() {
  setSheet('half');
  const h = $('#sheetHandle');
  let y0 = null, moved = false;
  h.addEventListener('pointerdown', (e) => { y0 = e.clientY; moved = false; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', (e) => { if (y0 !== null && Math.abs(e.clientY - y0) > 12) moved = true; });
  h.addEventListener('pointerup', (e) => {
    const i = SHEET.indexOf($('#panel').dataset.sheet);
    if (moved) setSheet(SHEET[Math.max(0, Math.min(2, i + (e.clientY < y0 ? 1 : -1)))]);
    else setSheet(SHEET[(i + 1) % 3]);
    y0 = null;
  });
  // Choisir une option en plein écran redescend le panneau pour montrer le résultat en 3D.
  $('#panelBody').addEventListener('click', (e) => {
    if (isMobile() && $('#panel').dataset.sheet === 'full' && e.target.closest('[data-k][data-v], [data-model]')) setSheet('half');
  });
}

function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (!webglAvailable()) {
  const l0 = document.getElementById('loading'); l0.classList.add('fatal'); document.body.appendChild(l0);
  l0.innerHTML = '<b>La 3D ne peut pas s\'afficher sur cet appareil.</b><span>Activez l\'accélération graphique du navigateur ou essayez Chrome, Safari ou Firefox à jour.</span>';
} else {
  init().catch((err) => {
    console.error(err);
    const l = document.getElementById('loading');
    if (l) l.innerHTML = '<b>Le configurateur n\'a pas pu se charger.</b><span>Vérifiez votre connexion puis rechargez la page.</span><button class="btn primary small" onclick="location.reload()">Recharger</button>';
    if (l) { l.classList.remove('hidden'); l.classList.add('fatal'); document.body.appendChild(l); }
    (window.dataLayer ||= []).push({ event: 'configurator_error', message: String(err?.message || err) });
  });
}
