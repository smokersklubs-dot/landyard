"""SKLUBS EVENT — HARDWARE MASTER (Blender, en script).

Construit les pièces métalliques et plastiques du lanyard, chacune dans sa collection,
avec des points d'accroche nommés (empties), puis exporte un GLB par pièce.

Unité : millimètre. Convention Blender : Z vers le haut, face avant vers -Y.
Chaque pièce pend vers -Z ; son point d'accroche haut est l'origine.
Après export glTF (Y vers le haut), -Z devient -Y et -Y devient +Z (face avant).

Pièces standard du marché : aucune cote fournisseur (TO_DEFINE_FACTORY).
Les pièces dont la taille suit le ruban (embout, boucle, breakaway, clip) sont
modélisées pour un ruban de 20 mm ; le configurateur les met à l'échelle en X.

Usage : python3 hardware-master/scripts/build_hardware.py
"""
import math
import os

import bpy
import bmesh
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORT = os.path.join(ROOT, 'export')
os.makedirs(EXPORT, exist_ok=True)
BASE_WIDTH = 20.0


# ---------- scène ----------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    s.unit_settings.scale_length = 0.001
    s.unit_settings.length_unit = 'MILLIMETERS'


MATS = {}


def mat(name, color, metallic=0.0, rough=0.5):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    MATS[name] = m
    return m


def metal():
    return mat('METAL', (0.85, 0.86, 0.87), 1.0, 0.16)


def plastic():
    return mat('PLASTIC', (0.02, 0.02, 0.02), 0.0, 0.48)


def plastic_dark():
    return mat('PLASTIC_DARK', (0.005, 0.005, 0.005), 0.0, 0.7)


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def link(obj, col):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)
    return obj


def finish(obj, material, col, smooth=True, bevel=None, segments=3):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
        if hasattr(obj.data, 'set_sharp_from_angle'):
            obj.data.set_sharp_from_angle(angle=math.radians(35))
    return link(obj, col)


def anchor(name, loc, col):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'SPHERE'
    e.empty_display_size = 1.2
    e.location = loc
    col.objects.link(e)
    return e


# ---------- primitives ----------
def rbox(name, size, loc, radius, material, col):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, col, bevel=min(radius, min(size) / 2 - 0.01), segments=4)


def torus(name, R, r, loc, rot, material, col):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=56, minor_segments=18, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return finish(o, material, col)


def lathe(name, profile, z, material, col, steps=40):
    """profile : liste (rayon, z) du haut vers le bas, révolution autour de Z."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for i in range(steps):
        a = 2 * math.pi * i / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z + zz)) for r, zz in profile])
    for i in range(steps):
        a, b = rings[i], rings[(i + 1) % steps]
        for k in range(len(profile) - 1):
            bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return finish(o, material, col)


def wire(name, pts, radius, material, col, flat=1.0, caps=True, closed=False, res=16):
    """Fil cintré : courbe de Bézier lissée, section ronde (aplatie en Y si flat < 1)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_mode = 'ROUND'
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.resolution_u = res
    cu.use_fill_caps = caps
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    sp.use_cyclic_u = closed
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    o.name = name
    if flat != 1.0:
        o.scale = (1, flat, 1)
        bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, col)


