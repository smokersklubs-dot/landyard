=== SKLUBS Event Quotes ===
Requires at least: 6.0
Requires PHP: 7.4
Stable tag: 1.1.0

Reçoit les demandes de devis du configurateur Lanyard (landyard.sklubs.fr).

== Ce que fait le plugin ==
* Point d'envoi : POST /wp-json/sklubs/v1/quote (test : GET /wp-json/sklubs/v1/ping).
* Chaque demande devient une fiche « Devis Event » dans l'admin : contact, configuration, statut de suivi.
* Fichiers joints (BAT PDF et SVG, logo, aperçu 3D, visuel du pass) rangés dans
  wp-content/uploads/sklubs-quotes/ (accès direct bloqué, téléchargement réservé aux utilisateurs connectés).
* E-mail à l'équipe avec BAT, logo et aperçu en pièces jointes ; accusé de réception au client.
* Sécurité : origines autorisées, champ piège anti-spam, 5 demandes / 10 min par adresse IP,
  types de fichiers vérifiés, 10 Mo max par fichier.
* Bouton à placer dans une page : [sklubs_lanyard_button text="Configurer mon lanyard"].

== Réglages ==
Devis Event → Réglages : adresses qui reçoivent les devis, sites autorisés, accusé de réception.
