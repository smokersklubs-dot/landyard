> Version pas à pas pour débutant : [`GUIDE_DEBUTANT.md`](../GUIDE_DEBUTANT.md).

# Mise en ligne et connexion à sklubs.fr

Comme les autres configurateurs SKLUBS (bags.sklubs.fr…), le lanyard vit sur un **sous-domaine Vercel :
landyard.sklubs.fr**, avec le même en-tête et pied de page que sklubs.fr (`site-chrome.js`, repris de bags).
Il est **relié à WooCommerce** par le plugin « SKLUBS Event Quotes » installé sur sklubs.fr :

| Situation | Bouton principal | Ce qui se passe dans WooCommerce |
|---|---|---|
| Grille de prix incomplète (aujourd'hui) | **Demander un devis** | Commande créée au statut **« Devis demandé »** (client, ligne « Lanyard personnalisé », configuration). Fiche « Devis Event » avec BAT, logo, aperçu. E-mail à l'équipe + accusé de réception au client. |
| Grille de prix remplie | **Ajouter au panier** | Le lanyard est ajouté au **panier de sklubs.fr** avec son prix (recalculé côté serveur) ; le client paie avec le tunnel WooCommerce habituel. |

### Chiffrer un devis dans WooCommerce
WooCommerce → Commandes → filtre « Devis demandé » → ouvrir la commande :
1. saisir le prix de la ligne « Lanyard personnalisé » (total du lot), cliquer « Recalculer » ;
2. passer le statut à **« En attente de paiement »** et enregistrer ;
3. Actions de commande → **« Envoyer la facture / les détails de commande au client »** : le client reçoit un lien de paiement.
Le lien « Voir le BAT, le logo et l'aperçu 3D » est sous la ligne de la commande.

## 1. Installer le plugin sur sklubs.fr (5 min)

1. Télécharger `wordpress-plugin/sklubs-event-quotes.zip` depuis le dépôt GitHub `smokersklubs-dot/landyard`
   (ouvrir le fichier sur GitHub → bouton « Download raw file »).
2. Admin WordPress → **Extensions → Ajouter → Téléverser une extension** → choisir le .zip → **Installer** → **Activer**.
3. Nouveau menu **Devis Event → Réglages** :
   - *E-mails qui reçoivent les devis* : l'adresse de l'équipe (plusieurs possibles, séparées par des virgules) ;
   - *Sites autorisés* : laisser `https://landyard.sklubs.fr` et `https://sklubs.fr` ;
   - *Accusé de réception* : coché.
   L'activation crée aussi la page `sklubs.fr/configurateur-de-lanyards-personnalises/` qui redirige vers
   landyard.sklubs.fr, comme `/configurateur-de-sacs-personnalises/` pour bags.
4. Vérifier : ouvrir <https://sklubs.fr/wp-json/sklubs/v1/ping> → doit afficher `{"ok":true,...}`.

> Si un plugin de sécurité (Wordfence, Hostinger, LiteSpeed…) bloque l'API REST, autoriser la route `/wp-json/sklubs/v1/`.
> Les e-mails partent avec la fonction d'envoi de WordPress : si les e-mails du site arrivent mal,
> installer un plugin SMTP (ex. WP Mail SMTP avec l'adresse Hostinger).

## 2. Mettre le configurateur en ligne sur Vercel (3 min)

1. <https://vercel.com> → se connecter avec GitHub → **Add New → Project** → importer `smokersklubs-dot/landyard`.
2. Framework Preset : **Other** ; ne rien changer d'autre → **Deploy**. Branche de production : `main`.

## 3. Brancher landyard.sklubs.fr (2 min + propagation)

1. Vercel → projet → **Settings → Domains** → ajouter `landyard.sklubs.fr`.
2. **Cloudflare** (le DNS de sklubs.fr y est géré) → zone sklubs.fr → **DNS → Add record** :
   - Type `CNAME`, Name `landyard`, Target `cname.vercel-dns.com` ;
   - Proxy status : **DNS only** (nuage gris), sinon le certificat Vercel ne s'émet pas.
3. Attendre que Vercel affiche « Valid Configuration ». Le HTTPS est automatique.

## 4. Ajouter les liens sur sklubs.fr

Le menu commun (`site-chrome.js`) est le même que sur bags.sklubs.fr : pour que « Lanyards 3D » y apparaisse
sur tous les configurateurs, l'ajouter dans le menu source puis recopier `site-chrome.js` dans ce dépôt.

- **Menu** : Apparence → Menus (ou Elementor → Header) → lien personnalisé
  `https://landyard.sklubs.fr`, libellé « Lanyards 3D ».
- **Page « Configurateurs produits »** (`/configurateurs-produits/`) : ajouter une carte Lanyard avec le bouton
  `[sklubs_lanyard_button text="Configurer mon lanyard en 3D"]` (widget « Code court » dans Elementor).
- Même bouton possible sur les pages produits liées (badges, goodies, événementiel).

## 5. Activer le panier : la grille de prix

**Devis Event → Prix** : un tableau avec une case par prix (HT, en euros, `0,62`), le MOQ et les remises par quantité.
Case vide = prix inconnu.
Dès que tout est rempli, le configurateur affiche les prix en direct et le bouton « Ajouter au panier ».
Tant qu'une valeur manque pour la configuration choisie, il reste en « Sur devis ».

## 6. Tester

Sur landyard.sklubs.fr : configurer un lanyard, importer un logo, étape 12 → **Demander un devis** → remplir le formulaire.
Résultat attendu :
- message « Demande SK-… envoyée » dans le configurateur ;
- nouvelle fiche dans **Devis Event** (contact, configuration, BAT, logo, aperçu) ;
- e-mail à l'équipe avec les pièces jointes, e-mail de confirmation au client.

Tant que le plugin n'est pas installé, le bouton télécharge le dossier complet (configuration, aperçu, BAT) au lieu d'envoyer.

## Suivi des demandes

Devis Event → Toutes les demandes : statut (Nouveau, En cours, Devis envoyé, Gagné, Perdu), quantité, date d'événement.
« Répondre » dans l'e-mail reçu écrit directement au client.
