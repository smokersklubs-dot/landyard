// Pièces modulaires du lanyard (millimètres). Chaque constructeur renvoie
// { group, bottom } : l'origine du groupe est le point d'accroche haut, `bottom`
// le point où s'accroche la pièce suivante (pendue vers -Y).
// Un fichier GLB pourra remplacer chaque pièce plus tard (champ `model` du produit).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const mesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; if (name) m.name = name; return m; };
const tube = (pts, r, mat, closed = false, seg = 96) =>
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), seg, r, 14, closed), mat);
const torus = (R, r, mat) => mesh(new THREE.TorusGeometry(R, r, 14, 48), mat);
const rbox = (w, h, d, r, mat) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)), mat);

function roundedRectShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function roundedRectPath(w, h, r, cx, cy) {
  const p = new THREE.Path(), x = cx - w / 2, y = cy - h / 2;
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}
const extrude = (shape, depth, mat, bevel = 0.4) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 18 });
  g.translate(0, 0, -depth / 2);
  return mesh(g, mat);
};

// Anneau d'accroche perpendiculaire (plan YZ), sommet de la ligne médiane à l'origine.
function eye(R, r, mat) {
  const t = torus(R, r, mat);
  t.rotation.y = Math.PI / 2;
  t.position.y = -R;
  return t;
}
function swivel(y, mat) {
  const pts = [V(0, 0), V(2.4, 0), V(2.8, -0.6), V(2.8, -4), V(3.6, -4.6), V(3.6, -7.4), V(2.6, -8.2), V(0, -8.2)].map((p) => new THREE.Vector2(p.x, p.y));
  const m = mesh(new THREE.LatheGeometry(pts, 28), mat);
  m.position.y = y;
  return m;
}

// ---------- Extrémités du ruban ----------
export function crimp(width, mats, { ring: withRing = true } = {}) {
  const g = new THREE.Group();
  const body = rbox(width + 3.4, 13, 4.4, 1.4, mats.metal);
  body.position.y = -3.5;
  g.add(body);
  if (!withRing) return { group: g, bottom: null };
  const ring = torus(4.2, 0.95, mats.metal);
  ring.position.y = -10 - 4.2 + 1;
  g.add(ring);
  return { group: g, bottom: V(0, -10 - 8.4 + 1) };
}

export function buckle(width, mats) {
  const g = new THREE.Group();
  const w = width + 7;
  const fem = rbox(w, 24, 7.8, 2.2, mats.plastic); fem.position.y = -9; g.add(fem);
  const mouth = rbox(w - 3, 2, 5.4, 0.8, mats.plasticDark); mouth.position.y = -20.4; g.add(mouth);
  for (const sx of [-1, 1]) { const tab = rbox(3, 9, 4.6, 1, mats.plastic); tab.position.set(sx * (w / 2 + 0.6), -14, 0); g.add(tab); }
  const male = rbox(w - 5, 13, 5.2, 1.6, mats.plastic); male.position.y = -27.5; g.add(male);
  const ring = torus(4, 1.3, mats.plastic); ring.position.y = -34 - 3; g.add(ring);
  return { group: g, bottom: V(0, -34 - 7 + 1.3) };
}

// Safety breakaway (nuque) : deux demi-coques autour du ruban. Construit dans le repère (W, N, T).
export function breakaway(width, mats) {
  const g = new THREE.Group();
  const halves = [];
  for (const s of [-1, 1]) {
    const h = rbox(width + 3.6, 5.2, 11, 1.6, mats.plastic);
    h.position.z = s * 6.2;
    const lip = rbox(width + 1.2, 5.6, 1.2, 0.4, mats.plasticDark);
    lip.position.z = s * 0.7;
    const part = new THREE.Group(); part.add(h, lip);
    part.userData.dir = s;
    g.add(part); halves.push(part);
  }
  g.userData.halves = halves;
  return { group: g };
}

