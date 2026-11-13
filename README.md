<div align="center">

<img src=".github/assets/banner.svg" alt="On Bade — raconte ce qui t'est arrivé, fais rire tout le monde" width="100%"/>

<br/>

<img src="https://img.shields.io/badge/React-19-1a1919?style=for-the-badge&logo=react&logoColor=B76BFF" alt="React"/>
<img src="https://img.shields.io/badge/Vite-5-1a1919?style=for-the-badge&logo=vite&logoColor=B76BFF" alt="Vite"/>
<img src="https://img.shields.io/badge/GSAP-3.13-1a1919?style=for-the-badge&logo=greensock&logoColor=B76BFF" alt="GSAP"/>

</div>

---

## 😂 On Bade, version web

**On Bade** est le réseau social où l'on raconte ce qui nous est arrivé… pour faire rire tout le monde. En nouchi, **« bader »** veut dire faire des blagues, amuser la galerie : un **bading** est une histoire drôle vécue, publiée **signée ou en « Badeur anonyme »**.

> **Ici, la seule règle, c'est qu'il n'y a pas de règle.** Enfin… presque : on rit des situations, jamais des personnes.

Ce dépôt est la **version web** de l'app mobile ([jean-emmvnuel/jebade](https://github.com/jean-emmvnuel/jebade)), écrite en **React** (JavaScript, sans TypeScript), construite avec **Vite** et animée avec **GSAP**. Même identité, mêmes règles, mêmes écrans, pensée pour le téléphone *et* l'ordinateur.

<div align="center"><img src=".github/assets/feed-card.svg" alt="Un bading, les rires montent en direct" width="460"/></div>

## ✨ Ce que fait le site

