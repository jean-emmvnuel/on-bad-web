// Règles de format du pseudo, partagées entre l'inscription et les paramètres.
// La disponibilité, elle, est demandée au serveur (services/auth.js → isPseudoAvailable).

export const PSEUDO_PATTERN = /^[A-Za-z0-9_.]{3,20}$/;
export const PSEUDO_FORMAT_ERROR = 'Entre 3 et 20 caractères : lettres, chiffres, _ ou .';
