// Ruban textile paramétrique : ligne médiane 3D + section (plate ou tubulaire).
// Unités : millimètres. Le ruban est une seule bande continue dont les deux
// extrémités se rejoignent en bas (embout / boucle). u = abscisse curviligne / L.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export const NECK = { rx: 66, rz: 56, shoulder: 0.6 * Math.PI };

// Points de contrôle de la pose « tour de cou » pour une hauteur de chute D.
function neckPoints(D, stack) {
  const { rx, rz, shoulder: a } = NECK;
  const zc = rz + 26;
  const ring = (phi) => new THREE.Vector3(rx * Math.sin(phi), 14 * (1 - Math.cos(phi)) / 2, rz * Math.cos(phi));
  const left = [
    new THREE.Vector3(0, -D, zc + stack),
    new THREE.Vector3(-1, -D + 18, zc + stack),
    new THREE.Vector3(-rx * 0.42, -D * 0.6, zc + 2),
    new THREE.Vector3(-rx * 0.8, -D * 0.22 - 4, rz * 0.62 + 8),
  ];
  const pts = [...left];
  const n = 8;
  for (let i = 0; i <= n; i++) pts.push(ring(-a - (i / n) * (2 * Math.PI - 2 * a)));
  for (let i = left.length - 1; i >= 0; i--) {
    const p = left[i];
    pts.push(new THREE.Vector3(-p.x, p.y, i < 2 ? zc - stack : p.z));
  }
  return pts;
}

// Pose « dragonne / porte-clés » : boucle en goutte dans le plan XY.
function wristPoints(D, stack) {
  const left = [
    new THREE.Vector3(0, -D, stack),
    new THREE.Vector3(-1, -D + Math.min(14, D * 0.12), stack),
    new THREE.Vector3(-D * 0.2, -D * 0.55, 2),
    new THREE.Vector3(-D * 0.22, -D * 0.2, 1),
  ];
  const pts = [...left, new THREE.Vector3(0, 0, 0)];
  for (let i = left.length - 1; i >= 0; i--) {
    const p = left[i];
    pts.push(new THREE.Vector3(-p.x, p.y, i < 2 ? -stack : p.z));
  }
  return pts;
}

// Pose « bracelet » : anneau vertical, extrémités superposées en bas (fermoir).
function bandPoints(D, stack) {
  const r = D / 2, cy = -r, pts = [], n = 18;
  for (let k = 0; k <= n; k++) {
    const a = -Math.PI / 2 + 0.22 - (k / n) * (2 * Math.PI + 0.44);
    const z = k === 0 ? stack : k === n ? -stack : 0;
    pts.push(new THREE.Vector3(r * Math.cos(a), cy + r * Math.sin(a), z));
  }
  return pts;
}

// Section : liste de bandes {g: groupe matière, pts: [{x, y, nx, ny, v}]} dans le repère (W, N).
function makeProfile(kind, w, t) {
  const strips = [];
  if (kind === 'tube') {
    const a = w / 2, b = Math.max(t, w * 0.42) / 2, K = 12;
    for (const [g, from, to] of [[0, 0, Math.PI], [1, Math.PI, 2 * Math.PI]]) {
      const pts = [];
      for (let k = 0; k <= K; k++) {
        const ang = from + (to - from) * (k / K);
        const x = a * Math.cos(ang), y = b * Math.sin(ang);
        const n = new THREE.Vector2(Math.cos(ang) / a, Math.sin(ang) / b).normalize();
        pts.push({ x, y, nx: n.x, ny: n.y, v: g === 0 ? 1 - k / K : k / K });
      }
      strips.push({ g, pts });
    }
    return strips;
  }
  const r = t / 2, x0 = -w / 2 + r, x1 = w / 2 - r;
  const flat = (y, ny, g, dir) => {
    const pts = [];
    for (let k = 0; k <= 3; k++) {
      const x = dir > 0 ? x0 + (x1 - x0) * (k / 3) : x1 - (x1 - x0) * (k / 3);
      pts.push({ x, y, nx: 0, ny, v: (x + w / 2) / w });
    }
    return { g, pts };
  };
  const edge = (cx, a0, a1) => {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const ang = a0 + (a1 - a0) * (k / 6);
      pts.push({ x: cx + r * Math.cos(ang), y: r * Math.sin(ang), nx: Math.cos(ang), ny: Math.sin(ang), v: k / 6 });
    }
    return { g: 2, pts };
  };
  strips.push(flat(r, 1, 0, 1));
  strips.push(edge(x1, Math.PI / 2, -Math.PI / 2));
  strips.push(flat(-r, -1, 1, -1));
  strips.push(edge(x0, -Math.PI / 2, -3 * Math.PI / 2));
  return strips;
}

