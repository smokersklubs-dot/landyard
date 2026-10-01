# SKLUBS EVENT 3D — Configurateur Lanyard

Premier produit du moteur **SKLUBS EVENT 3D** : un lanyard entièrement paramétrique,
assemblé à partir de pièces modulaires, dans la DA blanche futuriste SKLUBS (accent orange `#FF6A00`).

Site statique : HTML + CSS + JavaScript (modules ES) + Three.js 0.170 chargé par CDN. Aucune étape de build.

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
| 07 | Personnalisation | Import logo PNG/JPG/SVG, texte, couleurs, taille, rotation |
| 08 | Impression & répétition | Sérigraphie (réduction auto à 3 couleurs), sublimation, tissage ; recto / recto-verso / verso différent ; simple ou répété, entraxe, décalage, sens de lecture ; aperçu à plat sur 1 m |
| 09 | Attaches | Mousqueton, crochet tournant, clip plastique, anneau, double attache, patch téléphone, sans ; safety breakaway ; boucle détachable ; couleur métal |
| 10 | Badge & pass | *Complete your event kit* : lanyard seul / + porte-badge / + porte-badge + pass imprimé ; PVC souple, PVC rigide, cuir ; vertical / horizontal ; pass CR80 personnalisé |
| 11 | Quantité & prix | Paliers 100 → 5 000, quantité libre |
| 12 | Finalisation | Récapitulatif, ajouter au projet, demander un devis, sauvegarder (JSON + PNG) |

Mobile : viewer en haut, panneau dessous, barre d'actions collante.

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
| `tools/build_preview.py` | Version autonome (un seul HTML) pour l'aperçu hébergé |

Le modèle n'est **pas** un GLB par combinaison : le moteur assemble les composants.
Ajouter une attache = ajouter un constructeur dans `parts.js` (ou, plus tard, un GLB via le champ `model`
de `attachments` dans `product.json`) et l'autoriser dans `rules.attachmentsByPose`.

Le motif suit la courbure du textile : il est plaqué dans l'espace UV du ruban (u = longueur, v = largeur),
une tuile par entraxe. Le mode « lisible des deux côtés » retourne le motif à mi-longueur.

## Données à fournir (TO_DEFINE)

Aucun prix, MOQ ni compatibilité usine n'a été inventé. Tant que ces valeurs sont vides,
le configurateur affiche **Validation usine requise** au lieu d'un prix.

- Prix : base par modèle, suppléments largeur / longueur / matière / impression / verso,
  breakaway, boucle, attaches, porte-badges, pass imprimé, frais de calage, remises (`pricing`).
- MOQ (`quantity.moq`).
- Compatibilités matière / méthode / attache (`rules`) : brouillon technique à valider.
- Largeurs et longueurs réellement disponibles par modèle, épaisseurs textiles.
- Nuancier usine et couleurs métal disponibles.
- Point d'envoi des projets (`SUBMIT_ENDPOINT` dans `js/main.js`). En attendant, les boutons
  de devis et de sauvegarde téléchargent le fichier projet et l'aperçu PNG.

## Fichier projet exporté

Structure `LANYARD` : `TYPE`, `POSE`, `WIDTH_MM`, `LENGTH_MM`, `MATERIAL`, `BASE_COLOR`, `FINISH`,
`ARTWORK` (`FRONT`, `BACK`, `READING`, avec mode, taille, rotation, entraxe, décalage),
`PRINT_METHOD`, `BREAKAWAY`, `BUCKLE`, `ATTACHMENT`, `HARDWARE_COLOR`, `KIT`, `HOLDER`, `PASS`,
`QUANTITY`, `PRICE`, `FACTORY_RULES` ; plus `logo_files`, `preview_image` (PNG) et `timestamp`.

## Suite prévue

1. Planche technique validée du Lanyard Master et des attaches (cotes usine).
2. Master Blender / GLB par pièce (le moteur charge déjà chaque pièce séparément).
3. Bracelets, porte-badges, badges et passes VIP comme catégories à part entière.