| | |
|---|---|
| 🎬 | **Splash GSAP** : le b du logo rit (avec ses dents) puis zoome vers l'app |
| 🎨 | **Onboarding** à glisser (doigt ou souris) : la couleur de fond se transforme, cartes en parallaxe |
| 🔐 | **Inscription** e-mail + mot de passe (afficher/masquer, confirmation), pseudo + charte du Badeur ; **connexion** et mot de passe oublié |
| 📰 | **Fil** façon X : en-tête qui se replie, entrée des cartes en cascade, **pull-to-refresh** où le b rit pendant le chargement |
| 😂 | **Rire** avec explosion de **confettis** (physique GSAP) |
| 🖼️ | **Bading en image** : texte, image ou les deux ; **recadrage avant publication** en portrait 4:5 ou carré 1:1 (fil uniforme), zoom, rotation, déplacement ; légende de 280 caractères max ; JPEG 1 080 px max, métadonnées supprimées |
| 💬 | **Commentaires et réponses** en texte ou en **sticker** : 16 stickers On Bade (réactions, nouchi) + **stickers personnels** comme sur TikTok (créés depuis une photo, ou enregistrés en touchant le sticker d'un Badeur ; collection de 50), traits de fil, repli des réponses, suppression avec confirmation |
| 🔁 | **Rebade** direct ou avec avis · 📤 **Partage** WhatsApp, Facebook, lien dynamique, **image PNG générée** (canvas) |
| 🔖 | **Favoris**, 🎭 **mode anonyme**, @mentions avec suggestions, brouillon gardé |
| 👤 | **Profil** : statistiques qui défilent, onglets Badings / Favoris / Anonymes, **photo de profil** importée et recadrée en rond |
| 🔔 | **Notifications du navigateur** (rires, réponses) |
| ⚙️ | Paramètres : pseudo, mentions, blocages, badge vérifié, **demande de suppression du compte**, copie des données, confidentialité |
| 💻 | **Vrai rendu web** sur ordinateur : barre de navigation en haut, 3 colonnes (mon compte · fil en cartes · badings du moment), inscription en écran partagé ; barre d'onglets sur mobile |
| 📲 | **PWA installable** (Android, iPhone, ordinateur) : hors ligne, raccourcis « Bader » et « Notifications », partage de texte vers On Bade |
| 🔗 | **Liens dynamiques** `…/?b=<id>` : ils s'ouvrent dans l'app installée, sinon sur le site, directement sur le bading |
| ♿ | Clavier, focus visibles, libellés ARIA, `prefers-reduced-motion` respecté |

## 🚀 Lancer

```bash
npm install
npm run dev       # site de développement sur http://localhost:5173 (rechargement à chaud)
npm run build     # site prêt à mettre en ligne dans dist/
npm run preview   # sert dist/ pour le vérifier avant la mise en ligne
```

Réglages dans un fichier `.env` (copie de [`.env.example`](.env.example)) ; `npm run build` utilise [`.env.production`](.env.production), qui pointe vers l'API en production (`https://backend-onbade.oriverse-it.tech/api`) :

| Variable | Rôle |
|---|---|
| `VITE_API_URL` | Adresse du backend (par défaut `http://localhost:3000/api`) |
| `VITE_USE_BACKEND` | `true` : connexion et inscription par le backend Next.js ; `false` : mode démo, tout est simulé dans le navigateur (`localStorage`) |
| `VITE_BACKEND_CONTENT` | `true` (par défaut) : le fil, les commentaires, le profil… viennent aussi du backend (routes décrites dans [`API.md`](API.md)) ; `false` : seule la connexion passe par le backend |

En mode démo, crée un compte avec n'importe quel e-mail. Pour repartir de zéro : `localStorage.removeItem('jebade-web-v1')` dans la console.

## 🗂️ Structure

```
index.html                 ← page d'entrée (splash, conteneurs #app, #toast, #sheet-root)
public/                    ← fichiers servis tels quels : icônes, manifeste PWA, sw.js, data/privacy.json
src/main.jsx               ← démarrage : liens partagés, rendu de <App/>, splash GSAP, service worker
src/App.jsx                ← routes, gardes d'accès, coquille ou plein écran, transitions entre écrans
src/pages/                 ← un écran par fichier (ou par dossier pour les écrans complexes)
src/components/            ← coquille web, carte de bading et ses feuilles (menu, rebade, partage)
src/ui/                    ← briques d'affichage : icônes, avatar, feuilles, toasts, recadrage, visionneuse, chargement/erreurs
src/services/              ← lien API ↔ store : appellent le backend et rangent les réponses dans le cache
src/lib/api.js             ← client HTTP du backend (URL, jeton, erreurs, requêtes identiques regroupées)
src/lib/store.js           ← état local (cache des données du serveur) + règles métier ; démarre vide
src/lib/router.js          ← routeur par hash (#/chemin) : useLocation, go, back
src/lib/                   ← mouvement (ressorts), PWA, notifications, stickers, PDF « copie de mes données »
src/styles/style.css       ← tokens (identiques au mobile), mise en page, composants
```

**Comment les écrans parlent au backend.** Un écran n'appelle jamais `fetch` : il appelle un service (`src/services/`), qui appelle l'API puis range la réponse dans le store. L'écran s'abonne au store (`useStore()`) et se redessine tout seul. `useRemote()` (dans `src/ui/remote.jsx`) gère le chargement : une page déjà visitée s'affiche tout de suite depuis le cache et se met à jour en arrière-plan.

Les liens partagés ont la forme `…/?b=<id>` (l'ancienne forme `…/#/b/<id>` marche toujours) : sans compte, le visiteur passe par l'inscription puis arrive directement sur le bading.

## 📲 PWA

- `manifest.webmanifest` : nom, icônes, raccourcis, `share_target` (partager un texte depuis une autre app ouvre « Nouveau bading »), `launch_handler` + `handle_links` (un lien On Bade ouvre l'app déjà installée).
- `public/sw.js` : page réseau d'abord (une nouvelle version est prise tout de suite), fichiers construits et polices en cache (hors ligne, ouverture instantanée), clic sur les notifications. Actif seulement sur le site construit (`npm run build`).
- `src/lib/pwa.js` : enregistrement du service worker, bouton « Installer l'app » (invite native sur Chrome/Edge/Android, mode d'emploi sur iPhone), lecture des liens `?b=` et des partages.
- L'installation demande **HTTPS** (ou `localhost`).

---

<div align="center">

**On Bade** · une app **ORIVERSE** · Créée par **Jean Emmanuel Ahossi** — [portfolio](https://jeanemmanuel-portfolio-gamma.vercel.app/)

</div>

## Tests

Tests avec [Vitest](https://vitest.dev) (navigateur simulé par jsdom).

```bash
npm test            # une fois
npm run test:watch  # en continu
```

| Fichier | Ce qui est vérifié |
| --- | --- |
| `tests/store.test.js` | Règles de publication (10–1 000 caractères, légende 280, mots interdits, 5 mentions, 20 par jour), anonymat, rires, vues, partages, favoris, rebades, commentaires et stickers (collection de 50), compte (mot de passe haché, photo, pseudo, blocage, suppression), conditions du badge, copie des données, formats |
| `tests/migrations.test.js` | Les données gardées dans le navigateur survivent à un rechargement et aux changements de version |
| `tests/pdf.test.js` | Générateur PDF (encodage des accents, structure du fichier, coupure des lignes) et PDF « copie de mes données » |
| `tests/helpers.test.jsx` | Choix d’image (formats, 10 Mo), stickers, échappement du HTML, avatars |
| `tests/app.test.jsx` | Parcours complet de l’app React en mode démo : accueil, inscription, fil, rire, commentaire, publication, profil, notifications, paramètres, déconnexion |
| `tests/backend.test.jsx` | L’app branchée sur un faux backend : connexion, fil chargé du serveur, rire envoyé, bading introuvable (404), erreur serveur puis « Réessayer » |
