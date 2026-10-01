# Visual diff report

Référence : planche SKLUBS 12 écrans (v2). Captures : Chromium, rendu WebGL logiciel, 1440 × 900 et 390 × 844.
Statuts : **MATCH** · **MINOR DIFFERENCE** · **MAJOR DIFFERENCE**.

## Screen 01 — Page d'accueil (checkpoint 02)

Référence `qa/01-home-reference.jpg` · Implémentation `qa/01-home-lanyards.jpg`, `qa/01-home-badges.jpg`, `qa/01-home-mobile-390.jpg`

| Point | Avant | Après | Statut |
|---|---|---|---|
| Header (logo, 4 liens, icônes, CTA orange) | conforme | inchangé | MATCH |
| Titre « YOUR BRAND. » noir + « IN MOTION. » serif italique orange | serif système | Instrument Serif italique, jamais coupé | MATCH |
| Échelle du produit | lanyard entier, petit, à droite | gros plan : ruban 25 mm torsadé, boucle, mousqueton vers la caméra | MATCH |
| Liseré orange sur les bords du ruban | absent | deux filets orange (option `edge` du motif, aussi dans le configurateur) | MATCH |
| Décor 3D | fond uni | éclats blancs laqués, plaques de verre, filets lumineux orange, socle | MINOR — moins dense que la planche |
| Noir du ruban | gris | noir profond (reflet satiné réduit, exposition hero) | MINOR — un peu plus clair que la planche |
| Avantages (4 pictos) | conforme | inchangé | MATCH |
| Compteur | 01 / 07 (modèles) | 01 / 06 (catégories), verre dépoli + bouton rond | MATCH |
| Rangée catégories | vignettes rognées, 4 icônes grises | 6 rendus réels du moteur, carte active bordée orange, synchronisée avec le hero | MATCH |
| Hero par catégorie | — | Lanyard, bracelet, porte-badge, badge, pass VIP, porte-clés | MATCH |
| Mobile 390 px | 3D au-dessus du texte | texte, CTA, puis 3D ; catégories en 3 colonnes | MATCH |
| Sous-titre | 2 phrases | 2 phrases (la planche n'en montre qu'une) | MINOR — texte du guide conservé |

Aucune MAJOR DIFFERENCE restante sur l'écran 01.

## Screens 02 → 12 et mobile (checkpoints 03 → 10)

Captures : `qa/02-desktop.jpg` … `qa/12-desktop.jpg`, `qa/07-desktop-logo.jpg`, `qa/mobile-390.jpg`, BAT : `qa/exemple-BAT.pdf`.

| Écran | Point | Statut |
|---|---|---|
| 02 Catégorie | Titre, sous-titre, 6 cartes avec rendus 3D portrait, carte active orange | MATCH |
| 03 Modèle | Vignettes verticales, flèches, gros viewer, fiche (Matière, Largeur, Longueur, Personnalisation, Utilisation), « Choisir ce modèle » | MATCH |
| 03 Modèle | Transition entre modèles (rotation + échelle, 450 ms, respecte « réduire les animations ») | MATCH |
| 03–12 | Décor 3D : éclats blancs, verre, filets orange, podium | MINOR — moins dense que la planche |
| 04 Vue 3D | Outils à droite, vignettes de vues à gauche, vue éclatée annotée | MATCH |
| 05 Dimensions | Largeur / longueur, cotes orange qui suivent le ruban | MATCH |
| 06 Matière | Liste matières, nuancier, finition, macro matière | MATCH |
| 07 Personnalisation | Onglets, grand bouton d'import, cadre orange sur le ruban, zones d'impression | MATCH |
| 08 Impression | Type d'impression, recto / verso, répétition, entraxe, aperçu 1 m | MATCH |
| 09 Attaches | Grille d'attaches avec icônes, pièces Blender dans la vue | MATCH |
| 09 Attaches | « Accessoires supplémentaires » de la planche : traités à l'écran 10 | MINOR |
| 10 Badge & pass | Kit, onglets Porte-badge / Badge nominatif / Pass VIP, visuel du pass importable, liste de noms | MATCH |
| 10 (planche « Aperçu final ») | Vues Studio / Lifestyle / Vue 2D gabarit | MINOR — remplacé par le BAT (vue 2D gabarit) à l'écran 12 |
| 11 Quantité | Tableau des paliers, palier actif orange, « Ajouter au projet » ; prix « Sur devis » tant que la grille n'est pas fournie | MATCH (prix volontairement absents) |
| 12 Finalisation | Récapitulatif, Ajouter au projet, Demander un devis (formulaire), Sauvegarder, BAT | MATCH |
| Mobile 390 | Viewer en haut, bottom sheet réduit / moitié / plein écran, cadrage 3D recentré | MATCH |

Aucune MAJOR DIFFERENCE restante.