export class Strap {
  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.params = null;
    this.frames = [];
  }

  // Reconstruit la courbe, la topologie et les UV. Rapide (quelques ms).
  configure({ pose = 'neck', profile = 'flat', length = 900, width = 20, thickness = 1.1, mirror = false }) {
    const p = { pose, profile, length, width, thickness, mirror };
    this.params = p;
    const stack = profile === 'tube' ? width * 0.42 : thickness * 1.05;
    const build = pose === 'wrist' ? wristPoints : pose === 'band' ? bandPoints : neckPoints;
    const curveFor = (D) => new THREE.CatmullRomCurve3(build(D, stack), false, 'centripetal', 0.5);
    let lo = 10, hi = length, curve = null;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      curve = curveFor(mid);
      curve.arcLengthDivisions = 240;
      if (curve.getLength() > length) hi = mid; else lo = mid;
    }
    curve = curveFor((lo + hi) / 2);
    curve.arcLengthDivisions = 600;
    curve.updateArcLengths();
    this.curve = curve;
    this.drop = (lo + hi) / 2;
    this.realLength = curve.getLength();

    const M = Math.round(Math.min(900, Math.max(260, length / 1.4)));
    this.M = M;
    this.samples = [];
    for (let i = 0; i <= M; i++) {
      const u = i / M;
      this.samples.push({ u, p: curve.getPointAt(u), t: curve.getTangentAt(u).normalize() });
    }

    const strips = makeProfile(profile, width, thickness);
    this.strips = strips;
    const perRing = strips.reduce((n, s) => n + s.pts.length, 0);
    this.perRing = perRing;
    const count = (M + 1) * perRing;
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2), uv1 = new Float32Array(count * 2);
    const L = length;
    for (let i = 0; i <= M; i++) {
      const s = (i / M) * L;
      const second = mirror && s > L / 2;
      let k = i * perRing;
      for (const st of strips) {
        let arc = 0;
        st.pts.forEach((q, j) => {
          if (j > 0) arc += Math.hypot(q.x - st.pts[j - 1].x, q.y - st.pts[j - 1].y);
          let uu = s / L, vv = st.g === 1 ? q.v : 1 - q.v;
          if (second) { uu = 1 - uu; vv = 1 - vv; }
          uv[k * 2] = uu; uv[k * 2 + 1] = vv;
          uv1[k * 2] = s; uv1[k * 2 + 1] = st.g === 2 ? arc : q.x;
          k++;
        });
      }
    }
    const index = [];
    let base = 0;
    for (const st of strips) {
      const n = st.pts.length;
      for (let j = 0; j < n - 1; j++) {
        const a = st.pts[j], b = st.pts[j + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const orderA = (-dy * (a.nx + b.nx) + dx * (a.ny + b.ny)) > 0;
        for (let i = 0; i < M; i++) {
          const i0 = i * perRing + base + j, i1 = i0 + 1, i2 = i0 + perRing, i3 = i2 + 1;
          if (orderA) index.push(i0, i1, i2, i1, i3, i2); else index.push(i0, i2, i1, i1, i2, i3);
        }
      }
      // groupe matière : 0 face, 1 dos, 2 tranche
      base += n;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    // index réordonné par groupe pour les multi-matériaux
    const byGroup = [[], [], []];
    let off = 0;
    for (const st of strips) {
      const n = (st.pts.length - 1) * M * 6;
      byGroup[st.g].push(...index.slice(off, off + n));
      off += n;
    }
    const all = [];
    byGroup.forEach((arr, gi) => { if (arr.length) { g.addGroup(all.length, arr.length, gi); all.push(...arr); } });
    g.setIndex(all);
    this.geometry.dispose();
    this.geometry = g;
    this.update(0, 0.18);
    return this;
  }

  // Repère local du ruban (T tangente, W largeur, N normale face imprimée), avec torsion naturelle.
  frameAt(i, time, twist) {
    const { p, t, u } = this.samples[i];
    const pose = this.params.pose;
    let nt;
    let hang = 1;
    if (pose === 'neck') {
      const radial = new THREE.Vector3(p.x / NECK.rx, 0, p.z / NECK.rz);
      if (radial.lengthSq() < 1e-6) radial.set(0, 0, 1);
      radial.normalize();
      const ringN = radial.clone().addScaledVector(UP, 0.35).normalize();
      const frontN = FRONT.clone().addScaledVector(radial, 0.3).normalize();
      hang = smooth(-8, -70, p.y);
      nt = ringN.lerp(frontN, hang).normalize();
    } else if (pose === 'band') {
      nt = new THREE.Vector3(p.x, p.y + this.drop / 2, 0);
      if (nt.lengthSq() < 1e-6) nt.set(0, -1, 0);
      nt.normalize();
      hang = 0;
    } else {
      nt = FRONT.clone();
    }
    const W = new THREE.Vector3().crossVectors(t, nt);
    if (W.lengthSq() < 1e-8) W.set(1, 0, 0);
    W.normalize();
    const N = new THREE.Vector3().crossVectors(W, t).normalize();
    const env = smooth(0, 0.14, u) * smooth(1, 0.86, u) * hang;
    const th = twist * env * Math.sin(u * Math.PI * 2 * 1.35 + time) + twist * 0.35 * env * Math.sin(u * 17 + time * 0.7);
    if (th) {
      const c = Math.cos(th), s = Math.sin(th);
      const W2 = W.clone().multiplyScalar(c).addScaledVector(N, s);
      const N2 = N.clone().multiplyScalar(c).addScaledVector(W, -s);
      return { p, t, W: W2, N: N2 };
    }
    return { p, t, W, N };
  }

  update(time = 0, twist = 0.18) {
    const pos = this.geometry.attributes.position.array;
    const nor = this.geometry.attributes.normal.array;
    const strips = this.strips;
    this.frames.length = 0;
    let k = 0;
    for (let i = 0; i <= this.M; i++) {
      const f = this.frameAt(i, time, twist);
      this.frames.push(f);
      const { p, W, N } = f;
      for (const st of strips) {
        for (const q of st.pts) {
          pos[k * 3] = p.x + W.x * q.x + N.x * q.y;
          pos[k * 3 + 1] = p.y + W.y * q.x + N.y * q.y;
          pos[k * 3 + 2] = p.z + W.z * q.x + N.z * q.y;
          nor[k * 3] = W.x * q.nx + N.x * q.ny;
          nor[k * 3 + 1] = W.y * q.nx + N.y * q.ny;
          nor[k * 3 + 2] = W.z * q.nx + N.z * q.ny;
          k++;
        }
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();
  }

  // Point bas où les deux extrémités se rejoignent.
  get bottom() {
    const a = this.samples[0].p, b = this.samples[this.M].p;
    return new THREE.Vector3((a.x + b.x) / 2, Math.min(a.y, b.y), (a.z + b.z) / 2);
  }

  // Repère au milieu du ruban (nuque) pour le safety breakaway.
  get middle() { return this.frames[Math.round(this.M / 2)]; }

  // Ligne le long d'un bord (cotes / trajectoires).
  edgeLine(u0, u1, offset = 4, n = 60, side = -1) {
    const pts = [];
    const w = this.params.width / 2 + offset;
    for (let k = 0; k <= n; k++) {
      const i = Math.round((u0 + (u1 - u0) * (k / n)) * this.M);
      const f = this.frames[i];
      pts.push(f.p.clone().addScaledVector(f.W, side * w).addScaledVector(f.N, 1.5));
    }
    return pts;
  }
}
