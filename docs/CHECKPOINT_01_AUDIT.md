# Checkpoint 01 — Audit

Référence visuelle : planche SKLUBS 12 écrans (version 2, « 01 Page d'accueil » → « 12 Finalisation »).

## Existant SKLUBS (dépôts de la session)

| Dépôt | Contenu | Réutilisable pour Event |
|---|---|---|
| `chaussette` | Configurateur Bouteille : HTML + JS modules + Three.js 0.170 (CDN), `product.json`, moteur de prix « TO_DEFINE », bundle d'aperçu | Stack, schéma de prix sans valeur inventée, `build_preview.py`, export projet JSON + PNG |
| `box` | Luxury Box Lab : un seul HTML, Three.js, panier projet localStorage, brief usine | Principe « Ajouter au projet » multi-produits, vue technique éclatée |
| `carte-de-visite`, `lehastudio` | Prototypes et docs | Rien de directement réutilisable pour la 3D |
| `landyard` | Configurateur Lanyard v1 (ce dépôt) | Base de travail |

Pas de design system partagé : Bouteille utilise Inter Tight, Box utilise Barlow. Pas de header/footer commun,
pas de pont WooCommerce, pas d'analytics, pas de React / R3F. **Décision :** rester en HTML + JS modules + Three.js
(même stack que Bouteille), tokens dans `styles.css`, police Inter Tight (celle de Bouteille) + serif italique pour « IN MOTION. ».

## Ce que la v1 couvre déjà

- 12 écrans, ruban paramétrique (longueur exacte, torsion, épaisseur, section plate ou tubulaire), motif en espace UV.
- Assemblage par composants avec points d'accroche (`bottom` de chaque pièce), vue éclatée, cotes orange.
- Répétition (simple / répété, entraxe, décalage, rotation, sens de lecture), recto / verso différent, aperçu 1 m.
- Prix et MOQ à `null` → « Validation usine requise ».

## Écarts avec le guide maître

| # | Écart | Gravité | Checkpoint |
|---|---|---|---|
| 1 | Hero : lanyard petit et lointain ; la maquette le montre énorme, mousqueton proche caméra | MAJEUR | 02 |
| 2 | Hero : fond uni ; la maquette a une architecture blanche (éclats, verre, lumière orange) | MAJEUR | 02 |
| 3 | Ruban sans liseré orange (présent sur toute la planche) | MAJEUR | 02 |
| 4 | Rangée catégories : vignettes rognées, icônes grises pour 4 catégories | MAJEUR | 02 |
| 5 | Compteur hero 01 / 07 (modèles) au lieu de 01 / 06 (catégories) | MINEUR | 02 |
| 6 | Arborescence `/products/event/<catégorie>/<produit>` et fichiers séparés (components, print-rules, pricing) | Architecture | 03 |
| 7 | Points d'accroche nommés (`ATTACHMENT_TOP`, `HOLDER_ANCHOR`…) au lieu d'un seul `bottom` | Architecture | 07 |
| 8 | Transitions entre modèles (fondu / dolly 350–550 ms) | MINEUR | 03 |
| 9 | Écran 07 sans onglets (Logo & texte, Position, Taille, Rotation, Couleur, Répétition), pas de cadre de sélection sur la 3D | MAJEUR | 06 |
| 10 | Écran 10 sans onglets Porte-badge / Badge nominatif / Pass VIP, pas d'import de visuel sur le pass | MAJEUR | 08 |
| 11 | Mobile : panneau empilé, pas de bottom sheet 3 états | MAJEUR | 10 |
| 12 | États (LOADING_MODEL, MODEL_ERROR, PRICE_UNAVAILABLE…) et événements analytics absents | MINEUR | 09–10 |
| 13 | Pièces procédurales, pas de GLB par composant | Hors périmètre UI (prompt 3D séparé) | — |

## Ordre de travail

Checkpoint par checkpoint, avec la boucle référence → implémentation → capture → comparaison → correction,
et `docs/VISUAL_DIFF_REPORT.md` mis à jour à chaque écran.