// ---------- Attaches ----------
export function snaphook(mats) {
  const g = new THREE.Group();
  g.add(eye(5.6, 1.35, mats.metal));
  g.add(swivel(-10.6, mats.metal));
  const body = [V(-1.6, -18.5), V(-3.2, -24), V(-5.6, -36), V(-6.4, -46), V(-4, -53), V(1.5, -55), V(6.2, -51.5), V(7.4, -45), V(7, -38.5), V(5.2, -36.4)];
  g.add(tube(body, 2.25, mats.metal));
  const nose = mesh(new THREE.SphereGeometry(2.25, 16, 12), mats.metal); nose.position.copy(body[body.length - 1]); g.add(nose);
  const top = rbox(8, 5, 5, 1.6, mats.metal); top.position.y = -19.5; g.add(top);
  g.add(tube([V(2, -21.5, 0), V(4.6, -29, 0), V(5.8, -35.4, 0)], 1.05, mats.metal, false, 24));
  const trig = rbox(3.2, 9, 3, 1.1, mats.metal); trig.position.set(4.2, -24.5, 0); trig.rotation.z = 0.35; g.add(trig);
  return { group: g, bottom: V(0.6, -53.2) };
}

export function swivelHook(mats) {
  const g = new THREE.Group();
  g.add(eye(4.2, 1.05, mats.metal));
  g.add(swivel(-8, mats.metal));
  const j = [V(0, -15.6), V(0, -22), V(-0.6, -30), V(1.2, -36.5), V(5.2, -38), V(8.6, -34.5), V(8.8, -29), V(8.2, -25.5)];
  g.add(tube(j, 1.6, mats.metal));
  const tip = mesh(new THREE.SphereGeometry(1.6, 14, 10), mats.metal); tip.position.copy(j[j.length - 1]); g.add(tip);
  g.add(tube([V(0.4, -17.5), V(4.6, -20.6), V(7.9, -24.4)], 0.55, mats.metal, false, 16));
  return { group: g, bottom: V(4.6, -36.4) };
}

export function plasticClip(width, mats) {
  const g = new THREE.Group();
  const w = Math.max(width + 5, 16);
  const outer = roundedRectShape(w, 10, 2.5, 0, -5);
  outer.holes.push(roundedRectPath(w - 5, 3.2, 1.2, 0, -4.6));
  g.add(extrude(outer, 3, mats.plastic, 0.5));
  const stem = rbox(6, 14, 3.4, 1.4, mats.plastic); stem.position.y = -15; g.add(stem);
  const j = tube([V(0, -21), V(-0.5, -30), V(2.5, -37), V(8, -37.5), V(10.5, -32), V(9.8, -26.5)], 2.1, mats.plastic);
  j.scale.z = 1.4; g.add(j);
  return { group: g, bottom: V(4.8, -35.5) };
}

export function keyring(mats) {
  const g = new THREE.Group();
  const pts = [], R = 12.5;
  for (let k = 0; k <= 180; k++) {
    const a = (k / 180) * Math.PI * 3.6;
    pts.push(V((k / 180 - 0.5) * 2.1, -R + R * Math.cos(a), R * Math.sin(a)));
  }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 260, 0.85, 10), mats.metal));
  return { group: g, bottom: V(0, -2 * R) };
}

export function doubleAttach(mats) {
  const g = new THREE.Group();
  const a = swivelHook(mats); a.group.position.x = -2.5; a.group.rotation.z = -0.12; g.add(a.group);
  const b = keyring(mats); b.group.position.x = 3.5; b.group.rotation.z = 0.35; b.group.scale.setScalar(0.8); g.add(b.group);
  return { group: g, bottom: a.bottom.clone().applyAxisAngle(V(0, 0, 1), -0.12).add(V(-2.5, 0)) };
}

export function phonePatch(mats) {
  const g = new THREE.Group();
  g.add(eye(4, 1, mats.metal));
  g.add(tube([V(-1.6, -7.6), V(-2.4, -14), V(0, -19), V(2.4, -14), V(1.6, -7.6)], 1.3, mats.cord, false, 40));
  const card = extrude(roundedRectShape(46, 34, 5, 0, 0), 0.7, mats.patch, 0.2);
  card.position.y = -19 - 17; g.add(card);
  const hole = rbox(9, 3, 1.4, 0.6, mats.plasticDark); hole.position.y = -21.5; g.add(hole);
  return { group: g, bottom: null };
}

