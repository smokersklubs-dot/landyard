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
