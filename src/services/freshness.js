// Fraîcheur des données chargées depuis le serveur.
// Un écran déjà chargé il y a peu s'affiche tout de suite depuis le cache (le store) sans refaire de requête ;
// au-delà de `maxAge`, il s'affiche quand même tout de suite et se met à jour en arrière-plan.

const loadedAt = new Map();

/** Note que la donnée `key` vient d'être chargée. */
export const markFresh = (key) => loadedAt.set(key, Date.now());

/** La donnée a-t-elle déjà été chargée une fois depuis l'ouverture de l'app ? */
export const wasLoaded = (key) => loadedAt.has(key);

/** A-t-elle été chargée il y a moins de `maxAge` ms ? */
export const isFresh = (key, maxAge) => Date.now() - (loadedAt.get(key) ?? 0) < maxAge;

/** Oublie tout (déconnexion : les données du compte précédent ne doivent pas être réutilisées). */
export const forgetAll = () => loadedAt.clear();