def plate(name, outer, holes, depth, material, col, bevel=0.4):
    """Plaque extrudée (dans le plan XZ) avec trous : listes de points (x, z)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = depth / 2
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    for poly in [outer] + holes:
        sp = cu.splines.new('POLY')
        sp.points.add(len(poly) - 1)
        for p, (x, z) in zip(sp.points, poly):
            p.co = (x, z, 0, 1)
        sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (math.pi / 2, 0, 0)   # plan XY de la courbe -> plan XZ
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    bpy.ops.object.transform_apply(rotation=True)
    o.name = name
    return finish(o, material, col)


def rounded_rect(w, h, r, cx=0.0, cz=0.0, n=6):
    pts = []
    for (qx, qz, a0) in [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]:
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + qx + r * math.cos(a), cz + qz + r * math.sin(a)))
    return pts


V = lambda x, z, y=0.0: Vector((x, y, z))
EYE_ROT = (0, math.pi / 2, 0)        # anneau perpendiculaire à la face (plan YZ)
FACE_ROT = (math.pi / 2, 0, 0)       # anneau dans le plan de la face (plan XZ)


# ---------- pièces ----------
def build_crimp():
    col = collection('CRIMP')
    rbox('CRIMP_BODY', (BASE_WIDTH + 3.4, 4.4, 13), V(0, -3.5), 1.4, metal(), col)
    rbox('CRIMP_LIP', (BASE_WIDTH + 3.8, 4.8, 1.6), V(0, -9.2), 0.6, metal(), col)
    torus('CRIMP_RING', 4.2, 0.95, V(0, -13.2), FACE_ROT, metal(), col)
    anchor('STRAP_IN', V(0, 0), col)
    anchor('ANCHOR_BOTTOM', V(0, -17.4), col)
    return col


def build_buckle():
    col = collection('BUCKLE')
    w = BASE_WIDTH + 7
    rbox('BUCKLE_FEMALE', (w, 7.8, 24), V(0, -9), 2.2, plastic(), col)
    rbox('BUCKLE_MOUTH', (w - 3, 5.4, 2), V(0, -20.4), 0.8, plastic_dark(), col)
    for sx in (-1, 1):
        rbox(f'BUCKLE_TAB_{"L" if sx < 0 else "R"}', (3, 4.6, 9), V(sx * (w / 2 + 0.6), -14), 1.0, plastic(), col)
    rbox('BUCKLE_MALE', (w - 5, 5.2, 13), V(0, -27.5), 1.6, plastic(), col)
    rbox('BUCKLE_RIB', (w - 9, 5.6, 1.2), V(0, -24), 0.4, plastic_dark(), col)
    torus('BUCKLE_RING', 4.0, 1.3, V(0, -37), FACE_ROT, plastic(), col)
    anchor('STRAP_IN', V(0, 0), col)
    anchor('BUCKLE_SPLIT', V(0, -21.5), col)
    anchor('ANCHOR_BOTTOM', V(0, -39.7), col)
    return col


def build_breakaway():
    """Repère : X = largeur, Z(Blender) = épaisseur (normale du ruban), Y = le long du ruban."""
    col = collection('BREAKAWAY')
    for name, s in (('HALF_A', -1), ('HALF_B', 1)):
        rbox(f'BREAKAWAY_{name}', (BASE_WIDTH + 3.6, 11, 5.2), Vector((0, s * 6.2, 0)), 1.6, plastic(), col)
        rbox(f'BREAKAWAY_{name}_LIP', (BASE_WIDTH + 1.2, 1.2, 5.6), Vector((0, s * 0.7, 0)), 0.4, plastic_dark(), col)
    anchor('STRAP_AXIS', Vector((0, 0, 0)), col)
    return col


def build_snaphook():
    col = collection('SNAPHOOK')
    m = metal()
    torus('SNAPHOOK_EYE', 5.6, 1.35, V(0, -5.6), EYE_ROT, m, col)
    lathe('SNAPHOOK_SWIVEL', [(0.01, 0), (2.4, 0), (2.8, -0.6), (2.8, -4), (3.6, -4.6), (3.6, -7.4), (2.6, -8.2), (0.01, -8.2)], -10.6, m, col)
    rbox('SNAPHOOK_HEAD', (8, 5, 5), V(0, -19.5), 1.6, m, col)
    body = [V(-1.6, -18.5), V(-3.2, -24), V(-5.6, -36), V(-6.4, -46), V(-4, -53), V(1.5, -55), V(6.2, -51.5), V(7.4, -45), V(7, -38.5), V(5.2, -36.4)]
    wire('SNAPHOOK_BODY', body, 2.25, m, col, flat=0.82)
    wire('SNAPHOOK_GATE', [V(2, -21.5), V(4.6, -29), V(5.8, -35.4)], 1.05, m, col)
    rbox('SNAPHOOK_TRIGGER', (3.2, 3, 9), V(4.2, -24.5), 1.1, m, col)
    anchor('ATTACHMENT_TOP', V(0, 0), col)
    anchor('ANCHOR_BOTTOM', V(0.6, -53.2), col)
    return col


def build_swivel():
    col = collection('SWIVEL')
    m = metal()
    torus('SWIVEL_EYE', 4.2, 1.05, V(0, -4.2), EYE_ROT, m, col)
    lathe('SWIVEL_BARREL', [(0.01, 0), (2.0, 0), (2.4, -0.5), (2.4, -3.2), (3.0, -3.7), (3.0, -6.2), (2.2, -6.9), (0.01, -6.9)], -8, m, col)
    j = [V(0, -15.6), V(0, -22), V(-0.6, -30), V(1.2, -36.5), V(5.2, -38), V(8.6, -34.5), V(8.8, -29), V(8.2, -25.5)]
    wire('SWIVEL_HOOK', j, 1.6, m, col)
    wire('SWIVEL_LATCH', [V(0.4, -17.5), V(4.6, -20.6), V(7.9, -24.4)], 0.55, m, col)
    anchor('ATTACHMENT_TOP', V(0, 0), col)
    anchor('ANCHOR_BOTTOM', V(4.6, -36.4), col)
    return col


def build_keyring():
    col = collection('KEYRING')
    R, pts = 12.5, []
    for k in range(0, 181, 3):
        a = (k / 180) * math.pi * 3.6
        pts.append(Vector(((k / 180 - 0.5) * 2.1, R * math.sin(a), -R + R * math.cos(a))))
    wire('KEYRING_COIL', pts, 0.85, metal(), col, res=3)
    anchor('ATTACHMENT_TOP', V(0, 0), col)
    anchor('ANCHOR_BOTTOM', V(0, -2 * R), col)
    return col


def build_plasticclip():
    col = collection('PLASTICCLIP')
    w = max(BASE_WIDTH + 5, 16)
    plate('PLASTICCLIP_LOOP', rounded_rect(w, 10, 2.5, 0, -5), [rounded_rect(w - 5, 3.2, 1.2, 0, -4.6)], 3, plastic(), col, bevel=0.5)
    rbox('PLASTICCLIP_STEM', (6, 3.4, 14), V(0, -15), 1.4, plastic(), col)
    wire('PLASTICCLIP_HOOK', [V(0, -21), V(-0.5, -30), V(2.5, -37), V(8, -37.5), V(10.5, -32), V(9.8, -26.5)], 2.1, plastic(), col, flat=1.4)
    anchor('STRAP_IN', V(0, -4.6), col)
    anchor('ANCHOR_BOTTOM', V(4.8, -35.5), col)
    return col


PARTS = {
    'crimp': build_crimp,
    'buckle': build_buckle,
    'breakaway': build_breakaway,
    'snaphook': build_snaphook,
    'swivel': build_swivel,
    'keyring': build_keyring,
    'plasticclip': build_plasticclip,
}


def export(col, path):
    for o in bpy.context.scene.objects:
        o.select_set(o.name in col.all_objects)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT', export_cameras=False, export_lights=False)


def main():
    reset()
    cols = {pid: build() for pid, build in PARTS.items()}
    for pid, col in cols.items():
        export(col, os.path.join(EXPORT, f'{pid}.glb'))
    # scène de travail : pièces décalées côte à côte pour la planche
    for i, col in enumerate(cols.values()):
        for o in col.all_objects:
            o.location.x += i * 45
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(EXPORT, 'SKLUBS_HARDWARE_MASTER.blend'))
    for pid in PARTS:
        print(pid, os.path.getsize(os.path.join(EXPORT, f'{pid}.glb')), 'octets')


if __name__ == '__main__':
    main()
