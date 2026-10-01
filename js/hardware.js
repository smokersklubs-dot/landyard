// Pièces modélisées dans Blender (hardware-master/) : chargement des GLB, points d'accroche
// nommés, matériaux du configurateur. Si une pièce manque, le viewer garde la version procédurale.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const HARDWARE_IDS = ['crimp', 'buckle', 'breakaway', 'snaphook', 'swivel', 'keyring', 'plasticclip'];
const BASE_WIDTH = 20; // largeur de ruban du modèle Blender
const MAT_BY_NAME = { METAL: 'metal', PLASTIC: 'plastic', PLASTIC_DARK: 'plasticDark' };
// Pièces qui suivent la largeur du ruban : les corps s'élargissent, anneaux et crochets non.
const KEEP = /RING|HOOK|STEM/;

function b64ToBuffer(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export async function loadHardware(base = 'hardware-master/export/') {
  const loader = new GLTFLoader();
  const embedded = window.SKLUBS_HARDWARE || null;
  const templates = {};
  await Promise.all(HARDWARE_IDS.map(async (id) => {
    try {
      const gltf = embedded?.[id]
        ? await loader.parseAsync(b64ToBuffer(embedded[id]), '')
        : await loader.loadAsync(base + id + '.glb');
      templates[id] = gltf.scene;
    } catch (e) {
      console.warn(`Pièce ${id} indisponible, version procédurale utilisée.`, e);
    }
  }));
  return new HardwareLibrary(templates);
}

export class HardwareLibrary {
  constructor(templates) { this.templates = templates; }

  has(id) { return !!this.templates[id]; }

  // Renvoie { group, bottom, anchors } comme les constructeurs procéduraux de parts.js.
  instance(id, mats, width = BASE_WIDTH) {
    const t = this.templates[id];
    if (!t) return null;
    const root = t.clone(true);
    const anchors = {};
    const meshes = [];
    root.traverse((o) => {
      if (o.isMesh) meshes.push(o);
      // Blender suffixe les noms en double (ANCHOR_BOTTOM.001 → ANCHOR_BOTTOM001 dans Three.js).
      else if (o !== root && /^[A-Z_]+\d*$/.test(o.name)) anchors[o.name.replace(/\d+$/, '')] = o.position.clone();
    });
    const k = (width + 4) / (BASE_WIDTH + 4);
    for (const m of meshes) {
      const key = MAT_BY_NAME[(m.material?.name || '').toUpperCase()] || 'metal';
      m.material = mats[key];
      m.castShadow = true; m.receiveShadow = true;
      if (['crimp', 'buckle', 'breakaway', 'plasticclip'].includes(id) && Math.abs(k - 1) > 1e-3) {
        if (/TAB_/.test(m.name)) m.position.x *= k;
        else if (!KEEP.test(m.name)) m.scale.x *= k;
      }
    }
    const group = new THREE.Group();
    group.add(root);
    if (id === 'breakaway') {
      // Deux demi-coques animables séparément (vue éclatée).
      group.updateMatrixWorld(true);
      const halves = [];
      for (const [tag, dir] of [['HALF_A', 1], ['HALF_B', -1]]) {
        const h = new THREE.Group();
        h.userData.dir = dir;
        meshes.filter((m) => m.name.includes(tag)).forEach((m) => h.attach(m));
        group.add(h);
        halves.push(h);
      }
      group.userData.halves = halves;
    }
    return { group, bottom: anchors.ANCHOR_BOTTOM || null, anchors };
  }
}
