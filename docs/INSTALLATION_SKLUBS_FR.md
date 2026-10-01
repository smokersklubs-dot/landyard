# Mise en ligne et connexion à sklubs.fr

Le configurateur vit sur **landyard.sklubs.fr** (Vercel). sklubs.fr (WordPress + WooCommerce, Hostinger, derrière Cloudflare)
y envoie les visiteurs par des liens, et **reçoit les demandes de devis** grâce au plugin « SKLUBS Event Quotes ».

Le configurateur renvoie déjà vers sklubs.fr : Inspiration (portfolio), À propos, recherche, Mon compte,
« Retour sur sklubs.fr », tous les configurateurs, délais & MOQ, contact.

## 1. Installer le plugin sur sklubs.fr (5 min)

1. Télécharger `wordpress-plugin/sklubs-event-quotes.zip` depuis le dépôt GitHub `smokersklubs-dot/landyard`
   (ouvrir le fichier sur GitHub → bouton « Download raw file »).
2. Admin WordPress → **Extensions → Ajouter → Téléverser une extension** → choisir le .zip → **Installer** → **Activer**.
3. Nouveau menu **Devis Event → Réglages** :
   - *E-mails qui reçoivent les devis* : l'adresse de l'équipe (plusieurs possibles, séparées par des virgules) ;
   - *Sites autorisés* : laisser `https://landyard.sklubs.fr` et `https://sklubs.fr` ;
   - *Accusé de réception* : coché.
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

- **Menu** : Apparence → Menus (ou Elementor → Header) → lien personnalisé
  `https://landyard.sklubs.fr`, libellé « Lanyards 3D ».
- **Page « Configurateurs produits »** (`/configurateurs-produits/`) : ajouter une carte Lanyard avec le bouton
  `[sklubs_lanyard_button text="Configurer mon lanyard en 3D"]` (widget « Code court » dans Elementor).
- Même bouton possible sur les pages produits liées (badges, goodies, événementiel).

## 5. Tester

Sur landyard.sklubs.fr : configurer un lanyard, importer un logo, étape 12 → **Demander un devis** → remplir le formulaire.
Résultat attendu :
- message « Demande SK-… envoyée » dans le configurateur ;
- nouvelle fiche dans **Devis Event** (contact, configuration, BAT, logo, aperçu) ;
- e-mail à l'équipe avec les pièces jointes, e-mail de confirmation au client.

Tant que le plugin n'est pas installé, le bouton télécharge le dossier complet (configuration, aperçu, BAT) au lieu d'envoyer.

## Suivi des demandes

Devis Event → Toutes les demandes : statut (Nouveau, En cours, Devis envoyé, Gagné, Perdu), quantité, date d'événement.
« Répondre » dans l'e-mail reçu écrit directement au client.