export function buildAttachment(id, width, mats) {
  switch (id) {
    case 'snaphook': return snaphook(mats);
    case 'swivel': return swivelHook(mats);
    case 'plasticclip': return plasticClip(width, mats);
    case 'keyring': return keyring(mats);
    case 'double': return doubleAttach(mats);
    case 'phone': return phonePatch(mats);
    default: return null;
  }
}

// ---------- Porte-badges + pass ----------
// Carte CR80 : l'origine est au centre de la carte.
export function card(front, back, dims, horizontal, mats) {
  const w = horizontal ? dims.heightMM : dims.widthMM, h = horizontal ? dims.widthMM : dims.heightMM, d = dims.thicknessMM;
  const g = new THREE.Group();
  const shape = roundedRectShape(w, h, 3.2);
  const edge = mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 10 }), mats.cardEdge);
  edge.position.z = -d / 2; g.add(edge);
  const face = (tex, z, flip) => {
    const geo = new THREE.ShapeGeometry(shape, 10);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (flip ? w / 2 - pos.getX(i) : pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
    const m = mesh(geo, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 }));
    m.position.z = z;
    if (flip) m.rotation.y = Math.PI;
    return m;
  };
  g.add(face(front, d / 2 + 0.02, false));
  g.add(face(back, -d / 2 - 0.02, true));
  g.userData.size = { w, h };
  return g;
}

// Renvoie { group, cardAt } : origine = fente d'accroche, cardAt = centre de la carte.
export function holder(id, horizontal, dims, mats) {
  const cw = horizontal ? dims.heightMM : dims.widthMM, ch = horizontal ? dims.widthMM : dims.heightMM;
  const g = new THREE.Group();
  const slotY = -5.5;
  if (id === 'pvcsoft') {
    const W = cw + 9, H = ch + 16;
    const s = roundedRectShape(W, H, 3, 0, -H / 2);
    s.holes.push(roundedRectPath(15, 3.6, 1.8, 0, slotY));
    const sheet = extrude(s, 1.2, mats.clear, 0.15);
    g.add(sheet);
    const zip = mesh(new THREE.BoxGeometry(W - 1, 2.2, 1.5), mats.clearFrost); zip.position.y = -11.5; g.add(zip);
    return { group: g, cardAt: V(0, -H / 2 - 5, 0) };
  }
  if (id === 'pvcrigid') {
    const W = cw + 6, H = ch + 14;
    const s = roundedRectShape(W, H, 4, 0, -H / 2);
    s.holes.push(roundedRectPath(14, 3.4, 1.7, 0, slotY));
    const shell = extrude(s, 3.6, mats.clearRigid, 0.6);
    g.add(shell);
    const lip = mesh(new THREE.BoxGeometry(W - 4, 1.2, 4.2), mats.clearFrost); lip.position.y = -H + 2.5; g.add(lip);
    return { group: g, cardAt: V(0, -H / 2 - 3.5, 0) };
  }
  if (id === 'leather') {
    const W = cw + 12, H = ch + 20;
    const s = roundedRectShape(W, H, 5, 0, -H / 2);
    s.holes.push(roundedRectPath(14, 3.6, 1.8, 0, slotY));
    s.holes.push(roundedRectPath(cw - 8, ch - 14, 3, 0, -H / 2 - 5));
    const front = extrude(s, 1.8, mats.leather, 0.5); front.position.z = 1.6; g.add(front);
    const bs = roundedRectShape(W, H, 5, 0, -H / 2); bs.holes.push(roundedRectPath(14, 3.6, 1.8, 0, slotY));
    const back = extrude(bs, 1.8, mats.leather, 0.5); back.position.z = -1.6; g.add(back);
    // surpiqûre
    const st = roundedRectShape(W - 5, H - 5, 3.5, 0, -H / 2).getPoints(80).map((p) => V(p.x, p.y, 2.95));
    const stitch = new THREE.Line(new THREE.BufferGeometry().setFromPoints(st), new THREE.LineDashedMaterial({ color: '#e8d9c4', dashSize: 1.6, gapSize: 1.1 }));
    stitch.computeLineDistances(); g.add(stitch);
    return { group: g, cardAt: V(0, -H / 2 - 5, 0) };
  }
  return null;
}
