# SKLUBS EVENT 3D — Configurateur Lanyard

Premier produit du moteur **SKLUBS EVENT 3D** : un lanyard entièrement paramétrique,
assemblé à partir de pièces modulaires, dans la DA blanche futuriste SKLUBS (accent orange `#FF6A00`).

Site statique : HTML + CSS + JavaScript (modules ES) + Three.js 0.170 chargé par CDN. Aucune étape de build.

## Mise en ligne — landyard.sklubs.fr (Vercel)

Site statique, aucune étape de build. Three.js est servi depuis `vendor/` (aucune dépendance CDN au runtime).

1. **Vercel** : *Add New → Project*, importer le dépôt GitHub `smokersklubs-dot/landyard`.
   Framework preset : **Other**. Build command : vide. Output directory : `.` (racine). Déployer.
2. **Domaine** : *Project → Settings → Domains*, ajouter `landyard.sklubs.fr`.
   Chez le gestionnaire DNS de `sklubs.fr`, créer l'enregistrement indiqué par Vercel
   (en général `CNAME landyard → cname.vercel-dns.com`). HTTPS est automatique.
3. **WooCommerce et devis** : installer le plugin WordPress `wordpress-plugin/sklubs-event-quotes.zip` sur sklubs.fr.
   Chaque devis crée une commande WooCommerce « Devis demandé » (+ fiche avec BAT, logo, aperçu, e-mails).
   Quand la grille de prix est saisie dans WordPress, le bouton « Ajouter au panier » envoie le lanyard dans le panier sklubs.fr.
   Guide pas à pas : [`docs/INSTALLATION_SKLUBS_FR.md`](docs/INSTALLATION_SKLUBS_FR.md).
4. **Analytics** (facultatif) : ajouter le snippet Google Tag Manager / GA4 dans `index.html` ;
   les événements du configurateur sont déjà poussés dans `window.dataLayer`.

Chaque push sur la branche de production redéploie le site ; chaque pull request reçoit une URL d'aperçu Vercel.

## Lancer en local

```bash
npx http-server -p 8080 .
# puis ouvrir http://localhost:8080  (ou http://localhost:8080/#config pour aller direct au configurateur)
```

Un serveur HTTP est nécessaire (le produit est chargé depuis `products/lanyard/product.json`).

## Parcours (12 écrans)

| # | Écran | Contenu |
|---|---|---|
| 01 | Accueil | Hero « YOUR BRAND. IN MOTION. », lanyard 3D en mouvement textile, lignes de trajectoire orange |
| 02 | Catégorie | Lanyards, Porte-clés (actifs) · Bracelets, Porte-badges, Badges, Passes VIP (bientôt) |
| 03 | Modèle | Classic, Sublimation, Tissé, Tubulaire, RPET, Phone lanyard, Wrist strap — vignettes rendues par le moteur |
| 04 | Vue 3D | Rotation 360°, avant, arrière, dessus, profil, nuque, attache, macro matière, **vue éclatée annotée** + arbre `LANYARD_MASTER` |
| 05 | Dimensions | Largeur, longueur (ou sur mesure), cotes orange sur le modèle |
| 06 | Matière & couleur | Polyester, satin, RPET, tissé, bambou, tubulaire (cartes de normales procédurales), nuancier + HEX, finition |
| 07 | Personnalisation | Onglets Logo & texte, Position, Taille, Rotation, Couleur, Répétition ; grand bouton « Importer un logo » (PNG, JPG, SVG), fond blanc retiré automatiquement, logo en couleurs d'origine ou monochrome, liseré, cadre de placement orange sur le ruban, zones d'impression recto / recto-verso / verso différent |
| 08 | Impression & répétition | Sérigraphie (réduction auto à 3 couleurs), sublimation, tissage ; recto / recto-verso / verso différent ; simple ou répété, entraxe, décalage, sens de lecture ; aperçu à plat sur 1 m |
| 09 | Attaches | Mousqueton, crochet tournant, clip plastique, anneau, double attache, patch téléphone, sans ; safety breakaway ; boucle détachable ; couleur métal |
| 10 | Badge & pass | *Complete your event kit* : lanyard seul / + porte-badge / + porte-badge + pass imprimé ; PVC souple, PVC rigide, cuir ; vertical / horizontal ; pass CR80 personnalisé |
| 11 | Quantité & prix | Paliers 100 → 5 000, quantité libre |
| 12 | Finalisation | Récapitulatif, ajouter au projet, demander un devis, sauvegarder (JSON + PNG) |

Mobile : viewer en haut, panneau dessous, barre d'actions collante.

Le logo peut être ajouté partout : bouton « Importer mon logo » de l'accueil, bouton « Ajouter mon logo » dans la vue 3D,
ou glisser-déposer d'un fichier n'importe où sur la page. Il est appliqué au ruban (recto, verso) et au pass imprimé.

## Architecture

