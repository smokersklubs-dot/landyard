// Réglages de mise en ligne — seul fichier à modifier pour brancher les devis.
export const CONFIG = {
  // Envoi des demandes de devis par e-mail via un service de formulaire.
  quote: {
    provider: 'web3forms',                         // 'web3forms' ou 'formspree'
    endpoint: 'https://api.web3forms.com/submit',  // Formspree : https://formspree.io/f/<id>
    accessKey: null,                               // clé Web3Forms (créée avec l'adresse qui reçoit les devis)
    // Pièces jointes (BAT PDF, logo, aperçu, projet JSON) : offre payante du service.
    // false : l'e-mail contient le récapitulatif et le JSON, le client télécharge une copie du dossier.
    attachFiles: false,
    subject: 'Demande de devis — Lanyard SKLUBS',
  },
  // Analytics : les événements sont poussés dans window.dataLayer (Google Tag Manager, GA4, etc.).
  analytics: true,
};
