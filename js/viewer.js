// Viewer 3D SKLUBS EVENT : ruban paramétrique + pièces modulaires, studio blanc, PBR.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Strap } from './strap.js';
import * as P from './parts.js';
import { stripTexture, toTexture, fabricNormal, passCanvas, passBackCanvas, ORANGE } from './artwork.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - t, 3);

export class LanyardViewer {
  constructor(container, { mode = 'config', width, height } = {}) {
    this.mode = mode; // config | hero | studio
    this.container = container;
    this.fixed = width ? { width, height } : null;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: mode === 'studio', powerPreference: 'high-performance' });
    r.setPixelRatio(mode === 'studio' ? 1 : Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = mode === 'hero' ? 0.94 : 1.02;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    container.appendChild(r.domElement);

    if (mode === 'config') {
      this.labels = new CSS2DRenderer();
      this.labels.domElement.className = 'labels-layer';
      container.appendChild(this.labels.domElement);
    }

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.9;

    this.camera = new THREE.PerspectiveCamera(mode === 'hero' ? 34 : 28, 1, 5, 20000);
    this.camera.position.set(0, -120, 1400);
    if (mode !== 'studio') {
      this.controls = new OrbitControls(this.camera, r.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.enablePan = false;
      this.controls.minDistance = 90;
      this.controls.maxDistance = 2600;
      this.controls.autoRotateSpeed = 2.2;
      this.controls.addEventListener('start', () => { this.camAnim = null; });
      if (mode === 'hero') { this.controls.enableZoom = false; this.controls.enableRotate = false; }
    }

    this.setupLights();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.mats = this.makeMaterials();
    this.strap = new Strap();
    this.strapMesh = new THREE.Mesh(this.strap.geometry, [this.mats.front, this.mats.back, this.mats.edge]);
    this.strapMesh.castShadow = true; this.strapMesh.receiveShadow = true;
    this.root.add(this.strapMesh);
    this.chain = new THREE.Group();
    this.root.add(this.chain);
    this.neck = new THREE.Group();
    this.root.add(this.neck);
    this.overlay = new THREE.Group();
    this.root.add(this.overlay);

    this.keys = {};
    this.explodeT = 0; this.explodeTarget = 0;
    this.twist = mode === 'hero' ? 0.42 : 0.16;
    this.motion = mode !== 'studio';
    this.clock = new THREE.Clock();
    this.time = 0;
    if (mode === 'hero') this.setupHero();

    this.resize();
    if (mode !== 'studio') {
      new ResizeObserver(() => this.resize()).observe(container);
      r.setAnimationLoop(() => this.tick());
    }
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight('#ffffff', '#d9d6d0', 0.55);
    const key = new THREE.DirectionalLight('#ffffff', 1.9);
    key.position.set(420, 1100, 900);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera; sc.left = -500; sc.right = 500; sc.top = 500; sc.bottom = -500; sc.near = 100; sc.far = 4000;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.radius = 6;
    const rim = new THREE.DirectionalLight('#fff3e8', 0.7);
    rim.position.set(-900, 300, -700);
    this.key = key;
    this.scene.add(hemi, key, key.target, rim);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShadowMaterial({ opacity: 0.07 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  setupHero() {
    // Architecture blanche abstraite : éclats, plaques de verre, filets lumineux orange.
    this.decor = new THREE.Group();
    const white = new THREE.MeshPhysicalMaterial({ color: '#f6f6f4', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
    const glow = new THREE.MeshBasicMaterial({ color: '#ff7a1a' });
    const shard = (r, h, x, y, z, rx, ry, rz, seg = 4) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 1), white);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true;
      this.decor.add(m);
    };
    shard(150, 1500, 640, 80, -900, 0.08, 0.6, -0.12);
    shard(110, 1100, 900, -180, -700, -0.05, 0.2, 0.2, 3);
    shard(220, 1800, -900, 160, -1300, 0.1, 0.3, 0.32);
    shard(90, 900, 380, -380, -1100, 0.4, 0.8, -0.5, 3);
    shard(160, 700, -420, -560, -800, 1.2, 0.4, 0.9);
    shard(70, 620, 1050, 300, -500, -0.2, 0.1, 0.5, 3);
    const slab = (w, h, x, y, z, ry, rz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), glass);
      m.position.set(x, y, z); m.rotation.set(0, ry, rz);
      this.decor.add(m);
    };
    slab(520, 1300, 520, -50, -560, -0.7, 0.05);
    slab(360, 900, -700, -120, -700, 0.6, -0.08);
    const bar = (h, x, y, z, rz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(5, h, 5), glow);
      m.position.set(x, y, z); m.rotation.z = rz;
      this.decor.add(m);
      const l = new THREE.PointLight('#ff7a1a', 1.2, 900, 1.6); l.position.set(x, y, z + 60); this.decor.add(l);
    };
    bar(320, 760, -40, -620, 0.02);
    bar(180, 980, 260, -1000, -0.1);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(900, 960, 60, 64), white);
    floor.position.set(160, -760, -520); floor.receiveShadow = true;
    this.decor.add(floor);
    this.scene.add(this.decor);
    this.trails = [];
    for (let k = 0; k < 2; k++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(81 * 3), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.55 }));
      this.root.add(line);
      this.trails.push(line);
    }
  }

  makeMaterials() {
    const fab = (o = {}) => new THREE.MeshPhysicalMaterial({ roughness: 0.7, sheen: 0.4, sheenRoughness: 0.5, ...o });
    const leatherN = fabricNormal('leather', this.renderer);
    leatherN.repeat.set(1 / 24, 1 / 24);
    return {
      front: fab(), back: fab(), edge: fab(),
      metal: new THREE.MeshPhysicalMaterial({ color: '#d9dbdd', metalness: 1, roughness: 0.16 }),
      plastic: new THREE.MeshPhysicalMaterial({ color: '#151515', roughness: 0.48, clearcoat: 0.2 }),
      plasticDark: new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: 0.7 }),
      clear: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, transmission: 1, thickness: 1.2, ior: 1.45, transparent: true, opacity: 0.55, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
      clearRigid: new THREE.MeshPhysicalMaterial({ color: '#f2f6f8', roughness: 0.04, transmission: 1, thickness: 3.6, ior: 1.5, transparent: true, opacity: 0.62, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
      clearFrost: new THREE.MeshPhysicalMaterial({ color: '#e9eef0', roughness: 0.5, transparent: true, opacity: 0.6 }),
      leather: new THREE.MeshPhysicalMaterial({ color: '#6a4630', roughness: 0.62, sheen: 0.4, normalMap: leatherN, normalScale: new THREE.Vector2(0.5, 0.5) }),
      cord: new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.85 }),
      patch: new THREE.MeshPhysicalMaterial({ color: '#1a1a1a', roughness: 0.4, transparent: true, opacity: 0.92 }),
      cardEdge: new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.5 }),
    };
  }

  // ---------- Configuration ----------
  apply(state, product) {
    this.product = product;
    this.state = state;
    const model = state.modelDef || product.models.find((m) => m.id === state.model);
    const mat = product.materials.find((m) => m.id === state.material);
    const fin = product.finishes.find((f) => f.id === state.finish) || product.finishes[0];
    const method = product.printingMethods.find((m) => m.id === state.method);
    const geomKey = JSON.stringify([model.pose, model.profile, state.length, state.width, mat.thickness, state.mirror]);
    const geomChanged = geomKey !== this.keys.geom;
    if (geomChanged) {
      this.keys.geom = geomKey;
      this.strap.configure({ pose: model.pose, profile: model.profile, length: state.length, width: state.width, thickness: mat.thickness, mirror: state.mirror });
      this.strapMesh.geometry = this.strap.geometry;
    }

    // Matière
    const normal = fabricNormal(mat.weave, this.renderer);
    normal.repeat.set(1 / 4, 1 / 4);
    normal.channel = 1;
    const rough = THREE.MathUtils.clamp(mat.roughness + (fin?.roughness || 0), 0.12, 1);
    const base = new THREE.Color(state.color);
    const sheenColor = base.clone().lerp(new THREE.Color('#ffffff'), 0.14);
    for (const m of [this.mats.front, this.mats.back, this.mats.edge]) {
      m.normalMap = normal;
      m.normalScale.set(mat.normal, mat.normal);
      m.roughness = rough;
      m.sheen = mat.sheen * 0.7;
      m.sheenColor.copy(sheenColor);
      m.sheenRoughness = mat.weave === 'satin' ? 0.25 : 0.55;
      m.needsUpdate = true;
    }
    this.mats.edge.color.copy(base);

    // Marquage (textures)
    const side = (s, enabled) => ({ ...s, enabled, bg: state.color, guides: !!state.ui?.guides });
    const backSide = state.backMode === 'same' ? side(state.front, true) : side(state.back, state.backMode === 'different');
    const frontSide = side(state.front, true);
    const artKey = JSON.stringify([geomKey, state.color, state.method, strip(frontSide), strip(backSide), state.logoVersion]);
    if (artKey !== this.keys.art) {
      this.keys.art = artKey;
      const maxTex = Math.min(8192, this.renderer.capabilities.maxTextureSize);
      const common = { widthMM: state.width, lengthMM: state.length, drop: this.strap.drop, method, maxTex };
      this.frontTex = stripTexture({ side: frontSide, ...common });
      this.backTex = stripTexture({ side: backSide, ...common });
      for (const [m, t] of [[this.mats.front, this.frontTex], [this.mats.back, this.backTex]]) {
        m.map?.dispose();
        const tex = toTexture(t.canvas, this.renderer);
        tex.repeat.set(t.repeat, 1);
        tex.offset.set(t.offset, 0);
        m.map = tex;
        m.color.set('#ffffff');
        m.needsUpdate = true;
      }
    }

    // Quincaillerie
    const hw = product.hardwareColors.find((h) => h.id === state.hardwareColor);
    const hwHex = state.hardwareColor === 'custom' ? state.hardwareHex : hw?.hex || '#d9dbdd';
    const metal = state.hardwareColor === 'custom' ? false : hw?.metal !== false;
    this.mats.metal.color.set(hwHex);
    this.mats.metal.metalness = metal ? 1 : 0.1;
    this.mats.metal.roughness = metal ? (state.hardwareColor === 'black' ? 0.32 : 0.14) : 0.42;
    this.mats.metal.clearcoat = metal ? 0 : 0.6;
    this.mats.plastic.color.set(metal ? '#151515' : hwHex);

    const partsKey = JSON.stringify([geomKey, state.showcase, state.breakaway, state.buckle, state.attachment, state.kit, state.holder, state.holderOrientation, state.pass, state.logoVersion]);
    if (partsKey !== this.keys.parts || geomChanged) {
      this.keys.parts = partsKey;
      this.buildParts(state, product, model);
    }
    this.setDims(!!state.ui?.dims);
    this.frameKey = geomKey + state.attachment + state.kit + state.holder + state.holderOrientation;
  }

  clearGroup(g) {
    g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isCSS2DObject) o.element.remove(); });
    g.clear();
  }

  buildParts(state, product, model) {
    this.clearGroup(this.chain);
    this.clearGroup(this.neck);
    this.explodables = [];
    const w = model.profile === 'tube' ? state.width * 0.9 : state.width;
    const bottom = this.strap.bottom;
    this.chain.position.copy(bottom);
    let cursor = new THREE.Vector3();
    let depth = 0;
    const add = (part, label, sub, step) => {
      const g = new THREE.Group();
      g.add(part.group);
      g.position.copy(cursor);
      g.userData.home = cursor.clone();
      depth += step;
      g.userData.explode = new THREE.Vector3(0, -depth, 0);
      this.chain.add(g);
      this.explodables.push(g);
      this.addLabel(g, label, sub, new THREE.Vector3(34 + w, -10, 0));
      if (part.bottom) cursor = cursor.clone().add(part.bottom);
      return g;
    };
    // Vitrines sans ruban (porte-badge, badge, pass) : la pièce seule, centrée.
    const showcase = state.showcase || 'lanyard';
    this.strapMesh.visible = !['holder', 'badge', 'pass'].includes(showcase);
    if (!this.strapMesh.visible) {
      this.chain.position.set(0, 0, 0);
      const front = toTexture(passCanvas(state.pass, state.front.logoOn ? state.front : null, false), this.renderer);
      const back = toTexture(passBackCanvas(state.pass, false), this.renderer);
      front.wrapS = back.wrapS = THREE.ClampToEdgeWrapping;
      const c = P.card(front, back, product.card, false, this.mats);
      if (showcase === 'badge') { this.chain.add(c); this.chainBottom = new THREE.Vector3(0, -45, 0); return; }
      const h = P.holder(showcase === 'pass' ? 'pvcrigid' : 'pvcsoft', false, product.card, this.mats);
      c.position.copy(h.cardAt);
      this.chain.add(h.group, c);
      this.chainBottom = new THREE.Vector3(0, -110, 0);
      return;
    }
    if (model.pose === 'band') {
      add(P.crimp(w, this.mats, { ring: false }), 'Fermoir', 'Métal', 14);
      this.chainBottom = this.chain.position.clone();
      return;
    }
    const end = state.buckle === 'detachable' ? P.buckle(w, this.mats) : P.crimp(w, this.mats);
    add(end, state.buckle === 'detachable' ? 'Boucle détachable' : 'Embout serti', state.buckle === 'detachable' ? 'Clip plastique' : 'Métal', 14);
    const attDef = product.attachments.find((a) => a.id === state.attachment);
    const att = state.attachment !== 'none' ? P.buildAttachment(state.attachment, w, this.mats) : null;
    if (att) add(att, attDef.name, attDef.sub, 26);
    const canHold = att?.bottom && product.rules.holderNeedsAttachment.includes(state.attachment) && model.pose === 'neck';
    this.holderShown = false;
    if (canHold && state.kit !== 'lanyard' && state.holder !== 'none') {
      const horizontal = state.holderOrientation === 'horizontal';
      const h = P.holder(state.holder, horizontal, product.card, this.mats);
      if (h) {
        const hd = product.holders.find((x) => x.id === state.holder);
        const hg = add(h, 'Porte-badge ' + hd.name, horizontal ? 'Horizontal' : 'Vertical', 34);
        this.holderShown = true;
        if (state.kit === 'pass') {
          const front = toTexture(passCanvas(state.pass, state.front.logoOn ? state.front : null, horizontal), this.renderer);
          const back = toTexture(passBackCanvas(state.pass, horizontal), this.renderer);
          front.wrapS = back.wrapS = THREE.ClampToEdgeWrapping;
          const c = P.card(front, back, product.card, horizontal, this.mats);
          const cg = new THREE.Group();
          cg.add(c);
          cg.position.copy(hg.position).add(h.cardAt);
          cg.userData.home = cg.position.clone();
          cg.userData.explode = new THREE.Vector3(0, -depth - 30, 26);
          this.chain.add(cg);
          this.explodables.push(cg);
          this.addLabel(cg, 'Pass imprimé', 'CR80 · 54 × 86 mm', new THREE.Vector3(-70 - w, 20, 0), 'left');
        }
      }
    }
    // Breakaway nuque
    if (state.breakaway === 'safety' && model.pose === 'neck') {
      const b = P.breakaway(w, this.mats);
      this.breakawayGroup = b.group;
      this.neck.add(b.group);
      this.addLabel(this.neck, 'Safety breakaway', 'Nuque', new THREE.Vector3(0, 40, 0));
    } else this.breakawayGroup = null;
    // Étiquette du ruban
    if (this.strapLabelAnchor) { this.clearGroup(this.strapLabelAnchor); this.overlay.remove(this.strapLabelAnchor); }
    const i = Math.round(this.strap.M * 0.12);
    const f = this.strap.frames[i];
    this.strapLabelAnchor = new THREE.Group();
    this.strapLabelAnchor.position.copy(f.p);
    this.overlay.add(this.strapLabelAnchor);
    const matName = product.materials.find((m) => m.id === state.material)?.name;
    this.addLabel(this.strapLabelAnchor, 'Ruban ' + matName, `${state.width} mm × ${state.length / 10} cm`, new THREE.Vector3(-60 - w, 0, 0), 'left');
    this.chainBottom = this.chain.position.clone().add(cursor);
  }

  addLabel(parent, title, sub, offset, align = 'right') {
    if (!this.labels) return;
    const el = document.createElement('div');
    el.className = 'part-label ' + align;
    el.innerHTML = `<b>${title}</b><span>${sub || ''}</span>`;
    const o = new CSS2DObject(el);
    o.position.copy(offset);
    o.userData.isPartLabel = true;
    parent.add(o);
    o.visible = false;
  }

  setDims(on) {
    this.overlay.children.filter((c) => c.userData.dim).forEach((c) => { this.overlay.remove(c); c.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isCSS2DObject) o.element.remove(); }); });
    this.dimsOn = on;
    if (!on || !this.labels) return;
    const orange = new THREE.MeshBasicMaterial({ color: ORANGE });
    const g = new THREE.Group(); g.userData.dim = true;
    const pose = this.strap.params.pose;
    const u1 = pose === 'wrist' ? 0.4 : 0.36;
    const pts = this.strap.edgeLine(0.015, u1, 14, 60, -1);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.9, 6), orange));
    for (const [a, b] of [[pts[1], pts[0]], [pts[pts.length - 2], pts[pts.length - 1]]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.6, 10, 12), orange);
      cone.position.copy(b);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(cone);
    }
    const mid = pts[Math.round(pts.length * 0.45)];
    const lab = document.createElement('div');
    lab.className = 'dim-label'; lab.innerHTML = `<span>Longueur</span><b>${this.strap.params.length / 10} cm</b>`;
    const lo = new CSS2DObject(lab); lo.position.copy(mid).add(new THREE.Vector3(-46, 0, 0)); g.add(lo);
    // largeur
    const f = this.strap.frames[Math.round(this.strap.M * (1 - 0.2))];
    const w = this.strap.params.width;
    const a = f.p.clone().addScaledVector(f.W, -w / 2).addScaledVector(f.N, 5);
    const b = f.p.clone().addScaledVector(f.W, w / 2).addScaledVector(f.N, 5);
    const bar = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 2, 0.7, 6), orange); g.add(bar);
    for (const e of [a, b]) { const t = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), orange); t.position.copy(e); g.add(t); }
    const wl = document.createElement('div');
    wl.className = 'dim-label'; wl.innerHTML = `<span>Largeur</span><b>${w} mm</b>`;
    const wo = new CSS2DObject(wl); wo.position.copy(b).add(new THREE.Vector3(48, 6, 0)); g.add(wo);
    this.overlay.add(g);
  }

  setExploded(on) { this.explodeTarget = on ? 1 : 0; }

  // ---------- Caméra ----------
  bounds() {
    this.root.updateMatrixWorld(true);
    const box = this.strapMesh.visible ? new THREE.Box3().setFromObject(this.strapMesh) : new THREE.Box3();
    box.expandByObject(this.chain);
    if (this.explodeTarget > 0) {
      const extra = Math.max(0, ...(this.explodables || []).map((g) => -g.userData.explode.y)) * (1 - this.explodeT);
      box.min.y -= extra; box.max.y += 30;
    }
    return box;
  }

  viewFor(name) {
    const box = this.bounds();
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const fit = (h, w) => Math.max(h / 2 / Math.tan(fov / 2), (w / 2) / (Math.tan(fov / 2) * this.camera.aspect)) * 1.18;
    const dist = fit(s.y, Math.max(s.x, s.z));
    const at = (dir, target, d) => ({ pos: target.clone().addScaledVector(dir.normalize(), d), target });
    switch (name) {
      case 'back': return at(new THREE.Vector3(-0.1, 0.05, -1), c, dist);
      case 'top': return at(new THREE.Vector3(0, 1, 0.5), c.clone().setY(box.max.y - s.y * 0.2), dist * 0.8);
      case 'side': return at(new THREE.Vector3(1, 0.05, 0.05), c, dist);
      case 'detail': {
        const t = this.chain.position.clone().add(new THREE.Vector3(0, -40, 0));
        return at(new THREE.Vector3(0.55, 0.2, 1), t, 240);
      }
      case 'neck': return at(new THREE.Vector3(0.1, 0.6, -1), new THREE.Vector3(0, 0, 0), 420);
      case 'macro': {
        const f = this.strap.frames[Math.round(this.strap.M * 0.9)];
        return at(f.N.clone().add(new THREE.Vector3(0.25, 0.1, 0)), f.p.clone(), 120 + this.strap.params.width * 2);
      }
      case 'hero': return at(new THREE.Vector3(0.05, -0.1, 1), c.clone().add(new THREE.Vector3(0, -s.y * (this.heroFocus ?? 0.12), 0)), dist * (this.heroZoom ?? 0.62));
      case 'threeq': return at(new THREE.Vector3(0.75, 0.18, 0.85), c, dist);
      default: return at(new THREE.Vector3(0.18, 0.06, 1), c, dist);
    }
  }

  setView(name, instant = false) {
    this.currentView = name;
    if (this.mode === 'hero') this.heroPose(this.time);
    const v = this.viewFor(name);
    if (instant || !this.controls) {
      this.camera.position.copy(v.pos);
      this.target = v.target.clone();
      this.camera.lookAt(this.target);
      if (this.controls) { this.controls.target.copy(v.target); this.controls.update(); }
      this.camAnim = null;
      return;
    }
    this.camAnim = { t: 0, fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(), toPos: v.pos, toTarget: v.target };
  }

  zoom(f) {
    if (!this.controls) return;
    const d = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(d.length() * f, this.controls.minDistance, this.controls.maxDistance);
    this.camAnim = { t: 0, fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(), toPos: this.controls.target.clone().add(d.setLength(len)), toTarget: this.controls.target.clone() };
  }

  // Lanyard flottant : bas incliné vers la caméra, micro-rotation, flottement.
  heroPose(t) {
    const p = this.heroTilt || { x: -0.42, y: -0.32, z: 0.34 };
    this.root.rotation.set(p.x + Math.sin(t * 0.5) * 0.03, p.y + Math.sin(t * 0.25) * 0.12, p.z);
    this.root.position.y = Math.sin(t * 0.8) * 6;
    if (this.decor) this.decor.position.x = Math.sin(t * 0.2) * 12;
  }

  setAutoRotate(on) { if (this.controls) this.controls.autoRotate = on; }

  // Taille fixe (vitrine hors écran) : vignettes portrait ou paysage.
  setSize(width, height) {
    this.fixed = { width, height };
    this.container.style.width = width + 'px'; this.container.style.height = height + 'px';
    this.resize();
  }

  resize() {
    const w = this.fixed?.width || this.container.clientWidth || 1, h = this.fixed?.height || this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.labels?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- Boucle ----------
  animateParts(dt) {
    const t = this.time;
    // balancement de la chaîne (gravité)
    const sway = this.mode === 'hero' ? 0.07 : 0.022;
    this.chain.rotation.z = Math.sin(t * 0.9) * sway;
    this.chain.rotation.x = Math.sin(t * 0.63 + 1) * sway * 0.6;
    // vue éclatée
    this.explodeT += (this.explodeTarget - this.explodeT) * Math.min(1, dt * 5);
    const e = ease(this.explodeT);
    for (const g of this.explodables || []) g.position.copy(g.userData.home).addScaledVector(g.userData.explode, e);
    if (this.breakawayGroup) {
      const f = this.strap.middle;
      const m = new THREE.Matrix4().makeBasis(f.W, f.N, f.t);
      this.neck.position.copy(f.p).addScaledVector(new THREE.Vector3(0, 1, 0), 22 * e);
      this.breakawayGroup.quaternion.setFromRotationMatrix(m);
      for (const h of this.breakawayGroup.userData.halves) h.position.z = h.userData.dir * 7 * e;
    }
    const show = e > 0.5;
    for (const root of [this.chain, this.neck, this.overlay]) root.traverse((o) => { if (o.userData.isPartLabel) o.visible = show; });
  }

  updateTrails() {
    if (!this.trails) return;
    this.trails.forEach((line, k) => {
      const pts = k === 0 ? this.strap.edgeLine(0.04, 0.3, 22, 80, -1) : this.strap.edgeLine(0.7, 0.96, 22, 80, 1);
      const a = line.geometry.attributes.position.array;
      pts.forEach((p, i) => { a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; });
      line.geometry.attributes.position.needsUpdate = true;
    });
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.motion) this.time += dt;
    if (this.strap.params) {
      if (this.motion) this.strap.update(this.time * (this.mode === 'hero' ? 0.9 : 0.5), this.twist);
      this.animateParts(dt);
      this.updateTrails();
      const box = this.strap.geometry.boundingBox;
      const low = Math.min(box.min.y, this.chainBottom?.y ?? box.min.y) - (this.holderShown ? 120 : 40);
      this.ground.position.y = lerp(this.ground.position.y, low, 0.2);
    }
    if (this.mode === 'hero') this.heroPose(this.time);
    if (this.camAnim) {
      const a = this.camAnim;
      a.t = Math.min(1, a.t + dt * 1.6);
      const k = ease(a.t);
      this.camera.position.lerpVectors(a.fromPos, a.toPos, k);
      this.controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
      if (a.t >= 1) this.camAnim = null;
    }
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
    this.labels?.render(this.scene, this.camera);
  }

  // Rendu fixe (vignettes, export PNG).
  snapshot(view = 'front', { time = 0.6 } = {}) {
    const savedT = this.explodeT;
    this.strap.update(time, this.twist);
    this.animateParts(0);
    const box = this.strap.geometry.boundingBox;
    this.ground.position.y = Math.min(box.min.y, this.chainBottom?.y ?? box.min.y) - (this.holderShown ? 120 : 40);
    if (this.mode === 'studio') this.setView(view, true);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.explodeT = savedT;
    return url;
  }
}

function strip(side) {
  const { logoImage, logoData, logoSrc, ...rest } = side;
  return rest;
}
