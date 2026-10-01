"""Construit la version « page d'aperçu » du configurateur (hébergement Artifact claude.ai).

Contraintes de cet hébergement : pas de téléchargement, fichiers locaux limités.
On produit un index.html autonome : CSS, JS et données produit intégrés
(Three.js et les polices restent chargés depuis leur CDN).
Usage : python3 tools/build_preview.py <dossier_sortie>
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

# JS : un seul module en ligne. Chaque fichier est isolé dans sa propre fonction
# (noms internes sans collision) et ses imports relatifs deviennent des déstructurations.
ORDER = ('config.js', 'strap.js', 'artwork.js', 'parts.js', 'hardware.js', 'bat.js', 'pricing.js', 'viewer.js', 'main.js')
mod = lambda f: '__m_' + f[:-3]
three_imports, body = set(), ''
for f in ORDER:
    s = open(os.path.join(ROOT, 'js', f)).read()
    for m in re.findall(r"^import [^;]*from 'three[^']*';$", s, flags=re.M):
        three_imports.add(m)
    s = re.sub(r"^import [^;]*from 'three[^']*';\n", '', s, flags=re.M)
    def rel(m):
        what, src = m.group(1).strip(), mod(m.group(2) + '.js')
        if what.startswith('* as '):
            return f'const {what[5:].strip()} = {src};'
        names = what.strip('{} ').replace('\n', ' ')
        return 'const { ' + re.sub(r'(\w+)\s+as\s+(\w+)', r'\1: \2', names) + f' }} = {src};'
    s = re.sub(r"^import\s+(.+?)\s+from\s+'\./([\w-]+)\.js';", rel, s, flags=re.M | re.S)
    exported = re.findall(r'^export\s+(?:async\s+)?(?:function\*?|class|const|let)\s+(\w+)', s, flags=re.M)
    s = re.sub(r'^export ', '', s, flags=re.M)
    body += f'\n// ---- {f}\nconst {mod(f)} = (() => {{\n{s}\nreturn {{ {", ".join(exported)} }};\n}})();\n'
js = '\n'.join(sorted(three_imports)) + '\n' + body

product = json.load(open(os.path.join(ROOT, 'products', 'lanyard', 'product.json')))
h = open(os.path.join(ROOT, 'index.html')).read()
css = open(os.path.join(ROOT, 'styles.css')).read()
head = re.search(r'<head>(.*)</head>', h, re.S).group(1)
body = re.search(r'<body>(.*)</body>', h, re.S).group(1)
head = re.sub(r'\s*<meta[^>]*>', '', head)
head = head.replace('<title>SKLUBS — Configurateur Lanyard 3D</title>', '<title>SKLUBS Lanyard 3D</title>')
# l'aperçu charge Three.js depuis le CDN (le site, lui, sert sa copie dans vendor/)
head = head.replace('"./vendor/three/build/three.module.js"', '"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"')
head = head.replace('"./vendor/three/addons/"', '"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"')
head = re.sub(r'\s*<link rel="(modulepreload|icon)"[^>]*>', '', head)
hw = {}
for f in sorted(os.listdir(os.path.join(ROOT, 'hardware-master', 'export'))):
    if f.endswith('.glb'):
        hw[f[:-4]] = base64.b64encode(open(os.path.join(ROOT, 'hardware-master', 'export', f), 'rb').read()).decode()
head = head.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
data = json.dumps(product, ensure_ascii=False).replace('</', '<\\/')
body = body.replace('<script type="module" src="js/main.js"></script>',
                    f'<script>window.SKLUBS_PREVIEW = true; window.SKLUBS_PRODUCT = {data}; window.SKLUBS_HARDWARE = {json.dumps(hw)};</script>\n'
                    '  <script type="module">\n' + js.replace('</script', '<\\/script') + '\n  </script>')
open(os.path.join(OUT, 'index.html'), 'w').write(head.strip() + '\n' + body.strip() + '\n')
print('ok', OUT)
