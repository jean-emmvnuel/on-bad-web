// Abonnement des composants au store (store.js).
// Le store est un objet modifié sur place : on s'abonne à son numéro de version, puis le composant
// relit ce dont il a besoin (S.feed(), S.bading(id)…), dont les résultats coûteux sont en cache par version.
import { useSyncExternalStore } from 'react';
import * as S from './store.js';

/** Redessine le composant à chaque modification du store ; renvoie la version courante. */
export const useStore = () => useSyncExternalStore(S.subscribe, S.getVersion);
