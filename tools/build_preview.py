"""Construit la version « page d'aperçu » du configurateur (hébergement Artifact claude.ai).

Contraintes de cet hébergement : pas de téléchargement, fichiers locaux limités.
On produit un index.html autonome : CSS, JS et données produit intégrés
(Three.js et les polices restent chargés depuis leur CDN).
Usage : python3 tools/build_preview.py <dossier_sortie>
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

# JS : un seul module en ligne (imports relatifs retirés, exports déclassés)
js = ''
for f in ('strap.js', 'artwork.js', 'parts.js', 'pricing.js', 'viewer.js', 'main.js'):
    s = open(os.path.join(ROOT, 'js', f)).read()
    s = re.sub(r"^import [^;]*from '\./[^']+';\n", '', s, flags=re.M)
    s = re.sub(r'^export ', '', s, flags=re.M)
    js += f'\n// ---- {f}\n' + s
# parts.js est importé en espace de noms (P.xxx) : on le recrée
js = js.replace('// ---- pricing.js', 'const P = { crimp, buckle, breakaway, buildAttachment, card, holder };\n// ---- pricing.js', 1)
imports = sorted(set(re.findall(r"^import [^;]*from 'three[^']*';$", js, flags=re.M)))
js = re.sub(r"^import [^;]*from 'three[^']*';\n", '', js, flags=re.M)
js = '\n'.join(imports) + '\n' + js

product = json.load(open(os.path.join(ROOT, 'products', 'lanyard', 'product.json')))
h = open(os.path.join(ROOT, 'index.html')).read()
css = open(os.path.join(ROOT, 'styles.css')).read()
head = re.search(r'<head>(.*)</head>', h, re.S).group(1)
body = re.search(r'<body>(.*)</body>', h, re.S).group(1)
head = re.sub(r'\s*<meta[^>]*>', '', head)
head = head.replace('<title>SKLUBS — Configurateur Lanyard 3D</title>', '<title>SKLUBS Lanyard 3D</title>')
head = head.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
data = json.dumps(product, ensure_ascii=False).replace('</', '<\\/')
body = body.replace('<script type="module" src="js/main.js"></script>',
                    f'<script>window.SKLUBS_PREVIEW = true; window.SKLUBS_PRODUCT = {data};</script>\n'
                    '  <script type="module">\n' + js.replace('</script', '<\\/script') + '\n  </script>')
open(os.path.join(OUT, 'index.html'), 'w').write(head.strip() + '\n' + body.strip() + '\n')
print('ok', OUT)