| Fichier | Rôle |
|---|---|
| `products/lanyard/product.json` | Modèles, matières, couleurs, méthodes, attaches, porte-badges, règles, quantités, prix |
| `js/strap.js` | Ruban paramétrique : ligne médiane 3D (pose cou ou dragonne) recalculée pour respecter la longueur exacte, section plate arrondie ou tubulaire, torsion naturelle animée, UV recto / verso / tranche |
| `js/parts.js` | Pièces modulaires : embout serti, boucle détachable, breakaway, 6 attaches, 3 porte-badges, carte CR80. Chaque pièce expose un point d'accroche haut et bas |
| `js/artwork.js` | Motif (logo + texte), répétition en tuile, sérigraphie / tissage, cartes de normales textile, visuel du pass |
| `js/viewer.js` | Scène, assemblage de la chaîne `ruban → embout/boucle → attache → porte-badge → pass`, vue éclatée, cotes, caméras, captures |
| `js/pricing.js` | Compatibilités et calcul du prix |
| `js/main.js` | Écrans, état, panneaux, export projet |
| `js/hardware.js` | Chargement des pièces Blender (GLB), points d'accroche nommés, repli procédural |
| `js/bat.js` | BAT usine : ruban à plat à l'échelle 1 (recto, verso, cotes, spécifications, couleurs, pass) en SVG et PDF |
| `js/config.js` | Réglages de mise en ligne : point d'envoi des devis (sklubs.fr), analytics |
| `wordpress-plugin/` | Plugin WordPress « SKLUBS Event Quotes » (source + .zip à installer sur sklubs.fr) |
| `hardware-master/` | Pièces 3D Blender (script `scripts/build_hardware.py`, `.blend`, un GLB par pièce) |
| `vendor/three/` | Three.js 0.170 (licence MIT) servi avec le site |
| `site-chrome.js` | En-tête et pied de page communs SKLUBS (repris de bags.sklubs.fr) |
| `vercel.json` | En-têtes de cache et de sécurité pour Vercel |
| `tools/build_preview.py` | Version autonome (un seul HTML) pour l'aperçu hébergé |

Le modèle n'est **pas** un GLB par combinaison : le moteur assemble les composants.
Ajouter une attache = ajouter un constructeur dans `parts.js` (ou, plus tard, un GLB via le champ `model`
de `attachments` dans `product.json`) et l'autoriser dans `rules.attachmentsByPose`.

Le motif suit la courbure du textile : il est plaqué dans l'espace UV du ruban (u = longueur, v = largeur),
une tuile par entraxe. Le mode « lisible des deux côtés » retourne le motif à mi-longueur.

## Pièces 3D (Blender)

`python3 hardware-master/scripts/build_hardware.py` (module `bpy` 4.2) reconstruit les pièces et les exporte :
embout serti, boucle détachable, safety breakaway, mousqueton, crochet tournant, anneau, clip plastique.
Chaque pièce porte des points d'accroche nommés (`STRAP_IN`, `ATTACHMENT_TOP`, `ANCHOR_BOTTOM`, `BUCKLE_SPLIT`…)
que le moteur utilise pour assembler la chaîne. Pièces **standard du marché** : cotes à recaler sur le fournisseur.
Le patch téléphone, les porte-badges et le pass restent générés par le code.

## Logo du client

Bouton de l'accueil, bouton « Ajouter mon logo » dans la vue 3D, glisser-déposer ou étape 07.
SVG, PDF (première page), PNG ou JPG, 15 Mo max. Fond blanc retiré automatiquement (désactivable).
Qualité d'impression estimée en dpi selon la taille réelle du logo sur le ruban : alerte en dessous de 150 dpi.

## Données à fournir (TO_DEFINE)

Aucun prix, MOQ ni compatibilité usine n'a été inventé. Tant que ces valeurs sont vides,
le configurateur affiche **Validation usine requise** au lieu d'un prix.

- Prix : base par modèle, suppléments largeur / longueur / matière / impression / verso,
  breakaway, boucle, attaches, porte-badges, pass imprimé, frais de calage, remises (`pricing`).
- MOQ (`quantity.moq`).
- Compatibilités matière / méthode / attache (`rules`) : brouillon technique à valider.
- Largeurs et longueurs réellement disponibles par modèle, épaisseurs textiles.
- Nuancier usine et couleurs métal disponibles.
- Adresse(s) de réception des devis : à saisir dans WordPress, Devis Event → Réglages.
- Logo officiel SKLUBS en SVG (le mot SKLUBS est actuellement composé en texte).

## Fichier projet exporté

Structure `LANYARD` : `TYPE`, `POSE`, `WIDTH_MM`, `LENGTH_MM`, `MATERIAL`, `BASE_COLOR`, `FINISH`,
`ARTWORK` (`FRONT`, `BACK`, `READING`, avec mode, taille, rotation, entraxe, décalage),
`PRINT_METHOD`, `BREAKAWAY`, `BUCKLE`, `ATTACHMENT`, `HARDWARE_COLOR`, `KIT`, `HOLDER`, `PASS`,
`QUANTITY`, `PRICE`, `FACTORY_RULES` ; plus `logo_files`, `preview_image` (PNG) et `timestamp`.

## Suite prévue

1. Cotes usine du ruban et des attaches, puis recalage des pièces Blender.
2. Grille de prix fournisseur (`pricing` dans `product.json`).
3. Bracelets, porte-badges, badges et passes VIP comme produits configurables (aujourd'hui en vitrine « Bientôt »).
