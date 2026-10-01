// Réglages de mise en ligne — seul fichier à modifier pour brancher les devis.
export const CONFIG = {
  // Demandes de devis : enregistrées dans WordPress (plugin « SKLUBS Event Quotes » sur sklubs.fr),
  // avec BAT, logo et aperçu, puis e-mail à l'équipe et accusé de réception au client.
  quote: {
    provider: 'wordpress',                                  // 'wordpress', 'web3forms' ou 'formspree'
    endpoint: 'https://sklubs.fr/wp-json/sklubs/v1/quote',
    accessKey: null,                                        // seulement pour Web3Forms / Formspree
    attachFiles: true,                                      // le plugin WordPress accepte les fichiers
    subject: 'Demande de devis — Lanyard SKLUBS',
  },
  site: 'https://sklubs.fr',
  // WooCommerce (plugin « SKLUBS Event Quotes ») : grille de prix lue sur sklubs.fr, panier sklubs.fr.
  woo: {
    pricing: 'https://sklubs.fr/wp-json/sklubs/v1/pricing',
    cart: 'https://sklubs.fr/wp-json/sklubs/v1/cart',
  },
  // Analytics : les événements sont poussés dans window.dataLayer (Google Tag Manager, GA4, etc.).
  analytics: true,
};
